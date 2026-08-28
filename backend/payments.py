"""Stripe payments (Flow B — BYOK). Uses emergentintegrations shared test sandbox."""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)


payments_router = APIRouter(prefix="/api")


def _get_stripe(request: Request) -> StripeCheckout:
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=webhook_url)


class ProgramCheckoutIn(BaseModel):
    program_id: str
    origin_url: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def register_payment_routes(db, get_current_user, notify, audit, new_id):
    """Register payment routes with the shared db + auth helpers."""

    @payments_router.post("/payments/programs/checkout")
    async def create_program_checkout(
        payload: ProgramCheckoutIn,
        request: Request,
        user: dict = Depends(get_current_user),
    ):
        p = await db.programs.find_one({"program_id": payload.program_id})
        if not p:
            raise HTTPException(404, "Program not found")
        fee = float(p.get("fee") or 0.0)
        if fee <= 0:
            raise HTTPException(400, "Program is free — no checkout required")
        currency = (p.get("currency") or "usd").lower()

        origin = payload.origin_url.rstrip("/")
        req = CheckoutSessionRequest(
            amount=fee,
            currency=currency,
            success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/programs/{payload.program_id}?payment=cancelled",
            metadata={
                "program_id": payload.program_id,
                "user_id": user["user_id"],
                "user_email": user["email"],
                "kind": "program_registration",
            },
        )
        session = await _get_stripe(request).create_checkout_session(req)

        await db.payment_transactions.insert_one({
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "user_email": user["email"],
            "program_id": payload.program_id,
            "amount": fee,
            "currency": currency,
            "status": "initiated",
            "payment_status": "pending",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })
        return {"checkout_url": session.url, "session_id": session.session_id}

    @payments_router.get("/payments/status/{session_id}")
    async def get_payment_status(session_id: str, request: Request):
        record = await db.payment_transactions.find_one({"session_id": session_id})
        if not record:
            raise HTTPException(404, "Transaction not found")

        # Webhook fallback: poll Stripe if still pending
        if record.get("payment_status") != "paid":
            try:
                status = await _get_stripe(request).get_checkout_status(session_id)
                if status.payment_status == "paid" or status.status == "complete":
                    await db.payment_transactions.update_one(
                        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                        {"$set": {
                            "status": "completed",
                            "payment_status": "paid",
                            "updated_at": _now_iso(),
                        }},
                    )
                    # Materialize the program registration on first paid confirmation
                    await _mark_registration_paid(db, notify, new_id, record)
                    record = await db.payment_transactions.find_one({"session_id": session_id})
            except Exception:
                pass  # transient — return whatever we have

        return {
            "session_id": record["session_id"],
            "status": record["status"],
            "payment_status": record["payment_status"],
            "program_id": record.get("program_id"),
            "amount": record.get("amount"),
            "currency": record.get("currency"),
        }

    @payments_router.post("/webhook/stripe")
    async def stripe_webhook(request: Request):
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        try:
            wh = await _get_stripe(request).handle_webhook(body, signature)
        except Exception as e:
            raise HTTPException(400, f"Invalid webhook: {e}")

        if wh.payment_status in ("paid", "succeeded"):
            record = await db.payment_transactions.find_one({"session_id": wh.session_id})
            if record and record.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": wh.session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "status": "completed",
                        "payment_status": "paid",
                        "updated_at": _now_iso(),
                    }},
                )
                await _mark_registration_paid(db, notify, new_id, record)
        return {"received": True}


async def _mark_registration_paid(db, notify, new_id, record):
    """Create or upgrade a program registration to paid=True."""
    program_id = record.get("program_id")
    user_id = record.get("user_id")
    if not program_id or not user_id:
        return

    existing = await db.program_registrations.find_one({"program_id": program_id, "user_id": user_id})
    p = await db.programs.find_one({"program_id": program_id})
    if not p:
        return
    capacity = int(p.get("capacity") or 0)
    current = await db.program_registrations.count_documents({"program_id": program_id, "status": "registered"})
    status = "waitlisted" if (capacity and current >= capacity and p.get("waitlist_enabled")) else "registered"

    if existing:
        await db.program_registrations.update_one(
            {"reg_id": existing["reg_id"]},
            {"$set": {"paid": True, "session_id": record["session_id"], "status": existing.get("status") or status}},
        )
    else:
        m = await db.members.find_one({"email": record.get("user_email")}, {"member_id": 1, "full_name": 1})
        await db.program_registrations.insert_one({
            "reg_id": new_id("reg"),
            "program_id": program_id,
            "user_id": user_id,
            "user_email": record.get("user_email"),
            "member_id": m.get("member_id") if m else None,
            "status": status,
            "paid": True,
            "session_id": record["session_id"],
            "created_at": _now_iso(),
        })

    await notify(
        [user_id],
        "Payment confirmed",
        f"Your registration for {p.get('title')} is now paid and confirmed.",
        "success",
        f"/programs/{program_id}",
    )
