"""Rename public.sessions to resume_sessions to avoid confusion with next_auth.sessions.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return name in sa.inspect(bind).get_table_names()


def upgrade() -> None:
    # Idempotent: skip if already renamed or resume_sessions exists (e.g. manual rename)
    if _table_exists("resume_sessions"):
        return
    if not _table_exists("sessions"):
        return
    # Rename app sessions table so it's distinct from next_auth.sessions
    op.rename_table("sessions", "resume_sessions")


def downgrade() -> None:
    if _table_exists("resume_sessions"):
        op.rename_table("resume_sessions", "sessions")
