"""Add plan column to auth users table.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-03

Plan (free/monthly/one_time) lives on users; session data moves to resumes.
"""
from __future__ import annotations

import os
from typing import Union

from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _auth_schema_name() -> str | None:
    if not _is_postgres():
        return None
    schema = os.getenv("AUTH_SCHEMA", "auth").strip() or "auth"
    if schema == "public":
        return None
    return schema


def _column_exists(table_name: str, column_name: str, schema: str | None) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if schema:
        columns = inspector.get_columns(table_name, schema=schema)
    else:
        columns = inspector.get_columns(table_name)
    return any(col["name"] == column_name for col in columns)


def upgrade() -> None:
    if not _is_postgres():
        return
    schema_name = _auth_schema_name()
    if _column_exists("users", "plan", schema_name):
        return
    op.add_column(
        "users",
        sa.Column("plan", sa.String(16), nullable=False, server_default="free"),
        schema=schema_name,
    )


def downgrade() -> None:
    if not _is_postgres():
        return
    schema_name = _auth_schema_name()
    op.drop_column("users", "plan", schema=schema_name)
