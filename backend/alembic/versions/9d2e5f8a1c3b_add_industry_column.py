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


def upgrade() -> None:
    # Add industry column to companies table
    op.add_column('companies', sa.Column('industry', sa.String(64), nullable=True))
    op.create_index('ix_companies_industry', 'companies', ['industry'])

    # Add industry column to jobs table
    op.add_column('jobs', sa.Column('industry', sa.String(64), nullable=True))
    op.create_index('ix_jobs_industry', 'jobs', ['industry'])


def downgrade() -> None:
    # Remove industry column from jobs table
    op.drop_index('ix_jobs_industry', table_name='jobs')
    op.drop_column('jobs', 'industry')

    # Remove industry column from companies table
    op.drop_index('ix_companies_industry', table_name='companies')
    op.drop_column('companies', 'industry')
