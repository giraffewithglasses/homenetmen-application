from pymongo import MongoClient
from dotenv import dotenv_values

env = dotenv_values("/app/backend/.env")
db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
for u in db.users.find({}, {"_id": 0, "email": 1, "role": 1, "status": 1, "chapter_id": 1, "password_hash": 1}):
    ph = u.get("password_hash") or ""
    print(u.get("email"), u.get("role"), u.get("status"), u.get("chapter_id"), ph[:4])
print("members:", db.members.count_documents({}), "galleries:", db.galleries.count_documents({}))
