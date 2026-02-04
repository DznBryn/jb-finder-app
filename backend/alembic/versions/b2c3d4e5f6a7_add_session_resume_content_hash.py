"""Add resume_content_hash to sessions for content-hash dedupe.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-03

Stores SHA-256 hex of resume file bytes so re-upload of the same file
can skip storage write and session update.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    if _column_exists(conn, "sessions", "resume_content_hash"):
        return
    op.add_column(
        "sessions",
        sa.Column("resume_content_hash", sa.String(64), nullable=True, index=True),
    )


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    op.drop_index("ix_sessions_resume_content_hash", table_name="sessions")
    op.drop_column("sessions", "resume_content_hash")
