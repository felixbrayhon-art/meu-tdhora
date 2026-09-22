from __future__ import annotations

from firebase_admin import firestore

# 200 questions/chunk => ~400 ops (1 SET + 1 DELETE each), under Firestore's
# 500-op batch cap. Matches the size already exercised manually.
PUBLISH_CHUNK_SIZE = 200


def build_published_fields(draft: dict, approved_by: str) -> dict:
    return {
        "source": draft["source"],
        "externalId": draft["externalId"],
        "importSubject": draft.get("importSubject"),
        "importYear": draft.get("importYear"),
        "questionType": draft["questionType"],
        "subjectRaw": draft.get("subjectRaw"),
        "topicRaw": draft.get("topicRaw"),
        "statement": draft["statement"],
        "alternatives": draft["alternatives"],
        "correctLetter": draft.get("correctLetter"),
        "explanation": draft["explanation"],
        "contentHash": draft["contentHash"],
        "approvedAt": firestore.SERVER_TIMESTAMP,
        "approvedBy": approved_by,
    }


def filter_not_yet_published(db, draft_docs: list[tuple[str, dict]]) -> tuple[list[tuple[str, dict]], list[str]]:
    """Fresh, targeted existence check on `questions/{doc_id}` for exactly
    the IDs about to be published — guards against a race between the
    earlier full-scan dedup check and the actual moment of publishing.
    Returns (still_eligible, already_existing_ids).
    """
    if not draft_docs:
        return [], []
    refs = [db.collection("questions").document(doc_id) for doc_id, _ in draft_docs]
    snapshots = db.get_all(refs)
    existing_ids = {snap.id for snap in snapshots if snap.exists}
    still_eligible = [(doc_id, draft) for doc_id, draft in draft_docs if doc_id not in existing_ids]
    return still_eligible, sorted(existing_ids)


def publish_drafts(db, draft_docs: list[tuple[str, dict]], approved_by: str) -> int:
    """Publishes each (doc_id, draft) as `questions/{doc_id}` and deletes
    `question_drafts/{doc_id}` — both writes in the SAME atomic batch, so a
    draft is never removed without its corresponding question existing (or
    vice versa). Chunked to respect Firestore's per-batch operation limit.
    Each chunk commits independently: if a later chunk fails, everything
    committed before it stays published — the caller can inspect the
    returned count and retry the remainder via approve_import.py.
    """
    published = 0
    for start in range(0, len(draft_docs), PUBLISH_CHUNK_SIZE):
        chunk = draft_docs[start : start + PUBLISH_CHUNK_SIZE]
        batch = db.batch()
        for doc_id, draft in chunk:
            batch.set(db.collection("questions").document(doc_id), build_published_fields(draft, approved_by))
            batch.delete(db.collection("question_drafts").document(doc_id))
        batch.commit()
        published += len(chunk)
    return published
