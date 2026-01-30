from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.db_models import AnalysisUsage


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
