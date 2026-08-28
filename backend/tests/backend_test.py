"""Comprehensive backend tests for Scouting Platform."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://badge-track-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@scouts.am", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def chapter_admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "ararat.leader@scouts.am", "password": "scout123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def leader_token():
    r = requests.post(f"{API}/auth/login", json={"email": "sevan.leader@scouts.am", "password": "scout123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def scout_token():
    r = requests.post(f"{API}/auth/login", json={"email": "narek@scouts.am", "password": "scout123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@scouts.am", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["role"] == "national_admin"

    def test_register(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@scouts.am"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "test123",
                                                        "name": "Test User", "chapter_id": "chp_ararat"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["role"] == "scout"
        # New contract: registration creates a pending account awaiting approval (no token issued)
        assert j["status"] == "pending"
        assert "access_token" not in j

    def test_emergent_session_bad(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "invalid_xxx"})
        assert r.status_code in (401, 500)


# ---------- Chapters ----------
class TestChapters:
    def test_list_chapters(self):
        r = requests.get(f"{API}/chapters")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 4
        assert all("member_count" in c for c in items)
        assert all("_id" not in c for c in items)


# ---------- Members ----------
class TestMembers:
    def test_admin_list_all(self, admin_token):
        r = requests.get(f"{API}/members", headers=hdr(admin_token))
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_filter_by_chapter(self, admin_token):
        r = requests.get(f"{API}/members?chapter_id=chp_ararat", headers=hdr(admin_token))
        assert r.status_code == 200
        assert all(m["chapter_id"] == "chp_ararat" for m in r.json())

    def test_filter_section(self, admin_token):
        r = requests.get(f"{API}/members?section=Scouts", headers=hdr(admin_token))
        assert r.status_code == 200
        assert all(m["section"] == "Scouts" for m in r.json())

    def test_search_q(self, admin_token):
        r = requests.get(f"{API}/members?q=Narek", headers=hdr(admin_token))
        assert r.status_code == 200
        assert any("Narek" in m["full_name"] for m in r.json())

    def test_scout_sees_own_chapter(self, scout_token):
        r = requests.get(f"{API}/members", headers=hdr(scout_token))
        assert r.status_code == 200
        assert all(m["chapter_id"] == "chp_ararat" for m in r.json())


# ---------- Badges ----------
class TestBadges:
    def test_list_badges(self):
        r = requests.get(f"{API}/badges")
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_update_progress(self, chapter_admin_token):
        r = requests.post(f"{API}/badges/progress",
                          json={"member_id": "mbr_narek", "badge_id": "bdg_camping",
                                "requirement_index": 0, "completed": True},
                          headers=hdr(chapter_admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["completed_requirements"][0] is True

    def test_award_badge_notifies(self, chapter_admin_token, scout_token):
        # count notifs before
        before = requests.get(f"{API}/notifications", headers=hdr(scout_token)).json()
        r = requests.post(f"{API}/badges/award",
                          json={"member_id": "mbr_narek", "badge_id": "bdg_camping"},
                          headers=hdr(chapter_admin_token))
        assert r.status_code == 200, r.text
        after = requests.get(f"{API}/notifications", headers=hdr(scout_token)).json()
        assert len(after) > len(before)


# ---------- Programs ----------
class TestPrograms:
    program_id = None

    def test_list_programs(self, admin_token):
        r = requests.get(f"{API}/programs", headers=hdr(admin_token))
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_create_program(self, admin_token):
        payload = {"title": "TEST_Program", "date": "2026-05-01", "section": "Scouts"}
        r = requests.post(f"{API}/programs", json=payload, headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        TestPrograms.program_id = r.json()["program_id"]

    def test_duplicate_program(self, admin_token):
        assert TestPrograms.program_id
        r = requests.post(f"{API}/programs/{TestPrograms.program_id}/duplicate", headers=hdr(admin_token))
        assert r.status_code == 200
        assert "(Copy)" in r.json()["title"]


# ---------- Attendance ----------
class TestAttendance:
    def test_record_and_list(self, chapter_admin_token):
        # find any ararat program
        progs = requests.get(f"{API}/programs", headers=hdr(chapter_admin_token)).json()
        prog = next((p for p in progs if p.get("chapter_id") == "chp_ararat"), progs[0])
        pid = prog["program_id"]
        r = requests.post(f"{API}/attendance",
                          json={"program_id": pid, "entries": [{"member_id": "mbr_narek", "status": "present"}]},
                          headers=hdr(chapter_admin_token))
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/attendance?program_id={pid}", headers=hdr(chapter_admin_token))
        assert g.status_code == 200
        assert any(a["member_id"] == "mbr_narek" for a in g.json())


# ---------- Newsletters ----------
class TestNewsletters:
    def test_create_newsletter(self, admin_token):
        r = requests.post(f"{API}/newsletters",
                          json={"title": "TEST_Newsletter", "content": "hi"},
                          headers=hdr(admin_token))
        assert r.status_code == 200


# ---------- Announcements ----------
class TestAnnouncements:
    def test_chapter_admin_announcement_scoped(self, chapter_admin_token):
        r = requests.post(f"{API}/announcements",
                          json={"title": "TEST_Ann", "message": "hello"},
                          headers=hdr(chapter_admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["chapter_id"] == "chp_ararat"


# ---------- Notifications ----------
class TestNotifications:
    def test_get_and_mark_read(self, scout_token):
        r = requests.get(f"{API}/notifications", headers=hdr(scout_token))
        assert r.status_code == 200
        items = r.json()
        if items:
            nid = items[0]["notification_id"]
            m = requests.post(f"{API}/notifications/{nid}/read", headers=hdr(scout_token))
            assert m.status_code == 200


# ---------- Stats ----------
class TestStats:
    def test_national(self, admin_token):
        r = requests.get(f"{API}/stats/national", headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_members", "total_chapters", "active_scouts", "badges_awarded", "per_chapter"):
            assert k in d

    def test_national_forbidden_for_scout(self, scout_token):
        r = requests.get(f"{API}/stats/national", headers=hdr(scout_token))
        assert r.status_code == 403

    def test_chapter(self, chapter_admin_token):
        r = requests.get(f"{API}/stats/chapter/chp_ararat", headers=hdr(chapter_admin_token))
        assert r.status_code == 200
        assert "by_section" in r.json()

    def test_chapter_denied_other(self, chapter_admin_token):
        r = requests.get(f"{API}/stats/chapter/chp_sevan", headers=hdr(chapter_admin_token))
        assert r.status_code == 403

    def test_scout_stats(self, scout_token):
        r = requests.get(f"{API}/stats/scout", headers=hdr(scout_token))
        assert r.status_code == 200
        d = r.json()
        assert d["linked"] is True
        assert d["member"]["member_id"] == "mbr_narek"


# ---------- Audit ----------
class TestAudit:
    def test_admin_only(self, admin_token, scout_token):
        assert requests.get(f"{API}/audit-logs", headers=hdr(admin_token)).status_code == 200
        assert requests.get(f"{API}/audit-logs", headers=hdr(scout_token)).status_code == 403


# ---------- User Role ----------
class TestUserRole:
    def test_update_role(self, admin_token):
        # create a throwaway user
        email = f"TEST_role_{uuid.uuid4().hex[:6]}@scouts.am"
        rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "x", "name": "R",
                                                         "chapter_id": "chp_ararat"})
        assert rr.status_code == 200, rr.text
        uid = rr.json()["user_id"]
        r = requests.put(f"{API}/users/{uid}/role",
                         json={"role": "chapter_leader", "chapter_id": "chp_sevan"},
                         headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["role"] == "chapter_leader"

    def test_role_forbidden_for_scout(self, scout_token):
        r = requests.put(f"{API}/users/usr_admin/role",
                         json={"role": "scout"},
                         headers=hdr(scout_token))
        assert r.status_code == 403


# ---------- Search ----------
class TestSearch:
    def test_search_chapter_by_name(self, admin_token):
        # Chapter names were renamed by the app owner; derive the query from live data
        chapters = requests.get(f"{API}/chapters", headers=hdr(admin_token)).json()
        assert chapters, "no chapters available to search"
        term = chapters[0]["name"].split()[0]
        r = requests.get(f"{API}/search?q={term}", headers=hdr(admin_token))
        assert r.status_code == 200
        j = r.json()
        assert len(j["chapters"]) >= 1
