from __future__ import annotations

import json
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.models.schemas import (
    ApplyPrepareRequest,
    ApplyPrepareResponse,
    CheckoutRequest,
    CheckoutResponse,
    JobSelectionRequest,
    JobSelectionResponse,
    MatchesRequest,
    MatchesResponse,
    SessionProfile,
    SubscriptionStatusResponse,
)
from app.services.apply_service import prepare_cover_letter
from app.services.matching_service import build_matches
from app.schedulers.ingestion_service import refresh_all_jobs
from app.config import STRIPE_WEBHOOK_BYPASS
from app.services.payment_service import (
    create_checkout_session,
    get_subscription_status,
    set_subscription_active,
    verify_stripe_signature,
)
from app.db import get_db
from app.services.llm_service import parse_resume_text
from app.services.resume_parser import parse_resume_file
from app.services.session_service import (
    create_session,
    get_session,
    increment_daily_selection,
    list_job_selections,
    save_job_selections,
)
from app.services.storage_service import save_resume_file

router = APIRouter()


@router.post("/api/resume/upload", response_model=SessionProfile)
def upload_resume(
    file: UploadFile = File(...),
    location_pref: str | None = Form(None),
    remote_pref: bool | None = Form(None),
    db: Session = Depends(get_db),
) -> SessionProfile:
    """Create a temporary session profile from an uploaded resume file."""

    file_bytes = file.file.read()
    resume_text = parse_resume_file(file.filename, file_bytes)
    resume_s3_key = save_resume_file(file.filename, file_bytes)
    parsed = parse_resume_text(resume_text)
    record = create_session(
        db=db,
        resume_text=resume_text,
        resume_s3_key=resume_s3_key,
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


@router.post("/api/jobs/select", response_model=JobSelectionResponse)
def select_jobs(
    payload: JobSelectionRequest, db: Session = Depends(get_db)
) -> JobSelectionResponse:
    """Store job selections and enforce the free-tier daily limit."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    subscription = get_subscription_status(payload.session_id)
    is_pro = subscription.status == "active"
    daily_limit = 5

    accepted = []
    rejected = []
    remaining_quota = daily_limit if not is_pro else 9999

    for job_id in payload.job_ids:
        if is_pro:
            accepted.append(job_id)
            continue

        accepted_now, remaining_quota = increment_daily_selection(
            db, payload.session_id, daily_limit
        )
        if accepted_now:
            accepted.append(job_id)
        else:
            rejected.append(job_id)

    if accepted:
        save_job_selections(db, payload.session_id, accepted)

    return JobSelectionResponse(
        accepted_job_ids=accepted,
        rejected_job_ids=rejected,
        remaining_daily_quota=remaining_quota if not is_pro else 9999,
    )


@router.post("/api/apply/prepare", response_model=ApplyPrepareResponse)
def prepare_application(
    payload: ApplyPrepareRequest, db: Session = Depends(get_db)
) -> ApplyPrepareResponse:
    """Generate cover letter content for Pro users, or return apply URL only."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    subscription = get_subscription_status(payload.session_id)
    if subscription.status != "active":
        # Free tier: no cover letter generation.
        cover_letter = prepare_cover_letter(db, payload.job_id, "concise")
        return ApplyPrepareResponse(
            cover_letter_text=None,
            apply_url=cover_letter.get("apply_url", ""),
        )

    tone = payload.cover_letter_tone or "concise"
    cover_letter = prepare_cover_letter(db, payload.job_id, tone)
    return ApplyPrepareResponse(
        cover_letter_text=cover_letter.get("cover_letter_text"),
        apply_url=cover_letter.get("apply_url", ""),
    )


@router.post("/api/checkout/create", response_model=CheckoutResponse)
def create_checkout(payload: CheckoutRequest) -> CheckoutResponse:
    """Create a Stripe Checkout session and return the hosted URL."""

    try:
        checkout_url = create_checkout_session(payload.session_id, payload.plan)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutResponse(checkout_url=checkout_url)


@router.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request) -> Dict[str, str]:
    """Handle Stripe webhook payload and update subscription status."""

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    if STRIPE_WEBHOOK_BYPASS:
        # Dev-only fallback for simple payloads from the simulate button.
        data = json.loads(payload.decode("utf-8"))
        session_id_raw = data.get("session_id")
        plan = data.get("plan", "monthly")
        if session_id_raw:
            set_subscription_active(UUID(session_id_raw), plan)
        return {"status": "ok"}

    try:
        event = verify_stripe_signature(payload, signature)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        session_id_raw = session_obj["metadata"].get("session_id")
        plan = session_obj["metadata"].get("plan", "monthly")
        if session_id_raw:
            set_subscription_active(UUID(session_id_raw), plan)

    return {"status": "ok"}


@router.get("/api/subscription/status", response_model=SubscriptionStatusResponse)
def subscription_status(session_id: UUID) -> SubscriptionStatusResponse:
    """Return the current plan and subscription status for a session."""

    status = get_subscription_status(session_id)
    return SubscriptionStatusResponse(plan=status.plan, status=status.status)


@router.get("/api/jobs/selected")
def selected_jobs(session_id: UUID, db: Session = Depends(get_db)) -> Dict[str, list]:
    """Return the job IDs selected for this session."""

    selected = list_job_selections(db, session_id)
    return {"job_ids": selected}


@router.post("/api/ingest/refresh")
def ingest_refresh(db: Session = Depends(get_db)) -> Dict[str, int]:
    """Trigger a manual ATS ingestion refresh (dev only)."""

    totals = refresh_all_jobs(db)
    return totals
