"""Repair: ensure next_auth has Auth.js tables and public has stripe_checkout_fulfilled.

Revision ID: m3b4c5d6e7f8
Revises: l2a3b4c5d6e7
Create Date: 2026-02-07

Fixes two issues:
1) next_auth empty: Auth.js tables (users, accounts, sessions, verification_token)
   may have been created in 'auth' schema on first run, or never created in next_auth.
   This creates them in next_auth if the schema exists and tables are missing.
2) public.stripe_checkout_fulfilled missing: ensures the table exists in public with
   full column set (stripe_session_id, user_id, credits_granted, stripe_payment_intent_id).

Uses raw SQL so behavior does not depend on AUTH_SCHEMA env. Idempotent.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "m3b4c5d6e7f8"
down_revision = "l2a3b4c5d6e7"
branch_labels = None
depends_on = None


def _next_auth_schema_exists(bind) -> bool:
    r = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'next_auth'"
        )
    )
    return r.scalar() is not None


def _table_exists_in_schema(bind, schema: str, table: str) -> bool:
    r = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = :schema AND table_name = :t"
        ),
        {"schema": schema, "t": table},
    )
    return r.scalar() is not None


def _stripe_table_exists_in_public(bind) -> bool:
    return _table_exists_in_schema(bind, "public", "stripe_checkout_fulfilled")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # 1) Ensure next_auth has Auth.js tables (only if next_auth schema exists)
    if _next_auth_schema_exists(bind):
        if not _table_exists_in_schema(bind, "next_auth", "users"):
            op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
            op.execute(
                sa.text("""
                    CREATE TABLE next_auth.users (
                        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                        name TEXT,
                        email TEXT UNIQUE,
                        "emailVerified" TIMESTAMP WITH TIME ZONE,
                        image TEXT,
                        user_type VARCHAR(8) NOT NULL DEFAULT 'U',
                        subscription_credits INTEGER NOT NULL DEFAULT 0,
                        one_time_credits INTEGER NOT NULL DEFAULT 0,
                        signup_bonus_granted_at TIMESTAMP WITH TIME ZONE,
                        plan VARCHAR(16) NOT NULL DEFAULT 'free'
                    )
                """)
            )
        if not _table_exists_in_schema(bind, "next_auth", "accounts"):
            op.execute(
                sa.text("""
                    CREATE TABLE next_auth.accounts (
                        id BIGSERIAL PRIMARY KEY,
                        "userId" TEXT NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
                        type TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        "providerAccountId" TEXT NOT NULL,
                        refresh_token TEXT,
                        access_token TEXT,
                        expires_at BIGINT,
                        token_type TEXT,
                        scope TEXT,
                        id_token TEXT,
                        session_state TEXT,
                        UNIQUE(provider, "providerAccountId")
                    )
                """)
            )
        if not _table_exists_in_schema(bind, "next_auth", "sessions"):
            op.execute(
                sa.text("""
                    CREATE TABLE next_auth.sessions (
                        id BIGSERIAL PRIMARY KEY,
                        "sessionToken" TEXT NOT NULL UNIQUE,
                        "userId" TEXT NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
                        expires TIMESTAMP WITH TIME ZONE NOT NULL
                    )
                """)
            )
        if not _table_exists_in_schema(bind, "next_auth", "verification_token"):
            op.execute(
                sa.text("""
                    CREATE TABLE next_auth.verification_token (
                        identifier TEXT NOT NULL,
                        token TEXT NOT NULL,
                        expires TIMESTAMP WITH TIME ZONE NOT NULL,
                        PRIMARY KEY (identifier, token)
                    )
                """)
            )

    # 2) Ensure public.stripe_checkout_fulfilled exists with full column set
    if not _stripe_table_exists_in_public(bind):
        op.execute(
            sa.text("""
                CREATE TABLE public.stripe_checkout_fulfilled (
                    stripe_session_id VARCHAR(255) NOT NULL PRIMARY KEY,
                    user_id VARCHAR(36),
                    credits_granted INTEGER NOT NULL DEFAULT 0,
                    stripe_payment_intent_id VARCHAR(255)
                )
            """)
        )
        op.execute(
            sa.text("""
                CREATE INDEX ix_stripe_checkout_fulfilled_payment_intent
                ON public.stripe_checkout_fulfilled (stripe_payment_intent_id)
            """)
        )
    else:
        # Table exists; ensure refund columns exist (in case only base table was created)
        for col_def in [
            ("user_id", "VARCHAR(36)"),
            ("credits_granted", "INTEGER NOT NULL DEFAULT 0"),
            ("stripe_payment_intent_id", "VARCHAR(255)"),
        ]:
            col_name, col_type = col_def
            r = bind.execute(
                sa.text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'stripe_checkout_fulfilled' AND column_name = :c"
                ),
                {"c": col_name},
            )
            if r.scalar() is None:
                op.execute(
                    sa.text(
                        f"ALTER TABLE public.stripe_checkout_fulfilled ADD COLUMN {col_name} {col_type}"
                    )
                )
        # Index for refund lookups
        op.execute(
            sa.text("""
                CREATE INDEX IF NOT EXISTS ix_stripe_checkout_fulfilled_payment_intent
                ON public.stripe_checkout_fulfilled (stripe_payment_intent_id)
            """)
        )


def downgrade() -> None:
    pass
