"""Add Auth.js tables and user_id links.

Revision ID: 5a9f2e7c3b1a
Revises: 8c1b4a2f0d91
Create Date: 2026-02-01 02:15:00.000000

"""
from __future__ import annotations

import os

from alembic import op
import sqlalchemy as sa

revision = "5a9f2e7c3b1a"
down_revision = "8c1b4a2f0d91"
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


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(idx["name"] == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    is_postgres = _is_postgres()
    schema_name = _auth_schema_name()
    user_fk = f"{schema_name}.users.id" if schema_name else "users.id"

    if is_postgres:
        op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
        if schema_name:
            op.execute(sa.text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        op.create_table(
            "users",
            sa.Column(
                "id",
                sa.Text(),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("name", sa.Text(), nullable=True),
            sa.Column("email", sa.Text(), nullable=True, unique=True),
            sa.Column("emailVerified", sa.DateTime(timezone=True), nullable=True),
            sa.Column("image", sa.Text(), nullable=True),
            sa.Column("user_type", sa.String(8), nullable=False, server_default="U"),
            sa.Column(
                "subscription_credits",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column("one_time_credits", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("signup_bonus_granted_at", sa.DateTime(timezone=True), nullable=True),
            schema=schema_name,
        )

        op.create_table(
            "accounts",
            sa.Column(
                "userId",
                sa.Text(),
                sa.ForeignKey(user_fk, ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("type", sa.Text(), nullable=False),
            sa.Column("provider", sa.Text(), nullable=False),
            sa.Column("providerAccountId", sa.Text(), nullable=False),
            sa.Column("refresh_token", sa.Text(), nullable=True),
            sa.Column("access_token", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.BigInteger(), nullable=True),
            sa.Column("token_type", sa.Text(), nullable=True),
            sa.Column("scope", sa.Text(), nullable=True),
            sa.Column("id_token", sa.Text(), nullable=True),
            sa.Column("session_state", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("provider", "providerAccountId"),
            schema=schema_name,
        )

        op.create_table(
            "sessions",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("sessionToken", sa.Text(), nullable=False, unique=True),
            sa.Column(
                "userId",
                sa.Text(),
                sa.ForeignKey(user_fk, ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("expires", sa.DateTime(timezone=True), nullable=False),
            schema=schema_name,
        )

        op.create_table(
            "verification_token",
            sa.Column("identifier", sa.Text(), nullable=False),
            sa.Column("token", sa.Text(), nullable=False),
            sa.Column("expires", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("identifier", "token"),
            schema=schema_name,
        )

    if not _column_exists("sessions", "user_id"):
        op.add_column("sessions", sa.Column("user_id", sa.String(36), nullable=True))
    if not _index_exists("sessions", "ix_sessions_user_id"):
        op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    if not _column_exists("job_selections", "user_id"):
        op.add_column("job_selections", sa.Column("user_id", sa.String(36), nullable=True))
    if not _index_exists("job_selections", "ix_job_selections_user_id"):
        op.create_index("ix_job_selections_user_id", "job_selections", ["user_id"])

    if not _column_exists("analysis_usage", "user_id"):
        op.add_column("analysis_usage", sa.Column("user_id", sa.String(36), nullable=True))
    if not _index_exists("analysis_usage", "ix_analysis_usage_user_id"):
        op.create_index("ix_analysis_usage_user_id", "analysis_usage", ["user_id"])

    if not _column_exists("deep_analysis", "user_id"):
        op.add_column("deep_analysis", sa.Column("user_id", sa.String(36), nullable=True))
    if not _index_exists("deep_analysis", "ix_deep_analysis_user_id"):
        op.create_index("ix_deep_analysis_user_id", "deep_analysis", ["user_id"])

    if not _column_exists("cover_letter_documents", "user_id"):
        op.add_column("cover_letter_documents", sa.Column("user_id", sa.String(36), nullable=True))
    if not _index_exists("cover_letter_documents", "ix_cover_letter_documents_user_id"):
        op.create_index(
            "ix_cover_letter_documents_user_id",
            "cover_letter_documents",
            ["user_id"],
        )

    if not _column_exists("cover_letter_versions", "user_id"):
        op.add_column("cover_letter_versions", sa.Column("user_id", sa.String(36), nullable=True))
    if not _index_exists("cover_letter_versions", "ix_cover_letter_versions_user_id"):
        op.create_index(
            "ix_cover_letter_versions_user_id",
            "cover_letter_versions",
            ["user_id"],
        )


def downgrade() -> None:
    is_postgres = _is_postgres()
    schema_name = _auth_schema_name()
    op.drop_index("ix_cover_letter_versions_user_id", table_name="cover_letter_versions")
    op.drop_column("cover_letter_versions", "user_id")

    op.drop_index("ix_cover_letter_documents_user_id", table_name="cover_letter_documents")
    op.drop_column("cover_letter_documents", "user_id")

    op.drop_index("ix_deep_analysis_user_id", table_name="deep_analysis")
    op.drop_column("deep_analysis", "user_id")

    op.drop_index("ix_analysis_usage_user_id", table_name="analysis_usage")
    op.drop_column("analysis_usage", "user_id")

    op.drop_index("ix_job_selections_user_id", table_name="job_selections")
    op.drop_column("job_selections", "user_id")

    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_column("sessions", "user_id")

    if is_postgres:
        op.drop_table("verification_token", schema=schema_name)
        op.drop_table("sessions", schema=schema_name)
        op.drop_table("accounts", schema=schema_name)
        op.drop_table("users", schema=schema_name)
