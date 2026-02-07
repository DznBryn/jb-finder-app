from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import json
from pprint import pprint
import stripe
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import (
    AUTH_SCHEMA,
    FRONTEND_URL,
    STRIPE_PRICE_MONTHLY,
    STRIPE_PRICE_MONTHLY_BASIC,
    STRIPE_PRICE_MONTHLY_PRO,
    STRIPE_PRICE_ONETIME,
    STRIPE_PRICE_TOPUP_LARGE,
    STRIPE_PRICE_TOPUP_SMALL,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_BYPASS,
    STRIPE_WEBHOOK_SECRET,
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


# Plan -> (Stripe price ID, mode)
_PLAN_PRICE: dict[str, tuple[str, str]] = {
    "monthly_basic": (STRIPE_PRICE_MONTHLY_BASIC, "subscription"),
    "monthly_pro": (STRIPE_PRICE_MONTHLY_PRO, "subscription"),
    "topup_small": (STRIPE_PRICE_TOPUP_SMALL, "payment"),
    "topup_large": (STRIPE_PRICE_TOPUP_LARGE, "payment"),
}
# Fallback for legacy plans
if STRIPE_PRICE_MONTHLY:
    _PLAN_PRICE.setdefault("monthly", (STRIPE_PRICE_MONTHLY, "subscription"))
if STRIPE_PRICE_ONETIME:
    _PLAN_PRICE.setdefault("one_time", (STRIPE_PRICE_ONETIME, "payment"))

PLAN_CREDITS: dict[str, int] = {
    "monthly_basic": 500,
    "monthly_pro": 2500,
    "topup_small": 200,
    "topup_large": 1000,
}
SUBSCRIBER_BONUS = 0.5  # 50% bonus on top-ups for subscribers


def grant_credits(
    db: Session,
    user_id: str,
    plan: str,
    is_subscriber: bool,
) -> None:
    """Grant credits after purchase. Subscription plans add to subscription_credits; top-ups to one_time_credits with bonus if subscriber."""
    credits = PLAN_CREDITS.get(plan, 0)
    if not credits:
        return
    if plan.startswith("topup") and is_subscriber:
        credits = int(credits * (1 + SUBSCRIBER_BONUS))
    table = _users_table()
    if plan.startswith("monthly"):
        db.execute(
            text(f"UPDATE {table} SET subscription_credits = subscription_credits + :amt WHERE id = :id"),
            {"amt": credits, "id": user_id},
        )
    else:
        db.execute(
            text(f"UPDATE {table} SET one_time_credits = one_time_credits + :amt WHERE id = :id"),
            {"amt": credits, "id": user_id},
        )
    db.commit()


def create_checkout_session(
    user_id: str,
    plan: str,
    ui_mode: str = "embedded",
) -> dict[str, str | None]:
    """Create a Stripe Checkout session. For embedded mode returns client_secret; for hosted returns checkout_url."""

    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")

    entry = _PLAN_PRICE.get(plan)
    pprint(plan)
    pprint(_PLAN_PRICE)
    if not entry:
        raise ValueError(f"Unknown plan: {plan}.")
    price_id, mode = entry
    if not price_id:
        env_var = {"monthly_basic": "STRIPE_PRICE_MONTHLY_BASIC", "monthly_pro": "STRIPE_PRICE_MONTHLY_PRO", "topup_small": "STRIPE_PRICE_TOPUP_SMALL", "topup_large": "STRIPE_PRICE_TOPUP_LARGE"}.get(plan, "STRIPE_PRICE_*")
        raise ValueError(
            f"Stripe price ID is missing for plan: {plan}. "
            f"Set {env_var} in your environment to a Stripe Price ID (e.g. price_xxx from Dashboard → Products)."
        )

    stripe.api_key = STRIPE_SECRET_KEY
    return_url = f"{FRONTEND_URL}/checkout/complete?session_id={{CHECKOUT_SESSION_ID}}"
    create_params: dict = {
        "mode": mode,
        "line_items": [{"price": price_id, "quantity": 1}],
        "metadata": {"user_id": user_id, "plan": plan},
    }
    if ui_mode == "embedded":
        create_params["ui_mode"] = "embedded"
        create_params["return_url"] = return_url
    else:
        create_params["success_url"] = f"{FRONTEND_URL}?checkout=success"
        create_params["cancel_url"] = f"{FRONTEND_URL}?checkout=cancel"

    session = stripe.checkout.Session.create(**create_params)

    if ui_mode == "embedded" and session.client_secret:
        return {"client_secret": session.client_secret, "checkout_url": None}
    return {"client_secret": None, "checkout_url": session.url}


def get_checkout_session_status(session_id: str) -> dict[str, str]:
    """Retrieve Stripe Checkout Session and return status and payment_status."""
    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")
    stripe.api_key = STRIPE_SECRET_KEY
    session = stripe.checkout.Session.retrieve(session_id)
    return {
        "status": getattr(session, "status", "unknown") or "unknown",
        "payment_status": getattr(session, "payment_status", "unknown") or "unknown",
    }


def _credits_for_plan(plan: str, is_subscriber: bool) -> int:
    """Same logic as grant_credits: credits to grant for a plan."""
    credits = PLAN_CREDITS.get(plan, 0)
    if not credits:
        return 0
    if plan.startswith("topup") and is_subscriber:
        credits = int(credits * (1 + SUBSCRIBER_BONUS))
    return credits


def fulfill_checkout_session(stripe_session_id: str, db: Session) -> bool:
    """
    Idempotent fulfillment: if the Stripe session is paid and not yet fulfilled,
    grant credits and set plan. Returns True if we fulfilled (or already had been),
    False if session not paid or missing user.
    """
    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")
    stripe.api_key = STRIPE_SECRET_KEY
    session = stripe.checkout.Session.retrieve(stripe_session_id)
    payment_status = getattr(session, "payment_status", None) or ""
    if payment_status != "paid":
        return False
    metadata = getattr(session, "metadata", None) or {}
    user_id = metadata.get("user_id")
    plan = metadata.get("plan", "monthly")

    try:
        db.execute(
            text(
                "INSERT INTO stripe_checkout_fulfilled (stripe_session_id) VALUES (:id)"
            ),
            {"id": stripe_session_id},
        )
    except IntegrityError:
        db.rollback()
        return True

    effective_user_id: str | None = None
    credits_granted = 0

    if user_id:
        is_subscriber = get_user_plan(db, user_id) in (
            "monthly_basic",
            "monthly_pro",
            "monthly",
        )
        credits_granted = _credits_for_plan(plan, is_subscriber)
        grant_credits(db, user_id, plan, is_subscriber)
        set_user_plan(db, user_id, plan)
        effective_user_id = user_id
    else:
        session_id_raw = metadata.get("session_id")
        if session_id_raw:
            try:
                sid = UUID(session_id_raw)
            except ValueError:
                db.rollback()
                return False
            from app.services.session_service import get_session

            session_rec = get_session(db, sid)
            if session_rec and session_rec.user_id:
                is_subscriber = get_user_plan(db, session_rec.user_id) in (
                    "monthly_basic",
                    "monthly_pro",
                    "monthly",
                )
                credits_granted = _credits_for_plan(plan, is_subscriber)
                set_user_plan(db, session_rec.user_id, plan)
                grant_credits(db, session_rec.user_id, plan, is_subscriber)
                effective_user_id = session_rec.user_id
            else:
                set_subscription_active(sid, plan)

    # Record user_id, credits_granted, and payment_intent for refund handling
    payment_intent_id = getattr(session, "payment_intent", None) or (
        session.get("payment_intent") if isinstance(session, dict) else None
    )
    if isinstance(payment_intent_id, str):
        pass
    elif hasattr(payment_intent_id, "id"):
        payment_intent_id = payment_intent_id.id if payment_intent_id else None
    else:
        payment_intent_id = None

    db.execute(
        text(
            "UPDATE stripe_checkout_fulfilled SET user_id = :uid, credits_granted = :credits, stripe_payment_intent_id = :pi WHERE stripe_session_id = :sid"
        ),
        {
            "uid": effective_user_id,
            "credits": credits_granted,
            "pi": payment_intent_id,
            "sid": stripe_session_id,
        },
    )
    db.commit()
    return True


def handle_charge_refunded(charge_id: str, db: Session) -> None:
    """
    On charge.refunded: look up fulfillment by payment_intent, deduct credits
    from the user's one_time_credits, and zero out credits_granted (idempotent).
    """
    if not STRIPE_SECRET_KEY:
        return
    stripe.api_key = STRIPE_SECRET_KEY
    charge = stripe.Charge.retrieve(charge_id)
    payment_intent_id = getattr(charge, "payment_intent", None)
    if not payment_intent_id:
        return
    if hasattr(payment_intent_id, "id"):
        payment_intent_id = payment_intent_id.id

    row = db.execute(
        text(
            "SELECT user_id, credits_granted FROM stripe_checkout_fulfilled WHERE stripe_payment_intent_id = :pi AND credits_granted > 0"
        ),
        {"pi": payment_intent_id},
    ).fetchone()
    if not row:
        return
    user_id_val = row[0]
    credits = int(row[1] or 0)
    if not user_id_val or credits <= 0:
        return

    # Deduct from one_time_credits (topups go there); cap at current balance
    table = _users_table()
    current = db.execute(
        text(f"SELECT one_time_credits FROM {table} WHERE id = :id"),
        {"id": user_id_val},
    ).fetchone()
    if not current:
        return
    deduct = min(credits, int(current[0] or 0))
    if deduct <= 0:
        db.execute(
            text(
                "UPDATE stripe_checkout_fulfilled SET credits_granted = 0 WHERE stripe_payment_intent_id = :pi"
            ),
            {"pi": payment_intent_id},
        )
        db.commit()
        return
    db.execute(
        text(f"UPDATE {table} SET one_time_credits = one_time_credits - :amt WHERE id = :id"),
        {"amt": deduct, "id": user_id_val},
    )
    db.execute(
        text(
            "UPDATE stripe_checkout_fulfilled SET credits_granted = 0 WHERE stripe_payment_intent_id = :pi"
        ),
        {"pi": payment_intent_id},
    )
    db.commit()


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
