"""add unique constraint on jobs source + source_job_id

Revision ID: 7f2a4b8f1c2d
Revises: c1d0c3a9f2b1
Create Date: 2026-02-03

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "7f2a4b8f1c2d"
down_revision: Union[str, None] = "c1d0c3a9f2b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("jobs")}
    if "uq_jobs_source_source_job_id" in indexes:
        return
    op.create_index(
        "uq_jobs_source_source_job_id",
        "jobs",
        ["source", "source_job_id"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("jobs")}
    if "uq_jobs_source_source_job_id" not in indexes:
        return
    op.drop_index("uq_jobs_source_source_job_id", table_name="jobs")
