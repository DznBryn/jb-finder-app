from __future__ import annotations

import json
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.schemas import (
    ApplyPrepareRequest,
    ApplyPrepareResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    DeepAnalyzeRequest,
    DeepAnalyzeResponse,
    CheckoutRequest,
    CheckoutResponse,
    GreenhouseApplyRequest,
    JobSelectionRequest,
    JobSelectionResponse,
    MatchesRequest,
    MatchesResponse,
    SelectedJobDetail,
    SelectedJobsResponse,
    SessionProfile,
    SubscriptionStatusResponse,
)
from app.services.apply_service import prepare_cover_letter
from app.services.analysis_service import analyze_selected_jobs, deep_analyze_job
from app.services.greenhouse_service import retrieve_job_post, submit_application
from app.services.matching_service import build_matches
from app.services.jobs_service import list_jobs_by_ids
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
    list_job_selections,
    save_job_selections,
)
from app.services.storage_service import save_resume_file
from pprint import pprint

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
    pprint(f'Resume text: {resume_text}')
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
    """Store job selections for the session."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    accepted = list(payload.job_ids)
    rejected: list[str] = []

    if accepted:
        save_job_selections(db, payload.session_id, accepted)

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


@router.post("/api/checkout/create", response_model=CheckoutResponse)
def create_checkout(payload: CheckoutRequest) -> CheckoutResponse:
    """Create a Stripe Checkout session and return the hosted URL."""

    try:
        checkout_url = create_checkout_session(payload.session_id, payload.plan)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutResponse(checkout_url=checkout_url)


@router.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_selections(
    payload: AnalyzeRequest, db: Session = Depends(get_db)
) -> AnalyzeResponse:
    """Analyze selected jobs with the LLM and return grades."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    analysis = analyze_selected_jobs(db, session, payload.job_ids)
    return AnalyzeResponse(
        session_id=payload.session_id,
        results=analysis.get("results", []),
        best_match_job_id=analysis.get("best_match_job_id"),
    )


@router.post("/api/analyze/deep", response_model=DeepAnalyzeResponse)
def analyze_deep(
    payload: DeepAnalyzeRequest, db: Session = Depends(get_db)
) -> DeepAnalyzeResponse:
    """Deep analysis with learning resources for a single job."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    try:
        result = deep_analyze_job(db, session, payload.job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return DeepAnalyzeResponse(
        session_id=payload.session_id,
        job_id=result.get("job_id", payload.job_id),
        grade=result.get("grade", "D"),
        rationale=result.get("rationale", ""),
        missing_skills=result.get("missing_skills", []),
        learning_resources=result.get("learning_resources", []),
    )


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


@router.get("/api/jobs/selected/details", response_model=SelectedJobsResponse)
def selected_job_details(
    session_id: UUID, db: Session = Depends(get_db)
) -> SelectedJobsResponse:
    """Return job details for the selected job IDs."""

    selected = list_job_selections(db, session_id)
    jobs = list_jobs_by_ids(db, selected)
    mapped = [
        SelectedJobDetail(
            job_id=str(job.id),
            company=job.company_name,
            title=job.title,
            location=job.location,
            apply_url=job.apply_url,
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
    except Exception as exc:  # noqa: BLE001
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
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/api/ingest/refresh")
def ingest_refresh(db: Session = Depends(get_db)) -> Dict[str, int]:
    """Trigger a manual ATS ingestion refresh (dev only)."""

    totals = refresh_all_jobs(db)
    return totals
