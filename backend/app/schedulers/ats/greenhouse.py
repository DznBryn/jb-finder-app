from __future__ import annotations

from datetime import datetime
from typing import List

import requests
from bs4 import BeautifulSoup



def _strip_html(html: str) -> str:
    """Convert HTML to plain text."""

    return BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)


def fetch_jobs(board_token: str) -> List[dict]:
    """Fetch jobs from the Greenhouse public job board API."""

    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    data = response.json()

    jobs = []
    for job in data.get("jobs", []):
        job_id = str(job.get("id"))
        pay_ranges = []
        try:
            detail_url = (
                "https://boards-api.greenhouse.io/v1/boards/"
                f"{board_token}/jobs/{job_id}?pay_transparency=true"
            )
            detail_resp = requests.get(detail_url, timeout=15)
            if detail_resp.status_code == 200:
                detail = detail_resp.json()
                pay_ranges = detail.get("pay_input_ranges", []) or []
        except Exception:
            pay_ranges = []
        jobs.append(
            {
                "source_job_id": job_id,
                "company": board_token,
                "title": job.get("title", ""),
                "location": job.get("location", {}).get("name", ""),
                "apply_url": job.get("absolute_url", ""),
                "description": _strip_html(job.get("content", "")),
                "updated_at": job.get("updated_at") or datetime.utcnow().isoformat(),
                "pay_ranges": pay_ranges,
            }
        )
    return jobs
