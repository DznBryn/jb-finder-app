"""Repair: drop app tables from next_auth and ensure public.stripe_checkout_fulfilled.

Revision ID: l2a3b4c5d6e7
Revises: k1f2a3b4c5d6
Create Date: 2026-02-07

Uses raw SQL so it does not depend on AUTH_SCHEMA env. Fixes production where
tables remained in next_auth and/or stripe_checkout_fulfilled was missing in public.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "l2a3b4c5d6e7"
down_revision = "k1f2a3b4c5d6"
branch_labels = None
depends_on = None


# App tables that must not live in next_auth. Drop with CASCADE so order doesn't matter.
_NEXT_AUTH_APP_TABLES = [
    "cover_letter_versions",
    "cover_letter_documents",
    "deep_analysis",
    "job_selections",
    "stripe_checkout_fulfilled",
    "resumes",
    "resume_sessions",
    "analysis_usage",
    "refresh_jobs",
    "jobs",
    "companies",
]


def _next_auth_schema_exists(bind) -> bool:
    r = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'next_auth'"
        )
    )
    return r.scalar() is not None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # 1) Drop app tables from next_auth schema if that schema exists
    # Table names are from our fixed list, not user input.
    if _next_auth_schema_exists(bind):
        for table_name in _NEXT_AUTH_APP_TABLES:
            op.execute(sa.text(f"DROP TABLE IF EXISTS next_auth.{table_name} CASCADE"))

    # 2) Ensure public.stripe_checkout_fulfilled exists
    op.execute(
        sa.text("""
            CREATE TABLE IF NOT EXISTS public.stripe_checkout_fulfilled (
                stripe_session_id VARCHAR(255) NOT NULL PRIMARY KEY,
                user_id VARCHAR(36),
                credits_granted INTEGER NOT NULL DEFAULT 0,
                stripe_payment_intent_id VARCHAR(255)
            )
        """)
    )
    # Create index if not exists (PostgreSQL 9.5+)
    op.execute(
        sa.text("""
            CREATE INDEX IF NOT EXISTS ix_stripe_checkout_fulfilled_payment_intent
            ON public.stripe_checkout_fulfilled (stripe_payment_intent_id)
        """)
    )


def downgrade() -> None:
    pass