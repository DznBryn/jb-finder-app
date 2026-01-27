from __future__ import annotations

import logging

from app.db import SessionLocal, init_db
from app.logging_config import configure_logging
from app.schedulers.ingestion_service import refresh_all_jobs


def main() -> None:
    """Run a one-off ingestion refresh."""

    configure_logging()
    logger = logging.getLogger("ingestion")
    init_db()
    db = SessionLocal()
    try:
        logger.info("Starting ATS refresh")
        totals = refresh_all_jobs(db)
        logger.info("Refresh complete totals=%s", totals)
    finally:
        db.close()


if __name__ == "__main__":
    main()
