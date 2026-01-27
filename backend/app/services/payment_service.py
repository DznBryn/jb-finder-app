from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import json

import stripe

from app.config import (
    STRIPE_PRICE_MONTHLY,
    STRIPE_PRICE_ONETIME,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_WEBHOOK_BYPASS,
)
@dataclass
class SubscriptionStatus:
    """Simple in-memory subscription status for MVP prototyping."""

    plan: str = "free"
    status: str = "none"


_SUBSCRIPTIONS: dict[UUID, SubscriptionStatus] = {}


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
    """Mark a session as having an active subscription."""

    status = SubscriptionStatus(plan=plan, status="active")
    _SUBSCRIPTIONS[session_id] = status
    return status


def get_subscription_status(session_id: UUID) -> SubscriptionStatus:
    """Return current subscription status for a session."""

    return _SUBSCRIPTIONS.get(session_id, SubscriptionStatus())
