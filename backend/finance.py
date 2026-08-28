"""Finance module — chapter & national income/expense tracking (AMD)."""
import io
import zipfile
import base64
import re
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


finance_router = APIRouter(prefix="/api")


FINANCE_CATEGORIES = [
    "Donations", "Membership Fees", "Program Fees", "Grants",
    "Equipment", "Camps", "Travel", "Facilities", "Staff", "Other",
]

INCOME_CATEGORIES = {"Donations", "Membership Fees", "Program Fees", "Grants"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class FinanceTxnIn(BaseModel):
    kind: str  # "income" | "expense"
    category: str
    amount: float  # AMD
    date: str  # YYYY-MM-DD
    chapter_id: Optional[str] = None  # None = national
    description: str = ""


def register_finance_routes(db, get_current_user, LEADER_ROLES, is_leader, audit, new_id):
    def _finance_scope(user, chapter_id):
        if user["role"] == "national_admin":
            return  # can touch any chapter or national
        if user["role"] not in LEADER_ROLES:
            raise HTTPException(403, "Only leaders can manage finances")
        if chapter_id != user.get("chapter_id"):
            raise HTTPException(403, "Not allowed for this chapter")

    @finance_router.get("/finance/categories")
    async def categories(user: dict = Depends(get_current_user)):
        if not is_leader(user["role"]):
            raise HTTPException(403, "Not allowed")
        return {"categories": FINANCE_CATEGORIES, "income_categories": list(INCOME_CATEGORIES)}

    @finance_router.get("/finance/transactions")
    async def list_txns(
        chapter_id: Optional[str] = Query(None),
        kind: Optional[str] = Query(None),
        category: Optional[str] = Query(None),
        limit: int = Query(500),
        user: dict = Depends(get_current_user),
    ):
        if not is_leader(user["role"]):
            raise HTTPException(403, "Not allowed")
        q: dict = {}
        if user["role"] != "national_admin":
            q["chapter_id"] = user.get("chapter_id")
        elif chapter_id is not None:
            q["chapter_id"] = None if chapter_id == "national" else chapter_id
        if kind: q["kind"] = kind
        if category: q["category"] = category
        return await db.finance_transactions.find(q, {"_id": 0}).sort("date", -1).to_list(limit)

    @finance_router.post("/finance/transactions")
    async def create_txn(payload: FinanceTxnIn, user: dict = Depends(get_current_user)):
        if not is_leader(user["role"]):
            raise HTTPException(403, "Not allowed")
        if payload.kind not in ("income", "expense"):
            raise HTTPException(400, "kind must be income or expense")
        if payload.category not in FINANCE_CATEGORIES:
            raise HTTPException(400, "Unknown category")
        if payload.amount <= 0:
            raise HTTPException(400, "Amount must be > 0")
        # normalize scope
        cid = payload.chapter_id
        if user["role"] != "national_admin":
            cid = user.get("chapter_id")
        else:
            _finance_scope(user, cid)
        tid = new_id("fin")
        doc = {
            "txn_id": tid,
            "kind": payload.kind,
            "category": payload.category,
            "amount": float(payload.amount),
            "currency": "amd",
            "date": payload.date,
            "chapter_id": cid,
            "description": payload.description,
            "created_by": user["email"],
            "created_at": _now_iso(),
        }
        await db.finance_transactions.insert_one(doc)
        await audit(user, "create", "finance_transaction", tid, {"kind": payload.kind, "amount": payload.amount})
        doc.pop("_id", None)
        return doc

    @finance_router.delete("/finance/transactions/{tid}")
    async def delete_txn(tid: str, user: dict = Depends(get_current_user)):
        t = await db.finance_transactions.find_one({"txn_id": tid})
        if not t: raise HTTPException(404, "Not found")
        _finance_scope(user, t.get("chapter_id"))
        await db.finance_transactions.delete_one({"txn_id": tid})
        await audit(user, "delete", "finance_transaction", tid)
        return {"ok": True}

    @finance_router.get("/finance/summary")
    async def summary(
        chapter_id: Optional[str] = Query(None, description="chapter id, 'national', or omit for all"),
        user: dict = Depends(get_current_user),
    ):
        if not is_leader(user["role"]):
            raise HTTPException(403, "Not allowed")

        # Determine scope
        if user["role"] == "national_admin":
            if chapter_id is None:
                # Return breakdown across chapters + national
                chapters = await db.chapters.find({"archived": {"$ne": True}}, {"_id": 0, "chapter_id": 1, "name": 1}).to_list(200)
                buckets = [{"chapter_id": None, "name": "National"}] + [{"chapter_id": c["chapter_id"], "name": c["name"]} for c in chapters]
                results = []
                for b in buckets:
                    q = {"chapter_id": b["chapter_id"]}
                    txns = await db.finance_transactions.find(q, {"_id": 0}).to_list(5000)
                    inc = sum(t["amount"] for t in txns if t["kind"] == "income")
                    exp = sum(t["amount"] for t in txns if t["kind"] == "expense")
                    results.append({
                        **b,
                        "income_total": inc,
                        "expense_total": exp,
                        "networth": inc - exp,
                        "transaction_count": len(txns),
                    })
                # national aggregate = sum across everything (chapter + national)
                total_inc = sum(r["income_total"] for r in results)
                total_exp = sum(r["expense_total"] for r in results)
                return {
                    "scope": "all",
                    "grand_total": {
                        "income_total": total_inc,
                        "expense_total": total_exp,
                        "networth": total_inc - total_exp,
                    },
                    "buckets": results,
                }
            target_cid = None if chapter_id == "national" else chapter_id
        else:
            target_cid = user.get("chapter_id")

        q = {"chapter_id": target_cid}
        txns = await db.finance_transactions.find(q, {"_id": 0}).to_list(5000)
        inc = sum(t["amount"] for t in txns if t["kind"] == "income")
        exp = sum(t["amount"] for t in txns if t["kind"] == "expense")

        # Monthly breakdown for last 12 months
        by_month: dict = {}
        for t in txns:
            m = (t.get("date") or "")[:7]
            if not m: continue
            b = by_month.setdefault(m, {"month": m, "income": 0.0, "expense": 0.0})
            b[t["kind"]] += t["amount"]
        monthly = sorted(by_month.values(), key=lambda x: x["month"])[-12:]

        # By category
        by_cat: dict = {}
        for t in txns:
            key = (t["kind"], t["category"])
            by_cat[key] = by_cat.get(key, 0.0) + t["amount"]
        categories = [{"kind": k[0], "category": k[1], "total": v} for k, v in by_cat.items()]
        categories.sort(key=lambda c: c["total"], reverse=True)

        chapter_name = "National"
        if target_cid:
            c = await db.chapters.find_one({"chapter_id": target_cid}, {"name": 1, "_id": 0})
            chapter_name = c.get("name", target_cid) if c else target_cid

        return {
            "scope": "chapter" if target_cid else "national",
            "chapter_id": target_cid,
            "chapter_name": chapter_name,
            "income_total": inc,
            "expense_total": exp,
            "networth": inc - exp,
            "monthly": monthly,
            "categories": categories,
            "transaction_count": len(txns),
        }


def _slug(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", (s or "").strip())[:60] or "gallery"


def register_gallery_zip_route(db, finance_router, get_current_user):
    @finance_router.get("/galleries/{gid}/download")
    async def download_gallery_zip(gid: str, user: dict = Depends(get_current_user)):
        g = await db.galleries.find_one({"gallery_id": gid}, {"_id": 0})
        if not g: raise HTTPException(404, "Gallery not found")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for idx, img in enumerate(g.get("images") or [], start=1):
                data_url = img.get("data") or ""
                if "," not in data_url: continue
                header, b64 = data_url.split(",", 1)
                try:
                    raw = base64.b64decode(b64)
                except Exception:
                    continue
                # guess extension
                ext = "jpg"
                m = re.search(r"image/(\w+)", header or "")
                if m: ext = m.group(1).replace("jpeg", "jpg")
                caption = _slug(img.get("caption") or "")
                fname = f"{idx:03d}_{caption or 'image'}.{ext}"
                zf.writestr(fname, raw)
        buf.seek(0)
        filename = f"{_slug(g.get('title', 'gallery'))}.zip"
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
