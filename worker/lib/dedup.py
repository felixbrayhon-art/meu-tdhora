from __future__ import annotations

import re

# Extracted from worker/scripts/push_drafts.py so import_batch.py can reuse
# the exact same existence-check/ID logic without duplicating it.
# push_drafts.py's own internal-dedup loop is intentionally left as-is
# (imports sanitize_doc_id/fetch_existing_keys from here, but keeps its own
# behavior) — see push_drafts.py for why.

DEDUP_FIELDS = ["source", "externalId", "contentHash"]


def sanitize_doc_id(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", raw)[:1400]


def build_doc_id(source: str, external_id: str) -> str:
    return sanitize_doc_id(f"{source}_{external_id}")


# Full-collection scan rather than per-question queries: no composite index
# to set up, and it correctly catches drafts/questions created before
# deterministic doc IDs were introduced (their doc ID won't match
# `source_externalId`, but the fields still do). This reads O(existing bank
# size) on every run — fine at hundreds/thousands of questions.
# TODO: once `questions` grows into the hundreds of thousands, replace this
# with a dedicated dedup-index collection (e.g. `dedup_keys/{source_externalId}`
# and `content_hashes/{hash}`, each a tiny doc) so existence checks become
# O(1) lookups instead of a full scan. Not needed at the current scale.
def fetch_existing_keys(db) -> tuple[set[tuple[str, str]], set[str]]:
    pairs: set[tuple[str, str]] = set()
    hashes: set[str] = set()
    for collection_name in ("questions", "question_drafts"):
        for doc in db.collection(collection_name).select(DEDUP_FIELDS).stream():
            data = doc.to_dict() or {}
            source = data.get("source")
            external_id = data.get("externalId")
            if source and external_id:
                pairs.add((source, external_id))
            content_hash = data.get("contentHash")
            if content_hash:
                hashes.add(content_hash)
    return pairs, hashes


def dedup_internal(questions: list[dict]) -> tuple[list[dict], int]:
    """Removes duplicates WITHIN a single batch, by (source, externalId) and
    by contentHash — order-preserving, first occurrence wins. This is
    stricter than push_drafts.py's own within-batch check (which only looks
    at source+externalId), because import_batch.py explicitly needs to
    catch same-content questions that somehow got different externalIds.
    """
    seen_pairs: set[tuple[str, str]] = set()
    seen_hashes: set[str] = set()
    unique: list[dict] = []
    removed = 0
    for q in questions:
        key = (q["source"], q["externalId"])
        content_hash = q["contentHash"]
        if key in seen_pairs or content_hash in seen_hashes:
            removed += 1
            continue
        seen_pairs.add(key)
        seen_hashes.add(content_hash)
        unique.append(q)
    return unique, removed


def split_by_existing(
    questions: list[dict], existing_pairs: set[tuple[str, str]], existing_hashes: set[str]
) -> tuple[list[dict], int]:
    """Splits an already internally-deduped list into (new_questions, existing_count)
    by checking against keys already present in Firestore."""
    new_questions: list[dict] = []
    existing_count = 0
    for q in questions:
        key = (q["source"], q["externalId"])
        if key in existing_pairs or q["contentHash"] in existing_hashes:
            existing_count += 1
        else:
            new_questions.append(q)
    return new_questions, existing_count
