from __future__ import annotations

import math
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import AUTH_SCHEMA
from app.models.db_models import AnalysisUsage

# Feature name -> estimated credits (for affordability check)
FEATURE_ESTIMATES: dict[str, int] = {
    "match_analysis": 5,
    "deep_analysis": 50,
    "resume_review": 20,
    "cover_letter": 15,
}
# Per-request cap in credits (actual usage settled up to this)
MAX_RESERVE: dict[str, int] = {
    "match_analysis": 10,
    "deep_analysis": 100,
    "resume_review": 30,
    "cover_letter": 40,
}


def _users_table() -> str:
    """Qualified users table for auth schema."""
    return "users" if AUTH_SCHEMA == "public" else f'"{AUTH_SCHEMA}".users'


def get_available_credits(db: Session, user_id: str) -> Tuple[int, int]:
    """Return (subscription_credits, one_time_credits) for the user."""
    table = _users_table()
    row = db.execute(
        text(f"SELECT subscription_credits, one_time_credits FROM {table} WHERE id = :id"),
        {"id": user_id},
    ).fetchone()
    if not row:
        return 0, 0
    return (int(row[0] or 0), int(row[1] or 0))


def estimate_credits(feature: str) -> int:
    """Return estimated credit cost for the feature."""
    return FEATURE_ESTIMATES.get(feature, 0)


def check_can_afford(total_available: int, estimate: int) -> bool:
    """Return True if user can afford the estimated cost."""
    return total_available >= estimate


def deduct_credits(db: Session, user_id: str, amount: int) -> None:
    """Deduct credits: subscription_credits first, then one_time_credits."""
    if amount <= 0:
        return
    sub, onetime = get_available_credits(db, user_id)
    table = _users_table()
    from_sub = min(amount, sub)
    from_onetime = amount - from_sub
    if from_onetime > onetime:
        raise ValueError("Insufficient credits to deduct.")
    if from_sub > 0:
        db.execute(
            text(f"UPDATE {table} SET subscription_credits = subscription_credits - :amt WHERE id = :id"),
            {"amt": from_sub, "id": user_id},
        )
    if from_onetime > 0:
        db.execute(
            text(f"UPDATE {table} SET one_time_credits = one_time_credits - :amt WHERE id = :id"),
            {"amt": from_onetime, "id": user_id},
        )
    db.commit()


def settle_usage(db: Session, user_id: str, tokens_used: int, feature: str) -> int:
    """Convert tokens to credits (ceil(tokens/1000)), apply per-request cap when set, deduct, return credits used.
    For match_analysis we do not cap: deduct the actual rounded token-based credits."""
    credits = math.ceil(tokens_used / 1000) if tokens_used else 0
    if feature != "match_analysis":
        cap = MAX_RESERVE.get(feature)
        if cap is not None and credits > cap:
            credits = cap
    if credits <= 0:
        return 0
    deduct_credits(db, user_id, credits)
    return credits


def check_analysis_quota(
    db: Session,
    *,
    session_id: str,
    ip_address: Optional[str],
    is_pro: bool,
    limit: int,
) -> Tuple[bool, int]:
    """Return (allowed, remaining) without incrementing usage."""

    month_key = datetime.utcnow().strftime("%Y-%m")
    query = db.query(AnalysisUsage).filter(AnalysisUsage.month_key == month_key)
    if not is_pro and ip_address:
        query = query.filter(AnalysisUsage.ip_address == ip_address)
    else:
        query = query.filter(AnalysisUsage.session_id == session_id)
    usage = query.first()
    current = usage.count if usage else 0
    remaining = max(limit - current, 0)
    return remaining > 0, remaining


def record_analysis_usage(
    db: Session,
    *,
    session_id: str,
    ip_address: Optional[str],
    is_pro: bool,
    increment: int,
) -> int:
    """Increment analysis usage and return remaining credits."""

    month_key = datetime.utcnow().strftime("%Y-%m")
    query = db.query(AnalysisUsage).filter(AnalysisUsage.month_key == month_key)
    if not is_pro and ip_address:
        query = query.filter(AnalysisUsage.ip_address == ip_address)
    else:
        query = query.filter(AnalysisUsage.session_id == session_id)
    usage = query.first()
    if not usage:
        usage = AnalysisUsage(
            session_id=session_id if is_pro or not ip_address else None,
            ip_address=ip_address if not is_pro else None,
            month_key=month_key,
            count=0,
            updated_at=datetime.utcnow(),
        )
        db.add(usage)
    usage.count += max(increment, 0)
    usage.updated_at = datetime.utcnow()
    db.commit()
    return usage.count
