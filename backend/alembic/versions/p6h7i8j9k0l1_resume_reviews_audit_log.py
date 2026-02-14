"""Add resume_reviews, audit_log, and source_resume_id on resume_sessions.

Revision ID: p6h7i8j9k0l1
Revises: o5g6h7i8j9k0
Create Date: 2026-02-07

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "p6h7i8j9k0l1"
down_revision = "o5g6h7i8j9k0"
branch_labels = None
depends_on = None


def _table_exists(bind, table: str) -> bool:
    return table in sa.inspect(bind).get_table_names()


def _column_exists(bind, table: str, column: str) -> bool:
    if not _table_exists(bind, table):
        return False
    cols = sa.inspect(bind).get_columns(table)
    return any(col["name"] == column for col in cols)


def upgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "resumes"):
        raise RuntimeError("Expected resumes table to exist")

    if not _table_exists(bind, "resume_reviews"):
        op.create_table(
            "resume_reviews",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), nullable=False, index=True),
            sa.Column(
                "resume_id",
                sa.String(36),
                sa.ForeignKey("resumes.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("run_id", sa.String(36), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("model", sa.Text(), nullable=False),
            sa.Column("prompt_version", sa.Text(), nullable=False),
            sa.Column("input_hash", sa.Text(), nullable=False),
            sa.Column("output_json", sa.JSON(), nullable=False),
            sa.Column("usage_json", sa.JSON(), nullable=True),
            sa.UniqueConstraint("resume_id", "version", name="uq_resume_reviews_resume_version"),
        )
        op.create_index(
            "ix_resume_reviews_resume_created",
            "resume_reviews",
            ["resume_id", "created_at"],
        )
        op.create_index(
            "ix_resume_reviews_user_created",
            "resume_reviews",
            ["user_id", "created_at"],
        )

    if not _table_exists(bind, "audit_log"):
        op.create_table(
            "audit_log",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), nullable=False, index=True),
            sa.Column("action", sa.Text(), nullable=False),
            sa.Column("entity_type", sa.Text(), nullable=False),
            sa.Column("entity_id", sa.String(36), nullable=False),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if _table_exists(bind, "resume_sessions") and not _column_exists(bind, "resume_sessions", "source_resume_id"):
        op.add_column(
            "resume_sessions",
            sa.Column("source_resume_id", sa.String(36), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "resume_sessions") and _column_exists(bind, "resume_sessions", "source_resume_id"):
        op.drop_column("resume_sessions", "source_resume_id")

    if _table_exists(bind, "audit_log"):
        op.drop_table("audit_log")

    if _table_exists(bind, "resume_reviews"):
        op.drop_index("ix_resume_reviews_user_created", table_name="resume_reviews")
        op.drop_index("ix_resume_reviews_resume_created", table_name="resume_reviews")
        op.drop_table("resume_reviews")
