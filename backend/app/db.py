from __future__ import annotations

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import DATABASE_URL

# Force search_path to public so "jobs", "resume_sessions", etc. resolve even if
# the DB user's default schema (e.g. on Supabase) is different.
engine = create_engine(
    DATABASE_URL,
    connect_args={"options": "-c search_path=public"} if "postgresql" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    """Create database tables if they do not exist."""

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Provide a database session for request-scoped dependencies."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
