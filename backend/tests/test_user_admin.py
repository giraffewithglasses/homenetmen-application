"""Tests for the new user administration surface:
GET /api/users (include_scouts + status filters), archive/unarchive, DELETE /users/{uid},
scout-signup approval -> member materialization, leader approval -> role grant,
and the Google-auth complete-profile flow.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or fe.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"
be = dotenv_values("/app/backend/.env")
JWT_SECRET = be["JWT_SECRET"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)


def token(email, password):
    r = login(email, password)
    if r.status_code != 200:
        pytest.fail(f"login failed for {email}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"]


def mk_jwt(uid, email):
    return jwt.encode({"sub": uid, "email": email, "type": "access",
                       "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, JWT_SECRET, algorithm="HS256")


@pytest.fixture(scope="module")
def mongo():
    return MongoClient(be["MONGO_URL"])[be["DB_NAME"]]


@pytest.fixture(scope="module")
def admin_tok():
    return token("admin@scouts.am", "admin123")


@pytest.fixture(scope="module")
def ararat_tok():
    return token("ararat.leader@scouts.am", "scout123")


@pytest.fixture(scope="module")
def created(mongo):
    emails = []
    yield emails
    for e in emails:
        mongo.users.delete_many({"email": e})
        mongo.members.delete_many({"email": e})


def uniq(prefix="test_admin"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@scouts.am"


def reg(email, signup_type="scout", chapter="chp_ararat", requested_role=None, **extra):
    body = {
        "name": "TEST User", "email": email, "password": "Passw0rd!",
        "chapter_id": chapter, "signup_type": signup_type,
    }
    if requested_role:
        body["requested_role"] = requested_role
    body.update(extra)
    return requests.post(f"{API}/auth/register", json=body, timeout=30)


# ---------- Regression: seeded accounts ----------
class TestSeededLogins:
    @pytest.mark.parametrize("email,password,role", [
        ("admin@scouts.am", "admin123", "national_admin"),
        ("ararat.leader@scouts.am", "scout123", "chapter_admin"),
        ("sevan.leader@scouts.am", "scout123", "chapter_leader"),
        ("narek@scouts.am", "scout123", "scout"),
    ])
    def test_seeded_login(self, email, password, role):
        r = login(email, password)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email
        assert d["role"] == role
        assert d["status"] == "active"
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 20

    def test_bcrypt_hash_format(self, mongo):
        u = mongo.users.find_one({"email": "admin@scouts.am"})
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]

    def test_seeded_programs_and_members(self, admin_tok):
        p = requests.get(f"{API}/programs", headers=hdr(admin_tok), timeout=30)
        assert p.status_code == 200
        assert len(p.json()) >= 10
        m = requests.get(f"{API}/members", headers=hdr(admin_tok), timeout=30)
        assert m.status_code == 200
        assert len(m.json()) >= 30


# ---------- Scout / Leader registration + approval ----------
class TestRegistrationApproval:
    def test_scout_register_stashes_profile_and_approve_creates_member(self, mongo, admin_tok, created):
        email = uniq("test_scout")
        created.append(email)
        r = reg(email, "scout", full_name_hy="Տեստ", dob="2012-03-04", gender="M",
                phone="+374 11 11 11 11", section="Scouts", patrol="Eagle",
                guardian_name="TEST Guardian", guardian_phone="+374 22 22 22 22",
                emergency_contact="+374 33 33 33 33")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending"
        assert d["signup_type"] == "scout"
        uid = d["user_id"]

        u = mongo.users.find_one({"user_id": uid})
        assert u["status"] == "pending"
        assert u["role"] == "scout"
        prof = u.get("pending_member_profile")
        assert prof is not None
        assert prof["dob"] == "2012-03-04"
        assert prof["guardian_name"] == "TEST Guardian"
        assert prof["emergency_contact"] == "+374 33 33 33 33"
        assert prof["patrol"] == "Eagle"

        # pending user cannot log in
        assert login(email, "Passw0rd!").status_code == 403

        # appears in pending list with type info
        pend = requests.get(f"{API}/users/pending", headers=hdr(admin_tok), timeout=30).json()
        row = [x for x in pend if x["user_id"] == uid]
        assert row and row[0]["signup_type"] == "scout"

        # approve -> member materialized
        a = requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_tok), timeout=30)
        assert a.status_code == 200, a.text
        members = requests.get(f"{API}/members?chapter_id=chp_ararat", headers=hdr(admin_tok), timeout=30).json()
        mrow = [m for m in members if m["email"] == email]
        assert mrow, "approved scout signup did not create a member record"
        assert mrow[0]["full_name"] == "TEST User"
        assert mrow[0]["guardian_phone"] == "+374 22 22 22 22"
        assert mongo.users.find_one({"user_id": uid}).get("pending_member_profile") is None

        # now can log in
        li = login(email, "Passw0rd!")
        assert li.status_code == 200, li.text
        assert li.json()["role"] == "scout"

        # scout hidden from default /api/users listing
        default_users = requests.get(f"{API}/users", headers=hdr(admin_tok), timeout=30).json()
        assert email not in [x["email"] for x in default_users]
        with_scouts = requests.get(f"{API}/users?include_scouts=true", headers=hdr(admin_tok), timeout=30).json()
        assert email in [x["email"] for x in with_scouts]

    def test_leader_register_and_approve_grants_role(self, mongo, admin_tok, created):
        email = uniq("test_leader")
        created.append(email)
        r = reg(email, "leader", chapter="chp_sevan", requested_role="chapter_leader", gender="F")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending" and d["signup_type"] == "leader"
        uid = d["user_id"]
        u = mongo.users.find_one({"user_id": uid})
        assert u["requested_role"] == "chapter_leader"
        assert u.get("pending_member_profile") is None

        a = requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_tok), timeout=30)
        assert a.status_code == 200, a.text
        u = mongo.users.find_one({"user_id": uid})
        assert u["role"] == "chapter_leader"
        assert u["status"] == "active"
        # appears in default users listing (not a scout)
        users = requests.get(f"{API}/users", headers=hdr(admin_tok), timeout=30).json()
        assert email in [x["email"] for x in users]
        # no member record created for leader signup
        assert mongo.members.find_one({"email": email}) is None
        assert login(email, "Passw0rd!").status_code == 200

    def test_reject_blocks_login(self, admin_tok, created):
        email = uniq("test_reject")
        created.append(email)
        uid = reg(email).json()["user_id"]
        r = requests.post(f"{API}/users/{uid}/reject", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 200, r.text
        li = login(email, "Passw0rd!")
        assert li.status_code == 403
        assert "not approved" in li.json()["detail"].lower()

    def test_duplicate_email_and_bad_chapter(self, created):
        email = uniq("test_dup")
        created.append(email)
        assert reg(email).status_code == 200
        assert reg(email).status_code == 400
        assert reg(uniq("test_badchp"), chapter="chp_nope").status_code == 400


# ---------- Archive / unarchive / delete ----------
class TestArchiveDelete:
    def _make_leader(self, admin_tok, created, chapter="chp_ararat"):
        email = uniq("test_arch")
        created.append(email)
        uid = reg(email, "leader", chapter=chapter, requested_role="chapter_leader").json()["user_id"]
        assert requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_tok), timeout=30).status_code == 200
        return email, uid

    def test_archive_blocks_login_and_unarchive_restores(self, admin_tok, created):
        email, uid = self._make_leader(admin_tok, created)
        assert login(email, "Passw0rd!").status_code == 200

        r = requests.post(f"{API}/users/{uid}/archive", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 200, r.text
        li = login(email, "Passw0rd!")
        assert li.status_code == 403
        assert "archived" in li.json()["detail"].lower()

        # hidden from default listing, visible with status=archived
        default_users = requests.get(f"{API}/users", headers=hdr(admin_tok), timeout=30).json()
        assert email not in [x["email"] for x in default_users]
        archived = requests.get(f"{API}/users?status=archived", headers=hdr(admin_tok), timeout=30).json()
        arow = [x for x in archived if x["email"] == email]
        assert arow and arow[0]["status"] == "archived"

        r = requests.post(f"{API}/users/{uid}/unarchive", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 200, r.text
        assert login(email, "Passw0rd!").status_code == 200
        assert requests.get(f"{API}/users", headers=hdr(admin_tok), timeout=30).json()

    def test_cannot_archive_own_account(self, admin_tok):
        me = requests.get(f"{API}/auth/me", headers=hdr(admin_tok), timeout=30).json()
        r = requests.post(f"{API}/users/{me['user_id']}/archive", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 400, r.text
        assert "own" in r.json()["detail"].lower()

    def test_cannot_delete_own_account(self, admin_tok):
        me = requests.get(f"{API}/auth/me", headers=hdr(admin_tok), timeout=30).json()
        r = requests.delete(f"{API}/users/{me['user_id']}", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 400, r.text
        assert "own" in r.json()["detail"].lower()

    def test_national_admin_delete_removes_user(self, mongo, admin_tok, created):
        email, uid = self._make_leader(admin_tok, created)
        r = requests.delete(f"{API}/users/{uid}", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 200, r.text
        assert mongo.users.find_one({"user_id": uid}) is None
        assert login(email, "Passw0rd!").status_code == 401

    def test_chapter_admin_cannot_delete(self, ararat_tok, admin_tok, created):
        email, uid = self._make_leader(admin_tok, created)
        r = requests.delete(f"{API}/users/{uid}", headers=hdr(ararat_tok), timeout=30)
        assert r.status_code == 403, r.text

    def test_chapter_admin_archive_scoped_to_own_chapter(self, ararat_tok, admin_tok, created):
        own_email, own_uid = self._make_leader(admin_tok, created, chapter="chp_ararat")
        other_email, other_uid = self._make_leader(admin_tok, created, chapter="chp_sevan")

        ok = requests.post(f"{API}/users/{own_uid}/archive", headers=hdr(ararat_tok), timeout=30)
        assert ok.status_code == 200, ok.text
        assert login(own_email, "Passw0rd!").status_code == 403

        denied = requests.post(f"{API}/users/{other_uid}/archive", headers=hdr(ararat_tok), timeout=30)
        assert denied.status_code == 403, denied.text
        assert login(other_email, "Passw0rd!").status_code == 200

    def test_chapter_admin_users_list_scoped(self, ararat_tok):
        users = requests.get(f"{API}/users?include_scouts=true", headers=hdr(ararat_tok), timeout=30).json()
        assert users, "chapter_admin got empty user list"
        assert all(u.get("chapter_id") == "chp_ararat" for u in users), \
            [u["email"] for u in users if u.get("chapter_id") != "chp_ararat"]

    def test_scout_cannot_list_users_or_archive(self):
        st = token("narek@scouts.am", "scout123")
        assert requests.get(f"{API}/users", headers=hdr(st), timeout=30).status_code == 403
        assert requests.delete(f"{API}/users/usr_admin", headers=hdr(st), timeout=30).status_code == 403

    def test_archive_unknown_user_404(self, admin_tok):
        r = requests.post(f"{API}/users/usr_does_not_exist/archive", headers=hdr(admin_tok), timeout=30)
        assert r.status_code == 404, r.text


# ---------- Google auth complete-profile ----------
class TestCompleteProfile:
    def test_profile_incomplete_user_completes_and_becomes_pending(self, mongo, admin_tok, created):
        email = uniq("test_google")
        created.append(email)
        uid = "usr_" + uuid.uuid4().hex[:12]
        mongo.users.insert_one({
            "user_id": uid, "email": email, "name": "TEST Google User", "picture": "",
            "role": "scout", "chapter_id": None, "status": "profile_incomplete",
            "signup_type": "scout", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        tok = mk_jwt(uid, email)
        me = requests.get(f"{API}/auth/me", headers=hdr(tok), timeout=30)
        assert me.status_code == 200, me.text
        assert me.json()["status"] == "profile_incomplete"
        assert "password_hash" not in me.json()
        assert "_id" not in me.json()

        r = requests.post(f"{API}/auth/complete-profile", headers=hdr(tok), timeout=30, json={
            "chapter_id": "chp_ararat", "signup_type": "scout", "full_name_hy": "Տեստ",
            "dob": "2010-01-02", "gender": "F", "phone": "+374 44 44 44 44",
            "section": "Scouts", "patrol": "Wolf", "guardian_name": "TEST G",
            "guardian_phone": "+374 55 55 55 55", "emergency_contact": "+374 66 66 66 66",
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending"
        u = mongo.users.find_one({"user_id": uid})
        assert u["status"] == "pending"
        assert u["chapter_id"] == "chp_ararat"
        assert u["pending_member_profile"]["dob"] == "2010-01-02"

        # approving materializes the member
        assert requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_tok), timeout=30).status_code == 200
        assert mongo.members.find_one({"email": email}) is not None

    def test_complete_profile_leader_variant(self, mongo, admin_tok, created):
        email = uniq("test_gleader")
        created.append(email)
        uid = "usr_" + uuid.uuid4().hex[:12]
        mongo.users.insert_one({
            "user_id": uid, "email": email, "name": "TEST Google Leader", "picture": "",
            "role": "scout", "chapter_id": None, "status": "profile_incomplete",
            "signup_type": "scout", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        tok = mk_jwt(uid, email)
        r = requests.post(f"{API}/auth/complete-profile", headers=hdr(tok), timeout=30, json={
            "chapter_id": "chp_sevan", "signup_type": "leader", "requested_role": "scout_leader", "gender": "M",
        })
        assert r.status_code == 200, r.text
        u = mongo.users.find_one({"user_id": uid})
        assert u["status"] == "pending" and u["requested_role"] == "scout_leader"
        assert requests.post(f"{API}/users/{uid}/approve", headers=hdr(admin_tok), timeout=30).status_code == 200
        assert mongo.users.find_one({"user_id": uid})["role"] == "scout_leader"

    def test_complete_profile_rejected_for_active_user(self, admin_tok):
        r = requests.post(f"{API}/auth/complete-profile", headers=hdr(admin_tok), timeout=30,
                          json={"chapter_id": "chp_ararat", "signup_type": "scout"})
        assert r.status_code == 400, r.text
        assert "already complete" in r.json()["detail"].lower()

    def test_complete_profile_requires_auth(self):
        r = requests.post(f"{API}/auth/complete-profile", timeout=30,
                          json={"chapter_id": "chp_ararat", "signup_type": "scout"})
        assert r.status_code in (401, 403), r.text

    def test_session_invalid_id(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "definitely-not-valid"}, timeout=40)
        assert r.status_code == 401, r.text
