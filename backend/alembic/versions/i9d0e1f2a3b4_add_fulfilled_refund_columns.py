"""Add user_id, credits_granted, stripe_payment_intent_id to stripe_checkout_fulfilled for refund handling.

Revision ID: i9d0e1f2a3b4
Revises: h8c9d0e1f2a3
Create Date: 2026-02-07

Enables looking up which user and how many credits to deduct when Stripe sends charge.refunded.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "i9d0e1f2a3b4"
down_revision = "h8c9d0e1f2a3"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str, bind) -> bool:
    inspector = sa.inspect(bind)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists("stripe_checkout_fulfilled", "user_id", bind):
        op.add_column(
            "stripe_checkout_fulfilled",
            sa.Column("user_id", sa.String(36), nullable=True),
        )
    if not _column_exists("stripe_checkout_fulfilled", "credits_granted", bind):
        op.add_column(
            "stripe_checkout_fulfilled",
            sa.Column("credits_granted", sa.Integer(), nullable=False, server_default="0"),
        )
    if not _column_exists("stripe_checkout_fulfilled", "stripe_payment_intent_id", bind):
        op.add_column(
            "stripe_checkout_fulfilled",
            sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
        )
        op.create_index(
            "ix_stripe_checkout_fulfilled_payment_intent",
            "stripe_checkout_fulfilled",
            ["stripe_payment_intent_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "stripe_checkout_fulfilled" in inspector.get_table_names():
        try:
            op.drop_index(
                "ix_stripe_checkout_fulfilled_payment_intent",
                table_name="stripe_checkout_fulfilled",
            )
        except Exception:
            pass
        for col in ("stripe_payment_intent_id", "credits_granted", "user_id"):
            if _column_exists("stripe_checkout_fulfilled", col, bind):
                op.drop_column("stripe_checkout_fulfilled", col)
