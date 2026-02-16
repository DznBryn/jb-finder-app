from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - optional for prod
    load_dotenv = None


def _load_local_env() -> None:
    if os.getenv("APP_ENV") or os.getenv("DATABASE_URL"):
        return
    if load_dotenv is None:
        return
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env", override=False)
    load_dotenv(Path(__file__).resolve().parent / ".env", override=False)


_load_local_env()

APP_ENV = os.getenv("APP_ENV", "production").lower()

# Server (production platforms like Railway set PORT; default 8000 for local/Docker)
PORT = int(os.getenv("PORT", "8000"))

# Database
def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    if APP_ENV == "development":
        return "postgresql+psycopg2://jb_finder:jb_finder_password@localhost:5433/jb_finder"
    raise RuntimeError("DATABASE_URL is required when APP_ENV is not development.")


DATABASE_URL = _database_url()

# Storage
S3_BUCKET = os.getenv("S3_BUCKET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# Server-side only. Use Supabase `service_role` key (never expose to frontend).
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "resumes")

# LLM
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5")
OPENAI_MODEL_CHEAP = os.getenv("OPENAI_MODEL_CHEAP", "gpt-5-nano")
OPENAI_RESUME_MAX_OUTPUT_TOKENS = int(os.getenv("OPENAI_RESUME_MAX_OUTPUT_TOKENS", "1500"))
# Max concurrent threads for parallel skill extraction (analyze_selected_jobs). I/O-bound LLM calls.
LLM_SKILL_EXTRACT_MAX_WORKERS = int(os.getenv("LLM_SKILL_EXTRACT_MAX_WORKERS", "8"))

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_MONTHLY = os.getenv("STRIPE_PRICE_MONTHLY", "")
STRIPE_PRICE_ONETIME = os.getenv("STRIPE_PRICE_ONETIME", "")
STRIPE_PRICE_MONTHLY_BASIC = os.getenv("STRIPE_PRICE_MONTHLY_BASIC", "")  # $9.99/mo - 500 credits
STRIPE_PRICE_MONTHLY_PRO = os.getenv("STRIPE_PRICE_MONTHLY_PRO", "")  # $24.99/mo - 2500 credits
STRIPE_PRICE_TOPUP_SMALL = os.getenv("STRIPE_PRICE_TOPUP_SMALL", "")  # $4.99 - 200/300 credits
STRIPE_PRICE_TOPUP_LARGE = os.getenv("STRIPE_PRICE_TOPUP_LARGE", "")  # $19.99 - 1000/1500 credits
STRIPE_WEBHOOK_BYPASS = os.getenv("STRIPE_WEBHOOK_BYPASS", "false").lower() == "true"
FRONTEND_URL = (os.getenv("FRONTEND_URL", "") or "http://localhost:3000").strip().rstrip("/")

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ATS ingestion
GREENHOUSE_TOKENS = [
    token.strip()
    for token in os.getenv("GREENHOUSE_TOKENS", "").split(",")
    if token.strip()
]

# Greenhouse applications
GREENHOUSE_API_KEY = os.getenv("GREENHOUSE_API_KEY", "")

# Auth schema for NextAuth/Auth.js users table. Use "public" if users live in public schema (local dev),
# "next_auth" if using NextAuth with a dedicated schema, or "auth" on Supabase.
_AUTH_SCHEMA_RAW = (os.getenv("AUTH_SCHEMA", "") or "").strip()
AUTH_SCHEMA = "".join(c for c in _AUTH_SCHEMA_RAW if c.isalnum() or c == "_") or "public"

# Internal API key for server-to-server calls (Next.js server -> backend). Required for /api/user/*.
# Do not expose to the client. Set BACKEND_INTERNAL_API_KEY in Next.js and INTERNAL_API_KEY here (same value).
INTERNAL_API_KEY = (os.getenv("INTERNAL_API_KEY", "") or os.getenv("BACKEND_INTERNAL_API_KEY", "")).strip()

# Memory logging
MEM_LOG_ENABLED = os.getenv("MEM_LOG_ENABLED", "false").lower() == "true"