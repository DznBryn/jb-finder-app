from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import json

import stripe
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import (
    AUTH_SCHEMA,
    STRIPE_PRICE_MONTHLY,
    STRIPE_PRICE_ONETIME,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_WEBHOOK_BYPASS,
)

@dataclass
class SubscriptionStatus:
    """Plan and status (persisted on users when logged in, in-memory for anonymous)."""

    plan: str = "free"
    status: str = "none"


_SUBSCRIPTIONS: dict[UUID, SubscriptionStatus] = {}


def _users_table() -> str:
    """Qualified users table for auth schema (safe identifier)."""
    return "users" if AUTH_SCHEMA == "public" else f'"{AUTH_SCHEMA}".users'


def set_user_plan(db: Session, user_id: str, plan: str) -> None:
    """Persist plan on auth users table (after signup / Stripe checkout)."""
    db.execute(
        text(f"UPDATE {_users_table()} SET plan = :plan WHERE id = :id"),
        {"plan": plan, "id": user_id},
    )
    db.commit()


def get_user_plan(db: Session, user_id: str) -> str:
    """Return plan from auth users table; default 'free' if missing."""
    r = db.execute(
        text(f"SELECT plan FROM {_users_table()} WHERE id = :id"),
        {"id": user_id},
    ).fetchone()
    return (r[0] or "free") if r else "free"


def create_checkout_session(session_id: UUID, plan: str) -> str:
    """Create a Stripe Checkout session and return the hosted URL."""

    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")

    price_id = STRIPE_PRICE_MONTHLY if plan == "monthly" else STRIPE_PRICE_ONETIME
    if not price_id:
        raise ValueError("Stripe price ID is missing for the selected plan.")

    stripe.api_key = STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        mode="subscription" if plan == "monthly" else "payment",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url="http://localhost:3000?checkout=success",
        cancel_url="http://localhost:3000?checkout=cancel",
        metadata={"session_id": str(session_id), "plan": plan},
    )
    return session.url


def verify_stripe_signature(payload: bytes, signature: str) -> stripe.Event:
    """Verify Stripe webhook signature and return the event."""
    if STRIPE_WEBHOOK_BYPASS:
        data = json.loads(payload.decode("utf-8"))
        return stripe.Event.construct_from(data, stripe.api_key)

    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")
    if not STRIPE_WEBHOOK_SECRET:
        raise ValueError("STRIPE_WEBHOOK_SECRET is not set.")

    stripe.api_key = STRIPE_SECRET_KEY
    return stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)


def set_subscription_active(session_id: UUID, plan: str) -> SubscriptionStatus:
    """Mark a session as having an active subscription (in-memory for anonymous)."""

    status = SubscriptionStatus(plan=plan, status="active")
    _SUBSCRIPTIONS[session_id] = status
    return status


def get_subscription_status(
    session_id: UUID, db: Session | None = None
) -> SubscriptionStatus:
    """Return plan/status: from users table when session has user_id, else in-memory."""

    if db is not None:
        from app.models.db_models import ResumeSessionRecord

        rec = db.query(ResumeSessionRecord).filter(ResumeSessionRecord.id == str(session_id)).first()
        if rec and rec.user_id:
            plan = get_user_plan(db, rec.user_id)
            return SubscriptionStatus(plan=plan, status="active" if plan != "free" else "none")
    return _SUBSCRIPTIONS.get(session_id, SubscriptionStatus())
