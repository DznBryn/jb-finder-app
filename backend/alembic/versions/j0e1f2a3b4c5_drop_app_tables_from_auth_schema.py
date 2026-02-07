"""Drop application tables from auth schema (e.g. next_auth).

Revision ID: j0e1f2a3b4c5
Revises: i9d0e1f2a3b4
Create Date: 2026-02-07

When AUTH_SCHEMA is set (e.g. next_auth), only users, accounts, sessions, and
verification_token belong there. This migration removes any app tables that were
incorrectly created in the auth schema (e.g. due to search_path).
"""
from __future__ import annotations

import os

from alembic import op
import sqlalchemy as sa

revision = "j0e1f2a3b4c5"
down_revision = "i9d0e1f2a3b4"
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


def _table_exists_in_schema(bind, table_name: str, schema: str) -> bool:
    r = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = :schema AND table_name = :t"
        ),
        {"schema": schema, "t": table_name},
    )
    return r.scalar() is not None


# Tables that belong only in public. Drop in FK-safe order.
_APP_TABLES_IN_DROP_ORDER = [
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


def _schemas_to_clean() -> list[str]:
    """Return list of schema names to clean (env AUTH_SCHEMA + next_auth)."""
    seen: set[str] = set()
    out: list[str] = []
    for name in (_auth_schema_name(), "next_auth"):
        if name and name != "public" and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def upgrade() -> None:
    if not _is_postgres():
        return
    bind = op.get_bind()
    for schema_name in _schemas_to_clean():
        for table_name in _APP_TABLES_IN_DROP_ORDER:
            if _table_exists_in_schema(bind, table_name, schema_name):
                op.drop_table(table_name, schema=schema_name)


def downgrade() -> None:
    # We do not recreate these tables in the auth schema; they never belonged there.
    pass
