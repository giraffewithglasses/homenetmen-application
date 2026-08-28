"""
Iteration 4 backend tests (scoped follow-ups):
 - NEW GET /api/public/resources (no auth, non-archived, no file_data)
 - NEW GET /api/public/resources/{rid} (no auth, file_data present, 404 for archived/missing)
 - NEW POST /api/members/{id}/unarchive (national_admin, chapter_admin own/other chapter)
 - GET /api/trash includes members with chapter scoping
 - seed idempotency: three seeded leader accounts authenticate
 - GET /api/search excludes archived chapters / badges / members
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
    "ararat_admin": ("ararat.leader@scouts.am", "scout123"),
    "sevan_leader": ("sevan.leader@scouts.am", "scout123"),
    "gyumri_admin": ("gyumri.leader@scouts.am", "scout123"),
}

B64 = "aGVsbG8gc2NvdXRz"  # "hello scouts"


def _token(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {email}: {r.status_code} {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok, f"no access_token for {email}"
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
def ararat_admin():
    return _client("ararat_admin")


@pytest.fixture(scope="module")
def gyumri_admin():
    return _client("gyumri_admin")


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- seed idempotency (light check) ----------
class TestSeedLogins:
    @pytest.mark.parametrize("role", ["admin", "ararat_admin", "sevan_leader", "gyumri_admin"])
    def test_seed_account_login(self, role):
        email, pwd = CREDS[role]
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert r.status_code == 200, f"{email} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("access_token")
        assert (data.get("user") or data).get("email") == email

    def test_ensure_seed_users_present_is_idempotent_reimport(self):
        """Call the internal ensure function directly after deleting a seeded user."""
        import asyncio
        import sys
        sys.path.insert(0, "/app/backend")
        import server  # noqa

        async def run():
            await server.db.users.delete_one({"email": "sevan.leader@scouts.am"})
            gone = await server.db.users.find_one({"email": "sevan.leader@scouts.am"})
            assert gone is None
            await server.ensure_seed_users_present()
            back = await server.db.users.find_one({"email": "sevan.leader@scouts.am"})
            assert back is not None
            assert back["password_hash"].startswith("$2b$"), back["password_hash"][:10]
            return back

        doc = asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())
        assert doc["role"] == "chapter_leader"
        # login works again
        r = requests.post(f"{API}/auth/login",
                          json={"email": "sevan.leader@scouts.am", "password": "scout123"}, timeout=30)
        assert r.status_code == 200, r.text[:300]


# ---------- public resources ----------
class TestPublicResources:
    def test_public_resources_no_auth(self, admin, anon):
        title = f"TEST_res_{uuid.uuid4().hex[:6]}"
        cr = admin.post(f"{API}/resources", json={
            "title": title, "category": "Manuals", "description": "TEST_desc",
            "file_data": B64, "file_name": "test.txt", "file_type": "text/plain"})
        assert cr.status_code == 200, cr.text[:300]
        rid = cr.json()["resource_id"]
        assert "file_data" not in cr.json()
        try:
            lr = anon.get(f"{API}/public/resources")
            assert lr.status_code == 200, lr.text[:300]
            items = lr.json()
            assert isinstance(items, list)
            match = [i for i in items if i["resource_id"] == rid]
            assert match, "created resource missing from /public/resources"
            assert "file_data" not in match[0], "file_data blob leaked in listing"
            assert "_id" not in match[0]
            assert match[0]["title"] == title

            # download endpoint includes file_data
            dr = anon.get(f"{API}/public/resources/{rid}")
            assert dr.status_code == 200, dr.text[:300]
            d = dr.json()
            assert d["file_data"] == B64
            assert d["file_name"] == "test.txt"
            assert "_id" not in d

            # category filter
            cf = anon.get(f"{API}/public/resources", params={"category": "Manuals"})
            assert cf.status_code == 200
            assert all(i["category"] == "Manuals" for i in cf.json())

            # archived resource -> excluded + 404 on download
            ar = admin.post(f"{API}/resources/{rid}/archive")
            assert ar.status_code == 200, ar.text[:300]
            lr2 = anon.get(f"{API}/public/resources")
            assert lr2.status_code == 200
            assert not [i for i in lr2.json() if i["resource_id"] == rid], "archived resource still public"
            dr2 = anon.get(f"{API}/public/resources/{rid}")
            assert dr2.status_code == 404, dr2.status_code
        finally:
            admin.delete(f"{API}/resources/{rid}")

    def test_public_resource_missing_404(self, anon):
        r = anon.get(f"{API}/public/resources/res_does_not_exist")
        assert r.status_code == 404


# ---------- member unarchive + trash ----------
def _create_member(client, chapter_id, name):
    r = client.post(f"{API}/members", json={"full_name": name, "chapter_id": chapter_id,
                                            "section": "Scouts", "status": "active"})
    assert r.status_code == 200, r.text[:300]
    return r.json()["member_id"]


class TestMemberUnarchive:
    def test_national_admin_unarchive_and_listing(self, admin):
        mid = _create_member(admin, "chp_ararat", f"TEST_unarch_{uuid.uuid4().hex[:6]}")
        try:
            assert admin.delete(f"{API}/members/{mid}").status_code == 200
            ids = [m["member_id"] for m in admin.get(f"{API}/members").json()]
            assert mid not in ids, "archived member still in default listing"

            tr = admin.get(f"{API}/trash")
            assert tr.status_code == 200, tr.text[:300]
            body = tr.json()
            assert "members" in body and isinstance(body["members"], list)
            assert mid in [m["member_id"] for m in body["members"]], "archived member missing from trash"

            ur = admin.post(f"{API}/members/{mid}/unarchive")
            assert ur.status_code == 200, ur.text[:300]
            got = admin.get(f"{API}/members/{mid}").json()
            assert got["status"] == "active"
            ids2 = [m["member_id"] for m in admin.get(f"{API}/members").json()]
            assert mid in ids2, "unarchived member not back in listing"
            assert mid not in [m["member_id"] for m in admin.get(f"{API}/trash").json()["members"]]
        finally:
            admin.delete(f"{API}/members/{mid}")

    def test_unarchive_404_for_missing(self, admin):
        r = admin.post(f"{API}/members/mbr_missing_x/unarchive")
        assert r.status_code == 404

    def test_chapter_admin_scoping(self, admin, ararat_admin, gyumri_admin):
        mid = _create_member(admin, "chp_ararat", f"TEST_scope_{uuid.uuid4().hex[:6]}")
        try:
            assert admin.delete(f"{API}/members/{mid}").status_code == 200
            # other chapter admin -> 403
            other = gyumri_admin.post(f"{API}/members/{mid}/unarchive")
            assert other.status_code == 403, f"expected 403, got {other.status_code}"
            # own chapter admin -> 200
            own = ararat_admin.post(f"{API}/members/{mid}/unarchive")
            assert own.status_code == 200, own.text[:300]
            assert admin.get(f"{API}/members/{mid}").json()["status"] == "active"
        finally:
            admin.delete(f"{API}/members/{mid}")

    def test_trash_chapter_scoping(self, admin, ararat_admin, gyumri_admin):
        a_mid = _create_member(admin, "chp_ararat", f"TEST_trash_a_{uuid.uuid4().hex[:6]}")
        g_mid = _create_member(admin, "chp_gyumri", f"TEST_trash_g_{uuid.uuid4().hex[:6]}")
        try:
            admin.delete(f"{API}/members/{a_mid}")
            admin.delete(f"{API}/members/{g_mid}")
            a_trash = ararat_admin.get(f"{API}/trash")
            assert a_trash.status_code == 200, a_trash.text[:300]
            a_ids = [m["member_id"] for m in a_trash.json()["members"]]
            assert a_mid in a_ids
            assert g_mid not in a_ids, "chapter_admin sees other chapter archived member"
            assert all(m["chapter_id"] == "chp_ararat" for m in a_trash.json()["members"])

            n_ids = [m["member_id"] for m in admin.get(f"{API}/trash").json()["members"]]
            assert a_mid in n_ids and g_mid in n_ids, "national_admin trash missing members"
        finally:
            admin.delete(f"{API}/members/{a_mid}")
            admin.delete(f"{API}/members/{g_mid}")


# ---------- search archive exclusion ----------
class TestSearchArchiveExclusion:
    def test_search_excludes_archived_member(self, admin):
        uniq = uuid.uuid4().hex[:8]
        name = f"TEST_srch_{uniq}"
        mid = _create_member(admin, "chp_ararat", name)
        try:
            r = admin.get(f"{API}/search", params={"q": name})
            assert r.status_code == 200, r.text[:300]
            assert mid in [m["member_id"] for m in r.json()["members"]]
            admin.delete(f"{API}/members/{mid}")
            r2 = admin.get(f"{API}/search", params={"q": name})
            assert r2.status_code == 200
            assert mid not in [m["member_id"] for m in r2.json()["members"]], "archived member in search"
        finally:
            admin.delete(f"{API}/members/{mid}")

    def test_search_excludes_archived_badge(self, admin):
        uniq = uuid.uuid4().hex[:8]
        name = f"TEST_bdg_{uniq}"
        cr = admin.post(f"{API}/badges", json={"name": name, "section": "Scouts",
                                               "description": "TEST", "requirements": []})
        assert cr.status_code == 200, cr.text[:300]
        bid = cr.json()["badge_id"]
        try:
            r = admin.get(f"{API}/search", params={"q": name})
            assert bid in [b["badge_id"] for b in r.json()["badges"]]
            ar = admin.post(f"{API}/badges/{bid}/archive")
            assert ar.status_code == 200, ar.text[:300]
            r2 = admin.get(f"{API}/search", params={"q": name})
            assert bid not in [b["badge_id"] for b in r2.json()["badges"]], "archived badge in search"
        finally:
            admin.delete(f"{API}/badges/{bid}")

    def test_search_excludes_archived_chapter(self, admin):
        uniq = uuid.uuid4().hex[:8]
        name = f"TEST_chp_{uniq}"
        cr = admin.post(f"{API}/chapters", json={"name": name, "name_hy": name,
                                                 "location": "TEST", "description": "TEST"})
        assert cr.status_code == 200, cr.text[:300]
        cid = cr.json()["chapter_id"]
        try:
            r = admin.get(f"{API}/search", params={"q": name})
            assert cid in [c["chapter_id"] for c in r.json()["chapters"]]
            assert admin.post(f"{API}/chapters/{cid}/archive").status_code == 200
            r2 = admin.get(f"{API}/search", params={"q": name})
            assert cid not in [c["chapter_id"] for c in r2.json()["chapters"]], "archived chapter in search"
        finally:
            admin.delete(f"{API}/chapters/{cid}")


# ---------- cleanup: hard-remove TEST_ members (DELETE /members only archives) ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_members():
    yield
    from pymongo import MongoClient
    env = dotenv_values("/app/backend/.env")
    client = MongoClient(env["MONGO_URL"])
    dbx = client[env["DB_NAME"]]
    dbx.members.delete_many({"full_name": {"$regex": "^TEST_"}})
    dbx.resources.delete_many({"title": {"$regex": "^TEST_"}})
    client.close()
