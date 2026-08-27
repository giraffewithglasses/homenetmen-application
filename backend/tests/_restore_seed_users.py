"""Restore the seeded leader accounts that were missing from the users collection.

Root cause: server.seed() is non-idempotent (early-returns when a national_admin exists),
so any seeded account that gets deleted is never recreated. Restoring here so auth-gated
testing can continue.
"""
import bcrypt
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")
db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


def h(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


now = datetime.now(timezone.utc).isoformat()
seeded = [
    {"user_id": "usr_ararat_admin", "email": "ararat.leader@scouts.am", "name": "Anahit Sargsyan",
     "password_hash": h("scout123"), "role": "chapter_admin", "chapter_id": "chp_ararat",
     "picture": "", "status": "active", "created_at": now},
    {"user_id": "usr_sevan_leader", "email": "sevan.leader@scouts.am", "name": "Davit Petrosyan",
     "password_hash": h("scout123"), "role": "chapter_leader", "chapter_id": "chp_sevan",
     "picture": "", "status": "active", "created_at": now},
    {"user_id": "usr_gyumri_admin", "email": "gyumri.leader@scouts.am", "name": "Mher Grigoryan",
     "password_hash": h("scout123"), "role": "chapter_admin", "chapter_id": "chp_gyumri",
     "picture": "", "status": "active", "created_at": now},
]
for u in seeded:
    res = db.users.update_one({"email": u["email"]}, {"$set": u}, upsert=True)
    print(u["email"], "matched", res.matched_count, "upserted", res.upserted_id)

# remove leftover test artifacts from previous runs
r = db.users.delete_many({"email": {"$regex": "^test_"}})
print("removed leftover test users:", r.deleted_count)
