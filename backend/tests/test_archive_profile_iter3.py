"""
Iteration 3 backend tests:
 - Archived exclusion on public endpoints (/public/overview, /public/badges, /public/leaders)
 - /api/members archived defaults + include_archived + status filters
 - /api/chapters/{id} leaders filtered to status=active
 - PUT /api/users/{uid}/public-profile national_admin-only (403 for others)
 - Split registration (scout/leader) -> pending + approval flow materializes member
 - Galleries multi-image upload + /public/galleries trimming
"""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@scouts.am", "admin123"),
    "chapter_admin": ("ararat.leader@scouts.am", "scout123"),
    "chapter_leader": ("sevan.leader@scouts.am", "scout123"),
    "scout": ("narek@scouts.am", "scout123"),
}

PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="


def _token(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {email}: {r.status_code} {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok, "no access_token in login response"
    return tok


def _client(role):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {_token(*CREDS[role])}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _client("admin")


@pytest.fixture(scope="module")
def chap_admin():
    return _client("chapter_admin")


@pytest.fixture(scope="module")
def chap_leader():
    return _client("chapter_leader")


@pytest.fixture(scope="module")
def scout():
    return _client("scout")


@pytest.fixture(scope="module")
def chapters(admin):
    r = admin.get(f"{API}/chapters", timeout=30)
    assert r.status_code == 200
    return r.json()


# ---------------- Login for all seeded users ----------------
@pytest.mark.parametrize("role", list(CREDS.keys()))
def test_seeded_logins(role):
    email, pwd = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d["email"] == email
    assert d["status"] == "active"
    assert isinstance(d["access_token"], str) and len(d["access_token"]) > 10


# ---------------- Archived chapters excluded from /public/overview ----------------
class TestPublicOverviewArchived:
    def test_archived_chapter_hidden(self, admin):
        cid = None
        try:
            r = admin.post(f"{API}/chapters", json={"name": f"TEST_ArchChapter_{uuid.uuid4().hex[:6]}",
                                                    "location": "TESTLOC"}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            cid = r.json()["chapter_id"]

            ov = requests.get(f"{API}/public/overview", timeout=30).json()
            ids = [c["chapter_id"] for c in ov["chapters"]]
            assert cid in ids, "newly created active chapter should be public"
            before_count = ov["stats"]["chapters"]

            a = admin.post(f"{API}/chapters/{cid}/archive", timeout=30)
            assert a.status_code == 200, a.text[:300]

            ov2 = requests.get(f"{API}/public/overview", timeout=30).json()
            ids2 = [c["chapter_id"] for c in ov2["chapters"]]
            assert cid not in ids2, "archived chapter still visible on /public/overview"
            assert ov2["stats"]["chapters"] == before_count - 1
        finally:
            if cid:
                admin.delete(f"{API}/chapters/{cid}", timeout=30)

    def test_archived_badge_excluded_from_overview_count_and_public_badges(self, admin):
        bid = None
        try:
            r = admin.post(f"{API}/badges", json={"name": f"TEST_ArchBadge_{uuid.uuid4().hex[:6]}",
                                                  "section": "Scouts"}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            bid = r.json()["badge_id"]

            pb = requests.get(f"{API}/public/badges", timeout=30).json()
            assert bid in [b["badge_id"] for b in pb]
            before_badges = requests.get(f"{API}/public/overview", timeout=30).json()["stats"]["badges"]

            a = admin.post(f"{API}/badges/{bid}/archive", timeout=30)
            assert a.status_code == 200, a.text[:300]

            pb2 = requests.get(f"{API}/public/badges", timeout=30).json()
            assert bid not in [b["badge_id"] for b in pb2], "archived badge visible on /public/badges"
            after_badges = requests.get(f"{API}/public/overview", timeout=30).json()["stats"]["badges"]
            assert after_badges == before_badges - 1, "total_badges did not exclude archived badge"
        finally:
            if bid:
                admin.delete(f"{API}/badges/{bid}", timeout=30)


# ---------------- /public/leaders only active users ----------------
class TestPublicLeaders:
    def test_all_returned_leaders_are_active_roles(self):
        r = requests.get(f"{API}/public/leaders", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        for it in items:
            assert it["role"] in ("national_admin", "chapter_admin", "chapter_leader"), it
            assert "user_id" in it and "name" in it
            assert "password_hash" not in it

    def test_archived_leader_excluded(self, admin, chapters):
        cid = chapters[0]["chapter_id"]
        uid = None
        email = f"test_arch_leader_{uuid.uuid4().hex[:6]}@scouts.am"
        try:
            reg = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Arch Leader",
                "chapter_id": cid, "signup_type": "leader", "requested_role": "chapter_leader",
            }, timeout=30)
            assert reg.status_code == 200, reg.text[:300]
            uid = reg.json()["user_id"]
            assert admin.post(f"{API}/users/{uid}/approve", timeout=30).status_code == 200

            leaders = requests.get(f"{API}/public/leaders", timeout=30).json()
            assert uid in [x["user_id"] for x in leaders], "approved leader missing from /public/leaders"

            # single-leader endpoint works while active
            assert requests.get(f"{API}/public/leaders/{uid}", timeout=30).status_code == 200

            assert admin.post(f"{API}/users/{uid}/archive", timeout=30).status_code == 200
            leaders2 = requests.get(f"{API}/public/leaders", timeout=30).json()
            assert uid not in [x["user_id"] for x in leaders2], "archived leader still on /public/leaders"
            assert requests.get(f"{API}/public/leaders/{uid}", timeout=30).status_code == 404

            # chapter detail leaders list must also exclude archived
            ch = requests.get(f"{API}/chapters/{cid}", timeout=30).json()
            assert uid not in [x["user_id"] for x in ch.get("leaders", [])], \
                "archived leader still in /chapters/{id} leaders"
        finally:
            if uid:
                admin.delete(f"{API}/users/{uid}", timeout=30)


# ---------------- /chapters/{id} leaders active only ----------------
def test_chapter_detail_leaders_all_active(admin, chapters):
    for c in chapters[:3]:
        r = requests.get(f"{API}/chapters/{c['chapter_id']}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("leaders"), list)
        for lead in d["leaders"]:
            # skip transient users created by the concurrent archive test
            if str(lead.get("email", "")).startswith("test_"):
                continue
            assert lead.get("status") == "active", lead
            assert lead["role"] in ("chapter_admin", "chapter_leader")
            assert "password_hash" not in lead


# ---------------- /members archive filters ----------------
class TestMembersArchiveFilters:
    @pytest.fixture(scope="class")
    def archived_member(self, admin, chapters):
        cid = chapters[0]["chapter_id"]
        r = admin.post(f"{API}/members", json={
            "full_name": f"TEST_ArchMember_{uuid.uuid4().hex[:6]}", "chapter_id": cid,
            "section": "Scouts", "status": "archived",
        }, timeout=30)
        assert r.status_code == 200, r.text[:300]
        mid = r.json()["member_id"]
        yield mid
        admin.delete(f"{API}/members/{mid}", timeout=30)

    def test_default_excludes_archived(self, admin, archived_member):
        r = admin.get(f"{API}/members", timeout=30)
        assert r.status_code == 200
        ids = [m["member_id"] for m in r.json()]
        assert archived_member not in ids, "archived member returned by default /api/members"
        assert all(m.get("status") != "archived" for m in r.json())

    def test_include_archived_true(self, admin, archived_member):
        r = admin.get(f"{API}/members", params={"include_archived": "true"}, timeout=30)
        assert r.status_code == 200
        ids = [m["member_id"] for m in r.json()]
        assert archived_member in ids, "include_archived=true did not return archived member"

    def test_status_archived_only(self, admin, archived_member):
        r = admin.get(f"{API}/members", params={"status": "archived"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert archived_member in [m["member_id"] for m in data]
        assert all(m["status"] == "archived" for m in data)


# ---------------- PUT /users/{uid}/public-profile authz ----------------
class TestPublicProfileAuthz:
    @pytest.fixture(scope="class")
    def target_leader(self, chap_admin):
        r = requests.post(f"{API}/auth/login", json={"email": CREDS["chapter_admin"][0],
                                                     "password": CREDS["chapter_admin"][1]}, timeout=30)
        assert r.status_code == 200
        return r.json()  # ararat.leader (chapter_admin, chp_ararat)

    def test_national_admin_can_update(self, admin, target_leader):
        uid = target_leader["user_id"]
        orig = requests.get(f"{API}/public/leaders/{uid}", timeout=30).json()
        payload = {"name": "TEST Ararat Leader", "position_title": "TEST Chapter President",
                   "phone": "+37411000111", "bio": "TEST bio text", "picture": PNG}
        r = admin.put(f"{API}/users/{uid}/public-profile", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "password_hash" not in d and "_id" not in d
        for k in ("name", "position_title", "phone", "bio", "picture"):
            assert d[k] == payload[k], f"{k} not updated"
        # verify persistence via public endpoint
        pub = requests.get(f"{API}/public/leaders/{uid}", timeout=30).json()
        assert pub["name"] == payload["name"]
        assert pub["position_title"] == payload["position_title"]
        # restore
        admin.put(f"{API}/users/{uid}/public-profile", json={
            "name": orig.get("name") or "Ararat Leader",
            "position_title": orig.get("position_title") or "",
            "phone": orig.get("phone") or "",
            "bio": orig.get("bio") or "",
        }, timeout=30)

    def test_chapter_admin_forbidden_same_chapter(self, chap_admin, target_leader):
        # chapter_admin editing themselves / own chapter leader -> must be 403
        r = chap_admin.put(f"{API}/users/{target_leader['user_id']}/public-profile",
                           json={"bio": "hacked by chapter admin"}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_self_edit_forbidden(self, chap_leader):
        me = requests.get(f"{API}/auth/me", headers=chap_leader.headers, timeout=30)
        assert me.status_code == 200
        uid = me.json()["user_id"]
        r = chap_leader.put(f"{API}/users/{uid}/public-profile", json={"bio": "self edit"}, timeout=30)
        assert r.status_code == 403, f"expected 403 self-edit, got {r.status_code}"

    def test_scout_forbidden(self, scout, target_leader):
        r = scout.put(f"{API}/users/{target_leader['user_id']}/public-profile",
                      json={"bio": "scout edit"}, timeout=30)
        assert r.status_code == 403

    def test_unauthenticated_forbidden(self, target_leader):
        r = requests.put(f"{API}/users/{target_leader['user_id']}/public-profile",
                         json={"bio": "anon"}, timeout=30)
        assert r.status_code in (401, 403)

    def test_nonexistent_user_404(self, admin):
        r = admin.put(f"{API}/users/usr_does_not_exist/public-profile", json={"bio": "x"}, timeout=30)
        assert r.status_code == 404


# ---------------- Split registration + approval ----------------
class TestSplitRegistration:
    def test_scout_signup_pending_then_approve_creates_member(self, admin, chapters):
        cid = chapters[0]["chapter_id"]
        email = f"test_scout_{uuid.uuid4().hex[:6]}@scouts.am"
        uid = None
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Scout Signup",
                "chapter_id": cid, "signup_type": "scout", "section": "Cubs",
                "dob": "2012-05-01", "gender": "male", "phone": "+37411222333",
                "guardian_name": "TEST Guardian",
            }, timeout=30)
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            uid = d["user_id"]
            assert d["status"] == "pending"
            assert d["role"] == "scout"

            # cannot login while pending
            lg = requests.post(f"{API}/auth/login", json={"email": email, "password": "scout123"}, timeout=30)
            assert lg.status_code == 403, f"pending user should not login, got {lg.status_code}"

            # no member yet
            members = admin.get(f"{API}/members", params={"include_archived": "true"}, timeout=30).json()
            assert email not in [m.get("email") for m in members], "member created before approval"

            # in pending queue
            pending = admin.get(f"{API}/users/pending", timeout=30).json()
            assert uid in [u["user_id"] for u in pending]

            # approve
            ap = admin.post(f"{API}/users/{uid}/approve", timeout=30)
            assert ap.status_code == 200, ap.text[:300]

            members2 = admin.get(f"{API}/members", timeout=30).json()
            match = [m for m in members2 if m.get("email") == email]
            assert match, "member not materialized after approval"
            assert match[0]["section"] == "Cubs"
            assert match[0]["chapter_id"] == cid
            assert match[0]["guardian_name"] == "TEST Guardian"

            # can login now
            lg2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "scout123"}, timeout=30)
            assert lg2.status_code == 200, lg2.text[:300]
            assert lg2.json()["role"] == "scout"
            assert lg2.json()["status"] == "active"

            admin.delete(f"{API}/members/{match[0]['member_id']}", timeout=30)
        finally:
            if uid:
                admin.delete(f"{API}/users/{uid}", timeout=30)

    def test_leader_signup_pending_and_role_on_approval(self, admin, chapters):
        cid = chapters[1]["chapter_id"] if len(chapters) > 1 else chapters[0]["chapter_id"]
        email = f"test_leader_{uuid.uuid4().hex[:6]}@scouts.am"
        uid = None
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Leader Signup",
                "chapter_id": cid, "signup_type": "leader", "requested_role": "chapter_leader",
            }, timeout=30)
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            uid = d["user_id"]
            assert d["status"] == "pending"
            assert d["signup_type"] == "leader"

            lg = requests.post(f"{API}/auth/login", json={"email": email, "password": "scout123"}, timeout=30)
            assert lg.status_code == 403

            ap = admin.post(f"{API}/users/{uid}/approve", timeout=30)
            assert ap.status_code == 200, ap.text[:300]

            lg2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "scout123"}, timeout=30)
            assert lg2.status_code == 200
            assert lg2.json()["role"] == "chapter_leader", lg2.json()

            # leader signup must NOT create a member record
            members = admin.get(f"{API}/members", params={"include_archived": "true"}, timeout=30).json()
            assert email not in [m.get("email") for m in members], "leader signup created a member"
        finally:
            if uid:
                admin.delete(f"{API}/users/{uid}", timeout=30)

    def test_duplicate_email_rejected(self, chapters):
        r = requests.post(f"{API}/auth/register", json={
            "email": CREDS["admin"][0], "password": "whatever123", "name": "TEST Dup",
            "chapter_id": chapters[0]["chapter_id"], "signup_type": "scout",
        }, timeout=30)
        assert r.status_code in (400, 409), r.status_code


# ---------------- Galleries ----------------
class TestGalleries:
    def test_create_gallery_and_add_three_images(self, admin, chapters):
        gid = None
        try:
            r = admin.post(f"{API}/galleries", json={
                "title": f"TEST_Gallery_{uuid.uuid4().hex[:6]}",
                "description": "TEST gallery",
                "chapter_id": chapters[0]["chapter_id"],
            }, timeout=60)
            assert r.status_code == 200, r.text[:300]
            g = r.json()
            gid = g["gallery_id"]
            assert "_id" not in g
            assert not g.get("cover")

            imgs = [{"data": PNG, "caption": f"TEST cap {i}"} for i in range(3)]
            r2 = admin.post(f"{API}/galleries/{gid}/images", json={"images": imgs}, timeout=60)
            assert r2.status_code == 200, r2.text[:300]
            d = r2.json()
            assert "_id" not in d
            assert len(d["images"]) == 3, f"expected 3 images, got {len(d['images'])}"
            assert d["cover"] == PNG, "cover not set from first image"
            assert [i["caption"] for i in d["images"]] == ["TEST cap 0", "TEST cap 1", "TEST cap 2"]

            # persistence
            g2 = admin.get(f"{API}/galleries/{gid}", timeout=60).json()
            assert len(g2["images"]) == 3

            # public listing
            pub = requests.get(f"{API}/public/galleries", timeout=60)
            assert pub.status_code == 200
            pdata = pub.json()
            assert len(pdata) > 0, "/public/galleries empty"
            for pg in pdata:
                assert len(pg.get("images", [])) <= 12, "public gallery images not trimmed to 12"
            mine = [x for x in pdata if x["gallery_id"] == gid]
            assert mine and len(mine[0]["images"]) == 3

            # delete one image
            r3 = admin.delete(f"{API}/galleries/{gid}/images/0", timeout=60)
            assert r3.status_code == 200
            g3 = admin.get(f"{API}/galleries/{gid}", timeout=60).json()
            assert len(g3["images"]) == 2
        finally:
            if gid:
                admin.delete(f"{API}/galleries/{gid}", timeout=60)

    def test_public_galleries_trims_to_12(self, admin, chapters):
        gid = None
        try:
            r = admin.post(f"{API}/galleries", json={
                "title": f"TEST_Trim_{uuid.uuid4().hex[:6]}", "description": "",
                "chapter_id": chapters[0]["chapter_id"]}, timeout=60)
            assert r.status_code == 200
            gid = r.json()["gallery_id"]
            imgs = [{"data": PNG, "caption": str(i)} for i in range(15)]
            r2 = admin.post(f"{API}/galleries/{gid}/images", json={"images": imgs}, timeout=60)
            assert r2.status_code == 200
            assert len(r2.json()["images"]) == 15
            pub = requests.get(f"{API}/public/galleries", timeout=60).json()
            mine = [x for x in pub if x["gallery_id"] == gid]
            assert mine, "gallery not in public list"
            assert len(mine[0]["images"]) == 12, f"expected trim to 12, got {len(mine[0]['images'])}"
        finally:
            if gid:
                admin.delete(f"{API}/galleries/{gid}", timeout=60)

    def test_scout_cannot_create_gallery(self, scout, chapters):
        r = scout.post(f"{API}/galleries", json={"title": "TEST_scout_gal", "description": "",
                                                 "chapter_id": chapters[0]["chapter_id"]}, timeout=30)
        assert r.status_code == 403
