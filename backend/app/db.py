from __future__ import annotations

from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import DATABASE_URL

_is_pg = "postgresql" in DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    # Verify connections are alive before handing them out (guards against
    # stale connections behind Supabase pooler / PgBouncer).
    pool_pre_ping=True,
    # Startup parameter — works for direct connections; pooler may ignore it,
    # so the event listener below is the primary mechanism.
    connect_args={"options": "-c search_path=public"} if _is_pg else {},
)

# Set search_path every time a raw DBAPI connection is checked out from the
# pool. This fires *before* any transaction begins, so it cannot be rolled
# back and it applies even when the Supabase pooler rotates backend connections.
if _is_pg:

    @event.listens_for(engine, "connect")
    def _set_search_path(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("SET search_path TO public")
        cursor.close()

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
