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


def set_user_stripe_customer(db: Session, user_id: str, stripe_customer_id: str) -> None:
    """Persist Stripe customer ID for Customer Portal access."""
    try:
        db.execute(
            text(
                f"UPDATE {_users_table()} SET stripe_customer_id = :cid WHERE id = :id"
            ),
            {"cid": stripe_customer_id, "id": user_id},
        )
        db.commit()
    except Exception:
        pass


def get_user_stripe_customer(db: Session, user_id: str) -> str | None:
    """Return Stripe customer ID for user, or None if not set."""
    try:
        r = db.execute(
            text(f"SELECT stripe_customer_id FROM {_users_table()} WHERE id = :id"),
            {"id": user_id},
        ).fetchone()
        return (r[0] or None) if r else None
    except Exception:
        return None


def get_user_id_by_stripe_customer(db: Session, stripe_customer_id: str) -> str | None:
    """Return user ID for the given Stripe customer ID, or None."""
    if not stripe_customer_id:
        return None
    try:
        result = db.execute(
            text(f"SELECT id FROM {_users_table()} WHERE stripe_customer_id = :cid"),
            {"cid": stripe_customer_id},
        ).fetchone()
        return str(result[0]) if result and result[0] else None
    except Exception:
        return None


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

PLAN_CREDITS: dict[str, int] = {
    "monthly_basic": 500,
    "monthly_pro": 2500,
    "topup_small": 200,
    "topup_large": 1000,
}
SUBSCRIBER_BONUS = 0.5  # 50% bonus on top-ups for subscribers

# Stripe price ID -> internal plan (for subscription webhooks/sync)
_PRICE_TO_PLAN: dict[str, str] = {}

if STRIPE_PRICE_MONTHLY_BASIC:
    _PRICE_TO_PLAN[STRIPE_PRICE_MONTHLY_BASIC] = "monthly_basic"
if STRIPE_PRICE_MONTHLY_PRO:
    _PRICE_TO_PLAN[STRIPE_PRICE_MONTHLY_PRO] = "monthly_pro"
if STRIPE_PRICE_MONTHLY and "monthly" not in {v for v in _PRICE_TO_PLAN.values()}:
    _PRICE_TO_PLAN.setdefault(STRIPE_PRICE_MONTHLY, "monthly")


def _plan_from_subscription_items(subscription: dict) -> str:
    """Extract internal plan from Stripe subscription items. Returns 'free' if none matched."""
    items = subscription.get("items") or {}
    data = items.get("data") or []
    for item in data:
        price = item.get("price")
        if isinstance(price, dict):
            price_id = price.get("id")
        elif isinstance(price, str):
            price_id = price
        else:
            price_id = None
        if price_id and price_id in _PRICE_TO_PLAN:
            return _PRICE_TO_PLAN[price_id]
    return "free"


def update_subscription_from_event(db: Session, subscription: dict) -> str | None:
    """
    Update user subscription state from a Stripe subscription object.
    Finds user by stripe_customer_id == subscription.customer.
    Persists plan, subscription_status, stripe_subscription_id, and cancellation fields.
    Returns user_id if updated, None if no matching user.
    """
    customer_id = subscription.get("customer")
    if isinstance(customer_id, dict):
        customer_id = customer_id.get("id")
    if not customer_id:
        return None

    user_id = get_user_id_by_stripe_customer(db, str(customer_id))
    if not user_id:
        return None

    status = subscription.get("status") or "none"
    stripe_sub_id = subscription.get("id")
    cancel_at_period_end = bool(subscription.get("cancel_at_period_end", False))
    cancel_at = subscription.get("cancel_at")
    current_period_end = subscription.get("current_period_end")
    canceled_at = subscription.get("canceled_at")
    ended_at = subscription.get("ended_at")
    print("Subscription status:", subscription)
    if status in ("active", "trialing", "past_due"):
        plan = _plan_from_subscription_items(subscription)
        if plan == "free":
            plan = get_user_plan(db, user_id)
            if plan not in ("monthly_basic", "monthly_pro", "monthly"):
                plan = "free"
    else:
        plan = "free"

    table = _users_table()
    db.execute(
        text(
            f"""
            UPDATE {table} SET
                plan = :plan,
                subscription_status = :subscription_status,
                stripe_subscription_id = :stripe_subscription_id,
                cancel_at_period_end = :cancel_at_period_end,
                cancel_at = :cancel_at,
                current_period_end = :current_period_end,
                canceled_at = :canceled_at,
                ended_at = :ended_at
            WHERE id = :user_id
            """
        ),
        {
            "plan": plan,
            "subscription_status": status,
            "stripe_subscription_id": stripe_sub_id,
            "cancel_at_period_end": cancel_at_period_end,
            "cancel_at": cancel_at,
            "current_period_end": current_period_end,
            "canceled_at": canceled_at,
            "ended_at": ended_at,
            "user_id": user_id,
        },
    )
    db.commit()
    return user_id


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
    if plan.startswith("monthly_basic") or plan.startswith("monthly_pro"):
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
    plan = metadata.get("plan", "monthly_basic")

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
                )
                credits_granted = _credits_for_plan(plan, is_subscriber)
                set_user_plan(db, session_rec.user_id, plan)
                grant_credits(db, session_rec.user_id, plan, is_subscriber)
                effective_user_id = session_rec.user_id
            else:
                set_subscription_active(sid, plan)

    # Store Stripe customer ID for Customer Portal when we have a user
    if effective_user_id:
        customer = getattr(session, "customer", None)
        if customer:
            cid = customer if isinstance(customer, str) else (getattr(customer, "id", None) if hasattr(customer, "id") else None)
            if cid:
                set_user_stripe_customer(db, effective_user_id, cid)

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


def _subscription_to_dict(sub) -> dict:
    """Convert Stripe subscription object to dict for update_subscription_from_event."""
    if isinstance(sub, dict):
        return sub
    return {
        "customer": getattr(sub, "customer", None),
        "id": getattr(sub, "id", None),
        "status": getattr(sub, "status", "none"),
        "cancel_at_period_end": getattr(sub, "cancel_at_period_end", False),
        "cancel_at": getattr(sub, "cancel_at", None),
        "current_period_end": getattr(sub, "current_period_end", None),
        "canceled_at": getattr(sub, "canceled_at", None),
        "ended_at": getattr(sub, "ended_at", None),
        "items": getattr(sub, "items", {}),
    }


def sync_subscription_from_stripe(user_id: str, db: Session) -> str:
    """
    Sync the user's subscription state from Stripe. Lists subscriptions for the customer,
    picks the relevant one (active/trialing/past_due preferred), updates all DB fields
    (plan, subscription_status, cancellation fields, etc.).
    Returns: "active" | "none" | "canceling".
    """
    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")
    customer_id = get_user_stripe_customer(db, user_id)
    if not customer_id:
        return "none"

    stripe.api_key = STRIPE_SECRET_KEY
    subs = stripe.Subscription.list(
        customer=customer_id,
        status="all",
        limit=10,
        expand=["data.items.data.price"],
    )

    # Prefer: active/trialing (non-canceling) > active/trialing (canceling) > past_due
    def _rank(s):
        st = (getattr(s, "status", None) or (s.get("status") if isinstance(s, dict) else None)) or ""
        canceling = getattr(s, "cancel_at_period_end", False) or (s.get("cancel_at_period_end") if isinstance(s, dict) else False)
        if st in ("active", "trialing"):
            return (0, 0 if canceling else 1)
        if st == "past_due":
            return (1, 1)
        return (2, 0)

    data = getattr(subs, "data", None) or (subs.get("data", []) if isinstance(subs, dict) else [])
    chosen = None
    for sub in data:
        st = (getattr(sub, "status", None) or (sub.get("status") if isinstance(sub, dict) else None)) or ""
        if st in ("canceled", "unpaid", "incomplete_expired"):
            continue
        if chosen is None or _rank(sub) < _rank(chosen):
            chosen = sub

    if chosen is None:
        sub_dict = {
            "customer": customer_id,
            "id": None,
            "status": "canceled",
            "cancel_at_period_end": False,
            "cancel_at": None,
            "current_period_end": None,
            "canceled_at": None,
            "ended_at": None,
            "items": {"data": []},
        }
    else:
        sub_dict = _subscription_to_dict(chosen)
        sub_dict["customer"] = customer_id

    update_subscription_from_event(db, sub_dict)

    if chosen is None:
        return "none"
    st = sub_dict.get("status") or ""
    canceling = sub_dict.get("cancel_at_period_end") or False
    if st in ("active", "trialing", "past_due") and _plan_from_subscription_items(sub_dict) != "free":
        return "canceling" if canceling else "active"
    return "none"


def create_customer_portal_session(
    user_id: str,
    db: Session,
    return_path: str = "/",
) -> str:
    """
    Create a Stripe Customer Portal session. Returns the portal URL.
    Raises ValueError if user has no Stripe customer ID.
    """
    if not STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not set.")

    customer_id = get_user_stripe_customer(db, user_id)
    
    if not customer_id:
        raise ValueError("No Stripe customer linked. Subscribe first to manage your subscription.")
    
    stripe.api_key = STRIPE_SECRET_KEY
    
    base = return_path if return_path.startswith("/") else f"/{return_path}"
    sep = "&" if "?" in base else "?"
    return_url = f"{FRONTEND_URL}{base}{sep}portal_return=1"
    
    portal_session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    
    return portal_session.url


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
