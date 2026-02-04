"""Add resumes table (user-scoped session data, no session_id/plan).

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return name in sa.inspect(bind).get_table_names()


def upgrade() -> None:
    if _table_exists("resumes"):
        return
    op.create_table(
        "resumes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False, index=True),
        sa.Column("resume_text", sa.Text(), nullable=False),
        sa.Column("resume_s3_key", sa.String(512), nullable=True),
        sa.Column("resume_content_hash", sa.String(64), nullable=True, index=True),
        sa.Column("extracted_skills", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("inferred_titles", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("seniority", sa.String(32), nullable=False),
        sa.Column("years_experience", sa.Integer(), nullable=False),
        sa.Column("location_pref", sa.String(128), nullable=True),
        sa.Column("remote_pref", sa.Boolean(), nullable=True),
        sa.Column("llm_summary", sa.Text(), nullable=True),
        sa.Column("first_name", sa.String(64), nullable=True),
        sa.Column("last_name", sa.String(64), nullable=True),
        sa.Column("email", sa.String(128), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("location", sa.String(128), nullable=True),
        sa.Column("social_links", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("daily_selections", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("daily_selection_date", sa.String(32), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("resumes", if_exists=True)
