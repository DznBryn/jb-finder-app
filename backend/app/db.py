from __future__ import annotations

from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import DATABASE_URL

# Postgres (local Docker or Supabase pooler); both URL forms are common.
_is_pg = "postgresql" in DATABASE_URL or DATABASE_URL.strip().startswith("postgres://")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": "-c search_path=public"} if _is_pg else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    """Create database tables if they do not exist."""
    
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Provide a database session for request-scoped dependencies.

    With Supabase's transaction-mode pooler (PgBouncer, port 6543), each
    transaction can land on a different Postgres backend. SET commands from
    a previous transaction do not carry over. So we must run
    SET search_path TO public inside every request's transaction — not just
    once at connection creation.
    """

    db = SessionLocal()
    search_path = db.execute(text("show search_path")).scalar()
    print(f"Search path: {search_path}")
    try:
        if _is_pg:
            db.execute(text("SET LOCAL search_path TO public"))
        yield db
    finally:
        db.close()
