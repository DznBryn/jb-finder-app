from __future__ import annotations

import hashlib
import json
from typing import Dict, Optional

import stripe
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.schemas import (
    ApplyPrepareRequest,
    ApplyPrepareResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    CheckoutRequest,
    CheckoutResponse,
    CheckoutStatusResponse,
    CoverLetterDocumentResponse,
    CoverLetterDraftRequest,
    CoverLetterDraftResponse,
    CoverLetterSuggestRequest,
    CoverLetterSuggestResponse,
    CoverLetterVersionCreateRequest,
    CoverLetterDocumentVersion,
    DeepAnalyzeRequest,
    DeepAnalyzeResponse,
    GreenhouseApplyRequest,
    JobSelectionRequest,
    JobSelectionResponse,
    MatchesRequest,
    MatchesResponse,
    ResumeReviewRequest,
    ResumeReviewResponse,
    ResumeTextResponse,
    SelectedJobDetail,
    SelectedJobsResponse,
    SessionProfile,
    SubscriptionStatusResponse,
    RefreshEnqueueResponse,
    RefreshStatusResponse,
    TitleFiltersResponse,
    LocationFiltersResponse,
    UserResumesDeleteRequest,
    UserResumesDeleteResponse,
)
from app.services.apply_service import prepare_cover_letter
from app.services.analysis_service import (
    analyze_selected_jobs,
    deep_analyze_job,
    get_deep_analysis,
)
from app.services.greenhouse_service import retrieve_job_post, submit_application
from app.services.matching_service import build_matches
from app.services.jobs_service import list_jobs_by_ids
from app.services.refresh_queue import enqueue_refresh, get_job
from app.config import STRIPE_WEBHOOK_BYPASS, AUTH_SCHEMA, INTERNAL_API_KEY
from app.services.payment_service import (
    create_checkout_session,
    fulfill_checkout_session,
    get_checkout_session_status,
    handle_charge_refunded,
    get_subscription_status,
    get_user_plan,
    set_subscription_active,
    set_user_plan,
    verify_stripe_signature,
)
from app.services.usage_service import (
    check_can_afford,
    estimate_credits,
    get_available_credits,
    settle_usage,
)
from app.db import get_db
from app.services.ai.llm_service import parse_resume_text
from app.services.ai.llm_service import suggest_cover_letter_edits
from app.models.db_models import (
    AnalysisUsage,
    CoverLetterDocument,
    CoverLetterVersion,
    DeepAnalysisRecord,
    JobListing,
    JobSelection,
    ResumeRecord,
    ResumeSessionRecord,
)
from app.services.ai.llm_service import review_resume_for_job
from app.services.resume_parser import parse_resume_file
from app.services.session_service import (
    create_session,
    create_session_from_resume,
    delete_expired_sessions,
    get_session,
    list_job_selections,
    save_job_selections,
    update_session_from_upload,
)
from app.services.storage_service import save_resume_file, delete_resume_file
from app.services.cover_letter_service import (
    apply_ops,
    compute_diff,
    get_document_with_versions,
    get_or_create_document,
    hash_content,
    save_draft,
    save_version,
)
from app.services.analysis_service import persist_match_analysis
from app.rate_limiter import limiter
from app.services.payment_service import fulfill_checkout_session
from pprint import pprint

router = APIRouter()


@router.get("/api/health")
def health() -> Dict[str, str]:
    """Health check for Railway, load balancers, and monitoring. No auth required."""
    return {"status": "ok"}


def _auth_users_table() -> str:
    return "users" if AUTH_SCHEMA == "public" else f'"{AUTH_SCHEMA}".users'


def _verify_internal_api_key(
    x_internal_api_key: str | None = Header(None, alias="X-Internal-API-Key"),
    authorization: str | None = Header(None),
) -> None:
    """Require valid internal API key for server-to-server user data endpoints."""
    if not INTERNAL_API_KEY:
        return  # No key configured: allow (e.g. local dev). Set INTERNAL_API_KEY in production.
    token = x_internal_api_key
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    if token != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing internal API key.")


@router.post("/api/resume/upload", response_model=SessionProfile)
def upload_resume(
    file: UploadFile = File(...),
    session_id: str | None = Form(None),
    user_id: str | None = Form(None),
    location_pref: str | None = Form(None),
    remote_pref: bool | None = Form(None),
    db: Session = Depends(get_db),
) -> SessionProfile:
    """Create or update a session from an uploaded resume file.

    If the user uploads a file with the same filename as before, we do nothing
    and return the existing session profile. Otherwise we parse, store, and
    create/update the session.
    """

    file_bytes = file.file.read()
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    uploaded_filename = file.filename or ""

    def _session_profile_from_record(record, llm_warnings=None):
        return SessionProfile(
            session_id=UUID(record.id),
            resume_s3_key=record.resume_s3_key,
            extracted_skills=record.extracted_skills or [],
            inferred_titles=record.inferred_titles or [],
            seniority=record.seniority or "mid",
            years_experience=record.years_experience or 0,
            location_pref=record.location_pref,
            remote_pref=record.remote_pref,
            llm_summary=record.llm_summary,
            first_name=record.first_name,
            last_name=record.last_name,
            email=record.email,
            phone=record.phone,
            location=record.location,
            social_links=record.social_links or [],
            llm_model=None,
            llm_key_present=True,
            llm_warnings=llm_warnings or [],
            created_at=record.created_at,
            expires_at=record.expires_at,
        )

    existing = None
    if session_id:
        try:
            existing = get_session(db, UUID(session_id))
        except (ValueError, TypeError):
            existing = None

    # Same filename: do nothing, return existing profile.
    if existing and existing.resume_s3_key:
        existing_filename = getattr(existing, "uploaded_filename", None) or ""
        if existing_filename == uploaded_filename:
            return _session_profile_from_record(
                existing,
                llm_warnings=["Same file as previous upload; no changes made."],
            )

    # Signed-in user: check if they already have a session with this filename.
    effective_uid = (user_id or "").strip() or None
    if effective_uid and not existing and uploaded_filename:
        prior = (
            db.query(ResumeSessionRecord)
            .filter(
                ResumeSessionRecord.user_id == effective_uid,
                ResumeSessionRecord.uploaded_filename == uploaded_filename,
            )
            .order_by(ResumeSessionRecord.created_at.desc())
            .first()
        )
        if prior:
            return _session_profile_from_record(
                prior,
                llm_warnings=["Same file as previous upload; no changes made."],
            )

    resume_text = parse_resume_file(file.filename, file_bytes)
    parsed = parse_resume_text(resume_text, use_fast_model=False)

    if existing and existing.resume_s3_key:
        # Re-upload (different filename): replace file at existing key.
        resume_s3_key = save_resume_file(
            file.filename, file_bytes, overwrite_key=existing.resume_s3_key
        )
        record = update_session_from_upload(
            db=db,
            session_id=UUID(session_id),
            resume_text=resume_text,
            resume_s3_key=resume_s3_key,
            resume_content_hash=content_hash,
            uploaded_filename=uploaded_filename,
            extracted_skills=parsed.get("extracted_skills", []),
            inferred_titles=parsed.get("inferred_titles", []),
            seniority=parsed.get("seniority", "mid"),
            years_experience=int(parsed.get("years_experience", 0)),
            location_pref=location_pref,
            remote_pref=remote_pref,
            llm_summary=parsed.get("summary"),
            first_name=parsed.get("first_name"),
            last_name=parsed.get("last_name"),
            email=parsed.get("email"),
            phone=parsed.get("phone"),
            location=parsed.get("location"),
            social_links=parsed.get("social_links", []),
        )
    else:
        # New upload: create new storage object and session.
        resume_s3_key = save_resume_file(file.filename, file_bytes)
        effective_uid = (user_id or "").strip() or None
        record = create_session(
            db=db,
            resume_text=resume_text,
            resume_s3_key=resume_s3_key,
            resume_content_hash=content_hash,
            uploaded_filename=uploaded_filename,
            extracted_skills=parsed.get("extracted_skills", []),
            inferred_titles=parsed.get("inferred_titles", []),
            seniority=parsed.get("seniority", "mid"),
            years_experience=int(parsed.get("years_experience", 0)),
            location_pref=location_pref,
            remote_pref=remote_pref,
            llm_summary=parsed.get("summary"),
            first_name=parsed.get("first_name"),
            last_name=parsed.get("last_name"),
            email=parsed.get("email"),
            phone=parsed.get("phone"),
            location=parsed.get("location"),
            social_links=parsed.get("social_links", []),
            user_id=effective_uid,
        )

    # Link session to user when signed in so analyses are persisted and linked.
    effective_uid = (user_id or (getattr(record, "user_id", None) or "")).strip()
    if effective_uid:
        record.user_id = effective_uid
        db.commit()
    if effective_uid and content_hash:
        existing_resume_record = (
            db.query(ResumeRecord)
            .filter(
                ResumeRecord.user_id == effective_uid,
                ResumeRecord.resume_content_hash == content_hash,
            )
            .first()
        )
        if not existing_resume_record:
            now = datetime.now(timezone.utc)
            resume_row = ResumeRecord(
                id=str(uuid4()),
                user_id=effective_uid,
                resume_text=record.resume_text,
                resume_s3_key=record.resume_s3_key,
                resume_content_hash=content_hash,
                extracted_skills=record.extracted_skills or [],
                inferred_titles=record.inferred_titles or [],
                seniority=record.seniority or "mid",
                years_experience=record.years_experience or 0,
                location_pref=record.location_pref,
                remote_pref=record.remote_pref,
                llm_summary=record.llm_summary,
                first_name=record.first_name,
                last_name=record.last_name,
                email=record.email,
                phone=record.phone,
                location=record.location,
                social_links=record.social_links or [],
                created_at=now,
                daily_selections=0,
                daily_selection_date=now.date().isoformat(),
            )
            db.add(resume_row)
            db.commit()

    return SessionProfile(
        session_id=UUID(record.id),
        resume_s3_key=record.resume_s3_key,
        extracted_skills=record.extracted_skills,
        inferred_titles=record.inferred_titles,
        seniority=record.seniority,
        years_experience=record.years_experience,
        location_pref=record.location_pref,
        remote_pref=record.remote_pref,
        llm_summary=record.llm_summary,
        first_name=record.first_name,
        last_name=record.last_name,
        email=record.email,
        phone=record.phone,
        location=record.location,
        social_links=record.social_links or [],
        llm_model=parsed.get("llm_model"),
        llm_key_present=parsed.get("llm_key_present"),
        llm_warnings=parsed.get("warnings"),
        created_at=record.created_at,
        expires_at=record.expires_at,
    )


@router.get("/api/session/profile", response_model=SessionProfile)
def session_profile(session_id: UUID, db: Session = Depends(get_db)) -> SessionProfile:
    """Return the session profile for apply flow."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    return SessionProfile(
        session_id=UUID(session.id),
        resume_s3_key=session.resume_s3_key,
        extracted_skills=session.extracted_skills,
        inferred_titles=session.inferred_titles,
        seniority=session.seniority,
        years_experience=session.years_experience,
        location_pref=session.location_pref,
        remote_pref=session.remote_pref,
        llm_summary=session.llm_summary,
        first_name=session.first_name,
        last_name=session.last_name,
        email=session.email,
        phone=session.phone,
        location=session.location,
        social_links=session.social_links or [],
        created_at=session.created_at,
        expires_at=session.expires_at,
    )


@router.get("/api/session/resume", response_model=ResumeTextResponse)
def session_resume(session_id: UUID, db: Session = Depends(get_db)) -> ResumeTextResponse:
    """Return resume text for the current session."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    return ResumeTextResponse(session_id=UUID(session.id), resume_text=session.resume_text)


@router.get("/api/editor/document", response_model=CoverLetterDocumentResponse)
def cover_letter_document(
    session_id: UUID, job_id: str, db: Session = Depends(get_db)
) -> CoverLetterDocumentResponse:
    """Return cover letter document, draft, and versions."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    data = get_document_with_versions(db, str(session_id), job_id)
    draft_hash = hash_content(data.document.draft_content or "")
    return CoverLetterDocumentResponse(
        document_id=data.document.id,
        session_id=session_id,
        job_id=job_id,
        draft_content=data.document.draft_content or "",
        draft_hash=draft_hash,
        current_version_id=data.document.current_version_id,
        versions=[
            CoverLetterDocumentVersion(
                id=version.id,
                document_id=version.document_id,
                job_id=version.job_id,
                content=version.content,
                created_at=version.created_at,
                created_by=version.created_by,
                intent=version.intent,
                base_hash=version.base_hash,
                result_hash=version.result_hash,
            )
            for version in data.versions
        ],
    )


@router.post("/api/editor/draft", response_model=CoverLetterDraftResponse)
def cover_letter_draft(
    payload: CoverLetterDraftRequest, db: Session = Depends(get_db)
) -> CoverLetterDraftResponse:
    """Save cover letter draft content."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    document = get_or_create_document(db, str(payload.session_id), payload.job_id)
    current_hash = hash_content(document.draft_content or "")
    if payload.base_hash and payload.base_hash != current_hash:
        raise HTTPException(status_code=409, detail="Draft is out of date.")

    saved = save_draft(db, document, payload.content)
    return CoverLetterDraftResponse(
        document_id=saved.id,
        session_id=payload.session_id,
        job_id=payload.job_id,
        draft_content=saved.draft_content,
        draft_hash=hash_content(saved.draft_content or ""),
        updated_at=saved.updated_at,
    )


@router.post("/api/editor/version", response_model=CoverLetterDocumentVersion)
def cover_letter_version(
    payload: CoverLetterVersionCreateRequest, db: Session = Depends(get_db)
) -> CoverLetterDocumentVersion:
    """Create a new cover letter version."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    document = get_or_create_document(db, str(payload.session_id), payload.job_id)
    current_hash = hash_content(document.draft_content or "")
    if payload.base_hash and payload.base_hash != current_hash:
        raise HTTPException(status_code=409, detail="Draft is out of date.")

    version = save_version(
        db,
        document,
        payload.content,
        intent=payload.intent,
        created_by="user",
        base_hash=payload.base_hash,
    )
    return CoverLetterDocumentVersion(
        id=version.id,
        document_id=version.document_id,
        job_id=version.job_id,
        content=version.content,
        created_at=version.created_at,
        created_by=version.created_by,
        intent=version.intent,
        base_hash=version.base_hash,
        result_hash=version.result_hash,
    )


@router.post("/api/editor/suggest", response_model=CoverLetterSuggestResponse)
@limiter.limit("12/minute")
def cover_letter_suggest(
    payload: CoverLetterSuggestRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CoverLetterSuggestResponse:
    """Generate AI patch ops for cover letter content."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    user_id = getattr(session, "user_id", None)
    _require_credits_or_402(user_id, db, "cover_letter")

    _ = get_or_create_document(db, str(payload.session_id), payload.job_id)
    base_hash = hash_content(payload.content or "")
    if payload.base_hash and payload.base_hash != base_hash:
        raise HTTPException(status_code=409, detail="Draft hash mismatch.")

    job_context = ""
    try:
        job_payload = retrieve_job_post(db, payload.job_id)
        job_context = str(job_payload.get("content") or "")
    except Exception:
        try:
            job_int = int(payload.job_id)
        except ValueError:
            job_int = None
        if job_int is not None:
            job = db.query(JobListing).filter(JobListing.id == job_int).first()
            if job:
                job_context = job.description or ""

    resume_facts = payload.resume_facts or []
    if not resume_facts:
        if session.llm_summary:
            resume_facts.append(f"Summary: {session.llm_summary}")
        if session.extracted_skills:
            resume_facts.append("Skills: " + ", ".join(session.extracted_skills[:25]))
        if session.inferred_titles:
            resume_facts.append("Titles: " + ", ".join(session.inferred_titles[:5]))
        if session.years_experience:
            resume_facts.append(f"Years of experience: {session.years_experience}")

    result, total_tokens = suggest_cover_letter_edits(
        content=payload.content or "",
        resume_facts=resume_facts,
        job_context=job_context,
        intent=payload.intent,
        constraints=payload.constraints,
        selection=payload.selection,
    )
    if user_id and total_tokens:
        settle_usage(db, user_id, total_tokens, "cover_letter")
    ops = result.get("ops", [])
    explanation = result.get("explanation", "")
    warnings = list(result.get("warnings", []) or [])

    try:
        preview = apply_ops(payload.content or "", ops)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    diff = compute_diff(payload.content or "", preview)
    word_count = len(preview.split())
    if word_count > 400:
        warnings.append("Cover letter exceeds 400 words; consider shortening.")

    return CoverLetterSuggestResponse(
        base_hash=base_hash,
        ops=ops,
        preview=preview,
        diff=diff,
        explanation=explanation,
        warnings=warnings,
    )


@router.get("/api/matches", response_model=MatchesResponse)
def get_matches(
    session_id: UUID,
    page: int = 1,
    db: Session = Depends(get_db),
) -> MatchesResponse:
    """Return ranked job matches for the given session."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    page = max(page, 1)
    page_size = 25
    matches, total, title_terms = build_matches(
        db, session, page=page, page_size=page_size, filters=None
    )
    return MatchesResponse(
        session_id=session_id,
        matches=matches,
        title_terms=title_terms,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("/api/matches", response_model=MatchesResponse)
def post_matches(payload: MatchesRequest, db: Session = Depends(get_db)) -> MatchesResponse:
    """Return ranked job matches with optional filters."""

    session = get_session(db, payload.session_id)
    pprint(payload)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    page = max(payload.page, 1)
    page_size = 25
    matches, total, title_terms = build_matches(
        db,
        session,
        page=page,
        page_size=page_size,
        filters=payload.filters.model_dump() if payload.filters else None,
    )
    return MatchesResponse(
        session_id=payload.session_id,
        matches=matches,
        title_terms=title_terms,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/api/filters/titles", response_model=TitleFiltersResponse)
def list_title_filters(limit: int = 100, db: Session = Depends(get_db)) -> TitleFiltersResponse:
    """Return top job titles with counts for filter dropdowns."""

    safe_limit = max(1, min(limit, 500))
    rows = (
        db.query(JobListing.title, func.count(JobListing.id))
        .filter(JobListing.is_active.is_(True))
        .group_by(JobListing.title)
        .order_by(func.count(JobListing.id).desc(), JobListing.title.asc())
        .limit(safe_limit)
        .all()
    )
    return TitleFiltersResponse(
        titles=[{"title": title, "count": count} for title, count in rows]
    )


@router.get("/api/filters/locations", response_model=LocationFiltersResponse)
def list_location_filters(
    limit: int = 200, db: Session = Depends(get_db)
) -> LocationFiltersResponse:
    """Return distinct job locations with counts for filter suggestions."""

    safe_limit = max(1, min(limit, 500))
    rows = (
        db.query(JobListing.location, func.count(JobListing.id))
        .filter(JobListing.is_active.is_(True))
        .filter(JobListing.location != None, JobListing.location != "")
        .group_by(JobListing.location)
        .order_by(func.count(JobListing.id).desc(), JobListing.location.asc())
        .limit(safe_limit)
        .all()
    )
    return LocationFiltersResponse(
        locations=[{"location": loc, "count": count} for loc, count in rows]
    )


@router.post("/api/jobs/select", response_model=JobSelectionResponse)
def select_jobs(
    payload: JobSelectionRequest, db: Session = Depends(get_db)
) -> JobSelectionResponse:
    """Store job selections for the session."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    accepted = list(payload.job_ids)
    rejected: list[str] = []

    if accepted:
        save_job_selections(db, payload.session_id, accepted, payload.user_id)

    return JobSelectionResponse(
        accepted_job_ids=accepted,
        rejected_job_ids=rejected,
    )


@router.post("/api/apply/prepare", response_model=ApplyPrepareResponse)
def prepare_application(
    payload: ApplyPrepareRequest, db: Session = Depends(get_db)
) -> ApplyPrepareResponse:
    """Generate cover letter content and return apply URL."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    tone = payload.cover_letter_tone or "concise"
    cover_letter = prepare_cover_letter(db, payload.job_id, tone)
    return ApplyPrepareResponse(
        cover_letter_text=cover_letter.get("cover_letter_text"),
        apply_url=cover_letter.get("apply_url", ""),
    )


def _require_credits_or_402(
    user_id: str | None,
    db: Session,
    feature: str,
) -> None:
    """Raise HTTP 402 if user is missing or has insufficient credits."""
    if not user_id:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "authentication_required",
                "message": "Sign in to use this feature.",
                "required": estimate_credits(feature),
                "available": 0,
            },
        )
    sub, onetime = get_available_credits(db, user_id)
    total = sub + onetime
    required = estimate_credits(feature)
    if not check_can_afford(total, required):
        raise HTTPException(
            status_code=402,
            detail={
                "error": "insufficient_credits",
                "message": "Not enough credits.",
                "required": required,
                "available": total,
            },
        )


@router.post("/api/checkout/create", response_model=CheckoutResponse)
def create_checkout(
    payload: CheckoutRequest,
) -> CheckoutResponse:
    """Create a Stripe Checkout session. For embedded mode returns client_secret."""

    user_id = payload.user_id
    
    if not user_id:
        raise HTTPException(status_code=401, detail="user_id required (authenticate first).")
    try:
        result = create_checkout_session(user_id, payload.plan, payload.ui_mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutResponse(
        client_secret=result.get("client_secret"),
        checkout_url=result.get("checkout_url"),
    )


@router.get("/api/checkout/status", response_model=CheckoutStatusResponse)
def get_checkout_status(session_id: str) -> CheckoutStatusResponse:
    """Return Stripe Checkout Session status for frontend polling."""
    try:
        status = get_checkout_session_status(session_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutStatusResponse(
        status=status["status"],
        payment_status=status["payment_status"],
    )


@router.post("/api/checkout/fulfill")
def post_checkout_fulfill(session_id: str, db: Session = Depends(get_db)) -> Dict[str, object]:
    """
    Idempotent fulfillment: if the Stripe checkout session is paid, grant credits
    and set plan (if not already done). Call this after redirect from Stripe
    so the user gets credits even if the webhook has not run yet.
    """
    try:
        fulfilled = fulfill_checkout_session(session_id, db)
        return {"fulfilled": fulfilled}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/api/analyze", response_model=AnalyzeResponse)
@limiter.limit("10/minute")
def analyze_selections(
    payload: AnalyzeRequest, request: Request, db: Session = Depends(get_db)
) -> AnalyzeResponse:
    """Analyze selected jobs with the LLM and return grades."""

    session = get_session(db, payload.session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    user_id = getattr(session, "user_id", None)
    _require_credits_or_402(user_id, db, "match_analysis")

    analysis, total_tokens = analyze_selected_jobs(db, session, payload.job_ids)

    if user_id and total_tokens:
        settle_usage(db, user_id, total_tokens, "match_analysis")
    
    if user_id:
        persist_match_analysis(
            db, str(session.id), user_id, analysis.get("results", [])
        )
    
    return AnalyzeResponse(
        session_id=payload.session_id,
        results=analysis.get("results", []),
        best_match_job_id=analysis.get("best_match_job_id"),
    )


@router.post("/api/analyze/deep", response_model=DeepAnalyzeResponse)
@limiter.limit("3/minute")
def analyze_deep(
    payload: DeepAnalyzeRequest, request: Request, db: Session = Depends(get_db)
) -> DeepAnalyzeResponse:
    """Deep analysis with learning resources for a single job."""

    session = get_session(db, payload.session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    
    user_id = getattr(session, "user_id", None)
    _require_credits_or_402(user_id, db, "deep_analysis")

    cached = get_deep_analysis(db, str(payload.session_id), payload.job_id)
    
    if cached:
        # Cache payload may omit session_id/job_id (e.g. from persist_match_analysis)
        out = {**cached, "session_id": payload.session_id, "job_id": payload.job_id}
        return DeepAnalyzeResponse(**out)

    try:
        result, total_tokens = deep_analyze_job(db, session, payload.job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if user_id and total_tokens:
        settle_usage(db, user_id, total_tokens, "deep_analysis")
    
    return DeepAnalyzeResponse(
        session_id=payload.session_id,
        job_id=result.get("job_id", payload.job_id),
        grade=result.get("grade", "D"),
        rationale=result.get("rationale", ""),
        missing_skills=result.get("missing_skills", []),
        learning_resources=result.get("learning_resources", []),
        job_summary=result.get("job_summary"),
    )


@router.get("/api/analyze/deep", response_model=DeepAnalyzeResponse)
def get_deep_analyze(
    session_id: UUID, job_id: str, db: Session = Depends(get_db)
) -> DeepAnalyzeResponse:
    """Return cached deep analysis for a session + job."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    cached = get_deep_analysis(db, str(session_id), job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Deep analysis not found.")

    # Cache payload may omit session_id/job_id (e.g. from persist_match_analysis)
    out = {**cached, "session_id": session_id, "job_id": job_id}
    return DeepAnalyzeResponse(**out)


@router.post("/api/resume/review", response_model=ResumeReviewResponse)
@limiter.limit("5/minute")
def resume_review(
    payload: ResumeReviewRequest, request: Request, db: Session = Depends(get_db)
) -> ResumeReviewResponse:
    """Review a resume against a job posting."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    _require_credits_or_402(getattr(session, "user_id", None), db, "resume_review")

    try:
        job_int = int(payload.job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid job id.") from exc

    job = db.query(JobListing).filter(JobListing.id == job_int).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    review = review_resume_for_job(
        session.resume_text,
        {
            "title": job.title,
            "company": job.company_name,
            "description": job.description or "",
        },
    )

    return ResumeReviewResponse(
        session_id=payload.session_id,
        job_id=str(payload.job_id),
        summary=review.get("summary", ""),
        strengths=review.get("strengths", []),
        gaps=review.get("gaps", []),
        missing_required_skills=review.get("missing_required_skills", []),
        changes=review.get("changes", []),
        rewording=review.get("rewording", []),
        vocabulary=review.get("vocabulary", []),
    )


@router.post("/api/webhooks/stripe")
async def stripe_webhook(
    request: Request, db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Handle Stripe webhook payload and update subscription status (plan on users when linked)."""

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    if STRIPE_WEBHOOK_BYPASS:
        # Dev-only fallback for simple payloads from the simulate button.
        data = json.loads(payload.decode("utf-8"))
        session_id_raw = data.get("session_id")
        plan = data.get("plan", "monthly")
        
        if session_id_raw:
            sid = UUID(session_id_raw)
            session_rec = get_session(db, sid)
            
            if session_rec and session_rec.user_id:
                set_user_plan(db, session_rec.user_id, plan)
            else:
                set_subscription_active(sid, plan)
        return {"status": "ok"}

    pprint(payload)
    try:
        event = verify_stripe_signature(payload, signature)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        stripe_session_id = session_obj.get("id")
        if stripe_session_id:
            fulfill_checkout_session(stripe_session_id, db)
        return {"status": "ok"}

    if event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return {"status": "ok"}
        sub = stripe.Subscription.retrieve(subscription_id)
        metadata = sub.get("metadata") or {}
        user_id = metadata.get("user_id")
        if user_id:
            plan = get_user_plan(db, user_id)
            if plan in ("monthly_basic", "monthly_pro", "monthly"):
                from app.services.payment_service import PLAN_CREDITS
                credits = PLAN_CREDITS.get(plan) or PLAN_CREDITS.get("monthly_basic", 500)
                db.execute(
                    text(f"UPDATE {_auth_users_table()} SET subscription_credits = :amt WHERE id = :id"),
                    {"amt": credits, "id": user_id},
                )
                db.commit()
        return {"status": "ok"}

    if event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        metadata = sub.get("metadata") or {}
        user_id = metadata.get("user_id")
        if user_id:
            set_user_plan(db, user_id, "free")
        return {"status": "ok"}

    if event["type"] == "charge.refunded":
        charge = event["data"]["object"]
        charge_id = charge.get("id")
        if charge_id:
            try:
                handle_charge_refunded(charge_id, db)
            except Exception:
                pass
        return {"status": "ok"}

    return {"status": "ok"}


@router.get("/api/subscription/status", response_model=SubscriptionStatusResponse)
def subscription_status(
    session_id: UUID, db: Session = Depends(get_db)
) -> SubscriptionStatusResponse:
    """Return the current plan and subscription status (from users when session has user_id)."""

    status = get_subscription_status(session_id, db)
    return SubscriptionStatusResponse(plan=status.plan, status=status.status)


@router.get("/api/user/base")
def user_base(
    user_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_internal_api_key),
) -> Dict[str, object]:
    """Return base user profile + wallet data. Requires internal API key."""

    row = db.execute(
        text(
            f"""
            SELECT id, name, email, image, plan, subscription_credits, one_time_credits
            FROM {_auth_users_table()}
            WHERE id = :user_id
            """
        ),
        {"user_id": user_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "profile": {
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "image": row.image,
            "locale": None,
        },
        "wallet": {
            "plan": row.plan,
            "subscription_credits": row.subscription_credits,
            "one_time_credits": row.one_time_credits,
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "status": "active" if row.plan and row.plan != "free" else "none",
        },
        "updated_at": None,
    }


@router.get("/api/user/resumes")
def user_resumes(
    user_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_internal_api_key),
) -> Dict[str, object]:
    """Return resumes and related data for a user. Requires internal API key."""

    resumes = (
        db.query(ResumeRecord)
        .filter(ResumeRecord.user_id == user_id)
        .order_by(ResumeRecord.created_at.desc())
        .all()
    )
    
    if not resumes:
        return {"resumes": [], "saved_jobs": [], "analyzed_jobs": [], "cover_letters": []}

    saved_job_ids = [
        row.job_id
        for row in db.query(JobSelection)
        .filter(JobSelection.user_id == user_id)
        .all()
    ]
    saved_jobs = []
    
    if saved_job_ids:
        jobs = list_jobs_by_ids(db, saved_job_ids)
        saved_jobs = [
            {
                "job_id": str(job.id),
                "company": job.company_name,
                "title": job.title,
                "location": job.location,
                "apply_url": job.apply_url,
                "is_active": job.is_active,
                "industry": job.industry,
            }
            for job in jobs
        ]

    deep_rows = (
        db.query(DeepAnalysisRecord)
        .filter(DeepAnalysisRecord.user_id == user_id)
        .all()
    )
    
    analyzed = []

    if deep_rows:
        analyzed_job_ids = [row.job_id for row in deep_rows]
        analyzed_jobs = list_jobs_by_ids(db, analyzed_job_ids)
        job_map = {str(j.id): j for j in analyzed_jobs}
        
        for row in deep_rows:
            payload = row.payload or {}
            job = job_map.get(row.job_id)
        
            analyzed.append(
                {
                    "job_id": row.job_id,
                    "grade": payload.get("grade"),
                    "rationale": payload.get("rationale"),
                    "missing_skills": payload.get("missing_skills", []),
                    "learning_resources": payload.get("learning_resources", []),
                    "job_summary": payload.get("job_summary"),
                    "title": job.title if job else None,
                    "company": job.company_name if job else None,
                    "location": job.location if job else None,
                    "apply_url": job.apply_url if job else None,
                }
            )

    documents = (
        db.query(CoverLetterDocument)
        .filter(CoverLetterDocument.user_id == user_id)
        .all()
    )
    doc_ids = [doc.id for doc in documents]
    versions_by_doc: Dict[int, list] = {}
    if doc_ids:
        versions = (
            db.query(CoverLetterVersion)
            .filter(CoverLetterVersion.document_id.in_(doc_ids))
            .order_by(CoverLetterVersion.created_at.desc())
            .all()
        )
        for version in versions:
            versions_by_doc.setdefault(version.document_id, []).append(
                {
                    "id": version.id,
                    "job_id": version.job_id,
                    "content": version.content,
                    "created_at": version.created_at.isoformat()
                    if version.created_at
                    else None,
                    "intent": version.intent,
                }
            )

    cover_letters = []
    for doc in documents:
        cover_letters.append(
            {
                "job_id": doc.job_id,
                "draft_content": doc.draft_content,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
                "versions": versions_by_doc.get(doc.id, []),
            }
        )

    resume_payloads = [
        {
            "id": resume.id,
            "user_id": resume.user_id,
            "resume_s3_key": resume.resume_s3_key,
            "resume_content_hash": resume.resume_content_hash,
            "created_at": resume.created_at.isoformat() if resume.created_at else None,
            "inferred_titles": resume.inferred_titles or [],
            "extracted_skills": resume.extracted_skills or [],
        }
        for resume in resumes
    ]

    return {
        "resumes": resume_payloads,
        "saved_jobs": saved_jobs,
        "analyzed_jobs": analyzed,
        "cover_letters": cover_letters,
    }


@router.post("/api/user/resumes/delete", response_model=UserResumesDeleteResponse)
def user_resumes_delete(
    payload: UserResumesDeleteRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_internal_api_key),
) -> UserResumesDeleteResponse:
    """Delete one or more resume records for a user. Removes stored file(s) and DB rows."""

    if not payload.resume_ids:
        return UserResumesDeleteResponse(deleted=0)

    deleted = 0
    for resume_id in payload.resume_ids:
        if not resume_id or not resume_id.strip():
            continue
        record = (
            db.query(ResumeRecord)
            .filter(
                ResumeRecord.id == resume_id.strip(),
                ResumeRecord.user_id == payload.user_id,
            )
            .first()
        )
        if not record:
            continue
        if record.resume_s3_key:
            try:
                delete_resume_file(record.resume_s3_key)
            except Exception:
                pass  # continue to delete DB row even if storage delete fails
        db.delete(record)
        deleted += 1

    db.commit()
    return UserResumesDeleteResponse(deleted=deleted)


@router.post("/api/user/resume/{resume_id}/create-session", response_model=SessionProfile)
def create_session_from_resume_route(
    resume_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_internal_api_key),
) -> SessionProfile:
    """Create a temporary session from a stored resume for job matching. Returns session profile."""
    print("resume_id", resume_id)
    print("user_id", user_id)
    session_record = create_session_from_resume(db, resume_id.strip(), user_id.strip())
    pprint(session_record)
    if not session_record:
        raise HTTPException(status_code=404, detail="Resume not found or access denied.")
    return SessionProfile(
        session_id=UUID(session_record.id),
        resume_s3_key=session_record.resume_s3_key,
        extracted_skills=session_record.extracted_skills or [],
        inferred_titles=session_record.inferred_titles or [],
        seniority=session_record.seniority or "mid",
        years_experience=session_record.years_experience or 0,
        location_pref=session_record.location_pref,
        remote_pref=session_record.remote_pref,
        llm_summary=session_record.llm_summary,
        first_name=session_record.first_name,
        last_name=session_record.last_name,
        email=session_record.email,
        phone=session_record.phone,
        location=session_record.location,
        social_links=session_record.social_links or [],
        llm_model=None,
        llm_key_present=True,
        llm_warnings=None,
        created_at=session_record.created_at,
        expires_at=session_record.expires_at,
    )


@router.get("/api/jobs/selected")
def selected_jobs(
    session_id: UUID, user_id: Optional[str] = None, db: Session = Depends(get_db)
) -> Dict[str, list]:
    """Return the job IDs selected for this session."""

    selected = list_job_selections(db, session_id, user_id)
    return {"job_ids": selected}


@router.get("/api/jobs/selected/details", response_model=SelectedJobsResponse)
def selected_job_details(
    session_id: UUID, user_id: Optional[str] = None, db: Session = Depends(get_db)
) -> SelectedJobsResponse:
    """Return job details for the selected job IDs."""

    selected = list_job_selections(db, session_id, user_id)
    jobs = list_jobs_by_ids(db, selected)
    mapped = [
        SelectedJobDetail(
            job_id=str(job.id),
            company=job.company_name,
            title=job.title,
            location=job.location,
            apply_url=job.apply_url,
            is_active=job.is_active,
        )
        for job in jobs
    ]
    return SelectedJobsResponse(jobs=mapped)


@router.get("/api/greenhouse/job")
def greenhouse_job(job_id: str, db: Session = Depends(get_db)) -> Dict[str, object]:
    """Fetch Greenhouse job questions for a selected job."""

    try:
        return retrieve_job_post(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/api/greenhouse/apply")
def greenhouse_apply(
    payload: GreenhouseApplyRequest, request: Request, db: Session = Depends(get_db)
) -> Dict[str, object]:
    """Submit a Greenhouse application for a selected job."""

    session = get_session(db, payload.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    client_ip = request.client.host if request.client else None

    try:
        response = submit_application(
            db,
            session,
            payload.job_id,
            payload.fields,
            data_compliance=payload.data_compliance,
            demographic_answers=payload.demographic_answers,
            mapped_url_token=payload.mapped_url_token,
            applicant_ip=client_ip,
        )
        return {"status": "ok", "response": response}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/api/ingest/refresh", response_model=RefreshEnqueueResponse)
def ingest_refresh(db: Session = Depends(get_db)) -> RefreshEnqueueResponse:
    """Enqueue a manual ATS ingestion refresh (dev only)."""

    job = enqueue_refresh(db, requested_by="api")
    return RefreshEnqueueResponse(job_id=job.id, status=job.status)


@router.get("/api/ingest/refresh/{job_id}", response_model=RefreshStatusResponse)
def ingest_refresh_status(job_id: int, db: Session = Depends(get_db)) -> RefreshStatusResponse:
    """Check status for a queued refresh job."""

    job = get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Refresh job not found.")
    return RefreshStatusResponse(
        job_id=job.id,
        status=job.status,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        totals=job.totals if isinstance(job.totals, dict) else None,
        error=job.error,
    )


@router.post("/api/internal/cleanup-expired-sessions")
def cleanup_expired_sessions(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_internal_api_key),
) -> Dict[str, int]:
    """Delete resume_sessions rows where expires_at is in the past. Call from cron or manually."""
    deleted = delete_expired_sessions(db)
    return {"deleted": deleted}
