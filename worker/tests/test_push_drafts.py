from tests.fakes import FakeFirestoreClient
from tests.helpers import make_parsed_question

from scripts import push_drafts


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
