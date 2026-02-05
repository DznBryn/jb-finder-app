from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
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
    is_active: bool = True
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


class TitleCount(BaseModel):
    """Aggregated job title counts for filtering."""

    title: str
    count: int


class TitleFiltersResponse(BaseModel):
    """Response wrapper for title filter options."""

    titles: List[TitleCount]


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
    """Result of a selection attempt."""

    accepted_job_ids: List[str]
    rejected_job_ids: List[str]


class ApplyPrepareRequest(BaseModel):
    """Payload to prepare application materials for a job."""

    session_id: UUID
    job_id: str
    cover_letter_tone: Optional[str] = Field(None, description="formal/concise/technical")


class ApplyPrepareResponse(BaseModel):
    """Prepared assets for a manual application."""

    cover_letter_text: Optional[str]
    apply_url: str


class SelectedJobDetail(BaseModel):
    """Minimal job details for apply flow."""

    job_id: str
    company: str
    title: str
    location: str
    apply_url: str
    is_active: bool = True


class SelectedJobsResponse(BaseModel):
    """Response wrapper for selected job details."""

    jobs: List[SelectedJobDetail]


class CheckoutRequest(BaseModel):
    """Payload to start a Stripe Checkout session. user_id is set by the server when proxying."""

    plan: str = Field(
        ...,
        description="Plan key: monthly_basic, monthly_pro, topup_small, topup_large",
    )
    ui_mode: str = Field(default="embedded", description="embedded or hosted")
    user_id: Optional[str] = Field(None, description="Authenticated user ID (set by server proxy).")


class CheckoutResponse(BaseModel):
    """Response with client_secret for embedded checkout or checkout_url for redirect."""

    client_secret: Optional[str] = None
    checkout_url: Optional[str] = None


class CheckoutStatusResponse(BaseModel):
    """Stripe Checkout Session status for frontend polling."""

    status: str
    payment_status: str


class SubscriptionStatusResponse(BaseModel):
    """Current subscription status for a user/session."""

    plan: str
    status: str


class RefreshEnqueueResponse(BaseModel):
    """Response when a refresh job is enqueued."""

    job_id: int
    status: str


class RefreshStatusResponse(BaseModel):
    """Status for a refresh job."""

    job_id: int
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    totals: Optional[Dict[str, int]] = None
    error: Optional[str] = None


class AnalyzeRequest(BaseModel):
    """Payload to analyze selected jobs against a session."""

    session_id: UUID
    job_ids: List[str]


class AnalyzeResult(BaseModel):
    """Per-job analysis grade."""

    job_id: str
    grade: str
    rationale: str
    missing_skills: List[str] = []


class AnalyzeResponse(BaseModel):
    """Response with analysis results and best match."""

    session_id: UUID
    results: List[AnalyzeResult]
    best_match_job_id: Optional[str] = None


class LearningResource(BaseModel):
    """Learning resource for missing skills."""

    title: str
    type: str
    url: Optional[str] = None
    notes: Optional[str] = None


class LearningResourceGroup(BaseModel):
    """Resources grouped by skill."""

    skill: str
    category: str
    relevant: bool = True
    summary: Optional[str] = None
    resources: List[LearningResource] = []


class DeepAnalyzeRequest(BaseModel):
    """Payload to deep analyze a job."""

    session_id: UUID
    job_id: str


class DeepAnalyzeResponse(BaseModel):
    """Deep analysis response with learning resources."""

    session_id: UUID
    job_id: str
    grade: str
    rationale: str
    missing_skills: List[str] = []
    learning_resources: List[LearningResourceGroup] = []


class ResumeTextResponse(BaseModel):
    """Resume text for the current session."""

    session_id: UUID
    resume_text: str


class ResumeReviewRequest(BaseModel):
    """Payload to review a resume against a job."""

    session_id: UUID
    job_id: str


class ResumeReviewResponse(BaseModel):
    """Resume review response with actionable feedback."""

    session_id: UUID
    job_id: str
    summary: str
    strengths: List[str] = []
    gaps: List[str] = []
    missing_required_skills: List[str] = []
    changes: List[str] = []
    rewording: List[str] = []
    vocabulary: List[str] = []


class CoverLetterDocumentVersion(BaseModel):
    """Version history entry for cover letters."""

    id: int
    document_id: int
    job_id: str
    content: str
    created_at: datetime
    created_by: str
    intent: Optional[str] = None
    base_hash: Optional[str] = None
    result_hash: Optional[str] = None


class CoverLetterDocumentResponse(BaseModel):
    """Cover letter document with draft + versions."""

    document_id: int
    session_id: UUID
    job_id: str
    draft_content: str
    draft_hash: str
    current_version_id: Optional[int] = None
    versions: List[CoverLetterDocumentVersion] = []


class CoverLetterDraftRequest(BaseModel):
    """Payload to save a cover letter draft."""

    session_id: UUID
    job_id: str
    content: str
    base_hash: Optional[str] = None


class CoverLetterDraftResponse(BaseModel):
    """Response after saving a draft."""

    document_id: int
    session_id: UUID
    job_id: str
    draft_content: str
    draft_hash: str
    updated_at: datetime


class CoverLetterSuggestRequest(BaseModel):
    """Payload to request AI cover letter edits."""

    session_id: UUID
    job_id: str
    content: str
    intent: str
    selection: Optional[dict] = None
    constraints: Optional[dict] = None
    resume_facts: Optional[List[str]] = None
    base_hash: Optional[str] = None


class CoverLetterSuggestResponse(BaseModel):
    """AI patch response for cover letter editing."""

    base_hash: str
    ops: List[dict]
    preview: str
    diff: str
    explanation: str
    warnings: List[str] = []


class CoverLetterVersionCreateRequest(BaseModel):
    """Payload to create a new cover letter version."""

    session_id: UUID
    job_id: str
    content: str
    intent: Optional[str] = None
    base_hash: Optional[str] = None


class GreenhouseApplyRequest(BaseModel):
    """Payload to submit a Greenhouse application."""

    session_id: UUID
    job_id: str
    fields: Dict[str, object] = {}
    data_compliance: Dict[str, bool] = {}
    demographic_answers: Optional[List[dict]] = None
    mapped_url_token: Optional[str] = None
