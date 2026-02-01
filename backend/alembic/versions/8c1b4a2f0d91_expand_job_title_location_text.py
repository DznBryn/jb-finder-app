"""Expand job title and location to Text.

Revision ID: 8c1b4a2f0d91
Revises: 5fc3537d31f7
Create Date: 2026-02-01 01:20:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "8c1b4a2f0d91"
down_revision = "5fc3537d31f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.alter_column(
            "title",
            existing_type=sa.String(length=256),
            type_=sa.Text(),
        )
        batch_op.alter_column(
            "location",
            existing_type=sa.String(length=256),
            type_=sa.Text(),
        )


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.alter_column(
            "location",
            existing_type=sa.Text(),
            type_=sa.String(length=256),
        )
        batch_op.alter_column(
            "title",
            existing_type=sa.Text(),
            type_=sa.String(length=256),
        )
