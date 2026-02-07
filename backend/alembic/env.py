from __future__ import annotations

import os
import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    load_dotenv = None

if load_dotenv is not None:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env", override=False)
    load_dotenv(Path(__file__).resolve().parent.parent / "app" / ".env", override=False)

print(f"[alembic] AUTH_SCHEMA={os.getenv('AUTH_SCHEMA')}")

from sqlalchemy import text

from app.config import DATABASE_URL  # noqa: E402
from app.db import Base  # noqa: E402
from app.models import db_models  # noqa: F401, E402

config = context.config
fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section) or {},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Ensure app tables are always created in public. Only the auth migration
        # explicitly uses AUTH_SCHEMA for users/accounts/sessions/verification_token.
        if connectable.dialect.name == "postgresql":
            connection.execute(text("SET search_path TO public"))
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
