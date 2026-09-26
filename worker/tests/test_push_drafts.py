from tests.fakes import FakeFirestoreClient
from tests.helpers import make_parsed_question

from scripts import push_drafts
from scripts.push_drafts import derive_batch_subject_year


def build_payload(*parsed_questions):
    return {
        "meta": {"title": "Deck de teste", "ownerEmail": "teste@exemplo.com"},
        "questions": [q.to_dict() for q in parsed_questions],
    }


def test_valid_question_becomes_draft(tmp_path):
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    db = FakeFirestoreClient()
    result = push_drafts.push(db, build_payload(q), "uid-test", excluded_dir=tmp_path)

    assert result["new"] == 1
    assert result["excluded"] == 0
    drafts = db.dump("question_drafts")
    assert len(drafts) == 1


def test_question_with_warnings_is_excluded_not_drafted(tmp_path):
    flagged = make_parsed_question(external_id="1", letters="ABCD", correct="B", warnings=["revisar"])
    db = FakeFirestoreClient()
    result = push_drafts.push(db, build_payload(flagged), "uid-test", excluded_dir=tmp_path)

    assert result["new"] == 0
    assert result["excluded"] == 1
    assert db.dump("question_drafts") == {}

    report_files = list(tmp_path.glob("*.json"))
    assert len(report_files) == 1


def test_derive_batch_subject_year_from_consistent_batch():
    questions = [
        {"importSubject": "Direito Administrativo", "importYear": 2026},
        {"importSubject": "Direito Administrativo", "importYear": 2026},
    ]
    subject, year, warnings = derive_batch_subject_year(questions)
    assert subject == "Direito Administrativo"
    assert year == 2026
    assert warnings == []


def test_derive_batch_subject_year_mixed_subject_returns_none_with_warning():
    questions = [
        {"importSubject": "Direito Administrativo", "importYear": 2026},
        {"importSubject": "Direito Penal", "importYear": 2026},
    ]
    subject, year, warnings = derive_batch_subject_year(questions)
    assert subject is None
    assert year == 2026
    assert any("importSubject" in w for w in warnings)


def test_derive_batch_subject_year_empty_batch_returns_none_no_warning():
    subject, year, warnings = derive_batch_subject_year([])
    assert subject is None
    assert year is None
    assert warnings == []


def test_push_writes_import_subject_and_year_onto_the_imports_doc(tmp_path):
    # This is the real bug reported: imports.importSubject/importYear were
    # never written even when every draft agreed on the same value, which
    # made approve_import.py's comparison fail against None and block an
    # otherwise-consistent batch.
    q1 = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    q2 = make_parsed_question(external_id="2", letters="ABCD", correct="B")
    payload = build_payload(q1, q2)
    for question in payload["questions"]:
        question["importSubject"] = "Direito Administrativo"
        question["importYear"] = 2026

    db = FakeFirestoreClient()
    result = push_drafts.push(db, payload, "uid-test", excluded_dir=tmp_path)

    assert result["importSubject"] == "Direito Administrativo"
    assert result["importYear"] == 2026
    import_doc = db.dump("imports")[result["importId"]]
    assert import_doc["importSubject"] == "Direito Administrativo"
    assert import_doc["importYear"] == 2026


def test_structural_problem_caught_even_without_parser_warning(tmp_path):
    # No `warnings` set by the parser, but the alternatives are structurally
    # broken (duplicate letters) — push_drafts.py must catch this itself,
    # the same bar import_batch.py applies.
    q = make_parsed_question(external_id="1", letters="ABCD", correct="B")
    payload = build_payload(q)
    payload["questions"][0]["alternatives"][1]["letter"] = "A"  # force a duplicate letter

    db = FakeFirestoreClient()
    result = push_drafts.push(db, payload, "uid-test", excluded_dir=tmp_path)

    assert result["new"] == 0
    assert result["excluded"] == 1
    assert db.dump("question_drafts") == {}
