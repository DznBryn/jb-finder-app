from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List

import requests
from bs4 import BeautifulSoup

# Max concurrent requests per board for pay-transparency detail fetches.
DETAIL_FETCH_WORKERS = 8

logger = logging.getLogger(__name__)


def _strip_html(html: str) -> str:
    """Convert HTML to plain text."""

    return BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)


def _fetch_pay_ranges(board_token: str, job_id: str) -> List[dict]:
    """Fetch pay_input_ranges for one job (used in parallel)."""
    try:
        detail_url = (
            "https://boards-api.greenhouse.io/v1/boards/"
            f"{board_token}/jobs/{job_id}?pay_transparency=true"
        )
        resp = requests.get(detail_url, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("pay_input_ranges", []) or []
    except Exception:
        pass
    return []


def fetch_jobs(board_token: str) -> List[dict]:
    """Fetch jobs from the Greenhouse public job board API."""

    t_start = time.perf_counter()

    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
    t_list_start = time.perf_counter()
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    data = response.json()
    t_list_elapsed = time.perf_counter() - t_list_start
    jobs_data = data.get("jobs", [])
    logger.info(
        "Greenhouse list request board=%s jobs=%s elapsed=%.2fs",
        board_token,
        len(jobs_data),
        t_list_elapsed,
    )

    if not jobs_data:
        return []

    # Fetch pay ranges in parallel (1 list request + N detail requests in parallel).
    pay_ranges_by_index: List[List[dict]] = [[] for _ in range(len(jobs_data))]
    t_pool_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        future_to_index = {
            executor.submit(_fetch_pay_ranges, board_token, str(job.get("id"))): i
            for i, job in enumerate(jobs_data)
        }
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            pay_ranges_by_index[idx] = future.result()
    t_pool_elapsed = time.perf_counter() - t_pool_start
    logger.info(
        "Greenhouse pay-transparency fetches board=%s jobs=%s workers=%s elapsed=%.2fs",
        board_token,
        len(jobs_data),
        DETAIL_FETCH_WORKERS,
        t_pool_elapsed,
    )

    jobs = []
    for i, job in enumerate(jobs_data):
        job_id = str(job.get("id"))
        pay_ranges = pay_ranges_by_index[i]
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
    t_total = time.perf_counter() - t_start
    logger.info(
        "Greenhouse fetch_jobs complete board=%s jobs=%s total=%.2fs",
        board_token,
        len(jobs),
        t_total,
    )
    return jobs
