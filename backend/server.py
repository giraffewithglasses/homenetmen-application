from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import bcrypt
import jwt
import secrets
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
def jwt_secret(): return os.environ["JWT_SECRET"]

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scouting")

# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_access_token(uid: str, email: str) -> str:
    payload = {"sub": uid, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12),
               "type": "access"}
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(uid: str) -> str:
    payload = {"sub": uid,
               "exp": datetime.now(timezone.utc) + timedelta(days=7),
               "type": "refresh"}
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=12*3600, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=7*86400, path="/")

def clear_auth_cookies(resp: Response):
    for c in ("access_token", "refresh_token", "session_token"):
        resp.delete_cookie(c, path="/")

async def _user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        u = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        return u
    except Exception:
        return None

async def _user_from_session(session_token: str) -> Optional[dict]:
    s = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not s:
        return None
    exp = s.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": s["user_id"]}, {"_id": 0, "password_hash": 0})

async def get_current_user(request: Request) -> dict:
    # try jwt cookie
    tok = request.cookies.get("access_token")
    if tok:
        u = await _user_from_token(tok)
        if u: return u
    # try session cookie
    sess = request.cookies.get("session_token")
    if sess:
        u = await _user_from_session(sess)
        if u: return u
    # bearer
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        t = auth[7:]
        u = await _user_from_token(t) or await _user_from_session(t)
        if u: return u
    raise HTTPException(401, "Not authenticated")

def require_roles(*roles):
    async def _dep(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _dep

LEADER_ROLES = ("chapter_admin", "chapter_leader", "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader")
ADMIN_ROLES = ("national_admin", "chapter_admin")
STAFF_ROLES = ("national_admin",) + LEADER_ROLES  # anyone who can manage stuff for a chapter

def is_leader(role: str) -> bool:
    return role in LEADER_ROLES or role == "national_admin"

POSITION_TO_ROLE = {
    "Chapter Admin": "chapter_admin",
    "Chapter Leader": "chapter_leader",
    "Scout Leader": "scout_leader",
    "Cubs Leader": "cubs_leader",
    "Patrol Leader": "patrol_leader",
    "Patrol Co-Leader": "patrol_co_leader",
}

async def audit(user: dict, action: str, entity: str, entity_id: str = "", meta: dict = None):
    await db.audit_logs.insert_one({
        "log_id": new_id("log"),
        "user_id": user.get("user_id"),
        "user_email": user.get("email"),
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "meta": meta or {},
        "created_at": now_iso(),
    })

async def notify(user_ids: List[str], title: str, message: str, kind: str = "info", link: str = ""):
    docs = [{
        "notification_id": new_id("ntf"),
        "user_id": uid,
        "title": title,
        "message": message,
        "kind": kind,
        "link": link,
        "read": False,
        "created_at": now_iso(),
    } for uid in user_ids]
    if docs:
        await db.notifications.insert_many(docs)

def clean(d: dict) -> dict:
    d.pop("_id", None)
    return d

# ---------- Security: brute-force protection ----------
_LOGIN_ATTEMPTS: dict = {}  # key -> {count: int, first: datetime, locked_until: datetime|None}
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_MAX_ATTEMPTS = 6
LOGIN_LOCKOUT = timedelta(minutes=15)

def _rate_key(request: Request, email: str) -> str:
    ip = (request.headers.get("x-forwarded-for", "") or request.client.host or "").split(",")[0].strip()
    return f"{ip}::{email.lower()}"

def check_login_rate(request: Request, email: str) -> None:
    key = _rate_key(request, email)
    now = datetime.now(timezone.utc)
    rec = _LOGIN_ATTEMPTS.get(key)
    if rec and rec.get("locked_until") and rec["locked_until"] > now:
        secs = int((rec["locked_until"] - now).total_seconds())
        raise HTTPException(429, f"Too many failed attempts. Try again in {secs // 60 + 1} min.")
    if rec and now - rec["first"] > LOGIN_WINDOW:
        _LOGIN_ATTEMPTS.pop(key, None)

def register_failed_login(request: Request, email: str) -> None:
    key = _rate_key(request, email)
    now = datetime.now(timezone.utc)
    rec = _LOGIN_ATTEMPTS.get(key) or {"count": 0, "first": now, "locked_until": None}
    rec["count"] += 1
    if rec["count"] >= LOGIN_MAX_ATTEMPTS:
        rec["locked_until"] = now + LOGIN_LOCKOUT
    _LOGIN_ATTEMPTS[key] = rec

def clear_login_attempts(request: Request, email: str) -> None:
    _LOGIN_ATTEMPTS.pop(_rate_key(request, email), None)

def validate_password_strength(pw: str) -> None:
    if len(pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not any(c.isdigit() for c in pw):
        raise HTTPException(400, "Password must contain at least one number")
    if not any(c.isalpha() for c in pw):
        raise HTTPException(400, "Password must contain at least one letter")

# ---------- Models ----------
class GalleryIn(BaseModel):
    title: str
    description: str = ""
    cover: str = ""
    chapter_id: Optional[str] = None
    images: List[dict] = []  # [{data: base64, caption: str}]

class PromoteMemberIn(BaseModel):
    member_id: str
    position: str  # e.g. "Scout Leader", "Cubs Leader", "Chapter Leader"

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    chapter_id: str  # required — chapter to join
    signup_type: str = "scout"  # "scout" | "leader"
    requested_role: Optional[str] = "scout"
    # scout profile (only used when signup_type == "scout")
    full_name_hy: Optional[str] = ""
    dob: Optional[str] = ""
    gender: Optional[str] = ""
    phone: Optional[str] = ""
    section: Optional[str] = "Scouts"
    patrol: Optional[str] = ""
    guardian_name: Optional[str] = ""
    guardian_phone: Optional[str] = ""
    emergency_contact: Optional[str] = ""

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class SessionIn(BaseModel):
    session_id: str

class ChapterIn(BaseModel):
    name: str
    name_hy: Optional[str] = ""
    location: str = ""
    description: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    logo: str = ""  # base64
    cover: str = ""

class MemberIn(BaseModel):
    full_name: str
    full_name_hy: Optional[str] = ""
    photo: str = ""
    dob: str = ""
    gender: str = ""
    phone: str = ""
    email: str = ""
    guardian_name: str = ""
    guardian_phone: str = ""
    emergency_contact: str = ""
    chapter_id: str
    section: str = "Scouts"  # Cubs, Scouts, Senior Scouts, Rovers
    patrol: str = ""
    membership_start: str = ""
    status: str = "active"
    position: str = "Member"
    notes: str = ""

class BadgeIn(BaseModel):
    name: str
    name_hy: Optional[str] = ""
    icon: str = ""  # lucide icon name (fallback)
    icon_image: str = ""  # base64 data URL (preferred if provided)
    color: str = "#2D6A4F"
    description: str = ""
    section: str = "Scouts"
    category: str = "Scouting Skills"
    difficulty: str = "medium"
    recommended_age: str = ""
    requirements: List[str] = []

class ProgramIn(BaseModel):
    title: str
    title_hy: Optional[str] = ""
    description: str = ""
    date: str
    start_time: str = ""
    end_time: str = ""
    location: str = ""
    section: str = "Scouts"
    sections: List[str] = []  # multi-section support: Cubs, Scouts, Senior Scouts, Rovers
    level: str = "chapter"  # chapter | regional | national
    chapter_id: Optional[str] = None  # None = national
    leaders: List[str] = []
    expected_participants: int = 0
    capacity: int = 0  # 0 = unlimited
    waitlist_enabled: bool = False
    materials: str = ""
    objectives: str = ""
    related_badges: List[str] = []
    activities: List[dict] = []  # [{time, title, description}]
    cover: str = ""
    fee: float = 0.0  # program fee (0 = free)
    currency: str = "amd"
    prerequisites: str = ""

class AttendanceIn(BaseModel):
    program_id: str
    entries: List[dict]  # [{member_id, status: present|absent|late|excused}]

class NewsletterIn(BaseModel):
    title: str
    title_hy: Optional[str] = ""
    cover: str = ""
    short_description: str = ""
    content: str = ""
    pdf: str = ""
    author: str = ""

class AnnouncementIn(BaseModel):
    title: str
    title_hy: Optional[str] = ""
    message: str
    image: str = ""
    priority: str = "normal"  # low, normal, high, urgent
    expires_at: str = ""
    chapter_id: Optional[str] = None  # None = national

class ResourceIn(BaseModel):
    title: str
    category: str = "Manuals"
    description: str = ""
    file_data: str = ""  # base64
    file_name: str = ""
    file_type: str = ""

class BadgeAwardIn(BaseModel):
    member_id: str
    badge_id: str

class RequirementUpdate(BaseModel):
    member_id: str
    badge_id: str
    requirement_index: int
    completed: bool

# ---------- Public (Guest) Endpoints ----------
@api.get("/public/leaders")
async def public_leaders():
    q = {"role": {"$in": ["national_admin"] + list(LEADER_ROLES)}, "status": "active"}
    items = await db.users.find(q, {"_id": 0, "user_id": 1, "name": 1, "role": 1, "picture": 1, "chapter_id": 1, "bio": 1, "phone": 1, "position_title": 1, "email": 1}).sort("role", 1).to_list(200)
    chapters = {c["chapter_id"]: c["name"] for c in await db.chapters.find({}, {"chapter_id": 1, "name": 1}).to_list(200)}
    for it in items:
        it["chapter_name"] = chapters.get(it.get("chapter_id"), "")
    return items

@api.get("/public/leaders/{uid}")
async def public_leader(uid: str):
    u = await db.users.find_one({"user_id": uid, "status": "active"}, {"_id": 0, "user_id": 1, "name": 1, "role": 1, "picture": 1, "chapter_id": 1, "bio": 1, "phone": 1, "position_title": 1, "email": 1})
    if not u: raise HTTPException(404, "Not found")
    if u.get("chapter_id"):
        c = await db.chapters.find_one({"chapter_id": u["chapter_id"]}, {"name": 1})
        u["chapter_name"] = c["name"] if c else ""
    return u

@api.get("/public/galleries")
async def public_galleries():
    items = await db.galleries.find({}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
    for g in items:
        # trim payload: only keep first 12 image thumbs
        g["images"] = (g.get("images") or [])[:12]
    return items

@api.get("/public/overview")
async def public_overview():
    """Public snapshot for the guest / landing page — safe, non-sensitive info only."""
    chapters = await db.chapters.find(
        {"archived": {"$ne": True}}, {"_id": 0, "chapter_id": 1, "name": 1, "name_hy": 1, "location": 1, "description": 1}
    ).to_list(50)
    for c in chapters:
        c["member_count"] = await db.members.count_documents(
            {"chapter_id": c["chapter_id"], "status": {"$ne": "archived"}}
        )
    total_members = await db.members.count_documents({"status": {"$ne": "archived"}})
    total_badges = await db.badges.count_documents({"archived": {"$ne": True}})
    total_programs = await db.programs.count_documents({})
    total_awarded = await db.member_badges.count_documents({"awarded": True})
    return {
        "stats": {
            "chapters": len(chapters),
            "members": total_members,
            "badges": total_badges,
            "programs": total_programs,
            "badges_awarded": total_awarded,
        },
        "chapters": chapters,
    }

@api.get("/public/badges")
async def public_badges():
    return await db.badges.find({"archived": {"$ne": True}}, {"_id": 0}).sort("name", 1).to_list(500)

@api.get("/public/newsletters")
async def public_newsletters():
    # Skip the base64 pdf blob for guest view
    return await db.newsletters.find({}, {"_id": 0, "pdf": 0}).sort("created_at", -1).to_list(50)

@api.get("/public/programs/upcoming")
async def public_upcoming_programs():
    today_iso = datetime.now(timezone.utc).date().isoformat()
    items = await db.programs.find(
        {"date": {"$gte": today_iso}},
        {"_id": 0, "program_id": 1, "title": 1, "title_hy": 1, "description": 1,
         "date": 1, "start_time": 1, "end_time": 1, "location": 1, "section": 1,
         "chapter_id": 1, "activities": 1}
    ).sort("date", 1).limit(12).to_list(12)
    return items

@api.get("/public/announcements")
async def public_announcements():
    # Only national announcements are public
    items = await db.announcements.find(
        {"chapter_id": None}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    return items

@api.get("/public/resources")
async def public_resources(category: Optional[str] = None):
    q = {"archived": {"$ne": True}}
    if category: q["category"] = category
    # omit large base64 blob in listing
    return await db.resources.find(q, {"_id": 0, "file_data": 0}).sort("created_at", -1).to_list(500)

@api.get("/public/resources/{rid}")
async def public_resource_download(rid: str):
    r = await db.resources.find_one({"resource_id": rid, "archived": {"$ne": True}}, {"_id": 0})
    if not r: raise HTTPException(404, "Not found")
    return r

@api.get("/public/members/{member_id}/verify")
async def public_verify_member(member_id: str):
    """Public membership verification endpoint used by printed QR codes."""
    m = await db.members.find_one({"member_id": member_id}, {"_id": 0, "notes": 0, "guardian_phone": 0, "emergency_contact": 0, "phone": 0, "dob": 0})
    if not m:
        return {"valid": False, "reason": "not_found"}
    valid = m.get("status") != "archived"
    chapter = None
    if m.get("chapter_id"):
        c = await db.chapters.find_one({"chapter_id": m["chapter_id"], "archived": {"$ne": True}}, {"_id": 0, "name": 1, "location": 1})
        chapter = c
    return {
        "valid": valid,
        "member": {
            "member_id": m["member_id"],
            "full_name": m.get("full_name"),
            "full_name_hy": m.get("full_name_hy"),
            "section": m.get("section"),
            "patrol": m.get("patrol"),
            "position": m.get("position"),
            "membership_start": m.get("membership_start"),
            "status": m.get("status"),
            "photo": m.get("photo"),
        },
        "chapter": chapter,
    }

@api.get("/public/homepage-settings")
async def public_homepage_settings():
    """Editable homepage config (footer info + section order). Falls back to defaults."""
    s = await db.homepage_settings.find_one({"key": "singleton"}, {"_id": 0, "key": 0})
    defaults = {
        "footer": {
            "description": "The scouting movement of HOMENETMEN — building character through the outdoors, community, and service.",
            "description_hy": "ՀՄԸՄ-ի սկաուտական շարժումը՝ բնության, համայնքի և ծառայության միջոցով բնավորության կրթություն։",
            "hq_address": "Yervand Kochar 17/6\nYerevan, Armenia",
            "hq_email": "hq@homenetmen-hask.am",
            "hq_phone": "+374 10 000 000",
            "latitude": 40.1840,
            "longitude": 44.5110,
        },
        "section_order": ["chapters", "events", "badges", "newsletters", "leaders", "galleries", "resources"],
    }
    if not s: return defaults
    merged = {**defaults, **s}
    merged["footer"] = {**defaults["footer"], **(s.get("footer") or {})}
    if not merged.get("section_order"): merged["section_order"] = defaults["section_order"]
    return merged

class HomepageSettingsIn(BaseModel):
    footer: dict
    section_order: List[str]

@api.put("/homepage-settings")
async def update_homepage_settings(payload: HomepageSettingsIn, user: dict = Depends(require_roles("national_admin"))):
    doc = {"key": "singleton", "footer": payload.footer, "section_order": payload.section_order, "updated_at": now_iso(), "updated_by": user["email"]}
    await db.homepage_settings.update_one({"key": "singleton"}, {"$set": doc}, upsert=True)
    await audit(user, "update", "homepage_settings", "singleton")
    return {"ok": True}

# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    validate_password_strength(payload.password)
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    chapter = await db.chapters.find_one({"chapter_id": payload.chapter_id})
    if not chapter:
        raise HTTPException(400, "Invalid chapter")
    is_leader_signup = payload.signup_type == "leader"
    uid = new_id("usr")
    pending_member = None
    if not is_leader_signup:
        # scout signup — stash a pending member profile keyed to the pending user
        pending_member = {
            "full_name": payload.name,
            "full_name_hy": payload.full_name_hy or "",
            "email": email,
            "phone": payload.phone or "",
            "dob": payload.dob or "",
            "gender": payload.gender or "",
            "chapter_id": payload.chapter_id,
            "section": payload.section or "Scouts",
            "patrol": payload.patrol or "",
            "guardian_name": payload.guardian_name or "",
            "guardian_phone": payload.guardian_phone or "",
            "emergency_contact": payload.emergency_contact or "",
            "membership_start": now_iso()[:10],
            "position": "Member",
            "status": "active",
            "notes": "",
            "photo": "",
        }
    doc = {
        "user_id": uid, "email": email, "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": "scout", "chapter_id": payload.chapter_id,
        "picture": "", "status": "pending",
        "signup_type": payload.signup_type,
        "requested_role": (payload.requested_role or "scout") if is_leader_signup else "scout",
        "pending_member_profile": pending_member,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    # Notify chapter approvers + national admins
    approvers = await db.users.find(
        {"$or": [
            {"role": "national_admin"},
            {"role": {"$in": list(LEADER_ROLES)}, "chapter_id": payload.chapter_id},
        ]},
        {"user_id": 1}
    ).to_list(200)
    title = "New leader application" if is_leader_signup else "New scout signup"
    await notify(
        [u["user_id"] for u in approvers], title,
        f"{payload.name} ({email}) requested to join {chapter['name']}.",
        "info", "/administration",
    )
    return {
        "user_id": uid, "email": email, "name": payload.name,
        "role": "scout", "chapter_id": payload.chapter_id,
        "status": "pending", "signup_type": payload.signup_type,
        "message": "Registration submitted. A chapter leader will review and approve your account shortly.",
    }

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response, request: Request):
    email = payload.email.lower()
    check_login_rate(request, email)
    u = await db.users.find_one({"email": email})
    if not u or not u.get("password_hash") or not verify_password(payload.password, u["password_hash"]):
        register_failed_login(request, email)
        raise HTTPException(401, "Invalid email or password")
    if u.get("status") == "pending":
        raise HTTPException(403, "Your account is awaiting chapter leader approval.")
    if u.get("status") == "rejected":
        raise HTTPException(403, "Your registration was not approved. Please contact your chapter.")
    if u.get("status") == "archived":
        raise HTTPException(403, "Your account has been archived. Please contact your chapter.")
    clear_login_attempts(request, email)
    access = create_access_token(u["user_id"], email)
    refresh = create_refresh_token(u["user_id"])
    set_auth_cookies(response, access, refresh)
    return {"user_id": u["user_id"], "email": email, "name": u["name"], "role": u["role"],
            "chapter_id": u.get("chapter_id"), "picture": u.get("picture", ""),
            "status": u.get("status", "active"),
            "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response, request: Request):
    sess = request.cookies.get("session_token")
    if sess:
        await db.user_sessions.delete_one({"session_token": sess})
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/session")
async def emergent_session(payload: SessionIn, response: Response):
    # Verify session_id with Emergent auth service
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
            if r.status_code != 200:
                raise HTTPException(401, "Invalid session_id")
            data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Auth service unreachable: {e}")

    email = data["email"].lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        uid = existing["user_id"]
        await db.users.update_one({"user_id": uid}, {"$set": {"picture": data.get("picture", ""), "name": data.get("name", existing.get("name"))}})
    else:
        uid = new_id("usr")
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": data.get("name", email),
            "picture": data.get("picture", ""), "role": "scout",
            "chapter_id": None,
            "status": "profile_incomplete",  # must complete signup before use
            "signup_type": "scout",
            "created_at": now_iso(),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_id": new_id("ses"),
        "user_id": uid,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)),
        "created_at": now_iso(),
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", max_age=7*86400, path="/")
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    return u

class CompleteProfileIn(BaseModel):
    chapter_id: str
    signup_type: str = "scout"  # scout | leader
    requested_role: Optional[str] = "scout"
    # scout profile
    full_name_hy: Optional[str] = ""
    dob: Optional[str] = ""
    gender: Optional[str] = ""
    phone: Optional[str] = ""
    section: Optional[str] = "Scouts"
    patrol: Optional[str] = ""
    guardian_name: Optional[str] = ""
    guardian_phone: Optional[str] = ""
    emergency_contact: Optional[str] = ""

@api.post("/auth/complete-profile")
async def complete_profile(payload: CompleteProfileIn, user: dict = Depends(get_current_user)):
    if user.get("status") not in ("profile_incomplete", "pending"):
        raise HTTPException(400, "Profile already complete")
    chapter = await db.chapters.find_one({"chapter_id": payload.chapter_id})
    if not chapter:
        raise HTTPException(400, "Invalid chapter")
    is_leader_signup = payload.signup_type == "leader"
    upd = {
        "chapter_id": payload.chapter_id,
        "status": "pending",
        "signup_type": payload.signup_type,
        "requested_role": (payload.requested_role or "scout") if is_leader_signup else "scout",
    }
    if not is_leader_signup:
        upd["pending_member_profile"] = {
            "full_name": user["name"],
            "full_name_hy": payload.full_name_hy or "",
            "email": user["email"],
            "phone": payload.phone or "",
            "dob": payload.dob or "",
            "gender": payload.gender or "",
            "chapter_id": payload.chapter_id,
            "section": payload.section or "Scouts",
            "patrol": payload.patrol or "",
            "guardian_name": payload.guardian_name or "",
            "guardian_phone": payload.guardian_phone or "",
            "emergency_contact": payload.emergency_contact or "",
            "membership_start": now_iso()[:10],
            "position": "Member",
            "status": "active",
            "notes": "",
            "photo": "",
        }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    # Notify chapter approvers + national admins
    approvers = await db.users.find(
        {"$or": [
            {"role": "national_admin"},
            {"role": {"$in": list(LEADER_ROLES)}, "chapter_id": payload.chapter_id},
        ]},
        {"user_id": 1}
    ).to_list(200)
    title = "New leader application" if is_leader_signup else "New scout signup"
    await notify(
        [u["user_id"] for u in approvers], title,
        f"{user['name']} ({user['email']}) requested to join {chapter['name']}.",
        "info", "/administration",
    )
    return {"ok": True, "status": "pending"}

# ---------- Chapters ----------
@api.get("/chapters")
async def list_chapters(include_archived: bool = False):
    q = {} if include_archived else {"archived": {"$ne": True}}
    items = await db.chapters.find(q, {"_id": 0}).to_list(500)
    for c in items:
        c["member_count"] = await db.members.count_documents({"chapter_id": c["chapter_id"], "status": {"$ne": "archived"}})
    return items

@api.get("/chapters/{chapter_id}")
async def get_chapter(chapter_id: str):
    c = await db.chapters.find_one({"chapter_id": chapter_id}, {"_id": 0})
    if not c: raise HTTPException(404, "Chapter not found")
    c["member_count"] = await db.members.count_documents({"chapter_id": chapter_id, "status": {"$ne": "archived"}})
    c["leaders"] = await db.users.find({"chapter_id": chapter_id, "role": {"$in": ["chapter_admin", "chapter_leader"]}, "status": "active"}, {"_id": 0, "password_hash": 0}).to_list(50)
    return c

@api.post("/chapters")
async def create_chapter(payload: ChapterIn, user: dict = Depends(require_roles("national_admin"))):
    cid = new_id("chp")
    doc = {"chapter_id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.chapters.insert_one(doc)
    await audit(user, "create", "chapter", cid)
    return clean(doc)

@api.put("/chapters/{chapter_id}")
async def update_chapter(chapter_id: str, payload: ChapterIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("national_admin", "chapter_admin") or (user["role"] == "chapter_admin" and user.get("chapter_id") != chapter_id):
        raise HTTPException(403, "Not allowed")
    await db.chapters.update_one({"chapter_id": chapter_id}, {"$set": payload.model_dump()})
    await audit(user, "update", "chapter", chapter_id)
    c = await db.chapters.find_one({"chapter_id": chapter_id}, {"_id": 0})
    return c

@api.get("/chapters/{chapter_id}/impact")
async def chapter_delete_impact(chapter_id: str, user: dict = Depends(require_roles("national_admin"))):
    """Preview what deleting a chapter will affect."""
    c = await db.chapters.find_one({"chapter_id": chapter_id}, {"_id": 0})
    if not c: raise HTTPException(404, "Chapter not found")
    return {
        "chapter": c,
        "members_active": await db.members.count_documents({"chapter_id": chapter_id, "status": {"$ne": "archived"}}),
        "members_archived": await db.members.count_documents({"chapter_id": chapter_id, "status": "archived"}),
        "users": await db.users.count_documents({"chapter_id": chapter_id}),
        "programs": await db.programs.count_documents({"chapter_id": chapter_id}),
    }

@api.delete("/chapters/{chapter_id}")
async def delete_chapter(
    chapter_id: str,
    reassign_to: Optional[str] = None,
    force: bool = False,
    user: dict = Depends(require_roles("national_admin")),
):
    c = await db.chapters.find_one({"chapter_id": chapter_id})
    if not c: raise HTTPException(404, "Chapter not found")
    active_members = await db.members.count_documents({"chapter_id": chapter_id, "status": {"$ne": "archived"}})
    linked_users = await db.users.count_documents({"chapter_id": chapter_id})
    programs = await db.programs.count_documents({"chapter_id": chapter_id})
    if (active_members or linked_users or programs) and not (reassign_to or force):
        raise HTTPException(
            409,
            {
                "message": "Chapter has linked records. Choose to reassign or force-orphan.",
                "members_active": active_members,
                "users": linked_users,
                "programs": programs,
            },
        )
    if reassign_to:
        if reassign_to == chapter_id:
            raise HTTPException(400, "Cannot reassign to the same chapter")
        target = await db.chapters.find_one({"chapter_id": reassign_to})
        if not target: raise HTTPException(400, "reassign_to chapter not found")
        await db.members.update_many({"chapter_id": chapter_id}, {"$set": {"chapter_id": reassign_to}})
        await db.users.update_many({"chapter_id": chapter_id}, {"$set": {"chapter_id": reassign_to}})
        await db.programs.update_many({"chapter_id": chapter_id}, {"$set": {"chapter_id": reassign_to}})
    elif force:
        # Orphan: null out chapter_id references so nothing points at a dead id
        await db.members.update_many({"chapter_id": chapter_id}, {"$set": {"chapter_id": None}})
        await db.users.update_many({"chapter_id": chapter_id}, {"$set": {"chapter_id": None}})
        await db.programs.update_many({"chapter_id": chapter_id}, {"$set": {"chapter_id": None}})
    await db.chapters.delete_one({"chapter_id": chapter_id})
    await audit(user, "delete", "chapter", chapter_id, {"reassign_to": reassign_to, "force": force})
    return {"ok": True, "reassigned_to": reassign_to, "orphaned": force and not reassign_to}

@api.post("/chapters/{chapter_id}/archive")
async def archive_chapter(chapter_id: str, user: dict = Depends(require_roles("national_admin"))):
    await db.chapters.update_one({"chapter_id": chapter_id}, {"$set": {"archived": True}})
    await audit(user, "archive", "chapter", chapter_id)
    return {"ok": True}

@api.post("/chapters/{chapter_id}/unarchive")
async def unarchive_chapter(chapter_id: str, user: dict = Depends(require_roles("national_admin"))):
    await db.chapters.update_one({"chapter_id": chapter_id}, {"$set": {"archived": False}})
    await audit(user, "unarchive", "chapter", chapter_id)
    return {"ok": True}

# ---------- Members ----------
def _member_chapter_guard(user: dict, chapter_id: str):
    if user["role"] == "national_admin":
        return
    if user["role"] in LEADER_ROLES and user.get("chapter_id") == chapter_id:
        return
    raise HTTPException(403, "Not allowed for this chapter")

@api.get("/members")
async def list_members(chapter_id: Optional[str] = None, section: Optional[str] = None, status: Optional[str] = None, q: Optional[str] = None, include_archived: bool = False, user: dict = Depends(get_current_user)):
    query: dict = {}
    if user["role"] == "national_admin":
        if chapter_id: query["chapter_id"] = chapter_id
    elif user["role"] in ("chapter_admin", "chapter_leader"):
        query["chapter_id"] = user.get("chapter_id")
    else:  # scout
        query["chapter_id"] = user.get("chapter_id")
    if section: query["section"] = section
    if status:
        query["status"] = status
    elif not include_archived:
        query["status"] = {"$ne": "archived"}
    if q:
        query["$or"] = [{"full_name": {"$regex": q, "$options": "i"}}, {"full_name_hy": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]
    items = await db.members.find(query, {"_id": 0}).sort("full_name", 1).to_list(2000)
    return items

@api.get("/members/{member_id}")
async def get_member(member_id: str, user: dict = Depends(get_current_user)):
    m = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not m: raise HTTPException(404, "Not found")
    if user["role"] not in ("national_admin",) and user.get("chapter_id") != m["chapter_id"] and user.get("member_id") != member_id:
        # scouts can view their own
        if user["role"] == "scout" and user.get("email") == m.get("email"):
            pass
        else:
            raise HTTPException(403, "Not allowed")
    m["badges"] = await db.member_badges.find({"member_id": member_id}, {"_id": 0}).to_list(500)
    m["attendance"] = await db.attendance.find({"member_id": member_id}, {"_id": 0}).sort("date", -1).to_list(200)
    return m

@api.post("/members")
async def create_member(payload: MemberIn, user: dict = Depends(get_current_user)):
    _member_chapter_guard(user, payload.chapter_id)
    mid = new_id("mbr")
    doc = {"member_id": mid, **payload.model_dump(), "created_at": now_iso()}
    await db.members.insert_one(doc)
    await audit(user, "create", "member", mid, {"name": payload.full_name})
    return clean(doc)

@api.put("/members/{member_id}")
async def update_member(member_id: str, payload: MemberIn, user: dict = Depends(get_current_user)):
    m = await db.members.find_one({"member_id": member_id})
    if not m: raise HTTPException(404, "Not found")
    _member_chapter_guard(user, m["chapter_id"])
    await db.members.update_one({"member_id": member_id}, {"$set": payload.model_dump()})
    await audit(user, "update", "member", member_id)
    return await db.members.find_one({"member_id": member_id}, {"_id": 0})

@api.delete("/members/{member_id}")
async def archive_member(member_id: str, user: dict = Depends(get_current_user)):
    m = await db.members.find_one({"member_id": member_id})
    if not m: raise HTTPException(404, "Not found")
    _member_chapter_guard(user, m["chapter_id"])
    await db.members.update_one({"member_id": member_id}, {"$set": {"status": "archived"}})
    await audit(user, "archive", "member", member_id)
    return {"ok": True}

@api.post("/members/{member_id}/unarchive")
async def unarchive_member(member_id: str, user: dict = Depends(get_current_user)):
    m = await db.members.find_one({"member_id": member_id})
    if not m: raise HTTPException(404, "Not found")
    _member_chapter_guard(user, m["chapter_id"])
    await db.members.update_one({"member_id": member_id}, {"$set": {"status": "active"}})
    await audit(user, "unarchive", "member", member_id)
    return {"ok": True}

# ---------- Badges ----------
@api.get("/badges")
async def list_badges(section: Optional[str] = None, include_archived: bool = False):
    q = {} if include_archived else {"archived": {"$ne": True}}
    if section: q["section"] = section
    return await db.badges.find(q, {"_id": 0}).sort("name", 1).to_list(500)

@api.post("/badges")
async def create_badge(payload: BadgeIn, user: dict = Depends(require_roles("national_admin"))):
    bid = new_id("bdg")
    doc = {"badge_id": bid, **payload.model_dump(), "created_at": now_iso()}
    await db.badges.insert_one(doc)
    await audit(user, "create", "badge", bid)
    return clean(doc)

@api.put("/badges/{badge_id}")
async def update_badge(badge_id: str, payload: BadgeIn, user: dict = Depends(require_roles("national_admin"))):
    await db.badges.update_one({"badge_id": badge_id}, {"$set": payload.model_dump()})
    await audit(user, "update", "badge", badge_id)
    return await db.badges.find_one({"badge_id": badge_id}, {"_id": 0})

@api.delete("/badges/{badge_id}")
async def delete_badge(badge_id: str, user: dict = Depends(require_roles("national_admin"))):
    await db.badges.delete_one({"badge_id": badge_id})
    await audit(user, "delete", "badge", badge_id)
    return {"ok": True}

@api.post("/badges/{badge_id}/archive")
async def archive_badge(badge_id: str, user: dict = Depends(require_roles("national_admin"))):
    await db.badges.update_one({"badge_id": badge_id}, {"$set": {"archived": True}})
    await audit(user, "archive", "badge", badge_id)
    return {"ok": True}

@api.post("/badges/{badge_id}/unarchive")
async def unarchive_badge(badge_id: str, user: dict = Depends(require_roles("national_admin"))):
    await db.badges.update_one({"badge_id": badge_id}, {"$set": {"archived": False}})
    await audit(user, "unarchive", "badge", badge_id)
    return {"ok": True}

@api.get("/members/{member_id}/badges")
async def member_badges(member_id: str, user: dict = Depends(get_current_user)):
    return await db.member_badges.find({"member_id": member_id}, {"_id": 0}).to_list(500)

class BadgeAssignIn(BaseModel):
    member_id: str
    badge_id: str

@api.post("/badges/assign")
async def assign_badge(payload: BadgeAssignIn, user: dict = Depends(get_current_user)):
    """Leader assigns a badge to a scout to start working on."""
    if not is_leader(user["role"]):
        raise HTTPException(403, "Only leaders can assign badges")
    badge = await db.badges.find_one({"badge_id": payload.badge_id, "archived": {"$ne": True}})
    if not badge: raise HTTPException(404, "Badge not found")
    m = await db.members.find_one({"member_id": payload.member_id})
    if not m: raise HTTPException(404, "Member not found")
    _member_chapter_guard(user, m["chapter_id"])
    total = len(badge.get("requirements", []))
    existing = await db.member_badges.find_one({"member_id": payload.member_id, "badge_id": payload.badge_id})
    if existing:
        if existing.get("awarded"):
            raise HTTPException(400, "Scout already earned this badge")
        # If it was requested, approve it; otherwise it's already in progress
        await db.member_badges.update_one(
            {"mb_id": existing["mb_id"]},
            {"$set": {"status": "in_progress", "assigned_by": user["email"], "assigned_at": now_iso()}},
        )
    else:
        await db.member_badges.insert_one({
            "mb_id": new_id("mb"),
            "member_id": payload.member_id,
            "badge_id": payload.badge_id,
            "completed_requirements": [False] * total,
            "awarded": False,
            "awarded_at": "",
            "awarded_by": "",
            "status": "in_progress",
            "assigned_by": user["email"],
            "assigned_at": now_iso(),
            "created_at": now_iso(),
        })
    linked = await db.users.find_one({"email": m.get("email")}, {"user_id": 1}) if m.get("email") else None
    if linked:
        await notify([linked["user_id"]], "New badge to work on", f"You've been assigned '{badge['name']}' — start earning it!", "info", "/my-progress")
    await audit(user, "assign", "badge", payload.badge_id, {"member": payload.member_id})
    return await db.member_badges.find_one({"member_id": payload.member_id, "badge_id": payload.badge_id}, {"_id": 0})

class BadgeRequestIn(BaseModel):
    badge_id: str

@api.post("/badges/request")
async def request_badge(payload: BadgeRequestIn, user: dict = Depends(get_current_user)):
    """Scout requests permission to start a badge."""
    m = await db.members.find_one({"email": user["email"]})
    if not m:
        raise HTTPException(400, "Your account isn't linked to a scout profile yet")
    badge = await db.badges.find_one({"badge_id": payload.badge_id, "archived": {"$ne": True}})
    if not badge: raise HTTPException(404, "Badge not found")
    total = len(badge.get("requirements", []))
    existing = await db.member_badges.find_one({"member_id": m["member_id"], "badge_id": payload.badge_id})
    if existing:
        st = existing.get("status") or ("awarded" if existing.get("awarded") else "in_progress")
        raise HTTPException(400, f"Already {st.replace('_', ' ')}")
    await db.member_badges.insert_one({
        "mb_id": new_id("mb"),
        "member_id": m["member_id"],
        "badge_id": payload.badge_id,
        "completed_requirements": [False] * total,
        "awarded": False,
        "awarded_at": "",
        "awarded_by": "",
        "status": "requested",
        "requested_at": now_iso(),
        "created_at": now_iso(),
    })
    # Notify chapter leaders
    leaders = await db.users.find(
        {"chapter_id": m.get("chapter_id"), "role": {"$in": ["chapter_admin", "chapter_leader"]}, "status": "active"},
        {"user_id": 1},
    ).to_list(20)
    if leaders:
        await notify(
            [l["user_id"] for l in leaders],
            "Badge request",
            f"{m.get('full_name')} wants to start '{badge['name']}'",
            "info", "/badges",
        )
    await audit(user, "request", "badge", payload.badge_id, {"member": m["member_id"]})
    return {"ok": True, "status": "requested"}

@api.get("/badges/requests")
async def list_badge_requests(user: dict = Depends(get_current_user)):
    """Leaders see pending badge requests scoped to their chapter (national admin sees all)."""
    if not is_leader(user["role"]):
        raise HTTPException(403, "Not allowed")
    q = {"status": "requested"}
    reqs = await db.member_badges.find(q, {"_id": 0}).to_list(500)
    if not reqs: return []
    member_ids = [r["member_id"] for r in reqs]
    members = {m["member_id"]: m for m in await db.members.find({"member_id": {"$in": member_ids}}, {"_id": 0}).to_list(1000)}
    badge_ids = list({r["badge_id"] for r in reqs})
    badges = {b["badge_id"]: b for b in await db.badges.find({"badge_id": {"$in": badge_ids}}, {"_id": 0}).to_list(500)}
    out = []
    for r in reqs:
        m = members.get(r["member_id"])
        if not m: continue
        if user["role"] != "national_admin" and m.get("chapter_id") != user.get("chapter_id"):
            continue
        r["member"] = {"full_name": m.get("full_name"), "section": m.get("section"), "chapter_id": m.get("chapter_id")}
        r["badge"] = badges.get(r["badge_id"], {})
        out.append(r)
    return out

@api.post("/badges/requests/{mb_id}/approve")
async def approve_badge_request(mb_id: str, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]):
        raise HTTPException(403, "Not allowed")
    mb = await db.member_badges.find_one({"mb_id": mb_id})
    if not mb or mb.get("status") != "requested":
        raise HTTPException(404, "Request not found")
    m = await db.members.find_one({"member_id": mb["member_id"]})
    if not m: raise HTTPException(404, "Member not found")
    _member_chapter_guard(user, m["chapter_id"])
    await db.member_badges.update_one(
        {"mb_id": mb_id},
        {"$set": {"status": "in_progress", "assigned_by": user["email"], "assigned_at": now_iso()}},
    )
    linked = await db.users.find_one({"email": m.get("email")}, {"user_id": 1}) if m.get("email") else None
    if linked:
        badge = await db.badges.find_one({"badge_id": mb["badge_id"]}, {"name": 1})
        await notify([linked["user_id"]], "Badge request approved", f"You can start working on '{badge.get('name') if badge else 'your badge'}'", "success", "/my-progress")
    await audit(user, "approve", "badge_request", mb["badge_id"], {"member": mb["member_id"]})
    return {"ok": True}

@api.post("/badges/requests/{mb_id}/deny")
async def deny_badge_request(mb_id: str, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]):
        raise HTTPException(403, "Not allowed")
    mb = await db.member_badges.find_one({"mb_id": mb_id})
    if not mb or mb.get("status") != "requested":
        raise HTTPException(404, "Request not found")
    m = await db.members.find_one({"member_id": mb["member_id"]})
    if not m: raise HTTPException(404, "Member not found")
    _member_chapter_guard(user, m["chapter_id"])
    await db.member_badges.delete_one({"mb_id": mb_id})
    linked = await db.users.find_one({"email": m.get("email")}, {"user_id": 1}) if m.get("email") else None
    if linked:
        badge = await db.badges.find_one({"badge_id": mb["badge_id"]}, {"name": 1})
        await notify([linked["user_id"]], "Badge request declined", f"Your request for '{badge.get('name') if badge else 'the badge'}' wasn't approved this time. Talk to your leader.", "warning", "/my-progress")
    await audit(user, "deny", "badge_request", mb["badge_id"], {"member": mb["member_id"]})
    return {"ok": True}

@api.post("/badges/progress")
async def update_progress(payload: RequirementUpdate, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]):
        raise HTTPException(403, "Not allowed")
    badge = await db.badges.find_one({"badge_id": payload.badge_id})
    if not badge: raise HTTPException(404, "Badge not found")
    mb = await db.member_badges.find_one({"member_id": payload.member_id, "badge_id": payload.badge_id})
    total = len(badge.get("requirements", []))
    if not mb:
        completed = [False] * total
        completed[payload.requirement_index] = payload.completed
        doc = {
            "mb_id": new_id("mb"),
            "member_id": payload.member_id,
            "badge_id": payload.badge_id,
            "completed_requirements": completed,
            "awarded": False,
            "awarded_at": "",
            "awarded_by": "",
            "created_at": now_iso(),
        }
        await db.member_badges.insert_one(doc)
    else:
        arr = mb.get("completed_requirements", [False] * total)
        while len(arr) < total: arr.append(False)
        arr[payload.requirement_index] = payload.completed
        await db.member_badges.update_one({"mb_id": mb["mb_id"]}, {"$set": {"completed_requirements": arr}})
    await audit(user, "requirement_update", "badge_progress", payload.badge_id, {"member": payload.member_id, "req": payload.requirement_index})
    return await db.member_badges.find_one({"member_id": payload.member_id, "badge_id": payload.badge_id}, {"_id": 0})

@api.post("/badges/award")
async def award_badge(payload: BadgeAwardIn, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]):
        raise HTTPException(403, "Not allowed")
    badge = await db.badges.find_one({"badge_id": payload.badge_id})
    if not badge: raise HTTPException(404, "Badge not found")
    total = len(badge.get("requirements", []))
    mb = await db.member_badges.find_one({"member_id": payload.member_id, "badge_id": payload.badge_id})
    if not mb:
        doc = {
            "mb_id": new_id("mb"),
            "member_id": payload.member_id,
            "badge_id": payload.badge_id,
            "completed_requirements": [True] * total,
            "awarded": True,
            "awarded_at": now_iso(),
            "awarded_by": user["email"],
            "created_at": now_iso(),
        }
        await db.member_badges.insert_one(doc)
    else:
        await db.member_badges.update_one({"mb_id": mb["mb_id"]}, {"$set": {
            "awarded": True, "awarded_at": now_iso(), "awarded_by": user["email"],
            "completed_requirements": [True] * total,
        }})
    m = await db.members.find_one({"member_id": payload.member_id})
    if m:
        linked = await db.users.find_one({"email": m.get("email")}, {"user_id": 1})
        if linked:
            await notify([linked["user_id"]], "Badge Awarded!", f"You earned {badge['name']}", "success", "/my-progress")
    await audit(user, "award", "badge", payload.badge_id, {"member": payload.member_id})
    return {"ok": True}

# ---------- Programs ----------
@api.get("/programs")
async def list_programs(chapter_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: dict = {}
    if user["role"] == "national_admin":
        if chapter_id: q["chapter_id"] = chapter_id
    elif user["role"] == "parent":
        # Parents see all national + programs of their linked members' chapters
        member_ids = user.get("linked_member_ids") or []
        chapter_ids = []
        if member_ids:
            members = await db.members.find({"member_id": {"$in": member_ids}}, {"chapter_id": 1}).to_list(50)
            chapter_ids = list({m["chapter_id"] for m in members if m.get("chapter_id")})
        q = {"$or": [{"chapter_id": None}, {"chapter_id": {"$in": chapter_ids}}]} if chapter_ids else {"chapter_id": None}
    else:
        # national programs (chapter_id null) + user's chapter programs
        q = {"$or": [{"chapter_id": None}, {"chapter_id": user.get("chapter_id")}]}
    items = await db.programs.find(q, {"_id": 0}).sort("date", 1).to_list(500)
    # attach registration counts
    for it in items:
        it["registered_count"] = await db.program_registrations.count_documents({"program_id": it["program_id"], "status": "registered"})
        it["waitlist_count"] = await db.program_registrations.count_documents({"program_id": it["program_id"], "status": "waitlisted"})
    return items

@api.get("/programs/{program_id}")
async def get_program(program_id: str):
    p = await db.programs.find_one({"program_id": program_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Not found")
    return p

@api.post("/programs")
async def create_program(payload: ProgramIn, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]):
        raise HTTPException(403, "Not allowed")
    payload_dict = payload.model_dump()
    # Level-based chapter assignment
    if payload_dict.get("level") in ("national", "regional") and user["role"] == "national_admin":
        payload_dict["chapter_id"] = None
    elif user["role"] in LEADER_ROLES:
        payload_dict["chapter_id"] = user.get("chapter_id")
        payload_dict["level"] = "chapter"
    pid = new_id("prg")
    doc = {"program_id": pid, **payload_dict, "created_by": user["email"], "created_at": now_iso()}
    await db.programs.insert_one(doc)
    await audit(user, "create", "program", pid)
    return clean(doc)

@api.put("/programs/{program_id}")
async def update_program(program_id: str, payload: ProgramIn, user: dict = Depends(get_current_user)):
    p = await db.programs.find_one({"program_id": program_id})
    if not p: raise HTTPException(404, "Not found")
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    if user["role"] in LEADER_ROLES and p.get("chapter_id") != user.get("chapter_id"):
        raise HTTPException(403, "Not allowed for other chapters")
    await db.programs.update_one({"program_id": program_id}, {"$set": payload.model_dump()})
    await audit(user, "update", "program", program_id)
    return await db.programs.find_one({"program_id": program_id}, {"_id": 0})

@api.delete("/programs/{program_id}")
async def delete_program(program_id: str, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    await db.programs.delete_one({"program_id": program_id})
    await db.program_registrations.delete_many({"program_id": program_id})
    await audit(user, "delete", "program", program_id)
    return {"ok": True}

@api.post("/programs/{program_id}/duplicate")
async def duplicate_program(program_id: str, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    p = await db.programs.find_one({"program_id": program_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Not found")
    p["program_id"] = new_id("prg")
    p["title"] = p["title"] + " (Copy)"
    p["created_at"] = now_iso()
    await db.programs.insert_one(p)
    return clean(p)

# ---------- Event Registration ----------
@api.get("/programs/{program_id}/registrations")
async def list_registrations(program_id: str, user: dict = Depends(get_current_user)):
    regs = await db.program_registrations.find({"program_id": program_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return regs

@api.get("/programs/{program_id}/my-registration")
async def my_registration(program_id: str, user: dict = Depends(get_current_user)):
    reg = await db.program_registrations.find_one({"program_id": program_id, "user_id": user["user_id"]}, {"_id": 0})
    return reg or {"status": "none"}

@api.post("/programs/{program_id}/register")
async def register_for_program(program_id: str, user: dict = Depends(get_current_user)):
    p = await db.programs.find_one({"program_id": program_id})
    if not p: raise HTTPException(404, "Program not found")
    if float(p.get("fee") or 0.0) > 0:
        raise HTTPException(402, "This program requires payment — use the checkout flow.")
    existing = await db.program_registrations.find_one({"program_id": program_id, "user_id": user["user_id"]})
    if existing:
        return {"status": existing["status"], "message": "Already registered"}
    capacity = int(p.get("capacity") or 0)
    current = await db.program_registrations.count_documents({"program_id": program_id, "status": "registered"})
    if capacity and current >= capacity:
        if not p.get("waitlist_enabled"):
            raise HTTPException(400, "Event is full")
        status = "waitlisted"
    else:
        status = "registered"
    m = await db.members.find_one({"email": user["email"]}, {"member_id": 1, "full_name": 1})
    doc = {
        "reg_id": new_id("reg"),
        "program_id": program_id,
        "user_id": user["user_id"],
        "user_email": user["email"],
        "user_name": user.get("name"),
        "member_id": m.get("member_id") if m else None,
        "status": status,
        "created_at": now_iso(),
    }
    await db.program_registrations.insert_one(doc)
    await audit(user, "register", "program", program_id, {"status": status})
    return {"status": status}

@api.delete("/programs/{program_id}/register")
async def unregister_from_program(program_id: str, user: dict = Depends(get_current_user)):
    r = await db.program_registrations.find_one({"program_id": program_id, "user_id": user["user_id"]})
    await db.program_registrations.delete_one({"program_id": program_id, "user_id": user["user_id"]})
    # Promote first waitlisted user if we freed a spot
    if r and r.get("status") == "registered":
        wl = await db.program_registrations.find_one({"program_id": program_id, "status": "waitlisted"}, sort=[("created_at", 1)])
        if wl:
            await db.program_registrations.update_one({"reg_id": wl["reg_id"]}, {"$set": {"status": "registered"}})
            await notify([wl["user_id"]], "Waitlist promoted!", "A spot opened up — you're now registered.", "success", "/programs")
    await audit(user, "unregister", "program", program_id)
    return {"ok": True}

# ---------- Attendance ----------
@api.post("/attendance")
async def record_attendance(payload: AttendanceIn, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    p = await db.programs.find_one({"program_id": payload.program_id})
    if not p: raise HTTPException(404, "Program not found")
    for e in payload.entries:
        doc = {
            "attendance_id": new_id("att"),
            "program_id": payload.program_id,
            "member_id": e["member_id"],
            "status": e.get("status", "present"),
            "date": p.get("date", now_iso()),
            "recorded_by": user["email"],
            "created_at": now_iso(),
        }
        # replace prior entry for same program+member
        await db.attendance.delete_many({"program_id": payload.program_id, "member_id": e["member_id"]})
        await db.attendance.insert_one(doc)
    await audit(user, "record", "attendance", payload.program_id)
    return {"ok": True, "count": len(payload.entries)}

@api.get("/attendance")
async def list_attendance(program_id: Optional[str] = None, member_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if program_id: q["program_id"] = program_id
    if member_id: q["member_id"] = member_id
    return await db.attendance.find(q, {"_id": 0}).to_list(2000)

# ---------- Newsletters ----------
@api.get("/newsletters")
async def list_newsletters():
    return await db.newsletters.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.post("/newsletters")
async def create_newsletter(payload: NewsletterIn, user: dict = Depends(require_roles("national_admin"))):
    nid = new_id("nws")
    doc = {"newsletter_id": nid, **payload.model_dump(), "created_at": now_iso(), "published_at": now_iso()}
    await db.newsletters.insert_one(doc)
    users = await db.users.find({}, {"user_id": 1}).to_list(2000)
    await notify([u["user_id"] for u in users], "New Newsletter", payload.title, "info", "/newsletters")
    await audit(user, "publish", "newsletter", nid)
    return clean(doc)

@api.delete("/newsletters/{nid}")
async def delete_newsletter(nid: str, user: dict = Depends(require_roles("national_admin"))):
    await db.newsletters.delete_one({"newsletter_id": nid})
    return {"ok": True}

# ---------- Announcements ----------
@api.get("/announcements")
async def list_announcements(user: dict = Depends(get_current_user)):
    q = {"$or": [{"chapter_id": None}]}
    if user.get("chapter_id"):
        q["$or"].append({"chapter_id": user["chapter_id"]})
    items = await db.announcements.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api.post("/announcements")
async def create_announcement(payload: AnnouncementIn, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    data = payload.model_dump()
    if user["role"] in LEADER_ROLES:
        data["chapter_id"] = user.get("chapter_id")
    aid = new_id("ann")
    doc = {"announcement_id": aid, **data, "author": user["email"], "created_at": now_iso()}
    await db.announcements.insert_one(doc)
    # notify relevant users
    if data.get("chapter_id"):
        users = await db.users.find({"chapter_id": data["chapter_id"]}, {"user_id": 1}).to_list(2000)
    else:
        users = await db.users.find({}, {"user_id": 1}).to_list(2000)
    await notify([u["user_id"] for u in users], "Announcement: " + payload.title, payload.message[:120], "info", "/announcements")
    await audit(user, "create", "announcement", aid)
    return clean(doc)

@api.delete("/announcements/{aid}")
async def delete_announcement(aid: str, user: dict = Depends(get_current_user)):
    a = await db.announcements.find_one({"announcement_id": aid})
    if not a: raise HTTPException(404, "Not found")
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    if user["role"] in LEADER_ROLES and a.get("chapter_id") != user.get("chapter_id"):
        raise HTTPException(403, "Not allowed")
    await db.announcements.delete_one({"announcement_id": aid})
    return {"ok": True}

# ---------- Resources ----------
@api.get("/resources")
async def list_resources(category: Optional[str] = None, include_archived: bool = False):
    q = {} if include_archived else {"archived": {"$ne": True}}
    if category: q["category"] = category
    return await db.resources.find(q, {"_id": 0, "file_data": 0}).sort("created_at", -1).to_list(500)

@api.get("/resources/{rid}")
async def get_resource(rid: str, user: dict = Depends(get_current_user)):
    r = await db.resources.find_one({"resource_id": rid}, {"_id": 0})
    if not r: raise HTTPException(404, "Not found")
    return r

@api.post("/resources")
async def create_resource(payload: ResourceIn, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    rid = new_id("res")
    doc = {"resource_id": rid, **payload.model_dump(), "uploaded_by": user["email"], "created_at": now_iso()}
    await db.resources.insert_one(doc)
    await audit(user, "upload", "resource", rid)
    d = {**doc}; d.pop("file_data", None); return clean(d)

@api.delete("/resources/{rid}")
async def delete_resource(rid: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("national_admin", "chapter_admin"): raise HTTPException(403, "Not allowed")
    await db.resources.delete_one({"resource_id": rid})
    return {"ok": True}

@api.post("/resources/{rid}/archive")
async def archive_resource(rid: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("national_admin", "chapter_admin"): raise HTTPException(403, "Not allowed")
    await db.resources.update_one({"resource_id": rid}, {"$set": {"archived": True}})
    await audit(user, "archive", "resource", rid)
    return {"ok": True}

@api.post("/resources/{rid}/unarchive")
async def unarchive_resource(rid: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("national_admin", "chapter_admin"): raise HTTPException(403, "Not allowed")
    await db.resources.update_one({"resource_id": rid}, {"$set": {"archived": False}})
    await audit(user, "unarchive", "resource", rid)
    return {"ok": True}

# ---------- Notifications ----------
@api.get("/notifications")
async def my_notifications(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"notification_id": nid, "user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.delete("/notifications/{nid}")
async def delete_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.delete_one({"notification_id": nid, "user_id": user["user_id"]})
    return {"ok": True}

@api.delete("/notifications")
async def clear_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.delete_many({"user_id": user["user_id"]})
    return {"ok": True}

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None  # base64 data URL
    bio: Optional[str] = None
    phone: Optional[str] = None
    position_title: Optional[str] = None

class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str

@api.put("/auth/me")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})

class LeaderPublicProfileUpdate(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    position_title: Optional[str] = None

@api.put("/users/{uid}/public-profile")
async def update_leader_public_profile(uid: str, payload: LeaderPublicProfileUpdate, user: dict = Depends(require_roles("national_admin"))):
    target = await db.users.find_one({"user_id": uid})
    if not target: raise HTTPException(404, "Not found")
    upd = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if upd:
        await db.users.update_one({"user_id": uid}, {"$set": upd})
        await audit(user, "update_public_profile", "user", uid)
    return await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})

@api.post("/auth/change-password")
async def change_password(payload: PasswordChangeIn, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": user["user_id"]})
    if not u.get("password_hash"):
        raise HTTPException(400, "This account signs in with Google; no password to change.")
    if not verify_password(payload.current_password, u["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")
    validate_password_strength(payload.new_password)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    await audit(user, "password_change", "user", user["user_id"])
    return {"ok": True}

# ---------- Trash / Archive bin ----------
@api.get("/trash")
async def trash_bin(user: dict = Depends(require_roles("national_admin", "chapter_admin"))):
    member_q = {"status": "archived"}
    if user["role"] == "chapter_admin":
        member_q["chapter_id"] = user.get("chapter_id")
    return {
        "chapters": await db.chapters.find({"archived": True}, {"_id": 0}).to_list(200),
        "badges": await db.badges.find({"archived": True}, {"_id": 0}).to_list(500),
        "resources": await db.resources.find({"archived": True}, {"_id": 0, "file_data": 0}).to_list(500),
        "members": await db.members.find(member_q, {"_id": 0}).to_list(2000),
    }

# ---------- Galleries ----------
@api.get("/galleries")
async def list_galleries(chapter_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if chapter_id: q["chapter_id"] = chapter_id
    return await db.galleries.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.get("/galleries/{gid}")
async def get_gallery(gid: str, user: dict = Depends(get_current_user)):
    g = await db.galleries.find_one({"gallery_id": gid}, {"_id": 0})
    if not g: raise HTTPException(404, "Not found")
    return g

@api.post("/galleries")
async def create_gallery(payload: GalleryIn, user: dict = Depends(get_current_user)):
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    data = payload.model_dump()
    if user["role"] in LEADER_ROLES:
        data["chapter_id"] = user.get("chapter_id")
    gid = new_id("gal")
    doc = {"gallery_id": gid, **data, "created_by": user["email"], "created_at": now_iso()}
    await db.galleries.insert_one(doc)
    await audit(user, "create", "gallery", gid)
    return clean(doc)

@api.delete("/galleries/{gid}")
async def delete_gallery(gid: str, user: dict = Depends(get_current_user)):
    g = await db.galleries.find_one({"gallery_id": gid})
    if not g: raise HTTPException(404, "Not found")
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    if user["role"] in LEADER_ROLES and g.get("chapter_id") != user.get("chapter_id"):
        raise HTTPException(403, "Not allowed for other chapters")
    await db.galleries.delete_one({"gallery_id": gid})
    await audit(user, "delete", "gallery", gid)
    return {"ok": True}

class GalleryImagesIn(BaseModel):
    images: List[dict]  # [{data: base64, caption: str}]

@api.post("/galleries/{gid}/images")
async def add_gallery_images(gid: str, payload: GalleryImagesIn, user: dict = Depends(get_current_user)):
    g = await db.galleries.find_one({"gallery_id": gid})
    if not g: raise HTTPException(404, "Not found")
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    if user["role"] in LEADER_ROLES and g.get("chapter_id") != user.get("chapter_id"):
        raise HTTPException(403, "Not allowed for other chapters")
    new_imgs = payload.images or []
    upd = {"$push": {"images": {"$each": new_imgs}}}
    if not g.get("cover") and new_imgs:
        upd["$set"] = {"cover": new_imgs[0].get("data", "")}
    await db.galleries.update_one({"gallery_id": gid}, upd)
    await audit(user, "add_images", "gallery", gid, {"count": len(new_imgs)})
    return await db.galleries.find_one({"gallery_id": gid}, {"_id": 0})

@api.delete("/galleries/{gid}/images/{index}")
async def delete_gallery_image(gid: str, index: int, user: dict = Depends(get_current_user)):
    g = await db.galleries.find_one({"gallery_id": gid})
    if not g: raise HTTPException(404, "Not found")
    if not is_leader(user["role"]): raise HTTPException(403, "Not allowed")
    if user["role"] in LEADER_ROLES and g.get("chapter_id") != user.get("chapter_id"):
        raise HTTPException(403, "Not allowed for other chapters")
    imgs = g.get("images") or []
    if 0 <= index < len(imgs):
        imgs.pop(index)
        await db.galleries.update_one({"gallery_id": gid}, {"$set": {"images": imgs}})
    return {"ok": True}

# ---------- Chapter: promote member to leader ----------
@api.post("/chapters/{chapter_id}/promote-member")
async def promote_member_to_leader(chapter_id: str, payload: PromoteMemberIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Only chapter admin / national admin can promote")
    _member_chapter_guard(user, chapter_id)
    m = await db.members.find_one({"member_id": payload.member_id})
    if not m: raise HTTPException(404, "Member not found")
    if m.get("chapter_id") != chapter_id:
        raise HTTPException(400, "Member not in this chapter")
    if payload.position not in POSITION_TO_ROLE:
        raise HTTPException(400, "Invalid leadership position")
    await db.members.update_one({"member_id": payload.member_id}, {"$set": {"position": payload.position}})
    # sync user role if user account exists for this email
    target_role = POSITION_TO_ROLE[payload.position]
    if target_role == "chapter_admin" and user["role"] != "national_admin":
        target_role = "chapter_leader"
    linked_user = None
    if m.get("email"):
        linked_user = await db.users.find_one({"email": (m["email"] or "").lower()})
        if linked_user:
            await db.users.update_one({"user_id": linked_user["user_id"]}, {"$set": {"role": target_role, "chapter_id": chapter_id}})
    await audit(user, "promote", "member", payload.member_id, {"position": payload.position, "role": target_role})
    return {
        "ok": True, "position": payload.position, "role": target_role,
        "linked_user": bool(linked_user),
    }

# ---------- Users / Administration ----------
@api.get("/users")
async def list_users(status: Optional[str] = None, include_scouts: bool = False, user: dict = Depends(require_roles("national_admin", "chapter_admin"))):
    q = {}
    if user["role"] == "chapter_admin":
        q["chapter_id"] = user.get("chapter_id")
    if status:
        q["status"] = status
    else:
        # by default hide archived
        q["status"] = {"$ne": "archived"}
    if not include_scouts:
        q["role"] = {"$ne": "scout"}
    return await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)

@api.get("/users/pending")
async def list_pending_users(user: dict = Depends(get_current_user)):
    # National admin sees all pending; chapter approvers see pending for their chapter
    if user["role"] == "national_admin":
        q = {"status": "pending"}
    elif user["role"] in LEADER_ROLES:
        q = {"status": "pending", "chapter_id": user.get("chapter_id")}
    else:
        raise HTTPException(403, "Not allowed")
    return await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)

@api.post("/users/{uid}/approve")
async def approve_user(uid: str, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": uid})
    if not target: raise HTTPException(404, "Not found")
    if user["role"] == "national_admin":
        pass
    elif user["role"] in LEADER_ROLES and target.get("chapter_id") == user.get("chapter_id"):
        pass
    else:
        raise HTTPException(403, "Not allowed to approve this user")
    signup_type = target.get("signup_type", "scout")
    if signup_type == "leader":
        role = target.get("requested_role") or "scout"
        if role == "national_admin" and user["role"] != "national_admin":
            role = "scout"
    else:
        role = "scout"
    upd = {"status": "active", "role": role, "approved_by": user["email"], "approved_at": now_iso()}
    await db.users.update_one({"user_id": uid}, {"$set": upd})

    # If scout signup with a pending member profile, materialize it
    if signup_type == "scout" and target.get("pending_member_profile"):
        prof = dict(target["pending_member_profile"])
        # only create if not already linked
        already = await db.members.find_one({"email": target["email"]})
        if not already:
            mid = new_id("mbr")
            prof.update({
                "member_id": mid,
                "created_at": now_iso(),
            })
            await db.members.insert_one(prof)
            await audit(user, "materialize", "member", mid, {"from_user": uid})
        # clear the pending profile
        await db.users.update_one({"user_id": uid}, {"$unset": {"pending_member_profile": ""}})

    await notify([uid], "Welcome to Scouts!", "Your account has been approved. You can sign in now.", "success", "/dashboard")
    await audit(user, "approve", "user", uid, {"signup_type": signup_type})
    return {"ok": True}

@api.post("/users/{uid}/reject")
async def reject_user(uid: str, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": uid})
    if not target: raise HTTPException(404, "Not found")
    if user["role"] == "national_admin":
        pass
    elif user["role"] in LEADER_ROLES and target.get("chapter_id") == user.get("chapter_id"):
        pass
    else:
        raise HTTPException(403, "Not allowed")
    await db.users.update_one({"user_id": uid}, {"$set": {"status": "rejected", "rejected_by": user["email"], "rejected_at": now_iso()}})
    await audit(user, "reject", "user", uid)
    return {"ok": True}

class UserRoleUpdate(BaseModel):
    role: str
    chapter_id: Optional[str] = None

@api.put("/users/{uid}/role")
async def update_role(uid: str, payload: UserRoleUpdate, user: dict = Depends(require_roles("national_admin"))):
    await db.users.update_one({"user_id": uid}, {"$set": {"role": payload.role, "chapter_id": payload.chapter_id}})
    await audit(user, "role_change", "user", uid, {"role": payload.role})
    return await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})

@api.post("/users/{uid}/archive")
async def archive_user(uid: str, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": uid})
    if not target: raise HTTPException(404, "Not found")
    if user["role"] == "national_admin":
        pass
    elif user["role"] == "chapter_admin" and target.get("chapter_id") == user.get("chapter_id"):
        pass
    else:
        raise HTTPException(403, "Not allowed")
    if uid == user["user_id"]:
        raise HTTPException(400, "Cannot archive your own account")
    await db.users.update_one({"user_id": uid}, {"$set": {"status": "archived"}})
    await audit(user, "archive", "user", uid)
    return {"ok": True}

@api.post("/users/{uid}/unarchive")
async def unarchive_user(uid: str, user: dict = Depends(require_roles("national_admin", "chapter_admin"))):
    await db.users.update_one({"user_id": uid}, {"$set": {"status": "active"}})
    await audit(user, "unarchive", "user", uid)
    return {"ok": True}

@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("national_admin"))):
    if uid == user["user_id"]:
        raise HTTPException(400, "Cannot delete your own account")
    await db.users.delete_one({"user_id": uid})
    await audit(user, "delete", "user", uid)
    return {"ok": True}

class SyncRoleIn(BaseModel):
    apply: bool = False  # False → returns suggestion, True → performs upgrade

@api.post("/members/{member_id}/sync-user-role")
async def sync_member_user_role(member_id: str, payload: SyncRoleIn, user: dict = Depends(get_current_user)):
    m = await db.members.find_one({"member_id": member_id})
    if not m: raise HTTPException(404, "Not found")
    _member_chapter_guard(user, m["chapter_id"])
    if not m.get("email"):
        return {"linked": False, "reason": "Member has no email"}
    linked = await db.users.find_one({"email": (m["email"] or "").lower()}, {"_id": 0, "password_hash": 0})
    if not linked:
        return {"linked": False, "reason": "No user account with this email"}
    target_role = POSITION_TO_ROLE.get(m.get("position", ""), "scout")
    if target_role == "chapter_admin" and user["role"] != "national_admin":
        target_role = "chapter_leader"  # downgrade if non-national tries to make chapter_admin
    suggestion = {
        "linked": True,
        "user_id": linked["user_id"],
        "current_role": linked.get("role"),
        "suggested_role": target_role,
        "needs_change": linked.get("role") != target_role,
    }
    if payload.apply and suggestion["needs_change"]:
        if target_role == "national_admin" and user["role"] != "national_admin":
            raise HTTPException(403, "Only national admin can grant national_admin")
        await db.users.update_one({"user_id": linked["user_id"]}, {"$set": {"role": target_role, "chapter_id": m["chapter_id"]}})
        await audit(user, "role_sync", "user", linked["user_id"], {"role": target_role, "member": member_id})
        suggestion["applied"] = True
        suggestion["current_role"] = target_role
    return suggestion

# ---------- Parent Accounts ----------
import secrets as _secrets

class InviteParentIn(BaseModel):
    email: EmailStr
    name: Optional[str] = ""

@api.post("/members/{member_id}/invite-parent")
async def invite_parent(member_id: str, payload: InviteParentIn, user: dict = Depends(get_current_user)):
    m = await db.members.find_one({"member_id": member_id})
    if not m: raise HTTPException(404, "Not found")
    _member_chapter_guard(user, m["chapter_id"])
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    temp_password = None
    if existing:
        uid = existing["user_id"]
        linked = list(set((existing.get("linked_member_ids") or []) + [member_id]))
        upd = {"linked_member_ids": linked}
        if existing.get("role") not in ("national_admin",) + LEADER_ROLES:
            upd["role"] = "parent"; upd["status"] = "active"
        await db.users.update_one({"user_id": uid}, {"$set": upd})
    else:
        uid = new_id("usr")
        temp_password = _secrets.token_urlsafe(8)
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": payload.name or email.split("@")[0],
            "password_hash": hash_password(temp_password),
            "role": "parent", "chapter_id": m["chapter_id"],
            "linked_member_ids": [member_id],
            "picture": "", "status": "active",
            "created_at": now_iso(),
        })
    await db.members.update_one({"member_id": member_id}, {"$set": {"parent_email": email}})
    await audit(user, "invite_parent", "member", member_id, {"parent_email": email})
    return {"ok": True, "user_id": uid, "temp_password": temp_password}

@api.get("/parent/children")
async def parent_children(user: dict = Depends(require_roles("parent"))):
    ids = user.get("linked_member_ids") or []
    if not ids: return {"children": []}
    kids = await db.members.find({"member_id": {"$in": ids}}, {"_id": 0}).to_list(50)
    all_badges = await db.badges.find({}, {"_id": 0}).to_list(500)
    b_by_id = {b["badge_id"]: b for b in all_badges}
    today = datetime.now(timezone.utc).date().isoformat()
    for k in kids:
        mbs = await db.member_badges.find({"member_id": k["member_id"]}, {"_id": 0}).to_list(500)
        for mb in mbs:
            mb["badge"] = b_by_id.get(mb["badge_id"])
        k["badges"] = mbs
        k["awarded_count"] = sum(1 for x in mbs if x.get("awarded"))
        # next activity: any upcoming program at this chapter or national
        prg = await db.programs.find(
            {"$or": [{"chapter_id": None}, {"chapter_id": k.get("chapter_id")}], "date": {"$gte": today}},
            {"_id": 0}
        ).sort("date", 1).limit(1).to_list(1)
        k["next_activity"] = prg[0] if prg else None
        # attendance stats
        att = await db.attendance.find({"member_id": k["member_id"]}, {"_id": 0}).sort("date", -1).to_list(200)
        k["attendance"] = att
        present = sum(1 for a in att if a.get("status") == "present")
        k["attendance_percent"] = round(present / len(att) * 100, 1) if att else 0
    return {"children": kids}

@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_roles("national_admin"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)

# ---------- Dashboard Stats ----------
@api.get("/stats/national")
async def stats_national(user: dict = Depends(require_roles("national_admin"))):
    total_members = await db.members.count_documents({"status": {"$ne": "archived"}})
    total_chapters = await db.chapters.count_documents({})
    active = await db.members.count_documents({"status": "active"})
    badges_awarded = await db.member_badges.count_documents({"awarded": True})
    # per chapter breakdown
    chapters = await db.chapters.find({}, {"_id": 0}).to_list(200)
    per_chapter = []
    for c in chapters:
        cnt = await db.members.count_documents({"chapter_id": c["chapter_id"], "status": {"$ne": "archived"}})
        per_chapter.append({"chapter": c["name"], "members": cnt})
    return {
        "total_members": total_members,
        "total_chapters": total_chapters,
        "active_scouts": active,
        "badges_awarded": badges_awarded,
        "activities_this_month": await db.programs.count_documents({}),
        "per_chapter": per_chapter,
    }

@api.get("/stats/chapter/{chapter_id}")
async def stats_chapter(chapter_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("national_admin",) and user.get("chapter_id") != chapter_id:
        raise HTTPException(403, "Not allowed")
    members = await db.members.count_documents({"chapter_id": chapter_id, "status": {"$ne": "archived"}})
    sections = ["Cubs", "Scouts", "Senior Scouts", "Rovers"]
    by_section = {s: await db.members.count_documents({"chapter_id": chapter_id, "section": s, "status": {"$ne": "archived"}}) for s in sections}
    # Fetch chapter's members for attendance
    mem_ids = [m["member_id"] for m in await db.members.find({"chapter_id": chapter_id}, {"member_id": 1}).to_list(2000)]
    att = await db.attendance.find({"member_id": {"$in": mem_ids}}).to_list(5000)
    present = sum(1 for a in att if a.get("status") == "present")
    total_att = len(att) or 1
    return {
        "total_members": members,
        "by_section": by_section,
        "attendance_percent": round(present / total_att * 100, 1) if att else 0,
        "badges_awarded": await db.member_badges.count_documents({"member_id": {"$in": mem_ids}, "awarded": True}),
        "programs_count": await db.programs.count_documents({"$or": [{"chapter_id": chapter_id}, {"chapter_id": None}]}),
    }

@api.get("/stats/scout")
async def stats_scout(user: dict = Depends(get_current_user)):
    # find member linked to user email
    m = await db.members.find_one({"email": user["email"]}, {"_id": 0})
    if not m:
        return {"linked": False}
    mbs = await db.member_badges.find({"member_id": m["member_id"]}, {"_id": 0}).to_list(500)
    awarded = [x for x in mbs if x.get("awarded")]
    in_progress = [x for x in mbs if not x.get("awarded")]
    # progress percent overall
    all_badges = await db.badges.find({}, {"_id": 0}).to_list(500)
    return {
        "linked": True,
        "member": m,
        "awarded_count": len(awarded),
        "in_progress_count": len(in_progress),
        "total_badges": len(all_badges),
        "progress_percent": round(len(awarded) / max(len(all_badges), 1) * 100, 1),
    }

# ---------- Search ----------
@api.get("/search")
async def global_search(q: str = Query(...), user: dict = Depends(get_current_user)):
    rx = {"$regex": q, "$options": "i"}
    results = {
        "chapters": await db.chapters.find({"$and": [{"$or": [{"name": rx}, {"name_hy": rx}]}, {"archived": {"$ne": True}}]}, {"_id": 0}).limit(10).to_list(10),
        "members": [],
        "programs": await db.programs.find({"$or": [{"title": rx}, {"title_hy": rx}]}, {"_id": 0}).limit(10).to_list(10),
        "badges": await db.badges.find({"$and": [{"$or": [{"name": rx}, {"name_hy": rx}]}, {"archived": {"$ne": True}}]}, {"_id": 0}).limit(10).to_list(10),
    }
    mem_q = {"$and": [{"$or": [{"full_name": rx}, {"full_name_hy": rx}, {"email": rx}]}, {"status": {"$ne": "archived"}}]}
    if user["role"] != "national_admin":
        mem_q["$and"].append({"chapter_id": user.get("chapter_id")})
    results["members"] = await db.members.find(mem_q, {"_id": 0}).limit(10).to_list(10)
    return results

# ---------- Seed ----------
async def ensure_seed_users_present():
    """Idempotent: (re)create the documented seed users if any is missing."""
    admin_email = os.environ["ADMIN_EMAIL"]
    admin_password = os.environ["ADMIN_PASSWORD"]
    # If ADMIN_EMAIL was changed, migrate the existing admin record to the new email.
    old_admin = await db.users.find_one({"user_id": "usr_admin"})
    if old_admin:
        # keep the owner account pinned to national_admin — never let a login/promotion demote it.
        fixup = {"role": "national_admin", "chapter_id": None, "status": "active"}
        if old_admin.get("email") != admin_email:
            # remove any user squatting on the target email (won't touch usr_admin itself)
            await db.users.delete_many({"email": admin_email, "user_id": {"$ne": "usr_admin"}})
            fixup["email"] = admin_email
            fixup["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"user_id": "usr_admin"}, {"$set": fixup})
    users_seed = [
        {"user_id": "usr_admin", "email": admin_email, "name": "National Administrator",
         "password_hash": hash_password(admin_password), "role": "national_admin", "chapter_id": None},
        {"user_id": "usr_ararat_admin", "email": "ararat.leader@scouts.am", "name": "Anahit Sargsyan",
         "password_hash": hash_password("scout123"), "role": "chapter_admin", "chapter_id": "chp_ararat"},
        {"user_id": "usr_sevan_leader", "email": "sevan.leader@scouts.am", "name": "Davit Petrosyan",
         "password_hash": hash_password("scout123"), "role": "chapter_leader", "chapter_id": "chp_sevan"},
        {"user_id": "usr_gyumri_admin", "email": "gyumri.leader@scouts.am", "name": "Mher Grigoryan",
         "password_hash": hash_password("scout123"), "role": "chapter_admin", "chapter_id": "chp_gyumri"},
        {"user_id": "usr_narek", "email": "narek@scouts.am", "name": "Narek Hovhannisyan",
         "password_hash": hash_password("scout123"), "role": "scout", "chapter_id": "chp_ararat"},
    ]
    for u in users_seed:
        await db.users.update_one(
            {"email": u["email"]},
            {"$setOnInsert": {**u, "picture": "", "status": "active", "created_at": now_iso()}},
            upsert=True,
        )

async def seed():
    # Ensure documented seed logins always exist (idempotent).
    await ensure_seed_users_present()
    # Reset only if empty
    if await db.chapters.count_documents({}) > 0:
        return

    admin_email = os.environ["ADMIN_EMAIL"]
    admin_password = os.environ["ADMIN_PASSWORD"]

    # Chapters
    chapters_data = [
        {"chapter_id": "chp_ararat", "name": "Ararat Chapter", "name_hy": "Արարատի մասնաճյուղ",
         "location": "Yerevan, Armenia", "description": "Founded 1918. Home of the eagle patrols in central Armenia.",
         "contact_email": "ararat@scouts.am", "contact_phone": "+374 10 555 001",
         "logo": "", "cover": "", "created_at": now_iso()},
        {"chapter_id": "chp_sevan", "name": "Sevan Chapter", "name_hy": "Սևանի մասնաճյուղ",
         "location": "Gegharkunik", "description": "Lake Sevan scouts — sailing and water rescue specialty.",
         "contact_email": "sevan@scouts.am", "contact_phone": "+374 10 555 002",
         "logo": "", "cover": "", "created_at": now_iso()},
        {"chapter_id": "chp_gyumri", "name": "Gyumri Chapter", "name_hy": "Գյումրիի մասնաճյուղ",
         "location": "Shirak", "description": "Northern chapter focused on mountain hiking and community service.",
         "contact_email": "gyumri@scouts.am", "contact_phone": "+374 10 555 003",
         "logo": "", "cover": "", "created_at": now_iso()},
        {"chapter_id": "chp_tavush", "name": "Tavush Chapter", "name_hy": "Տավուշի մասնաճյուղ",
         "location": "Tavush", "description": "Forest-country chapter, expert in navigation and wilderness skills.",
         "contact_email": "tavush@scouts.am", "contact_phone": "+374 10 555 004",
         "logo": "", "cover": "", "created_at": now_iso()},
    ]
    await db.chapters.insert_many(chapters_data)

    # Users
    users_data = [
        {"user_id": "usr_admin", "email": admin_email, "name": "National Administrator",
         "password_hash": hash_password(admin_password), "role": "national_admin", "chapter_id": None, "picture": "", "status": "active", "created_at": now_iso()},
        {"user_id": "usr_ararat_admin", "email": "ararat.leader@scouts.am", "name": "Anahit Sargsyan",
         "password_hash": hash_password("scout123"), "role": "chapter_admin", "chapter_id": "chp_ararat", "picture": "", "status": "active", "created_at": now_iso()},
        {"user_id": "usr_sevan_leader", "email": "sevan.leader@scouts.am", "name": "Davit Petrosyan",
         "password_hash": hash_password("scout123"), "role": "chapter_leader", "chapter_id": "chp_sevan", "picture": "", "status": "active", "created_at": now_iso()},
        {"user_id": "usr_gyumri_admin", "email": "gyumri.leader@scouts.am", "name": "Mher Grigoryan",
         "password_hash": hash_password("scout123"), "role": "chapter_admin", "chapter_id": "chp_gyumri", "picture": "", "status": "active", "created_at": now_iso()},
        {"user_id": "usr_narek", "email": "narek@scouts.am", "name": "Narek Hovhannisyan",
         "password_hash": hash_password("scout123"), "role": "scout", "chapter_id": "chp_ararat", "picture": "", "status": "active", "created_at": now_iso()},
    ]
    # Users — upsert (some may already exist from ensure_seed_users_present)
    for u in users_data:
        await db.users.update_one({"email": u["email"]}, {"$set": u}, upsert=True)

    # Members
    first_names_en = ["Narek", "Ani", "Tigran", "Lilit", "Aram", "Mariam", "Hayk", "Nare", "Vahe", "Sona", "Arman", "Ashkhen", "Sevak", "Karine", "Suren", "Anahit", "Levon", "Nane", "Gor", "Tatev", "Erik", "Milena", "Rafael", "Zara", "Grigor", "Astghik", "Robert", "Nvard", "Vardan", "Mane"]
    last_names_en = ["Hovhannisyan", "Grigoryan", "Petrosyan", "Sargsyan", "Karapetyan", "Mkrtchyan", "Avetisyan", "Harutyunyan", "Simonyan", "Vardanyan"]
    first_names_hy = ["Նարեկ", "Անի", "Տիգրան", "Լիլիթ", "Արամ", "Մարիամ", "Հայկ", "Նարե", "Վահե", "Սոնա", "Արման", "Աշխեն", "Սևակ", "Կարինե", "Սուրեն", "Անահիտ", "Լևոն", "Նանե", "Գոռ", "Տաթև", "Էրիկ", "Միլենա", "Ռաֆայել", "Զառա", "Գրիգոր", "Աստղիկ", "Ռոբերտ", "Նվարդ", "Վարդան", "Մանե"]
    sections = ["Cubs", "Scouts", "Senior Scouts", "Rovers"]
    patrols = ["Eagle", "Wolf", "Bear", "Fox", "Hawk", "Deer"]
    import random
    random.seed(42)
    members = []
    # Ensure Narek is linked
    members.append({
        "member_id": "mbr_narek", "full_name": "Narek Hovhannisyan", "full_name_hy": "Նարեկ Հովհաննիսյան",
        "photo": "", "dob": "2011-06-14", "gender": "M", "phone": "+374 91 12 34 56",
        "email": "narek@scouts.am", "guardian_name": "Karen Hovhannisyan", "guardian_phone": "+374 91 00 00 01",
        "emergency_contact": "+374 91 00 00 02", "chapter_id": "chp_ararat", "section": "Scouts",
        "patrol": "Eagle", "membership_start": "2022-09-01", "status": "active", "position": "Patrol Leader",
        "notes": "Interested in navigation and first aid.", "created_at": now_iso()
    })
    for i in range(29):
        fi = i % len(first_names_en)
        li = i % len(last_names_en)
        ch = chapters_data[i % 4]["chapter_id"]
        sec = sections[i % 4]
        members.append({
            "member_id": new_id("mbr"),
            "full_name": f"{first_names_en[fi]} {last_names_en[li]}",
            "full_name_hy": f"{first_names_hy[fi]} {last_names_en[li]}",
            "photo": "", "dob": f"{2005 + (i % 15)}-0{(i%9)+1}-1{(i%9)}", "gender": "M" if i % 2 == 0 else "F",
            "phone": f"+374 91 {10 + i:02d} {20 + i:02d} {30 + i:02d}",
            "email": f"member{i+1}@scouts.am",
            "guardian_name": f"Parent {i+1}", "guardian_phone": f"+374 91 99 99 {i:02d}",
            "emergency_contact": f"+374 91 88 88 {i:02d}",
            "chapter_id": ch, "section": sec, "patrol": patrols[i % len(patrols)],
            "membership_start": f"202{i%4}-09-01", "status": "active" if i % 10 else "inactive",
            "position": "Member", "notes": "", "created_at": now_iso()
        })
    await db.members.insert_many(members)

    # Badges
    badges_data = [
        {"badge_id": "bdg_first_aid", "name": "First Aid", "name_hy": "Առաջին օգնություն", "icon": "heart-pulse", "color": "#E07A5F",
         "description": "Master the basics of emergency care.", "section": "Scouts", "category": "First Aid",
         "difficulty": "medium", "recommended_age": "12+", "requirements": ["CPR basics demonstrated", "Wound dressing", "Recognize shock", "Emergency call procedure"], "created_at": now_iso()},
        {"badge_id": "bdg_camping", "name": "Camping", "name_hy": "Ճամբարային գործ", "icon": "tent", "color": "#2D6A4F",
         "description": "Set up camp and cook outdoors.", "section": "Scouts", "category": "Camping",
         "difficulty": "medium", "recommended_age": "11+", "requirements": ["Pitch a tent", "Fire building", "Camp cooking", "Leave-no-trace"], "created_at": now_iso()},
        {"badge_id": "bdg_hiking", "name": "Hiking", "name_hy": "Զբոսարշավ", "icon": "mountain", "color": "#52796F",
         "description": "Complete a 15km trek with map.", "section": "Senior Scouts", "category": "Hiking",
         "difficulty": "hard", "recommended_age": "14+", "requirements": ["15km hike", "Route planning", "Pack for a day", "Trail safety"], "created_at": now_iso()},
        {"badge_id": "bdg_nature", "name": "Nature", "name_hy": "Բնություն", "icon": "leaf", "color": "#2D6A4F",
         "description": "Identify local flora and fauna.", "section": "Cubs", "category": "Nature",
         "difficulty": "easy", "recommended_age": "8+", "requirements": ["Identify 10 plants", "Identify 5 birds", "Water source safety"], "created_at": now_iso()},
        {"badge_id": "bdg_leader", "name": "Leadership", "name_hy": "Առաջնորդություն", "icon": "users", "color": "#E07A5F",
         "description": "Lead a patrol activity.", "section": "Senior Scouts", "category": "Leadership",
         "difficulty": "hard", "recommended_age": "15+", "requirements": ["Lead 3 activities", "Mentor a Cub", "Present a program"], "created_at": now_iso()},
        {"badge_id": "bdg_navigation", "name": "Navigation", "name_hy": "Կողմնորոշում", "icon": "compass", "color": "#F4A261",
         "description": "Read map and use compass.", "section": "Scouts", "category": "Navigation",
         "difficulty": "medium", "recommended_age": "12+", "requirements": ["Read a topo map", "Use a compass", "Orienteering course"], "created_at": now_iso()},
        {"badge_id": "bdg_community", "name": "Community Service", "name_hy": "Համայնքային ծառայություն", "icon": "hand-heart", "color": "#E07A5F",
         "description": "10 hours of service.", "section": "Scouts", "category": "Community Service",
         "difficulty": "easy", "recommended_age": "10+", "requirements": ["10 service hours", "Reflection report", "Team project"], "created_at": now_iso()},
        {"badge_id": "bdg_comm", "name": "Communication", "name_hy": "Հաղորդակցություն", "icon": "message-circle", "color": "#F4A261",
         "description": "Public speaking and radio basics.", "section": "Scouts", "category": "Communication",
         "difficulty": "medium", "recommended_age": "12+", "requirements": ["Give a 5-min talk", "Morse code alphabet", "Handheld radio use"], "created_at": now_iso()},
        {"badge_id": "bdg_swim", "name": "Swimmer", "name_hy": "Լողորդ", "icon": "waves", "color": "#52796F",
         "description": "Swim 200m and life saving basics.", "section": "Scouts", "category": "Sports",
         "difficulty": "medium", "recommended_age": "10+", "requirements": ["200m swim", "Tread water 3 min", "Rescue reach"], "created_at": now_iso()},
        {"badge_id": "bdg_crafts", "name": "Crafts", "name_hy": "Արհեստներ", "icon": "palette", "color": "#F4A261",
         "description": "Create with your hands.", "section": "Cubs", "category": "Creativity",
         "difficulty": "easy", "recommended_age": "8+", "requirements": ["Woodwork item", "Weaving basics", "Camp gadget"], "created_at": now_iso()},
        {"badge_id": "bdg_citizen", "name": "Citizenship", "name_hy": "Քաղաքացիություն", "icon": "landmark", "color": "#2D6A4F",
         "description": "Learn civic duties.", "section": "Senior Scouts", "category": "Citizenship",
         "difficulty": "medium", "recommended_age": "14+", "requirements": ["National anthem", "Local government visit", "Civic essay"], "created_at": now_iso()},
        {"badge_id": "bdg_fire", "name": "Fire Craft", "name_hy": "Խարույկ", "icon": "flame", "color": "#E07A5F",
         "description": "Safe fire building and cooking.", "section": "Scouts", "category": "Camping",
         "difficulty": "medium", "recommended_age": "12+", "requirements": ["Build with 1 match", "Charcoal method", "Fire safety plan"], "created_at": now_iso()},
        {"badge_id": "bdg_pioneer", "name": "Pioneering", "name_hy": "Կապեր և հանգույցներ", "icon": "anchor", "color": "#52796F",
         "description": "Knots, lashings, structures.", "section": "Senior Scouts", "category": "Scouting Skills",
         "difficulty": "hard", "recommended_age": "13+", "requirements": ["Ten knots", "Square lashing", "Build a tripod", "Rope care"], "created_at": now_iso()},
        {"badge_id": "bdg_star", "name": "Astronomy", "name_hy": "Աստղագիտություն", "icon": "star", "color": "#F4A261",
         "description": "Identify constellations.", "section": "Scouts", "category": "Nature",
         "difficulty": "medium", "recommended_age": "12+", "requirements": ["10 constellations", "Use star map", "Meteor shower log"], "created_at": now_iso()},
        {"badge_id": "bdg_ski", "name": "Winter Skills", "name_hy": "Ձմեռային հմտություններ", "icon": "snowflake", "color": "#52796F",
         "description": "Cold-weather scouting.", "section": "Senior Scouts", "category": "Camping",
         "difficulty": "hard", "recommended_age": "14+", "requirements": ["Cold-weather kit", "Snow shelter", "Avalanche awareness"], "created_at": now_iso()},
    ]
    await db.badges.insert_many(badges_data)

    # Award some badges to Narek
    await db.member_badges.insert_many([
        {"mb_id": new_id("mb"), "member_id": "mbr_narek", "badge_id": "bdg_nature",
         "completed_requirements": [True, True, True], "awarded": True, "awarded_at": now_iso(),
         "awarded_by": admin_email, "created_at": now_iso()},
        {"mb_id": new_id("mb"), "member_id": "mbr_narek", "badge_id": "bdg_first_aid",
         "completed_requirements": [True, True, False, False], "awarded": False, "awarded_at": "",
         "awarded_by": "", "created_at": now_iso()},
        {"mb_id": new_id("mb"), "member_id": "mbr_narek", "badge_id": "bdg_navigation",
         "completed_requirements": [True, False, False], "awarded": False, "awarded_at": "",
         "awarded_by": "", "created_at": now_iso()},
    ])

    # Programs
    today = datetime.now(timezone.utc)
    def d_offset(days): return (today + timedelta(days=days)).date().isoformat()
    programs = [
        {"program_id": "prg_national_camp", "title": "National Summer Camp", "title_hy": "Ազգային ամառային ճամբար",
         "description": "Annual weeklong national camp at Lake Sevan.", "date": d_offset(30), "start_time": "09:00", "end_time": "18:00",
         "location": "Lake Sevan", "section": "Scouts", "chapter_id": None, "leaders": ["National HQ"],
         "expected_participants": 200, "materials": "Tent, sleeping bag, uniform, hiking boots",
         "objectives": "Community building, skills development, badge activities",
         "related_badges": ["bdg_camping", "bdg_swim", "bdg_hiking"],
         "activities": [
             {"time": "09:00", "title": "Opening Ceremony", "description": "Flag raising and welcome"},
             {"time": "10:00", "title": "Patrol Setup", "description": "Camp organization"},
             {"time": "12:00", "title": "Lunch", "description": "Communal meal"},
             {"time": "14:00", "title": "Water Activities", "description": "Swimming and rescue drills"},
             {"time": "18:00", "title": "Campfire", "description": "Songs and stories"},
         ],
         "cover": "", "created_by": admin_email, "created_at": now_iso()},
    ]
    program_titles = [
        ("Sunday Meeting", "Կիրակնօրյա հանդիպում"),
        ("Hike to Mt. Aragats", "Արշավ դեպի Արագած"),
        ("First Aid Workshop", "Առաջին օգնության արհեստանոց"),
        ("Community Service Day", "Համայնքային ծառայության օր"),
        ("Winter Camp", "Ձմեռային ճամբար"),
        ("Astronomy Night", "Աստղագիտության գիշեր"),
        ("Pioneering Weekend", "Կապերի շաբաթավերջ"),
        ("Cub Fun Day", "Փոքրիկների խաղի օր"),
        ("Rover Expedition", "Ռովերների արշավ"),
    ]
    for i, (t_en, t_hy) in enumerate(program_titles):
        programs.append({
            "program_id": new_id("prg"), "title": t_en, "title_hy": t_hy,
            "description": f"{t_en} at the chapter.", "date": d_offset((i - 3) * 5),
            "start_time": "10:30", "end_time": "13:00",
            "location": chapters_data[i % 4]["location"], "section": sections[i % 4],
            "chapter_id": chapters_data[i % 4]["chapter_id"],
            "leaders": [], "expected_participants": 20 + i,
            "materials": "Uniform, notebook", "objectives": "Skill practice and fellowship",
            "related_badges": [badges_data[i % len(badges_data)]["badge_id"]],
            "activities": [
                {"time": "10:30", "title": "Opening", "description": "Welcome"},
                {"time": "10:45", "title": "Scout Game", "description": "Team-building game"},
                {"time": "11:15", "title": "Badge Activity", "description": "Progress work"},
                {"time": "12:00", "title": "Break", "description": "Snack"},
                {"time": "12:15", "title": "Team Activity", "description": "Patrol project"},
                {"time": "12:45", "title": "Closing", "description": "Debrief"},
            ],
            "cover": "", "created_by": "leader@scouts.am", "created_at": now_iso(),
        })
    await db.programs.insert_many(programs)

    # Sample attendance for one program
    ararat_members = await db.members.find({"chapter_id": "chp_ararat"}).to_list(50)
    if programs[1:2]:
        for i, m in enumerate(ararat_members[:8]):
            statuses = ["present", "present", "late", "present", "absent", "excused", "present", "present"]
            await db.attendance.insert_one({
                "attendance_id": new_id("att"),
                "program_id": programs[1]["program_id"],
                "member_id": m["member_id"],
                "status": statuses[i],
                "date": programs[1]["date"],
                "recorded_by": "ararat.leader@scouts.am",
                "created_at": now_iso(),
            })

    # Newsletters
    newsletters = [
        {"newsletter_id": new_id("nws"), "title": "Winter 2026 Recap", "title_hy": "Ձմեռ 2026 Ամփոփում",
         "cover": "", "short_description": "Highlights from the winter season across all chapters.",
         "content": "This winter our scouts learned snow shelter building, avalanche safety, and shared warmth around the campfire. Congratulations to 42 new badge awardees!",
         "pdf": "", "author": "National HQ", "created_at": now_iso(), "published_at": now_iso()},
        {"newsletter_id": new_id("nws"), "title": "Ararat Chapter News", "title_hy": "Արարատի լուրեր",
         "cover": "", "short_description": "Ararat chapter activities and upcoming events.",
         "content": "Ararat chapter completed 3 hikes this month, welcomed 5 new Cubs, and awarded 12 progress badges.",
         "pdf": "", "author": "Anahit Sargsyan", "created_at": now_iso(), "published_at": now_iso()},
        {"newsletter_id": new_id("nws"), "title": "Founder's Day Special", "title_hy": "Հիմնադիրի օր",
         "cover": "", "short_description": "Celebrating the founder of Armenian scouting.",
         "content": "Read about the history of our movement and reflections from long-serving leaders.",
         "pdf": "", "author": "National HQ", "created_at": now_iso(), "published_at": now_iso()},
    ]
    await db.newsletters.insert_many(newsletters)

    # Announcements
    announcements = [
        {"announcement_id": new_id("ann"), "title": "Summer Camp Registration Open",
         "title_hy": "Ամառային ճամբարի գրանցումը բաց է", "message": "Register by end of month. Limited spots.",
         "image": "", "priority": "high", "expires_at": d_offset(30),
         "chapter_id": None, "author": admin_email, "created_at": now_iso()},
        {"announcement_id": new_id("ann"), "title": "Ararat Meeting Time Change",
         "title_hy": "Ժամի փոփոխություն", "message": "Sunday meetings now at 10:30 (was 11:00).",
         "image": "", "priority": "normal", "expires_at": "",
         "chapter_id": "chp_ararat", "author": "ararat.leader@scouts.am", "created_at": now_iso()},
        {"announcement_id": new_id("ann"), "title": "Uniform Order Reminder",
         "title_hy": "Համազգեստի հիշեցում", "message": "Please order new uniforms before spring camp.",
         "image": "", "priority": "normal", "expires_at": "",
         "chapter_id": None, "author": admin_email, "created_at": now_iso()},
    ]
    await db.announcements.insert_many(announcements)

    # Resources
    resources = [
        {"resource_id": new_id("res"), "title": "Scout Manual (EN)", "category": "Manuals",
         "description": "Official scout manual — English edition.", "file_data": "", "file_name": "manual_en.pdf",
         "file_type": "application/pdf", "uploaded_by": admin_email, "created_at": now_iso()},
        {"resource_id": new_id("res"), "title": "First Aid Guide", "category": "Progress badge materials",
         "description": "Reference for the First Aid badge.", "file_data": "", "file_name": "first_aid.pdf",
         "file_type": "application/pdf", "uploaded_by": admin_email, "created_at": now_iso()},
        {"resource_id": new_id("res"), "title": "Camp Registration Form", "category": "Forms",
         "description": "PDF form to register for camp.", "file_data": "", "file_name": "camp_form.pdf",
         "file_type": "application/pdf", "uploaded_by": admin_email, "created_at": now_iso()},
        {"resource_id": new_id("res"), "title": "Activity Ideas Booklet", "category": "Activity ideas",
         "description": "50 ready-to-run activities.", "file_data": "", "file_name": "activities.pdf",
         "file_type": "application/pdf", "uploaded_by": admin_email, "created_at": now_iso()},
    ]
    await db.resources.insert_many(resources)

    logger.info("Seed data inserted.")

# ---------- Startup ----------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.chapters.create_index("chapter_id", unique=True)
    await db.members.create_index("member_id", unique=True)
    await db.badges.create_index("badge_id", unique=True)
    await db.programs.create_index("program_id", unique=True)
    await db.notifications.create_index("user_id")
    await db.attendance.create_index([("program_id", 1), ("member_id", 1)])
    await seed()

@app.on_event("shutdown")
async def on_stop():
    client.close()

app.include_router(api)

# Payment routes (Stripe)
from payments import payments_router, register_payment_routes
register_payment_routes(db, get_current_user, notify, audit, new_id)
app.include_router(payments_router)

# Finance routes + gallery zip download
from finance import finance_router, register_finance_routes, register_gallery_zip_route
register_finance_routes(db, get_current_user, LEADER_ROLES, is_leader, audit, new_id)
register_gallery_zip_route(db, finance_router, get_current_user)
app.include_router(finance_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # switched to Bearer tokens for cross-domain simplicity
    allow_methods=["*"],
    allow_headers=["*"],
)
