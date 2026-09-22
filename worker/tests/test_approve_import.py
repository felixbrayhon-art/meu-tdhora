import pytest
from tests.fakes import FakeFirestoreClient
from tests.helpers import make_parsed_question

from scripts import approve_import


def seeded_db(*drafts, subject="Direito Penal", year=2025, import_id="import-1"):
    draft_docs = {}
    for q in drafts:
        data = q.to_dict()
        data["importSubject"] = subject
        data["importYear"] = year
        data["importId"] = import_id
        draft_docs[f"{data['source']}_{data['externalId']}"] = data
    return FakeFirestoreClient(
        seed={
            "imports": {import_id: {"importSubject": subject, "importYear": year}},
            "question_drafts": draft_docs,
        }
    )


def test_publish_writes_backup_before_first_batch(tmp_path):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    db = seeded_db(q)

    result = approve_import.run_pipeline(db, "import-1", "uid-test", backups_dir=tmp_path)

    assert result["published"] == 1
    assert result["backupPath"] is not None
    report_files = list(tmp_path.glob("*.json"))
    assert len(report_files) == 1

    assert db.dump("question_drafts") == {}
    published = db.dump("questions")
    assert len(published) == 1


def test_backup_failure_aborts_publication_entirely(monkeypatch, tmp_path):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    db = seeded_db(q)

    def boom(*args, **kwargs):
        raise OSError("disco cheio (simulado)")

    monkeypatch.setattr(approve_import, "write_backup", boom)

    with pytest.raises(SystemExit):
        approve_import.run_pipeline(db, "import-1", "uid-test", backups_dir=tmp_path)

    # Nothing published, draft untouched, imports doc untouched — the
    # failure must happen before any write batch runs.
    assert db.dump("questions") == {}
    drafts = db.dump("question_drafts")
    assert len(drafts) == 1

    imports_doc = db.dump("imports")["import-1"]
    assert "status" not in imports_doc or imports_doc.get("status") != "published"
    assert "publishedCount" not in imports_doc

    # And no backup file should exist either, since the write itself failed.
    assert list(tmp_path.glob("*.json")) == []


def test_missing_import_id_raises(tmp_path):
    db = FakeFirestoreClient()
    with pytest.raises(SystemExit):
        approve_import.run_pipeline(db, "does-not-exist", "uid-test", backups_dir=tmp_path)


def test_questions_with_warnings_are_skipped_by_default(tmp_path):
    clean_q = make_parsed_question(number=1, external_id="1", letters="ABCD", correct="B")
    flagged_q = make_parsed_question(number=2, external_id="2", letters="ABCD", correct="C", warnings=["revisar"])
    db = seeded_db(clean_q, flagged_q)

    result = approve_import.run_pipeline(db, "import-1", "uid-test", backups_dir=tmp_path)

    assert result["published"] == 1
    assert result["skippedWarnings"] == 1
    remaining_drafts = db.dump("question_drafts")
    assert len(remaining_drafts) == 1  # the flagged one is left untouched, not published
