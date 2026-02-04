"""Add id column to accounts for Auth.js pg-adapter.

Revision ID: a1b2c3d4e5f6
Revises: 7f2a4b8f1c2d
Create Date: 2026-02-03

The @auth/pg-adapter expects an 'id' column on accounts (INSERT ... RETURNING id).
Our auth migration created accounts with composite PK (provider, providerAccountId)
and no id. This migration adds id as primary key and keeps (provider, providerAccountId) unique.
"""
from __future__ import annotations

import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "7f2a4b8f1c2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
    table = "accounts"
    qualified = f'"{schema_name}".{table}' if schema_name else table

    if _column_exists(table, "id", schema_name):
        return

    # Add id as BIGSERIAL (auto-increment). Existing rows get id from the sequence.
    op.execute(sa.text(f'ALTER TABLE {qualified} ADD COLUMN id BIGSERIAL NOT NULL'))
    # Drop the composite primary key
    op.execute(sa.text(f'ALTER TABLE {qualified} DROP CONSTRAINT accounts_pkey'))
    # Set id as the new primary key
    op.execute(sa.text(f'ALTER TABLE {qualified} ADD PRIMARY KEY (id)'))
    # Restore unique on (provider, providerAccountId) so linking is still unique
    op.execute(
        sa.text(
            f'ALTER TABLE {qualified} ADD CONSTRAINT accounts_provider_provideraccountid_key '
            f'UNIQUE (provider, "providerAccountId")'
        )
    )


def downgrade() -> None:
    if not _is_postgres():
        return
    schema_name = _auth_schema_name()
    table = "accounts"
    qualified = f'"{schema_name}".{table}' if schema_name else table

    op.execute(sa.text(f'ALTER TABLE {qualified} DROP CONSTRAINT IF EXISTS accounts_provider_provideraccountid_key'))
    op.execute(sa.text(f'ALTER TABLE {qualified} DROP CONSTRAINT accounts_pkey'))
    op.execute(sa.text(f'ALTER TABLE {qualified} ADD PRIMARY KEY (provider, "providerAccountId")'))
    op.execute(sa.text(f'ALTER TABLE {qualified} DROP COLUMN id'))