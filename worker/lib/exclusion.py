from __future__ import annotations

"""Policy: a question with any warning, or status `needs_attention`, never
becomes a draft and is never published — it's dropped from the pipeline
entirely, before drafts are even created. No content, alternative or
gabarito is ever auto-corrected here; excluded questions are only ever
recorded (number/externalId/reasons) for local audit, never guessed at.
"""


def is_excluded(q: dict) -> bool:
    return bool(q.get("warnings")) or q.get("status") == "needs_attention"


def split_valid_and_excluded(questions: list[dict]) -> tuple[list[dict], list[dict]]:
    valid = [q for q in questions if not is_excluded(q)]
    excluded = [q for q in questions if is_excluded(q)]
    return valid, excluded


def excluded_summary(excluded: list[dict]) -> list[dict]:
    """Compact per-question record for the `imports` doc and terminal
    output — full question content lives only in the local audit report
    file (write_excluded_report in import_batch.py), never in Firestore.
    """
    return [
        {"number": q.get("number"), "externalId": q.get("externalId"), "reasons": list(q.get("warnings", []))}
        for q in excluded
    ]
