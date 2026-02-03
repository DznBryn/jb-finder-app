from __future__ import annotations

import logging
from typing import Dict

from sqlalchemy.orm import Session

from app.schedulers.ats.greenhouse import fetch_jobs as fetch_greenhouse_jobs
from app.schedulers.company_service import list_companies, load_seed_companies
from app.services.jobs_service import upsert_jobs

logger = logging.getLogger("ingestion")


def refresh_all_jobs(db: Session) -> Dict[str, int]:
    """Ingest jobs from Greenhouse and Lever tokens."""

    totals = {"greenhouse": 0}

    load_seed_companies(db)
    companies = list_companies(db)
    logger.info("Refreshing jobs for %s companies", len(companies))

    for company in companies:
        if company.greenhouse_token:
            try:
                logger.info(
                    "Fetching Greenhouse jobs for %s (%s)",
                    company.name,
                    company.greenhouse_token,
                )
                jobs = fetch_greenhouse_jobs(company.greenhouse_token)
                totals["greenhouse"] += upsert_jobs(
                    db,
                    "greenhouse",
                    jobs,
                    company_id=company.id,
                    company_name=company.name,
                    company_industry=company.industry,
                )
                logger.info(
                    "Upserted %s jobs for %s", len(jobs), company.name
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Failed to ingest Greenhouse token=%s", company.greenhouse_token
                )

    logger.info("Refresh totals=%s", totals)
    return totals
