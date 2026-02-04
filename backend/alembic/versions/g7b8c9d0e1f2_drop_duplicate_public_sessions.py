"""Drop duplicate public.sessions; keep resume_sessions as the app session table.

If both tables exist in public, copy any rows from public.sessions into public.resume_sessions
(skip duplicates by id), then drop public.sessions. Never touches next_auth.sessions.
Idempotent.

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "g7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def _table_exists_in_public(bind, name: str) -> bool:
    r = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :t"
        ),
        {"t": name},
    )
    return r.scalar() is not None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if not _table_exists_in_public(bind, "sessions"):
        return
    if _table_exists_in_public(bind, "resume_sessions"):
        # Both exist in public: copy missing rows, then drop public.sessions
        op.execute(
            sa.text("""
                INSERT INTO public.resume_sessions (
                    id, user_id, resume_text, resume_s3_key, resume_content_hash,
                    extracted_skills, inferred_titles, seniority, years_experience,
                    location_pref, remote_pref, llm_summary, first_name, last_name,
                    email, phone, location, social_links, created_at, expires_at,
                    daily_selections, daily_selection_date, plan
                )
                SELECT
                    id, user_id, resume_text, resume_s3_key, resume_content_hash,
                    extracted_skills, inferred_titles, seniority, years_experience,
                    location_pref, remote_pref, llm_summary, first_name, last_name,
                    email, phone, location, social_links, created_at, expires_at,
                    daily_selections, daily_selection_date, plan
                FROM public.sessions
                ON CONFLICT (id) DO NOTHING
            """)
        )
        op.drop_table("sessions", schema="public")
    else:
        # Only public.sessions exists: rename to resume_sessions
        op.rename_table("sessions", "resume_sessions", schema="public")


def downgrade() -> None:
    # Recreating sessions from resume_sessions is lossy if we had merged; just leave resume_sessions
    # and do not recreate sessions to avoid re-duplicating.
    pass