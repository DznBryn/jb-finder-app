from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.routes import router
from app.db import init_db
from app.logging_config import configure_logging
from app.rate_limiter import limiter

from app.config import FRONTEND_URL

def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""

    app = FastAPI(title="Hyreme.io API", version="1.0.0")
    configure_logging()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_URL or "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    init_db()
    return app


app = create_app()
