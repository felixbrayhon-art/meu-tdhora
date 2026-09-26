from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from .dedup import statement_hash
from .models import ExamPair, ExtractedQuestion

# Mirrors worker/lib/publish.py's own pattern (existence check right
# before writing, chunked batches under Firestore's 500-op cap) — this
# module intentionally does not invent a new write style. `commit=False`
# (the default everywhere in this package) means NOTHING here ever calls
# `db`; sync_pair can be exercised in tests with `db=None`.
WRITE_CHUNK_SIZE = 400


@dataclass
class SyncReport:
    pair: ExamPair
    would_write: list[dict] = field(default_factory=list)  # dry-run: what WOULD be written
    written_ids: list[str] = field(default_factory=list)  # commit: what WAS written
    skipped_existing_ids: list[str] = field(default_factory=list)  # already in Firestore — never touched
    committed: bool = False


def _doc_id(pair: ExamPair, question: ExtractedQuestion) -> str:
    """Deterministic, stable per (pair, question) — re-running the same
    discovery never produces a different id for the same question, so the
    existence check below is meaningful across runs, not just within one.
    """
    parts = [
        pair.board,
        pair.institution,
        pair.role or "",
        str(pair.year or ""),
        pair.test_type or "",
        str(question.question_number),
    ]
    normalized = "|".join(p.strip().lower() for p in parts)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]


def fetch_existing_content_hashes(
    db,
    board: str,
    institution: str,
    role: str | None,
    year: int | None,
    collection: str = "questions",
) -> set[str]:
    """Queries Firestore for every `contentHash` already stored for this
    (board, institution, role, year) group — the piece that was missing
    before: without this, dedup only ever caught duplicates WITHIN one
    run (exam_discovery.dedup.split_new_and_duplicate's `existing_hashes`
    started empty every time), so a second, separate run of the same
    concurso could re-import the same statements under new doc_ids if
    they'd ever drifted from the deterministic _doc_id scheme. Scoped to
    one group (not a full-collection scan) so it stays cheap as the
    `questions` collection grows. Returns an empty set for db=None (dry
    run never needs — and never gets — a real Firestore read).
    """
    if db is None:
        return set()

    query = (
        db.collection(collection)
        .where("board", "==", board)
        .where("institution", "==", institution)
        .where("year", "==", year)
    )
    if role is not None:
        query = query.where("role", "==", role)

    hashes: set[str] = set()
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        content_hash_value = data.get("contentHash")
        if content_hash_value:
            hashes.add(content_hash_value)
    return hashes


def build_question_fields(pair: ExamPair, question: ExtractedQuestion) -> dict:
    fields = {
        "source": "official_exam",
        "board": pair.board,
        "institution": pair.institution,
        "role": pair.role,
        "year": pair.year,
        "testType": pair.test_type,
        "examName": pair.exam_doc.exam_name,
        "questionNumber": question.question_number,
        "subject": question.subject,
        "statement": question.statement,
        "alternatives": question.alternatives,
        "officialAnswer": question.official_answer,
        "officialAnswerText": question.official_answer_text,
        "annulled": question.annulled,
        "contentHash": statement_hash(question.statement),
        "explanationStatus": "annulled" if question.annulled else "pending",
    }
    return fields


def sync_pair(
    pair: ExamPair,
    questions: list[ExtractedQuestion],
    db,
    commit: bool = False,
    collection: str = "questions",
) -> SyncReport:
    """Dry-run by default (commit=False): computes exactly what WOULD be
    written and returns it, without ever touching `db` — `db` may even be
    None in this mode, which is what every test in this package uses.
    commit=True is the ONLY path that writes, and even then a doc_id
    already present in Firestore is left completely untouched (its
    fields are never re-set, its explanationStatus never overwritten) —
    this function only ever ADDS new question documents.
    """
    report = SyncReport(pair=pair)

    entries = [(_doc_id(pair, q), build_question_fields(pair, q), q) for q in questions]

    if not commit:
        report.would_write = [fields for _, fields, _ in entries]
        return report

    if db is None:
        raise ValueError("commit=True requires a real Firestore client (db)")

    refs = [db.collection(collection).document(doc_id) for doc_id, _, _ in entries]
    existing_ids: set[str] = set()
    if refs:
        snapshots = db.get_all(refs)
        existing_ids = {snap.id for snap in snapshots if snap.exists}

    to_write = [(doc_id, fields) for doc_id, fields, _ in entries if doc_id not in existing_ids]
    report.skipped_existing_ids = sorted(existing_ids)

    for start in range(0, len(to_write), WRITE_CHUNK_SIZE):
        chunk = to_write[start : start + WRITE_CHUNK_SIZE]
        batch = db.batch()
        for doc_id, fields in chunk:
            batch.set(db.collection(collection).document(doc_id), fields)
        batch.commit()
        report.written_ids.extend(doc_id for doc_id, _ in chunk)

    report.committed = True
    return report
