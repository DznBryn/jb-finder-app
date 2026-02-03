"""add industry column to companies and jobs

Revision ID: 9d2e5f8a1c3b
Revises: 5a9f2e7c3b1a
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d2e5f8a1c3b'
down_revision: Union[str, None] = '5a9f2e7c3b1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.scalar() is not None


def _index_exists(conn, index_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
        {"name": index_name},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # Add industry column to companies table (idempotent)
    if not _column_exists(conn, "companies", "industry"):
        op.add_column("companies", sa.Column("industry", sa.String(64), nullable=True))
    if not _index_exists(conn, "ix_companies_industry"):
        op.create_index("ix_companies_industry", "companies", ["industry"])

    # Add industry column to jobs table (idempotent)
    if not _column_exists(conn, "jobs", "industry"):
        op.add_column("jobs", sa.Column("industry", sa.String(64), nullable=True))
    if not _index_exists(conn, "ix_jobs_industry"):
        op.create_index("ix_jobs_industry", "jobs", ["industry"])


def downgrade() -> None:
    conn = op.get_bind()

    # Remove industry from jobs (idempotent)
    if _index_exists(conn, "ix_jobs_industry"):
        op.drop_index("ix_jobs_industry", table_name="jobs")
    if _column_exists(conn, "jobs", "industry"):
        op.drop_column("jobs", "industry")

    # Remove industry from companies (idempotent)
    if _index_exists(conn, "ix_companies_industry"):
        op.drop_index("ix_companies_industry", table_name="companies")
    if _column_exists(conn, "companies", "industry"):
        op.drop_column("companies", "industry")
