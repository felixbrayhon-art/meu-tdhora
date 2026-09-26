from __future__ import annotations

from exam_discovery.dedup import statement_hash
from exam_discovery.firestore_sync import build_question_fields, fetch_existing_content_hashes, sync_pair
from exam_discovery.models import DiscoveredDocument, ExamPair, ExtractedQuestion
from tests.fakes import FakeFirestoreClient


def _pair() -> ExamPair:
    exam = DiscoveredDocument(
        source_url="x", download_url="x-1", discovered_at="2026-01-01T00:00:00Z",
        board="FGV", institution="PCMG", exam_name="Concurso PCMG 2024",
        role="Investigador de Polícia I", year=2024, test_type="1", document_type="exam", title="Tipo 1",
    )
    return ExamPair(
        board="FGV", institution="PCMG", role="Investigador de Polícia I", year=2024,
        test_type="1", exam_doc=exam, answer_key_doc=None, status="ready", reason=None,
    )


def _question(number=1, annulled=False) -> ExtractedQuestion:
    alts = [{"letter": l, "text": f"alt {l}"} for l in "ABCDE"]
    return ExtractedQuestion(
        question_number=number, subject="Direito Penal", statement=f"Enunciado {number}.",
        alternatives=alts, official_answer=None if annulled else "A",
        official_answer_text=None if annulled else "alt A", annulled=annulled, status="valid", warnings=[],
    )


def test_build_question_fields_sets_pending_for_normal_question():
    fields = build_question_fields(_pair(), _question(1))
    assert fields["source"] == "official_exam"
    assert fields["explanationStatus"] == "pending"
    assert fields["annulled"] is False


def test_build_question_fields_sets_annulled_status_for_annulled_question():
    fields = build_question_fields(_pair(), _question(1, annulled=True))
    assert fields["explanationStatus"] == "annulled"
    assert fields["annulled"] is True
    assert fields["officialAnswer"] is None


def test_dry_run_never_touches_db_and_reports_what_would_be_written():
    pair = _pair()
    questions = [_question(1), _question(2)]
    report = sync_pair(pair, questions, db=None, commit=False)
    assert report.committed is False
    assert len(report.would_write) == 2
    assert report.written_ids == []


def test_dry_run_works_even_with_db_none():
    # The whole point of dry-run defaulting everywhere: no Firestore
    # client is required to see what an import WOULD do.
    report = sync_pair(_pair(), [_question(1)], db=None, commit=False)
    assert report.would_write[0]["questionNumber"] == 1


def test_commit_writes_new_questions():
    db = FakeFirestoreClient()
    report = sync_pair(_pair(), [_question(1), _question(2)], db=db, commit=True)
    assert report.committed is True
    assert len(report.written_ids) == 2
    stored = db._store.get("questions", {})
    assert len(stored) == 2


def test_commit_never_overwrites_an_existing_question():
    db = FakeFirestoreClient()
    pair = _pair()
    q1 = _question(1)

    first_report = sync_pair(pair, [q1], db=db, commit=True)
    doc_id = first_report.written_ids[0]
    db.collection("questions").document(doc_id).set({**db._store["questions"][doc_id], "explanationStatus": "approved"})

    second_report = sync_pair(pair, [q1], db=db, commit=True)

    assert second_report.written_ids == []
    assert doc_id in second_report.skipped_existing_ids
    # The manual edit above (simulating a human-approved explanation) survived.
    assert db._store["questions"][doc_id]["explanationStatus"] == "approved"


def test_commit_without_db_raises():
    import pytest

    with pytest.raises(ValueError):
        sync_pair(_pair(), [_question(1)], db=None, commit=True)


# --- fetch_existing_content_hashes: pre-commit, cross-run dedup --------

def test_fetch_existing_hashes_returns_empty_set_for_none_db():
    assert fetch_existing_content_hashes(None, "FGV", "PCMG", "Investigador de Polícia I", 2024) == set()


def test_fetch_existing_hashes_finds_matching_group_documents():
    db = FakeFirestoreClient()
    db.collection("questions").document("q1").set(
        {"board": "FGV", "institution": "PCMG", "role": "Investigador de Polícia I", "year": 2024,
         "contentHash": "hash-abc"}
    )
    db.collection("questions").document("q2").set(
        {"board": "FGV", "institution": "PCMG", "role": "Investigador de Polícia I", "year": 2024,
         "contentHash": "hash-def"}
    )
    hashes = fetch_existing_content_hashes(db, "FGV", "PCMG", "Investigador de Polícia I", 2024)
    assert hashes == {"hash-abc", "hash-def"}


def test_fetch_existing_hashes_never_leaks_across_groups():
    db = FakeFirestoreClient()
    db.collection("questions").document("q1").set(
        {"board": "FGV", "institution": "PCMG", "role": "Investigador de Polícia I", "year": 2024,
         "contentHash": "hash-pcmg"}
    )
    db.collection("questions").document("q2").set(
        {"board": "FGV", "institution": "OUTRA", "role": "Outro Cargo", "year": 2024,
         "contentHash": "hash-outra"}
    )
    hashes = fetch_existing_content_hashes(db, "FGV", "PCMG", "Investigador de Polícia I", 2024)
    assert hashes == {"hash-pcmg"}


def test_a_question_already_imported_in_an_earlier_run_is_seen_as_duplicate_before_commit():
    # Simulates the exact gap this fix closes: an earlier, separate run
    # already committed this question; a fresh run must recognize it as
    # a duplicate BEFORE writing anything, using only a Firestore read —
    # not sync_pair's own per-doc_id check (a different scenario).
    db = FakeFirestoreClient()
    pair = _pair()
    q1 = _question(1)
    db.collection("questions").document("some-other-doc-id-from-a-previous-run").set(
        {
            "board": pair.board, "institution": pair.institution, "role": pair.role, "year": pair.year,
            "contentHash": statement_hash(q1.statement),
        }
    )

    existing_hashes = fetch_existing_content_hashes(db, pair.board, pair.institution, pair.role, pair.year)
    from exam_discovery.dedup import split_new_and_duplicate

    new, duplicates = split_new_and_duplicate([q1], existing_hashes=existing_hashes)
    assert new == []
    assert len(duplicates) == 1
