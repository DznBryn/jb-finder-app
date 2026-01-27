from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import requests
def _is_greenhouse_valid(token: str) -> bool:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
    response = requests.get(url, timeout=30)
    return response.status_code == 200


def validate_seed(seed_path: Path) -> List[Dict[str, object]]:
    companies = json.loads(seed_path.read_text())
    valid: List[Dict[str, object]] = []

    for company in companies:
        greenhouse_token = company.get("greenhouse_token")
        if greenhouse_token and not _is_greenhouse_valid(greenhouse_token):
            company["greenhouse_token"] = None

        if company.get("greenhouse_token"):
            valid.append(company)

    return valid


def main() -> None:
    seed_path = Path(__file__).with_name("companies_seed.json")
    valid_companies = validate_seed(seed_path)

    output_path = Path(__file__).with_name("companies_seed.valid.json")
    output_path.write_text(json.dumps(valid_companies, indent=2))

    print(f"Validated {len(valid_companies)} companies. Output: {output_path}")


if __name__ == "__main__":
    main()
