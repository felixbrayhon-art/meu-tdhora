from __future__ import annotations

from pathlib import Path

from .db import DEFAULT_DB_PATH
from .evidence_augmentation import augment_missing_claims_with_sumulas
from .evidence_coverage import assess_evidence_coverage
from .evidence_enrichment import (
    enrich_articles_when_coverage_incomplete,
    enrich_referenced_articles,
    enrich_with_full_articles,
)
from .evidence_selector import select_question_evidence

# The full, shared evidence pipeline for one question — selection,
# enrichment (both kinds), coverage assessment, and súmula augmentation as
# a last resort. Factored out so worker/scripts/test_exam_retrieval.py,
# worker/scripts/test_exam_explanation.py and
# worker/scripts/batch_exam_explanations.py run the exact same sequence
# instead of three copies that could quietly drift apart.


def _merge_unique(*source_lists: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    merged: list[dict] = []
    for source_list in source_lists:
        for source in source_list:
            key = (source.get("diploma", ""), str(source.get("artigo", "")), source.get("referencia", ""))
            if key in seen:
                continue
            seen.add(key)
            merged.append(source)
    return merged


def build_evidence_for_question(
    statement: str,
    correct_text: str,
    subject: str | None = None,
    limit: int = 3,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> tuple[list[dict], dict]:
    sources = select_question_evidence(statement, correct_text, subject=subject, limit=limit, db_path=db_path)

    if not sources:
        return sources, assess_evidence_coverage(statement, correct_text, sources)

    # Both enrichment passes scan the ORIGINAL selector output, not each
    # other's output — `enrich_referenced_articles` in particular must
    # never scan a freshly-widened full-article text (which can be
    # thousands of characters, e.g. CF art. 5 with its 78 incisos) for
    # "art. N" mentions, or one relevant reference cascades into dozens of
    # unrelated ones pulled in only because they're cited SOMEWHERE inside
    # that huge unrelated article. `_merge_unique` combines both passes'
    # additions without duplicating a full-article row added by both.
    widened = enrich_with_full_articles(sources, db_path=db_path)
    referenced = enrich_referenced_articles(sources, db_path=db_path)
    sources = _merge_unique(widened, referenced)

    coverage = assess_evidence_coverage(statement, correct_text, sources)

    if coverage["status"] != "complete":
        sources = enrich_articles_when_coverage_incomplete(sources, coverage["status"], db_path=db_path)
        coverage = assess_evidence_coverage(statement, correct_text, sources)

    if coverage["status"] != "complete":
        sources, coverage = augment_missing_claims_with_sumulas(statement, correct_text, sources, coverage)

    return sources, coverage
