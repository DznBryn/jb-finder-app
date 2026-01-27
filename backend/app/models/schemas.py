from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ResumeUploadRequest(BaseModel):
    """Payload for uploading a resume and user preferences."""

    resume_text: str = Field(..., description="Plain text extracted from resume.")
    location_pref: Optional[str] = Field(None, description="Preferred location.")
    remote_pref: Optional[bool] = Field(None, description="Remote preference.")


class SessionProfile(BaseModel):
    """Represents the temporary session profile derived from a resume."""

    session_id: UUID
    resume_s3_key: Optional[str]
    extracted_skills: List[str]
    inferred_titles: List[str]
    seniority: str
    years_experience: int
    location_pref: Optional[str]
    remote_pref: Optional[bool]
    llm_summary: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    social_links: List[str]
    llm_model: Optional[str] = None
    llm_key_present: Optional[bool] = None
    llm_warnings: Optional[List[str]] = None
    created_at: datetime
    expires_at: datetime


class MatchResult(BaseModel):
    """Represents a single job match with explainable details."""

    job_id: str
    company: str
    title: str
    location: str
    pay_ranges: List[dict] = []
    score: int
    tier: str
    reasons: List[str]
    missing_skills: List[str]
    apply_url: str


class MatchesResponse(BaseModel):
    """Response wrapper for job matches."""

    session_id: UUID
    matches: List[MatchResult]
    title_terms: List[str] = []
    page: int
    page_size: int
    total: int


class MatchFilters(BaseModel):
    """Optional filters to refine match results."""

    title_terms: List[str] = []
    location_pref: Optional[str] = None
    work_mode: Optional[str] = None
    pay_range: Optional[str] = None


class MatchesRequest(BaseModel):
    """Payload to fetch matches with optional filters."""

    session_id: UUID
    page: int = 1
    filters: Optional[MatchFilters] = None


class JobSelectionRequest(BaseModel):
    """Payload for selecting jobs for assisted apply."""

    session_id: UUID
    job_ids: List[str]


class JobSelectionResponse(BaseModel):
    """Result of a selection attempt (with limit enforcement)."""

    accepted_job_ids: List[str]
    rejected_job_ids: List[str]
    remaining_daily_quota: int


class ApplyPrepareRequest(BaseModel):
    """Payload to prepare application materials for a job."""

    session_id: UUID
    job_id: str
    cover_letter_tone: Optional[str] = Field(None, description="formal/concise/technical")


class ApplyPrepareResponse(BaseModel):
    """Prepared assets for a manual application."""

    cover_letter_text: Optional[str]
    apply_url: str


class CheckoutRequest(BaseModel):
    """Payload to start a Stripe Checkout session."""

    session_id: UUID
    plan: str = Field(..., description="monthly or one_time")


class CheckoutResponse(BaseModel):
    """Response with a hosted checkout URL."""

    checkout_url: str


class SubscriptionStatusResponse(BaseModel):
    """Current subscription status for a user/session."""

    plan: str
    status: str
