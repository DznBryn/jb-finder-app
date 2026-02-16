from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import resource, logging, asyncio

from app.api.v1.routes import router
from app.db import init_db
from app.logging_config import configure_logging
from app.rate_limiter import limiter
from app.services.payment_service import _cleanup_subscriptions
from app.config import FRONTEND_URL, MEM_LOG_ENABLED

async def _log_memory_usage() -> None:
    while True:
        resource_usage = resource.getrusage(resource.RUSAGE_SELF)
        logging.getLogger("memory").info("RSS_MB=%.1f", resource_usage.ru_maxrss / 1024)
        await asyncio.sleep(60)

async def run_cleanup_subscriptions() -> None:
    while True:
        await asyncio.sleep(3600)
        await asyncio.to_thread(_cleanup_subscriptions)


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

    @app.on_event("startup")
    async def startup() -> None:
        init_db()
        if MEM_LOG_ENABLED:
            asyncio.create_task(_log_memory_usage())
        asyncio.create_task(run_cleanup_subscriptions())

    return app


app = create_app()
