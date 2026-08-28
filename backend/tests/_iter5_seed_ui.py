"""Create UI fixtures for iteration 5 frontend testing: paid program + archived chapter with links."""
import json
import os
import sys

import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
s = requests.Session()
tok = s.post(f"{BASE}/api/auth/login", json={"email": "hovsepmarachlian@gmail.com", "password": "admin123"}).json()["access_token"]
s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})

if sys.argv[1] == "create":
    prg = s.post(f"{BASE}/api/programs", json={
        "title": "TEST_UI Paid Camp", "date": "2026-12-20", "level": "national",
        "fee": 30.0, "currency": "usd", "description": "UI paid program"}).json()
    chp = s.post(f"{BASE}/api/chapters", json={"name": "TEST_UI Cascade Chapter", "location": "TEST"}).json()
    cid = chp["chapter_id"]
    mbr = s.post(f"{BASE}/api/members", json={"full_name": "TEST_UI Member", "chapter_id": cid}).json()
    cprg = s.post(f"{BASE}/api/programs", json={
        "title": "TEST_UI Chapter Program", "date": "2026-12-21", "level": "chapter", "chapter_id": cid}).json()
    s.post(f"{BASE}/api/chapters/{cid}/archive")
    out = {"paid_program": prg["program_id"], "chapter": cid, "member": mbr["member_id"], "chapter_program": cprg["program_id"]}
    open("/tmp/iter5_ui.json", "w").write(json.dumps(out))
    print(json.dumps(out))
else:
    d = json.load(open("/tmp/iter5_ui.json"))
    print(s.delete(f"{BASE}/api/programs/{d['paid_program']}").status_code)
    print(s.delete(f"{BASE}/api/programs/{d['chapter_program']}").status_code)
    print(s.delete(f"{BASE}/api/members/{d['member']}").status_code)
    print(s.delete(f"{BASE}/api/chapters/{d['chapter']}?force=true").status_code)
    # remove leftover TEST_ artifacts
    for p in s.get(f"{BASE}/api/programs").json():
        if p["title"].startswith("TEST_"):
            print("prg", p["program_id"], s.delete(f"{BASE}/api/programs/{p['program_id']}").status_code)
    for c in s.get(f"{BASE}/api/chapters?include_archived=true").json():
        if c["name"].startswith("TEST_"):
            print("chp", c["chapter_id"], s.delete(f"{BASE}/api/chapters/{c['chapter_id']}?force=true").status_code)
    for m in s.get(f"{BASE}/api/members?include_archived=true").json():
        if m["full_name"].startswith("TEST_"):
            print("mbr", m["member_id"], s.delete(f"{BASE}/api/members/{m['member_id']}").status_code)
