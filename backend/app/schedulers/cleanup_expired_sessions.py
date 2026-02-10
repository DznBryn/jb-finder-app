"""One-off or cron script: delete expired resume_sessions rows from the database."""

from __future__ import annotations

import logging
import os

from app.db import SessionLocal, init_db
from app.logging_config import configure_logging
from app.services.session_service import delete_expired_sessions


def main() -> None:
    configure_logging()
    logger = logging.getLogger("cleanup_sessions")
    if os.getenv("APP_ENV", "production").lower() == "development":
        init_db()
    db = SessionLocal()
    try:
        deleted = delete_expired_sessions(db)
        logger.info("Deleted %d expired resume_sessions", deleted)
    finally:
        db.close()


if __name__ == "__main__":
    main()
