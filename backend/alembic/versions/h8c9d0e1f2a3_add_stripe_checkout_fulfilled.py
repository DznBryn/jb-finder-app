"""Add stripe_checkout_fulfilled table for idempotent credit grant.

Revision ID: h8c9d0e1f2a3
Revises: g7b8c9d0e1f2
Create Date: 2026-02-07

Stores Stripe checkout session IDs that have already been fulfilled (credits
granted) so that both webhook and redirect-based fulfillment can run safely.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "h8c9d0e1f2a3"
down_revision = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    if "stripe_checkout_fulfilled" in existing:
        return
    op.create_table(
        "stripe_checkout_fulfilled",
        sa.Column("stripe_session_id", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("stripe_session_id"),
    )


def downgrade() -> None:
    op.drop_table("stripe_checkout_fulfilled", if_exists=True)
