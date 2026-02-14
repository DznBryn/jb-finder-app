"""Add job_id to resume_reviews for job-scoped versioning.

Revision ID: q7i8j9k0l1m2
Revises: p6h7i8j9k0l1
Create Date: 2026-02-07

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "q7i8j9k0l1m2"
down_revision = "p6h7i8j9k0l1"
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
    if not _table_exists(bind, "resume_reviews"):
        return

    if not _column_exists(bind, "resume_reviews", "job_id"):
        op.add_column(
            "resume_reviews",
            sa.Column("job_id", sa.String(64), nullable=True),
        )
        op.execute(
            sa.text("UPDATE resume_reviews SET job_id = '' WHERE job_id IS NULL")
        )
        op.alter_column(
            "resume_reviews",
            "job_id",
            nullable=False,
            server_default="",
        )
        op.create_index(
            "ix_resume_reviews_job_id",
            "resume_reviews",
            ["job_id"],
        )

    # Replace unique constraint: (resume_id, version) -> (resume_id, job_id, version)
    insp = sa.inspect(bind)
    uc_names = [c.get("name") for c in insp.get_unique_constraints("resume_reviews")]
    if "uq_resume_reviews_resume_version" in uc_names:
        op.drop_constraint(
            "uq_resume_reviews_resume_version",
            "resume_reviews",
            type_="unique",
        )
    if "uq_resume_reviews_resume_job_version" not in uc_names:
        op.create_unique_constraint(
            "uq_resume_reviews_resume_job_version",
            "resume_reviews",
            ["resume_id", "job_id", "version"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "resume_reviews"):
        return

    insp = sa.inspect(bind)
    if "uq_resume_reviews_resume_job_version" in [c["name"] for c in insp.get_unique_constraints("resume_reviews")]:
        op.drop_constraint(
            "uq_resume_reviews_resume_job_version",
            "resume_reviews",
            type_="unique",
        )
    op.create_unique_constraint(
        "uq_resume_reviews_resume_version",
        "resume_reviews",
        ["resume_id", "version"],
    )

    if _column_exists(bind, "resume_reviews", "job_id"):
        op.drop_index("ix_resume_reviews_job_id", table_name="resume_reviews")
        op.drop_column("resume_reviews", "job_id")
