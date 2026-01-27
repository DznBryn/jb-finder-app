from __future__ import annotations

from typing import List


def get_sample_jobs() -> List[dict]:
    """Return a small set of mock jobs for MVP UI testing.

    Replace this with real Greenhouse/Lever ingestion later.
    """

    return [
        {
            "job_id": "gh_001",
            "company": "Acme Corp",
            "title": "Senior Backend Engineer",
            "location": "Remote",
            "skills": ["python", "fastapi", "postgres"],
            "apply_url": "https://boards.greenhouse.io/stripe/jobs/1",
        },
        {
            "job_id": "lv_002",
            "company": "Beta Labs",
            "title": "Product Designer",
            "location": "New York, NY",
            "skills": ["figma", "ux", "research"],
            "apply_url": "https://jobs.lever.co/betalabs/2",
        },
    ]
