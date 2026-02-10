from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from app.services.ai.llm_service import parse_resume_text


def _normalize(value: str) -> str:
    return value.lower().strip()


def _score_list(predicted: List[str], expected: List[str]) -> float:
    if not expected:
        return 1.0
    predicted_set = {_normalize(item) for item in predicted}
    expected_set = {_normalize(item) for item in expected}
    return len(predicted_set & expected_set) / len(expected_set)


def _score_case(result: Dict[str, object], expected: Dict[str, object]) -> Dict[str, float]:
    return {
        "skills_recall": _score_list(
            result.get("extracted_skills", []), expected.get("skills", [])
        ),
        "titles_recall": _score_list(
            result.get("inferred_titles", []), expected.get("titles", [])
        ),
        "seniority_match": 1.0
        if _normalize(result.get("seniority", "")) == _normalize(expected.get("seniority", ""))
        else 0.0,
        "years_experience_match": 1.0
        if int(result.get("years_experience", 0)) == int(expected.get("years_experience", 0))
        else 0.0,
    }


def main() -> None:
    cases_path = Path(__file__).with_name("resume_eval_cases.json")
    cases = json.loads(cases_path.read_text())

    scores: List[Dict[str, float]] = []
    for case in cases:
        result = parse_resume_text(case["resume_text"])
        metrics = _score_case(result, case["expected"])
        scores.append(metrics)
        print(f"Case {case['id']}: {metrics}")

    avg = {
        "skills_recall": sum(m["skills_recall"] for m in scores) / len(scores),
        "titles_recall": sum(m["titles_recall"] for m in scores) / len(scores),
        "seniority_match": sum(m["seniority_match"] for m in scores) / len(scores),
        "years_experience_match": sum(m["years_experience_match"] for m in scores)
        / len(scores),
    }
    print(f"Average: {avg}")


if __name__ == "__main__":
    main()
