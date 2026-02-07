"""Ensure stripe_checkout_fulfilled exists in public schema.

Revision ID: k1f2a3b4c5d6
Revises: j0e1f2a3b4c5
Create Date: 2026-02-07

On production the table may have been created in next_auth only and then dropped
by the auth-schema cleanup. This migration creates it in public if missing.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "k1f2a3b4c5d6"
down_revision = "j0e1f2a3b4c5"
branch_labels = None
depends_on = None


def _table_exists_in_public(bind) -> bool:
    r = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'stripe_checkout_fulfilled'"
        )
    )
    return r.scalar() is not None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if _table_exists_in_public(bind):
        return
    op.create_table(
        "stripe_checkout_fulfilled",
        sa.Column("stripe_session_id", sa.String(255), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("credits_granted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
        sa.PrimaryKeyConstraint("stripe_session_id"),
        schema="public",
    )
    op.create_index(
        "ix_stripe_checkout_fulfilled_payment_intent",
        "stripe_checkout_fulfilled",
        ["stripe_payment_intent_id"],
        unique=False,
        schema="public",
    )


def downgrade() -> None:
    # Leave table in place; this migration is a one-off fix for missing public table.
    pass
