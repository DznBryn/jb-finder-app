"""Add stripe_customer_id column to auth users table.

Revision ID: n4c5d6e7f8a9
Revises: m3b4c5d6e7f8
Create Date: 2026-02-07

Enables Stripe Customer Portal for subscription management.
"""
from __future__ import annotations

import os
from alembic import op
import sqlalchemy as sa

revision = "n4c5d6e7f8a9"
down_revision = "m3b4c5d6e7f8"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _auth_schema_name() -> str | None:
    if not _is_postgres():
        return None

    # Users table lives in next_auth schema only (not public)
    schema = (os.getenv("AUTH_SCHEMA", "") or "").strip() or "next_auth"

    if schema == "public":
        return None
    return schema


def _table_exists(bind, table: str, schema: str | None) -> bool:
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names(schema=schema) if schema else inspector.get_table_names()
    return table in tables


def _column_exists(bind, table: str, column: str, schema: str | None) -> bool:
    if not _table_exists(bind, table, schema):
        return False
    inspector = sa.inspect(bind)
    cols = inspector.get_columns(table, schema=schema) if schema else inspector.get_columns(table)
    return any(col["name"] == column for col in cols)



def upgrade() -> None:
    if not _is_postgres():
        return

    bind = op.get_bind()
    schema_name = _auth_schema_name()
    if not _table_exists(bind, "users", schema_name):
        raise RuntimeError(f"Expected users table not found in schema={schema_name or 'next_auth'}")

    if _column_exists(bind, "users", "stripe_customer_id", schema_name):
        return

    print(f"Adding stripe_customer_id column to users table in schema={schema_name}")
    op.add_column(
        "users",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        schema=schema_name,
    )


def downgrade() -> None:
    if not _is_postgres():
        return
    bind = op.get_bind()
    schema_name = _auth_schema_name()
    if not _column_exists(bind, "users", "stripe_customer_id", schema_name):
        return
    op.drop_column("users", "stripe_customer_id", schema=schema_name)
