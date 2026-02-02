from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


# Industry choices for filtering
INDUSTRY_CHOICES = [
    "fintech",
    "ai",
    "developer-tools",
    "productivity",
    "marketplace",
    "delivery",
    "social-media",
    "hr-tech",
    "saas",
    "security",
    "healthcare",
    "consumer",
    "logistics",
    "aerospace",
    "agency",
    "nonprofit",
]


class SessionRecord(Base):
    """Database model for a resume upload session."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    resume_text: Mapped[str] = mapped_column(Text)
    resume_s3_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    extracted_skills: Mapped[list] = mapped_column(JSON, default=list)
    inferred_titles: Mapped[list] = mapped_column(JSON, default=list)
    seniority: Mapped[str] = mapped_column(String(32))
    years_experience: Mapped[int] = mapped_column(Integer)
    location_pref: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    remote_pref: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    llm_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    social_links: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    daily_selections: Mapped[int] = mapped_column(Integer, default=0)
    daily_selection_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    plan: Mapped[str] = mapped_column(String(16), default="free")


class JobSelection(Base):
    """Database model for job selections tied to a session."""

    __tablename__ = "job_selections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    job_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Company(Base):
    """Database model for ATS company tokens."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128))
    website: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    greenhouse_token: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)


class JobListing(Base):
    """Database model for ATS job postings."""

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_name: Mapped[str] = mapped_column(String(128))
    title: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(Text)
    remote: Mapped[bool] = mapped_column(Boolean, default=False)
    seniority: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text)
    pay_ranges: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(32))
    source_job_id: Mapped[str] = mapped_column(String(128))
    apply_url: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    industry: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)


class AnalysisUsage(Base):
    """Track analysis usage for free/pro limits."""

    __tablename__ = "analysis_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    month_key: Mapped[str] = mapped_column(String(16))
    count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class DeepAnalysisRecord(Base):
    """Persist deep analysis results per session and job."""

    __tablename__ = "deep_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    job_id: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime)


class CoverLetterDocument(Base):
    """Cover letter document keyed by session and job."""

    __tablename__ = "cover_letter_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    job_id: Mapped[str] = mapped_column(String(64), index=True)
    draft_content: Mapped[str] = mapped_column(Text, default="")
    current_version_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class CoverLetterVersion(Base):
    """Version history for cover letter documents."""

    __tablename__ = "cover_letter_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cover_letter_documents.id"), index=True
    )
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    job_id: Mapped[str] = mapped_column(String(64), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    created_by: Mapped[str] = mapped_column(String(32), default="user")
    intent: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    base_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    result_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class RefreshJob(Base):
    """Queue table for background refresh jobs."""

    __tablename__ = "refresh_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(16), default="queued")
    requested_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    totals: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
