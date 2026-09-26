from __future__ import annotations

import hashlib

from parsers.base import content_hash  # the SAME statementHash logic every other importer already uses
from .models import ExamPair, ExtractedQuestion

# Reuses parsers.base.content_hash (NFKD-fold + lowercase + collapse
# whitespace, then SHA-256) rather than reimplementing normalization —
# this is the "statementHash normalizado" the spec asks for, and staying
# on the one existing implementation means a question imported through
# this pipeline dedups correctly against one imported through the older
# PDF-course-material importers too.

statement_hash = content_hash


def pair_fingerprint(pair: ExamPair) -> str:
    """A strong fingerprint for a whole (exam, answer_key) pair — used to
    recognize "this exact prova+gabarito combination was already
    processed" independent of any single question's content.
    """
    parts = [
        pair.board,
        pair.institution,
        pair.role or "",
        str(pair.year or ""),
        pair.test_type or "",
    ]
    normalized = "|".join(p.strip().lower() for p in parts)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def split_new_and_duplicate(
    questions: list[ExtractedQuestion],
    existing_hashes: set[str],
) -> tuple[list[ExtractedQuestion], list[tuple[ExtractedQuestion, str]]]:
    """Splits `questions` into (new, duplicates) against `existing_hashes`
    — statementHash values already known, from Firestore and/or an
    earlier chunk of the same local batch (the caller merges both into
    one set before calling this, so a question can't slip through by
    being "new" relative to Firestore alone while duplicating something
    three documents earlier in the same run). Never overwrites or
    removes anything — this only decides what NOT to send onward.
    """
    new: list[ExtractedQuestion] = []
    duplicates: list[tuple[ExtractedQuestion, str]] = []
    seen_this_batch: set[str] = set()

    for question in questions:
        h = statement_hash(question.statement)
        if h in existing_hashes or h in seen_this_batch:
            duplicates.append((question, h))
            continue
        seen_this_batch.add(h)
        new.append(question)

    return new, duplicates
