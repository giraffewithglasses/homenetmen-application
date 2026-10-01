"""Iteration 8: badge-approval workflow additions - count endpoint, note body, bulk actions."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://badge-track-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "hovsepmarachlian@gmail.com", "password": "admin123"}
CHAPTER_ADMIN = {"email": "ararat.leader@scouts.am", "password": "scout123"}  # chp_ararat
OTHER_LEADER = {"email": "sevan.leader@scouts.am", "password": "scout123"}    # chp_sevan
SCOUT = {"email": "narek@scouts.am", "password": "scout123"}                  # chp_ararat


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login {creds['email']} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(ADMIN),
        "leader": _login(CHAPTER_ADMIN),
        "other": _login(OTHER_LEADER),
        "scout": _login(SCOUT),
    }


def _seed_request(tokens):
    """Have narek request a badge. Returns mb_id or skips if none available."""
    # find a badge that scout doesn't already have requested/awarded
    r = requests.get(f"{API}/badges", headers=_h(tokens["scout"]), timeout=20)
    assert r.status_code == 200, r.text
    badges = r.json()
    # get current member_badges for scout
    r2 = requests.get(f"{API}/badges/mine", headers=_h(tokens["scout"]), timeout=20)
    taken = set()
    if r2.status_code == 200:
        for mb in r2.json():
            taken.add(mb.get("badge_id"))
    for b in badges:
        bid = b.get("badge_id")
        if bid in taken:
            continue
        rq = requests.post(f"{API}/badges/request", headers=_h(tokens["scout"]),
                           json={"badge_id": bid}, timeout=20)
        if rq.status_code == 200:
            # locate the mb_id via leader list
            lr = requests.get(f"{API}/badges/requests", headers=_h(tokens["leader"]), timeout=20)
            assert lr.status_code == 200
            for item in lr.json():
                if item.get("badge_id") == bid and item.get("member_id"):
                    return item["mb_id"], bid
        elif rq.status_code == 400:
            continue
    pytest.skip("Could not seed a badge request")


# ---------- Count endpoint ----------
class TestCountEndpoint:
    def test_scout_gets_zero_not_403(self, tokens):
        r = requests.get(f"{API}/badges/requests/count", headers=_h(tokens["scout"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == {"count": 0}

    def test_admin_returns_count(self, tokens):
        r = requests.get(f"{API}/badges/requests/count", headers=_h(tokens["admin"]), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and isinstance(data["count"], int)

    def test_leader_chapter_scoped(self, tokens):
        # seed a request for narek (chp_ararat)
        mb_id, _ = _seed_request(tokens)
        # ararat leader should see >=1
        r = requests.get(f"{API}/badges/requests/count", headers=_h(tokens["leader"]), timeout=20)
        assert r.status_code == 200
        ararat_count = r.json()["count"]
        assert ararat_count >= 1
        # sevan leader should NOT see this request (different chapter)
        r2 = requests.get(f"{API}/badges/requests/count", headers=_h(tokens["other"]), timeout=20)
        assert r2.status_code == 200
        sevan_count = r2.json()["count"]
        # Not necessarily zero (sevan may have own), but the ararat request shouldn't be in it.
        # Deny it and confirm ararat count decreases while sevan stays same.
        d = requests.post(f"{API}/badges/requests/{mb_id}/deny",
                          headers=_h(tokens["leader"]), json={"note": ""}, timeout=20)
        assert d.status_code == 200
        r3 = requests.get(f"{API}/badges/requests/count", headers=_h(tokens["leader"]), timeout=20)
        assert r3.json()["count"] == ararat_count - 1
        r4 = requests.get(f"{API}/badges/requests/count", headers=_h(tokens["other"]), timeout=20)
        assert r4.json()["count"] == sevan_count


# ---------- Approve with note (in_progress and awarded) ----------
class TestApproveWithNote:
    def test_approve_in_progress_with_note(self, tokens):
        mb_id, bid = _seed_request(tokens)
        r = requests.post(f"{API}/badges/requests/{mb_id}/approve?mode=in_progress",
                          headers=_h(tokens["leader"]),
                          json={"note": "TEST_note_ip Keep it up!"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "in_progress"
        # verify notification to scout
        n = requests.get(f"{API}/notifications", headers=_h(tokens["scout"]), timeout=20)
        assert n.status_code == 200
        found = any("TEST_note_ip Keep it up!" in (x.get("message") or "") for x in n.json())
        assert found, "note not found in scout notification"

    def test_approve_awarded_with_note(self, tokens):
        mb_id, bid = _seed_request(tokens)
        r = requests.post(f"{API}/badges/requests/{mb_id}/approve?mode=awarded",
                          headers=_h(tokens["leader"]),
                          json={"note": "TEST_note_award Nice work!"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "awarded"
        n = requests.get(f"{API}/notifications", headers=_h(tokens["scout"]), timeout=20)
        found = any("TEST_note_award Nice work!" in (x.get("message") or "") for x in n.json())
        assert found

    def test_approve_no_body_still_works(self, tokens):
        mb_id, _ = _seed_request(tokens)
        r = requests.post(f"{API}/badges/requests/{mb_id}/approve?mode=in_progress",
                          headers=_h(tokens["leader"]), timeout=20)
        assert r.status_code == 200, r.text


# ---------- Deny with note ----------
class TestDenyWithNote:
    def test_deny_with_note(self, tokens):
        mb_id, _ = _seed_request(tokens)
        r = requests.post(f"{API}/badges/requests/{mb_id}/deny",
                          headers=_h(tokens["leader"]),
                          json={"note": "TEST_note_deny Try again next term"}, timeout=20)
        assert r.status_code == 200, r.text
        # Row deleted
        lst = requests.get(f"{API}/badges/requests", headers=_h(tokens["leader"]), timeout=20).json()
        assert not any(x["mb_id"] == mb_id for x in lst)
        # Notification present with note
        n = requests.get(f"{API}/notifications", headers=_h(tokens["scout"]), timeout=20).json()
        assert any("TEST_note_deny Try again next term" in (x.get("message") or "") for x in n)


# ---------- Bulk endpoint ----------
class TestBulk:
    def test_empty_returns_processed_zero(self, tokens):
        r = requests.post(f"{API}/badges/requests/bulk", headers=_h(tokens["leader"]),
                          json={"mb_ids": [], "action": "approve"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["processed"] == 0

    def test_bulk_approve_in_progress(self, tokens):
        # seed 2
        ids = []
        for _ in range(2):
            try:
                mb_id, _b = _seed_request(tokens)
                ids.append(mb_id)
            except Exception:
                break
        if len(ids) < 1:
            pytest.skip("could not seed")
        r = requests.post(f"{API}/badges/requests/bulk", headers=_h(tokens["leader"]),
                          json={"mb_ids": ids, "action": "approve", "mode": "in_progress",
                                "note": "TEST_bulk_ip good job"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["processed"] == len(ids)
        assert all(x["ok"] for x in body["results"])

    def test_bulk_deny(self, tokens):
        ids = []
        for _ in range(2):
            try:
                mb_id, _b = _seed_request(tokens)
                ids.append(mb_id)
            except Exception:
                break
        if not ids:
            pytest.skip("no seeds")
        r = requests.post(f"{API}/badges/requests/bulk", headers=_h(tokens["leader"]),
                          json={"mb_ids": ids, "action": "deny", "note": "TEST_bulk_deny"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["processed"] == len(ids)
        # rows gone
        lst = requests.get(f"{API}/badges/requests", headers=_h(tokens["leader"]), timeout=20).json()
        rem = [x["mb_id"] for x in lst]
        for i in ids:
            assert i not in rem

    def test_bulk_forbidden_silent_for_out_of_chapter(self, tokens):
        # seed request for narek (ararat), attempt to bulk-approve as sevan leader
        mb_id, _ = _seed_request(tokens)
        r = requests.post(f"{API}/badges/requests/bulk", headers=_h(tokens["other"]),
                          json={"mb_ids": [mb_id], "action": "approve", "mode": "in_progress"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["processed"] == 0
        assert body["results"][0]["ok"] is False
        assert body["results"][0]["reason"] == "forbidden"
        # cleanup
        requests.post(f"{API}/badges/requests/{mb_id}/deny", headers=_h(tokens["leader"]),
                      json={"note": ""}, timeout=20)

    def test_bulk_invalid_action(self, tokens):
        r = requests.post(f"{API}/badges/requests/bulk", headers=_h(tokens["leader"]),
                          json={"mb_ids": ["mb_x"], "action": "explode"}, timeout=20)
        assert r.status_code == 400
