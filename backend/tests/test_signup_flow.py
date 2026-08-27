"""Feature-batch tests: google complete-profile bug fix, 2-tab register + approval,
programs level/capacity/waitlist, member role sync, parent invite, password change, trash, public endpoints."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
JWT_SECRET = backend_env["JWT_SECRET"]
MONGO_URL = backend_env["MONGO_URL"]
DB_NAME = backend_env["DB_NAME"]

CHP = "chp_ararat"


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:300]}"
    return r.json()["access_token"]


def mk_token(uid, email):
    return jwt.encode(
        {"sub": uid, "email": email, "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(hours=2)},
        JWT_SECRET, algorithm="HS256")


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def admin_token():
    return login("admin@scouts.am", "admin123")


@pytest.fixture(scope="module")
def ararat_admin_token():
    return login("ararat.leader@scouts.am", "scout123")


@pytest.fixture(scope="module")
def sevan_leader_token():
    return login("sevan.leader@scouts.am", "scout123")


@pytest.fixture(scope="module")
def scout_token():
    return login("narek@scouts.am", "scout123")


def cleanup(mongo, emails=(), program_ids=(), member_ids=()):
    for e in emails:
        u = mongo.users.find_one({"email": e})
        if u:
            mongo.notifications.delete_many({"user_id": u["user_id"]})
            mongo.program_registrations.delete_many({"user_id": u["user_id"]})
        mongo.users.delete_many({"email": e})
        mongo.members.delete_many({"email": e})
    for p in program_ids:
        mongo.programs.delete_many({"program_id": p})
        mongo.program_registrations.delete_many({"program_id": p})
    for m in member_ids:
        mongo.members.delete_many({"member_id": m})


# ---------- Public / guest endpoints ----------
class TestPublicEndpoints:
    @pytest.mark.parametrize("path", [
        "/public/overview", "/public/badges", "/public/newsletters",
        "/public/programs/upcoming", "/public/announcements",
    ])
    def test_public_no_auth(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, (list, dict))
        if path == "/public/overview":
            assert "stats" in data and "chapters" in data
            assert data["stats"]["chapters"] >= 1
            assert isinstance(data["stats"]["members"], int)


# ---------- Google auth + complete-profile (primary bug fix) ----------
class TestGoogleCompleteProfile:
    def test_session_bad_id_returns_401(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "totally-bogus-session-id"})
        assert r.status_code in (401, 500), f"unexpected {r.status_code}: {r.text[:300]}"
        assert r.status_code == 401, f"expected 401 for invalid session, got {r.status_code}"

    def test_session_endpoint_code_sets_profile_incomplete(self):
        src = open("/app/backend/server.py").read()
        seg = src.split('@api.post("/auth/session")')[1].split('@api.post("/auth/complete-profile")')[0]
        assert '"status": "profile_incomplete"' in seg
        assert '"chapter_id": None' in seg

    def test_google_scout_complete_profile_then_approve(self, mongo, admin_token):
        email = f"test_gscout_{uuid.uuid4().hex[:6]}@example.com"
        uid = "usr_test_" + uuid.uuid4().hex[:8]
        cleanup(mongo, emails=[email])
        mongo.users.insert_one({
            "user_id": uid, "email": email, "name": "TEST Google Scout",
            "picture": "", "role": "scout", "chapter_id": None,
            "status": "profile_incomplete", "signup_type": "scout",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        tok = mk_token(uid, email)
        try:
            r = requests.get(f"{API}/auth/me", headers=hdr(tok))
            assert r.status_code == 200, r.text[:300]
            assert r.json()["status"] == "profile_incomplete"
            assert r.json().get("chapter_id") is None

            payload = {
                "chapter_id": CHP, "signup_type": "scout", "full_name_hy": "Թեստ",
                "dob": "2010-05-04", "gender": "male", "phone": "+37411223344",
                "section": "Scouts", "patrol": "Eagles",
                "guardian_name": "TEST Guardian", "guardian_phone": "+37499887766",
                "emergency_contact": "TEST Emergency 112",
            }
            r = requests.post(f"{API}/auth/complete-profile", headers=hdr(tok), json=payload)
            assert r.status_code == 200, r.text[:300]
            assert r.json()["status"] == "pending"

            me = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
            assert me["status"] == "pending"
            assert me["chapter_id"] == CHP
            prof = me.get("pending_member_profile")
            assert prof, "pending_member_profile missing after complete-profile"
            assert prof["dob"] == "2010-05-04"
            assert prof["guardian_name"] == "TEST Guardian"
            assert prof["section"] == "Scouts"

            # visible in pending list
            pend = requests.get(f"{API}/users/pending", headers=hdr(admin_token)).json()
            assert any(u["user_id"] == uid for u in pend)

            # approve -> member materialised
            r = requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_token))
            assert r.status_code == 200, r.text[:300]
            me = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
            assert me["status"] == "active"
            assert me["role"] == "scout"
            assert not me.get("pending_member_profile")

            mem = requests.get(f"{API}/members", headers=hdr(admin_token),
                               params={"chapter_id": CHP})
            assert mem.status_code == 200, mem.text[:300]
            match = [m for m in mem.json() if m.get("email") == email]
            assert match, "member record not created on approve"
            m = match[0]
            assert m["full_name"] == "TEST Google Scout"
            assert m["dob"] == "2010-05-04"
            assert m["guardian_phone"] == "+37499887766"
            assert m["emergency_contact"] == "TEST Emergency 112"
            assert m["chapter_id"] == CHP
        finally:
            cleanup(mongo, emails=[email])

    def test_google_leader_complete_profile_then_approve(self, mongo, admin_token):
        email = f"test_gleader_{uuid.uuid4().hex[:6]}@example.com"
        uid = "usr_test_" + uuid.uuid4().hex[:8]
        cleanup(mongo, emails=[email])
        mongo.users.insert_one({
            "user_id": uid, "email": email, "name": "TEST Google Leader",
            "picture": "", "role": "scout", "chapter_id": None,
            "status": "profile_incomplete", "signup_type": "scout",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        tok = mk_token(uid, email)
        try:
            r = requests.post(f"{API}/auth/complete-profile", headers=hdr(tok), json={
                "chapter_id": CHP, "signup_type": "leader", "requested_role": "chapter_leader"})
            assert r.status_code == 200, r.text[:300]
            me = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
            assert me["status"] == "pending"
            assert me["requested_role"] == "chapter_leader"
            assert me.get("pending_member_profile") in (None, {})

            r = requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_token))
            assert r.status_code == 200, r.text[:300]
            me = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
            assert me["status"] == "active"
            assert me["role"] == "chapter_leader", f"role not upgraded: {me['role']}"
        finally:
            cleanup(mongo, emails=[email])

    def test_complete_profile_rejected_for_active_user(self, admin_token):
        r = requests.post(f"{API}/auth/complete-profile", headers=hdr(admin_token),
                          json={"chapter_id": CHP, "signup_type": "scout"})
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"
        assert "already complete" in r.text.lower()

    def test_complete_profile_invalid_chapter(self, mongo):
        email = f"test_gbad_{uuid.uuid4().hex[:6]}@example.com"
        uid = "usr_test_" + uuid.uuid4().hex[:8]
        mongo.users.insert_one({
            "user_id": uid, "email": email, "name": "TEST Bad Chapter",
            "role": "scout", "chapter_id": None, "status": "profile_incomplete",
            "created_at": datetime.now(timezone.utc).isoformat()})
        try:
            r = requests.post(f"{API}/auth/complete-profile", headers=hdr(mk_token(uid, email)),
                              json={"chapter_id": "chp_does_not_exist", "signup_type": "scout"})
            assert r.status_code == 400
        finally:
            cleanup(mongo, emails=[email])

    def test_complete_profile_requires_auth(self):
        r = requests.post(f"{API}/auth/complete-profile", json={"chapter_id": CHP})
        assert r.status_code == 401


# ---------- Two-tab register + approval flow ----------
class TestRegisterApproval:
    def test_scout_register_pending_then_approve_creates_member(self, mongo, admin_token):
        email = f"test_scout_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        body = {
            "email": email, "password": "scout123", "name": "TEST Reg Scout",
            "chapter_id": CHP, "signup_type": "scout", "full_name_hy": "Ռեգ",
            "dob": "2011-01-02", "gender": "female", "phone": "+3741111",
            "section": "Cubs", "patrol": "Wolves", "guardian_name": "TEST G",
            "guardian_phone": "+3742222", "emergency_contact": "TEST EC",
        }
        try:
            r = requests.post(f"{API}/auth/register", json=body)
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            assert d["status"] == "pending"
            uid = d["user_id"]

            # pending login blocked
            lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "scout123"})
            assert lr.status_code == 403, lr.status_code
            assert "approval" in lr.text.lower()

            # duplicate email
            dup = requests.post(f"{API}/auth/register", json=body)
            assert dup.status_code == 400

            r = requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_token))
            assert r.status_code == 200, r.text[:300]

            tok = login(email, "scout123")
            me = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
            assert me["status"] == "active" and me["role"] == "scout"

            members = requests.get(f"{API}/members", headers=hdr(admin_token),
                                   params={"chapter_id": CHP}).json()
            match = [m for m in members if m.get("email") == email]
            assert match, "member not materialised from register signup"
            m = match[0]
            assert m["dob"] == "2011-01-02"
            assert m["gender"] == "female"
            assert m["section"] == "Cubs"
            assert m["patrol"] == "Wolves"
            assert m["guardian_name"] == "TEST G"
            assert m["emergency_contact"] == "TEST EC"
            assert m["position"] == "Member"
        finally:
            cleanup(mongo, emails=[email])

    def test_leader_register_approve_upgrades_role(self, mongo, admin_token):
        email = f"test_leader_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Reg Leader",
                "chapter_id": CHP, "signup_type": "leader", "requested_role": "scout_leader"})
            assert r.status_code == 200, r.text[:300]
            uid = r.json()["user_id"]
            r = requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_token))
            assert r.status_code == 200, r.text[:300]
            tok = login(email, "scout123")
            me = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
            assert me["role"] == "scout_leader", me["role"]
            # no member record for leader signup
            members = requests.get(f"{API}/members", headers=hdr(admin_token),
                                   params={"chapter_id": CHP}).json()
            assert not [m for m in members if m.get("email") == email]
        finally:
            cleanup(mongo, emails=[email])

    def test_rejected_user_login_blocked(self, mongo, admin_token):
        email = f"test_rej_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Rejected",
                "chapter_id": CHP, "signup_type": "scout"})
            uid = r.json()["user_id"]
            rr = requests.post(f"{API}/users/{uid}/reject", headers=hdr(admin_token))
            assert rr.status_code == 200, rr.text[:300]
            lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "scout123"})
            assert lr.status_code == 403
            assert "not approved" in lr.text.lower()
        finally:
            cleanup(mongo, emails=[email])

    def test_register_invalid_chapter(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"test_bad_{uuid.uuid4().hex[:6]}@example.com", "password": "scout123",
            "name": "TEST Bad", "chapter_id": "chp_nope"})
        assert r.status_code == 400

    def test_chapter_scoped_approval_permissions(self, mongo, ararat_admin_token, admin_token, scout_token):
        # pending user in a different chapter (sevan) — ararat chapter_admin must not approve
        email = f"test_other_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Other Chapter",
                "chapter_id": "chp_sevan", "signup_type": "scout"})
            assert r.status_code == 200, r.text[:300]
            uid = r.json()["user_id"]

            r = requests.post(f"{API}/users/{uid}/approve", headers=hdr(ararat_admin_token))
            assert r.status_code == 403, f"cross-chapter approve allowed: {r.status_code}"

            # scout cannot approve or list pending
            assert requests.post(f"{API}/users/{uid}/approve", headers=hdr(scout_token)).status_code == 403
            assert requests.get(f"{API}/users/pending", headers=hdr(scout_token)).status_code == 403

            # chapter admin pending list scoped to own chapter
            pend = requests.get(f"{API}/users/pending", headers=hdr(ararat_admin_token))
            assert pend.status_code == 200
            assert all(u.get("chapter_id") == CHP for u in pend.json())
            assert not any(u["user_id"] == uid for u in pend.json())
            # national admin sees it
            assert any(u["user_id"] == uid for u in
                       requests.get(f"{API}/users/pending", headers=hdr(admin_token)).json())
        finally:
            cleanup(mongo, emails=[email])

    def test_chapter_admin_approves_own_chapter(self, mongo, ararat_admin_token):
        email = f"test_own_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Own Chapter",
                "chapter_id": CHP, "signup_type": "scout"})
            uid = r.json()["user_id"]
            r = requests.post(f"{API}/users/{uid}/approve", headers=hdr(ararat_admin_token))
            assert r.status_code == 200, r.text[:300]
            tok = login(email, "scout123")
            assert requests.get(f"{API}/auth/me", headers=hdr(tok)).json()["status"] == "active"
        finally:
            cleanup(mongo, emails=[email])


# ---------- Programs: levels, capacity, waitlist ----------
class TestPrograms:
    def _prog(self, level="chapter", **kw):
        body = {
            "title": f"TEST Program {uuid.uuid4().hex[:5]}",
            "description": "TEST", "date": "2026-12-01", "start_time": "10:00",
            "end_time": "12:00", "location": "Yerevan", "section": "Scouts",
            "sections": ["Scouts", "Cubs"], "level": level, "capacity": 0,
            "waitlist_enabled": False,
        }
        body.update(kw)
        return body

    def test_levels_and_counts(self, mongo, admin_token, ararat_admin_token):
        created = []
        try:
            for level in ("national", "regional"):
                r = requests.post(f"{API}/programs", headers=hdr(admin_token), json=self._prog(level))
                assert r.status_code == 200, r.text[:300]
                d = r.json()
                created.append(d["program_id"])
                assert d["chapter_id"] is None, f"{level} program got chapter_id {d['chapter_id']}"
                assert d["level"] == level
                assert "_id" not in d
                assert d["sections"] == ["Scouts", "Cubs"]

            # chapter leader creating -> forced to own chapter + level chapter
            r = requests.post(f"{API}/programs", headers=hdr(ararat_admin_token),
                              json=self._prog("national"))
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            created.append(d["program_id"])
            assert d["chapter_id"] == CHP
            assert d["level"] == "chapter"

            lst = requests.get(f"{API}/programs", headers=hdr(admin_token))
            assert lst.status_code == 200
            items = lst.json()
            assert items and all("registered_count" in p and "waitlist_count" in p for p in items)
            assert all(isinstance(p["registered_count"], int) for p in items)
        finally:
            cleanup(mongo, program_ids=created)

    def test_capacity_waitlist_and_promotion(self, mongo, admin_token, scout_token, sevan_leader_token, ararat_admin_token):
        pid = None
        try:
            r = requests.post(f"{API}/programs", headers=hdr(admin_token),
                              json=self._prog("national", capacity=1, waitlist_enabled=True))
            assert r.status_code == 200, r.text[:300]
            pid = r.json()["program_id"]

            r1 = requests.post(f"{API}/programs/{pid}/register", headers=hdr(scout_token))
            assert r1.status_code == 200, r1.text[:300]
            assert r1.json()["status"] == "registered"

            r2 = requests.post(f"{API}/programs/{pid}/register", headers=hdr(sevan_leader_token))
            assert r2.status_code == 200, r2.text[:300]
            assert r2.json()["status"] == "waitlisted", r2.json()

            r3 = requests.post(f"{API}/programs/{pid}/register", headers=hdr(ararat_admin_token))
            assert r3.json()["status"] == "waitlisted"

            mine = requests.get(f"{API}/programs/{pid}/my-registration", headers=hdr(scout_token)).json()
            assert mine["status"] == "registered"

            lst = [p for p in requests.get(f"{API}/programs", headers=hdr(admin_token)).json()
                   if p["program_id"] == pid][0]
            assert lst["registered_count"] == 1
            assert lst["waitlist_count"] == 2

            # unregister first -> first waitlisted (sevan) promoted + notified
            d = requests.delete(f"{API}/programs/{pid}/register", headers=hdr(scout_token))
            assert d.status_code == 200, d.text[:300]
            after = requests.get(f"{API}/programs/{pid}/my-registration", headers=hdr(sevan_leader_token)).json()
            assert after["status"] == "registered", after
            still_wl = requests.get(f"{API}/programs/{pid}/my-registration", headers=hdr(ararat_admin_token)).json()
            assert still_wl["status"] == "waitlisted"
            notes = requests.get(f"{API}/notifications", headers=hdr(sevan_leader_token)).json()
            assert any("Waitlist promoted" in (n.get("title") or "") for n in notes), "no promotion notification"
        finally:
            cleanup(mongo, program_ids=[pid] if pid else [])

    def test_full_without_waitlist_returns_400(self, mongo, admin_token, scout_token, sevan_leader_token):
        pid = None
        try:
            r = requests.post(f"{API}/programs", headers=hdr(admin_token),
                              json=self._prog("national", capacity=1, waitlist_enabled=False))
            pid = r.json()["program_id"]
            assert requests.post(f"{API}/programs/{pid}/register",
                                 headers=hdr(scout_token)).json()["status"] == "registered"
            r2 = requests.post(f"{API}/programs/{pid}/register", headers=hdr(sevan_leader_token))
            assert r2.status_code == 400, f"{r2.status_code} {r2.text[:200]}"
            assert "full" in r2.text.lower()
        finally:
            cleanup(mongo, program_ids=[pid] if pid else [])

    def test_scout_cannot_create_program(self, scout_token):
        r = requests.post(f"{API}/programs", headers=hdr(scout_token), json=self._prog())
        assert r.status_code == 403

    def test_register_unknown_program_404(self, scout_token):
        r = requests.post(f"{API}/programs/prg_missing/register", headers=hdr(scout_token))
        assert r.status_code == 404


# ---------- Member role sync + parent invite + parent dashboard ----------
class TestMemberRoleSyncAndParent:
    @pytest.fixture(scope="class")
    def member_with_user(self, mongo, admin_token):
        """Create a TEST member whose email matches an approved TEST user."""
        email = f"test_pos_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "scout123", "name": "TEST Position User",
            "chapter_id": CHP, "signup_type": "scout", "section": "Scouts"})
        uid = r.json()["user_id"]
        assert requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_token)).status_code == 200
        members = requests.get(f"{API}/members", headers=hdr(admin_token),
                               params={"chapter_id": CHP}).json()
        m = [x for x in members if x.get("email") == email][0]
        yield {"member": m, "email": email, "user_id": uid}
        cleanup(mongo, emails=[email], member_ids=[m["member_id"]])

    def test_sync_role_suggestion_then_apply(self, admin_token, member_with_user):
        m = member_with_user["member"]
        mid = m["member_id"]
        body = {k: m.get(k, "") for k in
                ("full_name", "full_name_hy", "photo", "dob", "gender", "phone", "email",
                 "guardian_name", "guardian_phone", "emergency_contact", "chapter_id",
                 "section", "patrol", "membership_start", "status", "position", "notes")}
        body["position"] = "Patrol Leader"
        r = requests.put(f"{API}/members/{mid}", headers=hdr(admin_token), json=body)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["position"] == "Patrol Leader"

        s = requests.post(f"{API}/members/{mid}/sync-user-role", headers=hdr(admin_token),
                          json={"apply": False})
        assert s.status_code == 200, s.text[:300]
        d = s.json()
        assert d["linked"] is True
        assert d["suggested_role"] == "patrol_leader", d
        assert d["needs_change"] is True
        assert d.get("applied") is not True
        # not applied yet (scouts are hidden from /users by default now)
        users = requests.get(f"{API}/users", headers=hdr(admin_token),
                             params={"include_scouts": "true"}).json()
        u = [x for x in users if x["email"] == member_with_user["email"]][0]
        assert u["role"] == "scout"

        s = requests.post(f"{API}/members/{mid}/sync-user-role", headers=hdr(admin_token),
                          json={"apply": True})
        assert s.status_code == 200, s.text[:300]
        assert s.json().get("applied") is True
        assert s.json()["current_role"] == "patrol_leader"
        users = requests.get(f"{API}/users", headers=hdr(admin_token),
                             params={"include_scouts": "true"}).json()
        u = [x for x in users if x["email"] == member_with_user["email"]][0]
        assert u["role"] == "patrol_leader"

    def test_sync_role_member_without_user(self, mongo, admin_token):
        r = requests.post(f"{API}/members", headers=hdr(admin_token), json={
            "full_name": "TEST Orphan", "chapter_id": CHP, "section": "Scouts",
            "email": f"test_orphan_{uuid.uuid4().hex[:6]}@example.com", "position": "Scout Leader"})
        assert r.status_code == 200, r.text[:300]
        mid = r.json()["member_id"]
        try:
            s = requests.post(f"{API}/members/{mid}/sync-user-role", headers=hdr(admin_token),
                              json={"apply": True})
            assert s.status_code == 200
            assert s.json()["linked"] is False
        finally:
            cleanup(mongo, member_ids=[mid])

    def test_invite_parent_and_parent_children(self, mongo, admin_token, member_with_user):
        mid = member_with_user["member"]["member_id"]
        pemail = f"test_parent_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[pemail])
        try:
            r = requests.post(f"{API}/members/{mid}/invite-parent", headers=hdr(admin_token),
                              json={"email": pemail, "name": "TEST Parent"})
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            assert d["temp_password"], "temp_password not returned for new parent"
            ptok = login(pemail, d["temp_password"])
            me = requests.get(f"{API}/auth/me", headers=hdr(ptok)).json()
            assert me["role"] == "parent"
            assert me["status"] == "active"
            assert me["linked_member_ids"] == [mid]

            kids = requests.get(f"{API}/parent/children", headers=hdr(ptok))
            assert kids.status_code == 200, kids.text[:300]
            children = kids.json()["children"]
            assert len(children) == 1
            c = children[0]
            assert c["member_id"] == mid
            for key in ("badges", "next_activity", "attendance", "attendance_percent", "awarded_count"):
                assert key in c, f"missing {key} in parent child payload"

            # re-invite existing parent is idempotent (no temp password)
            r2 = requests.post(f"{API}/members/{mid}/invite-parent", headers=hdr(admin_token),
                               json={"email": pemail})
            assert r2.status_code == 200
            assert r2.json()["temp_password"] is None

            # non-parent cannot access parent dashboard
            assert requests.get(f"{API}/parent/children", headers=hdr(admin_token)).status_code == 403
        finally:
            cleanup(mongo, emails=[pemail])


# ---------- Password change ----------
class TestPasswordChange:
    def test_change_password_flow(self, mongo, admin_token):
        email = f"test_pwd_{uuid.uuid4().hex[:6]}@example.com"
        cleanup(mongo, emails=[email])
        try:
            r = requests.post(f"{API}/auth/register", json={
                "email": email, "password": "scout123", "name": "TEST Pwd",
                "chapter_id": CHP, "signup_type": "scout"})
            uid = r.json()["user_id"]
            requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_token))
            tok = login(email, "scout123")

            bad = requests.post(f"{API}/auth/change-password", headers=hdr(tok),
                                json={"current_password": "wrongpass", "new_password": "newpass123"})
            assert bad.status_code == 401, bad.status_code

            short = requests.post(f"{API}/auth/change-password", headers=hdr(tok),
                                  json={"current_password": "scout123", "new_password": "abc"})
            assert short.status_code == 400, short.status_code

            ok = requests.post(f"{API}/auth/change-password", headers=hdr(tok),
                               json={"current_password": "scout123", "new_password": "newpass123"})
            assert ok.status_code == 200, ok.text[:300]
            assert login(email, "newpass123")
            assert requests.post(f"{API}/auth/login",
                                 json={"email": email, "password": "scout123"}).status_code == 401
        finally:
            cleanup(mongo, emails=[email])

    def test_google_only_account_cannot_change_password(self, mongo):
        email = f"test_gonly_{uuid.uuid4().hex[:6]}@example.com"
        uid = "usr_test_" + uuid.uuid4().hex[:8]
        mongo.users.insert_one({
            "user_id": uid, "email": email, "name": "TEST Google Only",
            "role": "scout", "chapter_id": CHP, "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()})
        try:
            r = requests.post(f"{API}/auth/change-password", headers=hdr(mk_token(uid, email)),
                              json={"current_password": "x", "new_password": "newpass123"})
            assert r.status_code in (400, 401), f"{r.status_code} {r.text[:200]}"
            assert "google" in r.text.lower()
        finally:
            cleanup(mongo, emails=[email])


# ---------- Trash bin / archive ----------
class TestTrash:
    def test_trash_permissions(self, admin_token, ararat_admin_token, scout_token, sevan_leader_token):
        r = requests.get(f"{API}/trash", headers=hdr(admin_token))
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("chapters", "badges", "resources"):
            assert k in d and isinstance(d[k], list)
        assert requests.get(f"{API}/trash", headers=hdr(ararat_admin_token)).status_code == 200
        assert requests.get(f"{API}/trash", headers=hdr(scout_token)).status_code == 403
        assert requests.get(f"{API}/trash", headers=hdr(sevan_leader_token)).status_code == 403
        assert requests.get(f"{API}/trash").status_code == 401

    def test_badge_archive_unarchive_roundtrip(self, admin_token):
        r = requests.post(f"{API}/badges", headers=hdr(admin_token), json={
            "name": f"TEST Badge {uuid.uuid4().hex[:5]}", "section": "Scouts",
            "requirements": ["a", "b"]})
        assert r.status_code == 200, r.text[:300]
        bid = r.json()["badge_id"]
        try:
            assert requests.post(f"{API}/badges/{bid}/archive", headers=hdr(admin_token)).status_code == 200
            assert bid not in [b["badge_id"] for b in requests.get(f"{API}/badges").json()]
            trash = requests.get(f"{API}/trash", headers=hdr(admin_token)).json()
            assert bid in [b["badge_id"] for b in trash["badges"]]
            assert requests.post(f"{API}/badges/{bid}/unarchive", headers=hdr(admin_token)).status_code == 200
            assert bid in [b["badge_id"] for b in requests.get(f"{API}/badges").json()]
        finally:
            requests.delete(f"{API}/badges/{bid}", headers=hdr(admin_token))

    def test_chapter_archive_unarchive_roundtrip(self, admin_token):
        r = requests.post(f"{API}/chapters", headers=hdr(admin_token), json={
            "name": f"TEST Chapter {uuid.uuid4().hex[:5]}", "location": "Test"})
        assert r.status_code == 200, r.text[:300]
        cid = r.json()["chapter_id"]
        try:
            assert requests.post(f"{API}/chapters/{cid}/archive", headers=hdr(admin_token)).status_code == 200
            assert cid not in [c["chapter_id"] for c in requests.get(f"{API}/chapters").json()]
            trash = requests.get(f"{API}/trash", headers=hdr(admin_token)).json()
            assert cid in [c["chapter_id"] for c in trash["chapters"]]
            assert requests.post(f"{API}/chapters/{cid}/unarchive", headers=hdr(admin_token)).status_code == 200
            assert cid in [c["chapter_id"] for c in requests.get(f"{API}/chapters").json()]
        finally:
            requests.delete(f"{API}/chapters/{cid}", headers=hdr(admin_token))
