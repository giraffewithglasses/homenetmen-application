"""Restore seeded members that were left in status='archived'.

Root cause: DELETE /api/members/{id} soft-archives, and the Members page bulk-archive
was applied to every seeded member. There is NO unarchive endpoint for members and
/api/trash does not list members, so they could not be restored through the API.
"""
from pymongo import MongoClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")
db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]

res = db.members.update_many(
    {"status": "archived", "full_name": {"$not": {"$regex": "^TEST_"}}},
    {"$set": {"status": "active"}},
)
print("restored members:", res.modified_count)
print("active now:", db.members.count_documents({"status": "active"}))
