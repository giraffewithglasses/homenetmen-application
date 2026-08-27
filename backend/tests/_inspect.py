import os
from pymongo import MongoClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")
c = MongoClient(env["MONGO_URL"])
db = c[env["DB_NAME"]]
for u in db.users.find({}, {"_id": 0, "pending_member_profile": 0}):
    print(u.get("email"), "|", u.get("role"), "|", u.get("status"), "|", u.get("chapter_id"), "|hash:", str(u.get("password_hash"))[:7])
print("users total:", db.users.count_documents({}))
print("members:", db.members.count_documents({}), "programs:", db.programs.count_documents({}), "chapters:", db.chapters.count_documents({}))
