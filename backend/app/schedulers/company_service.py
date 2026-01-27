from __future__ import annotations

import json
from pathlib import Path
from typing import List

from sqlalchemy.orm import Session

from app.models.db_models import Company


def load_seed_companies(db: Session) -> None:
    """Load seed companies into DB if table is empty."""

    if db.query(Company).count() > 0:
        return

    base_path = Path(__file__).resolve().parent.parent / "schedulers"
    valid_seed_path = base_path / "companies_seed.valid.json"
    seed_path = base_path / "companies_seed.json"
    active_path = valid_seed_path if valid_seed_path.exists() else seed_path
    companies = json.loads(active_path.read_text())

    for company in companies:
        db.add(
            Company(
                name=company["name"],
                website=company.get("website"),
                greenhouse_token=company.get("greenhouse_token"),
            )
        )
    db.commit()


def list_companies(db: Session) -> List[Company]:
    """Return all company records."""

    return db.query(Company).all()
