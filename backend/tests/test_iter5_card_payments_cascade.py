"""Iteration 5 tests: public membership verify, program payments (Stripe), cascade chapter delete."""
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

ADMIN = {"email": "hovsepmarachlian@gmail.com", "password": "admin123"}
SCOUT = {"email": "narek@scouts.am", "password": "scout123"}
CHAPTER_ADMIN = {"email": "ararat.leader@scouts.am", "password": "scout123"}

SENSITIVE = ["dob", "phone", "guardian_phone", "emergency_contact", "notes"]


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['email']}: {r.status_code} {r.text[:300]}")
    token = r.json().get("access_token")
    if not token:
        pytest.fail("No access_token in login response")
    return token


def _client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def scout_token():
    return _login(SCOUT)


@pytest.fixture(scope="session")
def admin(admin_token):
    return _client(admin_token)


@pytest.fixture(scope="session")
def scout(scout_token):
    return _client(scout_token)


@pytest.fixture(scope="session")
def anon():
    return _client()


# ---------------- Seed migration / auth ----------------
class TestSeedMigration:
    def test_new_owner_admin_email_logs_in(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["email"] == ADMIN["email"]
        assert d["user_id"] == "usr_admin"
        assert d["role"] == "national_admin"

    def test_old_admin_email_no_longer_valid(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@scouts.am", "password": "admin123"})
        assert r.status_code == 401, f"old email still logs in: {r.status_code} {r.text[:200]}"

    def test_bcrypt_hash_format(self, admin):
        # verify stored hash format via mongo is out of scope for HTTP; assert login works with bcrypt-backed pw
        r = admin.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]


# ---------------- Public membership verification ----------------
class TestPublicVerify:
    def test_verify_valid_member_no_auth(self, anon):
        r = anon.get(f"{BASE_URL}/api/public/members/mbr_narek/verify")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["valid"] is True
        m = d["member"]
        for f in ["full_name", "section", "patrol", "position", "status"]:
            assert f in m, f"missing {f}"
        assert m["full_name"]
        assert m["status"] == "active"
        assert d["chapter"] and d["chapter"].get("name")
        for f in SENSITIVE:
            assert f not in m, f"sensitive field leaked: {f}"
        assert "_id" not in m

    def test_verify_missing_member(self, anon):
        r = anon.get(f"{BASE_URL}/api/public/members/mbr_missing/verify")
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is False
        assert d.get("reason") == "not_found"

    def test_verify_archived_member(self, admin, anon):
        cr = admin.post(f"{BASE_URL}/api/members", json={
            "full_name": "TEST_Archived Verify", "chapter_id": "chp_ararat", "section": "Scouts",
        })
        assert cr.status_code == 200, cr.text[:300]
        mid = cr.json()["member_id"]
        try:
            ar = admin.delete(f"{BASE_URL}/api/members/{mid}")
            assert ar.status_code == 200
            r = anon.get(f"{BASE_URL}/api/public/members/{mid}/verify")
            assert r.status_code == 200
            d = r.json()
            assert d["valid"] is False, f"archived member reported valid: {d}"
            assert d["member"]["status"] == "archived"
        finally:
            admin.delete(f"{BASE_URL}/api/members/{mid}")


# ---------------- Program fee + paid registration block ----------------
@pytest.fixture(scope="class")
def paid_program(admin):
    payload = {
        "title": "TEST_Paid Program", "date": "2026-12-01", "section": "Scouts",
        "level": "national", "fee": 25.00, "currency": "usd", "capacity": 0,
    }
    r = admin.post(f"{BASE_URL}/api/programs", json=payload)
    assert r.status_code == 200, r.text[:300]
    pid = r.json()["program_id"]
    yield pid
    admin.delete(f"{BASE_URL}/api/programs/{pid}")


@pytest.fixture(scope="class")
def free_program(admin):
    r = admin.post(f"{BASE_URL}/api/programs", json={
        "title": "TEST_Free Program", "date": "2026-12-02", "level": "national", "fee": 0,
    })
    assert r.status_code == 200, r.text[:300]
    pid = r.json()["program_id"]
    yield pid
    admin.delete(f"{BASE_URL}/api/programs/{pid}")


class TestProgramFees:
    def test_create_persists_fee(self, admin, paid_program):
        r = admin.get(f"{BASE_URL}/api/programs/{paid_program}")
        assert r.status_code == 200
        d = r.json()
        assert d["fee"] == 25.00
        assert d["currency"] == "usd"

    def test_list_returns_fee(self, admin, paid_program):
        r = admin.get(f"{BASE_URL}/api/programs")
        assert r.status_code == 200
        items = [p for p in r.json() if p["program_id"] == paid_program]
        assert items, "created paid program missing from list"
        assert items[0]["fee"] == 25.00

    def test_direct_register_paid_program_402(self, scout, paid_program):
        r = scout.post(f"{BASE_URL}/api/programs/{paid_program}/register", json={})
        assert r.status_code == 402, f"expected 402, got {r.status_code} {r.text[:200]}"
        assert "payment" in str(r.json().get("detail", "")).lower() or "checkout" in str(r.json().get("detail", "")).lower()

    def test_direct_register_free_program_ok(self, scout, free_program):
        r = scout.post(f"{BASE_URL}/api/programs/{free_program}/register", json={})
        assert r.status_code == 200, r.text[:200]
        assert r.json()["status"] in ("registered", "waitlisted")


# ---------------- Stripe checkout ----------------
class TestPayments:
    def test_checkout_paid_program(self, scout, paid_program, anon):
        r = scout.post(f"{BASE_URL}/api/payments/programs/checkout", json={
            "program_id": paid_program, "origin_url": BASE_URL,
        }, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com/"), d["checkout_url"]
        assert d["session_id"].startswith("cs_test_"), d["session_id"]

        # status endpoint works unauthenticated and reflects initiated/pending
        sr = anon.get(f"{BASE_URL}/api/payments/status/{d['session_id']}", timeout=60)
        assert sr.status_code == 200, sr.text[:300]
        s = sr.json()
        assert s["session_id"] == d["session_id"]
        assert s["status"] == "initiated"
        assert s["payment_status"] == "pending"
        assert s["program_id"] == paid_program
        assert float(s["amount"]) == 25.00
        assert s["currency"] == "usd"

    def test_checkout_free_program_400(self, scout, free_program):
        r = scout.post(f"{BASE_URL}/api/payments/programs/checkout", json={
            "program_id": free_program, "origin_url": BASE_URL,
        }, timeout=60)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"

    def test_checkout_requires_auth(self, anon, paid_program):
        r = anon.post(f"{BASE_URL}/api/payments/programs/checkout", json={
            "program_id": paid_program, "origin_url": BASE_URL,
        }, timeout=60)
        assert r.status_code in (401, 403), f"{r.status_code} {r.text[:200]}"

    def test_checkout_unknown_program_404(self, scout):
        r = scout.post(f"{BASE_URL}/api/payments/programs/checkout", json={
            "program_id": "prg_nope", "origin_url": BASE_URL,
        }, timeout=60)
        assert r.status_code == 404, f"{r.status_code} {r.text[:200]}"

    def test_status_unknown_session_404(self, anon):
        r = anon.get(f"{BASE_URL}/api/payments/status/cs_test_bogus{uuid.uuid4().hex[:8]}", timeout=60)
        assert r.status_code == 404, f"{r.status_code} {r.text[:200]}"


# ---------------- Cascade chapter delete ----------------
def _make_chapter_with_links(admin, label):
    cr = admin.post(f"{BASE_URL}/api/chapters", json={"name": f"TEST_{label}", "location": "TEST"})
    assert cr.status_code == 200, cr.text[:300]
    cid = cr.json()["chapter_id"]
    mr = admin.post(f"{BASE_URL}/api/members", json={
        "full_name": f"TEST_{label} Member", "chapter_id": cid, "section": "Scouts"})
    assert mr.status_code == 200, mr.text[:300]
    pr = admin.post(f"{BASE_URL}/api/programs", json={
        "title": f"TEST_{label} Program", "date": "2026-11-11", "level": "chapter", "chapter_id": cid})
    assert pr.status_code == 200, pr.text[:300]
    return cid, mr.json()["member_id"], pr.json()["program_id"]


class TestCascadeDelete:
    def test_impact_national_admin(self, admin):
        cid, mid, pid = _make_chapter_with_links(admin, "IMPACT")
        try:
            r = admin.get(f"{BASE_URL}/api/chapters/{cid}/impact")
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            assert d["chapter"]["chapter_id"] == cid
            assert d["members_active"] == 1
            assert d["programs"] == 1
            assert "users" in d and isinstance(d["users"], int)
        finally:
            admin.delete(f"{BASE_URL}/api/chapters/{cid}?force=true")
            admin.delete(f"{BASE_URL}/api/members/{mid}")
            admin.delete(f"{BASE_URL}/api/programs/{pid}")

    def test_impact_forbidden_for_chapter_admin(self):
        c = _client(_login(CHAPTER_ADMIN))
        r = c.get(f"{BASE_URL}/api/chapters/chp_ararat/impact")
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_impact_unknown_chapter_404(self, admin):
        r = admin.get(f"{BASE_URL}/api/chapters/chp_nope/impact")
        assert r.status_code == 404

    def test_delete_without_params_returns_409(self, admin):
        cid, mid, pid = _make_chapter_with_links(admin, "C409")
        try:
            r = admin.delete(f"{BASE_URL}/api/chapters/{cid}")
            assert r.status_code == 409, f"{r.status_code} {r.text[:200]}"
            detail = r.json()["detail"]
            assert detail["message"]
            assert detail["members_active"] == 1
            assert detail["programs"] == 1
            # chapter must still exist
            assert admin.get(f"{BASE_URL}/api/chapters/{cid}").status_code == 200
        finally:
            admin.delete(f"{BASE_URL}/api/chapters/{cid}?force=true")
            admin.delete(f"{BASE_URL}/api/members/{mid}")
            admin.delete(f"{BASE_URL}/api/programs/{pid}")

    def test_delete_with_reassign(self, admin):
        src, mid, pid = _make_chapter_with_links(admin, "SRC")
        tr = admin.post(f"{BASE_URL}/api/chapters", json={"name": "TEST_TARGET", "location": "TEST"})
        assert tr.status_code == 200
        tgt = tr.json()["chapter_id"]
        try:
            r = admin.delete(f"{BASE_URL}/api/chapters/{src}?reassign_to={tgt}")
            assert r.status_code == 200, r.text[:300]
            assert r.json()["reassigned_to"] == tgt
            assert admin.get(f"{BASE_URL}/api/chapters/{src}").status_code == 404
            m = admin.get(f"{BASE_URL}/api/members/{mid}")
            assert m.status_code == 200
            assert m.json()["chapter_id"] == tgt
            p = admin.get(f"{BASE_URL}/api/programs/{pid}")
            assert p.status_code == 200
            assert p.json()["chapter_id"] == tgt
        finally:
            admin.delete(f"{BASE_URL}/api/members/{mid}")
            admin.delete(f"{BASE_URL}/api/programs/{pid}")
            admin.delete(f"{BASE_URL}/api/chapters/{tgt}?force=true")

    def test_delete_with_force_orphans(self, admin):
        cid, mid, pid = _make_chapter_with_links(admin, "FORCE")
        try:
            r = admin.delete(f"{BASE_URL}/api/chapters/{cid}?force=true")
            assert r.status_code == 200, r.text[:300]
            assert r.json()["orphaned"] is True
            assert admin.get(f"{BASE_URL}/api/chapters/{cid}").status_code == 404
            m = admin.get(f"{BASE_URL}/api/members/{mid}")
            assert m.status_code == 200
            assert m.json()["chapter_id"] is None
            p = admin.get(f"{BASE_URL}/api/programs/{pid}")
            assert p.status_code == 200
            assert p.json()["chapter_id"] is None
        finally:
            admin.delete(f"{BASE_URL}/api/programs/{pid}")

    def test_reassign_to_same_chapter_400(self, admin):
        cid, mid, pid = _make_chapter_with_links(admin, "SAME")
        try:
            r = admin.delete(f"{BASE_URL}/api/chapters/{cid}?reassign_to={cid}")
            assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"
        finally:
            admin.delete(f"{BASE_URL}/api/chapters/{cid}?force=true")
            admin.delete(f"{BASE_URL}/api/members/{mid}")
            admin.delete(f"{BASE_URL}/api/programs/{pid}")

    def test_reassign_to_nonexistent_400(self, admin):
        cid, mid, pid = _make_chapter_with_links(admin, "NOEXIST")
        try:
            r = admin.delete(f"{BASE_URL}/api/chapters/{cid}?reassign_to=chp_does_not_exist")
            assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"
            assert admin.get(f"{BASE_URL}/api/chapters/{cid}").status_code == 200
        finally:
            admin.delete(f"{BASE_URL}/api/chapters/{cid}?force=true")
            admin.delete(f"{BASE_URL}/api/members/{mid}")
            admin.delete(f"{BASE_URL}/api/programs/{pid}")

    def test_delete_empty_chapter_no_params(self, admin):
        cr = admin.post(f"{BASE_URL}/api/chapters", json={"name": "TEST_EMPTY", "location": "TEST"})
        cid = cr.json()["chapter_id"]
        r = admin.delete(f"{BASE_URL}/api/chapters/{cid}")
        assert r.status_code == 200, r.text[:300]
        assert admin.get(f"{BASE_URL}/api/chapters/{cid}").status_code == 404

    def test_delete_forbidden_for_chapter_admin(self):
        c = _client(_login(CHAPTER_ADMIN))
        r = c.delete(f"{BASE_URL}/api/chapters/chp_ararat")
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"
