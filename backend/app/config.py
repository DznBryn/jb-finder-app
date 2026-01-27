from __future__ import annotations

import os

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

# Storage
S3_BUCKET = os.getenv("S3_BUCKET", "")

# LLM
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5")

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_MONTHLY = os.getenv("STRIPE_PRICE_MONTHLY", "")
STRIPE_PRICE_ONETIME = os.getenv("STRIPE_PRICE_ONETIME", "")
STRIPE_WEBHOOK_BYPASS = os.getenv("STRIPE_WEBHOOK_BYPASS", "false").lower() == "true"

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ATS ingestion
GREENHOUSE_TOKENS = [
    token.strip()
    for token in os.getenv("GREENHOUSE_TOKENS", "").split(",")
    if token.strip()
]
