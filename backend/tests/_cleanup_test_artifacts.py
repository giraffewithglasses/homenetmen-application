"""Cleanup leftover TEST_ artifacts created by earlier testing iterations and
restore the leader profile fields mutated by the iteration-3 UI test."""
from pymongo import MongoClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")
db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]

print("newsletters removed:", db.newsletters.delete_many({"title": {"$regex": "^TEST_"}}).deleted_count)
print("members removed:", db.members.delete_many({"full_name": {"$regex": "^TEST_"}}).deleted_count)
print("users removed:", db.users.delete_many({"email": {"$regex": "^test_"}}).deleted_count)
print("chapters removed:", db.chapters.delete_many({"name": {"$regex": "^TEST_"}}).deleted_count)
print("badges removed:", db.badges.delete_many({"name": {"$regex": "^TEST_"}}).deleted_count)
print("galleries removed:", db.galleries.delete_many({"title": {"$regex": "^TEST_"}}).deleted_count)

r = db.users.update_one(
    {"email": "sevan.leader@scouts.am"},
    {"$set": {"position_title": "", "bio": "", "phone": ""}},
)
print("sevan leader profile restored:", r.modified_count)
