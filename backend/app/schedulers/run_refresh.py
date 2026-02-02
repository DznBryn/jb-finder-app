from __future__ import annotations

import logging

from app.db import SessionLocal, init_db
from app.logging_config import configure_logging
from app.schedulers.ingestion_service import refresh_all_jobs
from app.services.refresh_queue import claim_next_job, mark_job_failed, mark_job_success


def main() -> None:
    """Run a one-off ingestion refresh."""

    configure_logging()
    logger = logging.getLogger("ingestion")
    init_db()
    db = SessionLocal()
    try:
        job = claim_next_job(db)
        if not job:
            logger.info("No refresh jobs queued.")
            return
        logger.info("Starting ATS refresh job_id=%s", job.id)
        totals = refresh_all_jobs(db)
        mark_job_success(db, job, totals)
        logger.info("Refresh complete job_id=%s totals=%s", job.id, totals)
    except Exception as exc:  # noqa: BLE001
        if "job" in locals() and job:
            mark_job_failed(db, job, str(exc))
        logger.exception("Refresh failed")
    finally:
        db.close()


if __name__ == "__main__":
    main()
