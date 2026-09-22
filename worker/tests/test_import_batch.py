import json

import pytest
from tests.fakes import FakeFirestoreClient
from tests.helpers import FakeSourceModule, make_parsed_question

from scripts import import_batch


def test_import_subject_and_year_preserved_on_drafts(monkeypatch):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([q]))

    db = FakeFirestoreClient()
    import_batch.run_pipeline("fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test")

    drafts = db.dump("question_drafts")
    assert len(drafts) == 1
    draft = next(iter(drafts.values()))
    assert draft["importSubject"] == "Direito Penal"
    assert draft["importYear"] == 2025
    # subjectRaw/topicRaw (the parser's own classification) must stay untouched
    assert draft["subjectRaw"] == "Materia de Teste"
    assert draft["topicRaw"] == "Assunto de Teste"


def test_dry_run_writes_nothing(monkeypatch):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([q]))

    db = FakeFirestoreClient()
    result = import_batch.run_pipeline("fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test", dry_run=True)

    assert db.dump("imports") == {}
    assert db.dump("question_drafts") == {}
    assert db.dump("questions") == {}
    assert result["newQuestions"] == 1
    assert result["importId"] is None


def test_publish_preserves_all_required_fields(monkeypatch, tmp_path):
    q = make_parsed_question(
        external_id="1", letters="ABCD", correct="B", subject_raw="Dos Crimes contra o Patrimonio", topic_raw="Furto"
    )
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([q]))

    db = FakeFirestoreClient()
    result = import_batch.run_pipeline(
        "fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test", publish=True, backups_dir=tmp_path
    )

    assert result["publishedCount"] == 1
    published = db.dump("questions")
    assert len(published) == 1
    doc = next(iter(published.values()))

    required_fields = [
        "source", "externalId", "importSubject", "importYear", "questionType",
        "subjectRaw", "topicRaw", "statement", "alternatives", "correctLetter",
        "explanation", "contentHash", "approvedAt", "approvedBy",
    ]
    for field in required_fields:
        assert field in doc, f"campo ausente na questão publicada: {field}"

    assert doc["importSubject"] == "Direito Penal"
    assert doc["importYear"] == 2025
    assert doc["subjectRaw"] == "Dos Crimes contra o Patrimonio"
    assert doc["topicRaw"] == "Furto"
    assert doc["approvedBy"] == "uid-test"

    # the draft must be gone once published — never left dangling
    assert db.dump("question_drafts") == {}

    imports = db.dump("imports")
    import_doc = next(iter(imports.values()))
    assert import_doc["status"] == "published"
    assert import_doc["publishedCount"] == 1


def test_questions_with_warnings_are_excluded_before_draft_creation(monkeypatch, tmp_path):
    clean_q = make_parsed_question(number=1, external_id="1", letters="ABCD", correct="B")
    flagged_q = make_parsed_question(number=2, external_id="2", letters="ABCD", correct="C", warnings=["revisar manualmente"])
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([clean_q, flagged_q]))

    db = FakeFirestoreClient()
    result = import_batch.run_pipeline(
        "fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test", publish=True,
        backups_dir=tmp_path, excluded_dir=tmp_path,
    )

    assert result["excludedQuestions"] == 1
    assert result["publishedCount"] == 1  # only the clean one

    published = db.dump("questions")
    assert len(published) == 1

    # the flagged one never becomes a draft at all — not left pending, not published
    remaining_drafts = db.dump("question_drafts")
    assert remaining_drafts == {}

    imports = db.dump("imports")
    import_doc = next(iter(imports.values()))
    assert import_doc["excludedQuestions"] == 1
    assert import_doc["excluded"] == [{"number": 2, "externalId": "2", "reasons": ["revisar manualmente"]}]

    # excluded question's full content is preserved in the local audit report
    report_files = list(tmp_path.glob("*.json"))
    assert any("direito-penal" in f.name for f in report_files)


def test_excluded_report_written_locally_for_audit(monkeypatch, tmp_path):
    flagged_q = make_parsed_question(external_id="1", letters="ABCD", correct="B", warnings=["algo pendente"])
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([flagged_q]))

    db = FakeFirestoreClient()
    # No valid questions at all in this batch — nothing to publish, but the
    # excluded one must still be recorded for audit (import doc + drafts
    # aren't created since there's nothing new to stage).
    result = import_batch.run_pipeline(
        "fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test", excluded_dir=tmp_path
    )
    assert result["excludedQuestions"] == 1
    assert result["newQuestions"] == 0
    assert result["importId"] is not None  # still recorded, even with 0 new questions
    assert db.dump("question_drafts") == {}

    report_files = list(tmp_path.glob("*.json"))
    assert len(report_files) == 1
    reported = json.loads(report_files[0].read_text(encoding="utf-8"))
    assert len(reported) == 1
    assert reported[0]["externalId"] == "1"

    imports = db.dump("imports")
    import_doc = next(iter(imports.values()))
    assert import_doc["status"] == "no_new_questions"
    assert import_doc["excludedQuestions"] == 1


def test_publish_error_aborts_before_writing_anything(monkeypatch, tmp_path):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([q]))
    # Force the final pre-publish gate to fail, simulating an inconsistency
    # caught right before the irreversible write.
    monkeypatch.setattr(import_batch, "validate_before_publish", lambda draft, subject, year: ["erro forçado para teste"])

    db = FakeFirestoreClient()
    with pytest.raises(SystemExit):
        import_batch.run_pipeline(
            "fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test", publish=True, backups_dir=tmp_path
        )

    assert db.dump("questions") == {}, "nada deveria ter sido publicado"
    drafts = db.dump("question_drafts")
    assert len(drafts) == 1, "o draft deveria ter sido preservado, não apagado"

    imports = db.dump("imports")
    import_doc = next(iter(imports.values()))
    assert import_doc["status"] == "publish_aborted"


def test_no_new_questions_when_everything_is_duplicate(monkeypatch):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    monkeypatch.setitem(import_batch.PARSERS, "fc_concursos", FakeSourceModule([q]))

    db = FakeFirestoreClient(
        seed={"questions": {"existing": {"source": "fc_concursos", "externalId": "1", "contentHash": q.content_hash}}}
    )
    result = import_batch.run_pipeline("fake.pdf", "Direito Penal", 2025, db, lambda: "uid-test", publish=True)

    assert result["newQuestions"] == 0
    assert db.dump("imports") == {}
    assert db.dump("question_drafts") == {}
