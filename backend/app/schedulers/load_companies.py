from __future__ import annotations

import json
from pathlib import Path

from app.db import SessionLocal, init_db
from app.models.db_models import Company


def main() -> None:
    init_db()
    base_path = Path(__file__).parent
    valid_seed_path = base_path / "companies_seed.valid.json"
    seed_path = base_path / "companies_seed.json"
    active_path = valid_seed_path if valid_seed_path.exists() else seed_path
    companies = json.loads(active_path.read_text())

    db = SessionLocal()
    try:
        for company in companies:
            record = (
                db.query(Company)
                .filter(Company.name == company["name"])
                .first()
            )
            if record:
                record.website = company.get("website") or record.website
                record.greenhouse_token = company.get("greenhouse_token")
                record.industry = company.get("industry") or record.industry
            else:
                db.add(
                    Company(
                        name=company["name"],
                        website=company.get("website"),
                        greenhouse_token=company.get("greenhouse_token"),
                        industry=company.get("industry"),
                    )
                )
        db.commit()
    finally:
        db.close()

    print(f"Loaded {len(companies)} companies into DB from {active_path.name}")


if __name__ == "__main__":
    main()
