"""Add subscription state columns + indexes to auth users table.

Revision ID: o5g6h7i8j9k0
Revises: n4c5d6e7f8a9
Create Date: 2026-02-07

Adds columns for Stripe subscription sync:
- subscription_status
- stripe_subscription_id
- cancel_at_period_end
- cancel_at
- current_period_end
- canceled_at
- ended_at

Also adds indexes for webhook lookup:
- stripe_customer_id (if column exists)
- stripe_subscription_id
- subscription_status
- cancel_at
"""
from __future__ import annotations

import os

from alembic import op
import sqlalchemy as sa

revision = "o5g6h7i8j9k0"
down_revision = "n4c5d6e7f8a9"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _auth_schema_name() -> str | None:
    if not _is_postgres():
        return None
    schema = (os.getenv("AUTH_SCHEMA", "") or "").strip() or "next_auth"
    if schema == "public":
        return None
    return schema


def _table_exists(bind, table: str, schema: str | None) -> bool:
    inspector = sa.inspect(bind)
    tables = (
        inspector.get_table_names(schema=schema)
        if schema
        else inspector.get_table_names()
    )
    return table in tables


def _column_exists(bind, table: str, column: str, schema: str | None) -> bool:
    if not _table_exists(bind, table, schema):
        return False
    inspector = sa.inspect(bind)
    cols = (
        inspector.get_columns(table, schema=schema)
        if schema
        else inspector.get_columns(table)
    )
    return any(col["name"] == column for col in cols)


def _index_exists(bind, index_name: str, schema: str | None) -> bool:
    inspector = sa.inspect(bind)
    indexes = inspector.get_indexes("users", schema=schema) if schema else inspector.get_indexes("users")
    return any(ix["name"] == index_name for ix in indexes)


def upgrade() -> None:
    if not _is_postgres():
        return

    bind = op.get_bind()
    schema = _auth_schema_name()

    if not _table_exists(bind, "users", schema):
        raise RuntimeError(
            f"Expected users table not found in schema={schema or 'public'}"
        )

    def add_col(name: str, col: sa.Column) -> None:
        if _column_exists(bind, "users", name, schema):
            return
        op.add_column("users", col, schema=schema)

    add_col(
        "subscription_status",
        sa.Column(
            "subscription_status",
            sa.Text(),
            server_default=sa.text("'none'"),
            nullable=True,
        ),
    )
    add_col(
        "stripe_subscription_id",
        sa.Column("stripe_subscription_id", sa.Text(), nullable=True),
    )
    add_col(
        "cancel_at_period_end",
        sa.Column(
            "cancel_at_period_end",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    add_col("cancel_at", sa.Column("cancel_at", sa.BigInteger(), nullable=True))
    add_col(
        "current_period_end",
        sa.Column("current_period_end", sa.BigInteger(), nullable=True),
    )
    add_col("canceled_at", sa.Column("canceled_at", sa.BigInteger(), nullable=True))
    add_col("ended_at", sa.Column("ended_at", sa.BigInteger(), nullable=True))


    if _column_exists(bind, "users", "stripe_customer_id", schema):
        if not _index_exists(bind, "idx_users_stripe_customer_id", schema):
            op.create_index(
                "idx_users_stripe_customer_id",
                "users",
                ["stripe_customer_id"],
                unique=False,
                schema=schema,
            )

    if _column_exists(bind, "users", "stripe_subscription_id", schema):
        if not _index_exists(bind, "idx_users_stripe_subscription_id", schema):
            op.create_index(
                "idx_users_stripe_subscription_id",
                "users",
                ["stripe_subscription_id"],
                unique=False,
                schema=schema,
            )

    if _column_exists(bind, "users", "subscription_status", schema):
        if not _index_exists(bind, "idx_users_subscription_status", schema):
            op.create_index(
                "idx_users_subscription_status",
                "users",
                ["subscription_status"],
                unique=False,
                schema=schema,
            )

    if _column_exists(bind, "users", "cancel_at", schema):
        if not _index_exists(bind, "idx_users_cancel_at", schema):
            op.create_index(
                "idx_users_cancel_at",
                "users",
                ["cancel_at"],
                unique=False,
                schema=schema,
            )


def downgrade() -> None:
    if not _is_postgres():
        return

    bind = op.get_bind()
    schema = _auth_schema_name()

    def drop_ix(name: str) -> None:
        if _index_exists(bind, name, schema):
            op.drop_index(name, table_name="users", schema=schema)

    drop_ix("idx_users_cancel_at")
    drop_ix("idx_users_subscription_status")
    drop_ix("idx_users_stripe_subscription_id")
    drop_ix("idx_users_stripe_customer_id")

    for col_name in (
        "subscription_status",
        "stripe_subscription_id",
        "cancel_at_period_end",
        "cancel_at",
        "current_period_end",
        "canceled_at",
        "ended_at",
    ):
        if _column_exists(bind, "users", col_name, schema):
            op.drop_column("users", col_name, schema=schema)