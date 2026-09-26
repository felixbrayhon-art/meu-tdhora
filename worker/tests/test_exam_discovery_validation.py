from __future__ import annotations

from exam_discovery.models import DiscoveredDocument, ExamPair, ExtractedQuestion
from exam_discovery.validation import validate_extraction, validate_pair, validate_question


def _doc(document_type, test_type=None):
    return DiscoveredDocument(
        source_url="https://x/page", download_url=f"https://x/{document_type}.pdf",
        discovered_at="2026-01-01T00:00:00Z", board="FGV", institution="PCMG",
        exam_name="Concurso", role="Investigador de Polícia I", year=2024,
        test_type=test_type, document_type=document_type, title=document_type,
    )


def _ready_pair(test_type="1"):
    return ExamPair(
        board="FGV", institution="PCMG", role="Investigador de Polícia I", year=2024, test_type=test_type,
        exam_doc=_doc("exam", test_type=test_type), answer_key_doc=_doc("answer_key_final"),
        status="ready", reason=None,
    )


def _valid_question(number=1, letter="C") -> ExtractedQuestion:
    alts = [{"letter": l, "text": f"alternativa {l}"} for l in "ABCDE"]
    return ExtractedQuestion(
        question_number=number, subject="Direito Penal", statement="Enunciado válido.",
        alternatives=alts, official_answer=letter,
        official_answer_text=f"alternativa {letter}", annulled=False, status="valid", warnings=[],
    )


def _annulled_question(number=1) -> ExtractedQuestion:
    alts = [{"letter": l, "text": f"alternativa {l}"} for l in "ABCDE"]
    return ExtractedQuestion(
        question_number=number, subject="Direito Penal", statement="Enunciado anulado.",
        alternatives=alts, official_answer=None, official_answer_text=None,
        annulled=True, status="valid", warnings=[],
    )


# --- pair-level -----------------------------------------------------------

def test_ready_pair_with_final_key_is_valid():
    ok, errors = validate_pair(_ready_pair())
    assert ok is True
    assert errors == []


def test_waiting_pair_never_validates():
    pair = _ready_pair()
    pair.status = "waiting_final_key"
    pair.answer_key_doc = _doc("answer_key_preliminary")
    ok, errors = validate_pair(pair)
    assert ok is False
    assert any("ready" in e for e in errors)


def test_preliminary_key_never_releases_even_if_status_manually_ready():
    pair = _ready_pair()
    pair.answer_key_doc = _doc("answer_key_preliminary")  # inconsistent on purpose
    ok, errors = validate_pair(pair)
    assert ok is False
    assert any("answer_key_final" in e for e in errors)


def test_testtype_mismatch_between_exam_and_key_is_rejected():
    pair = _ready_pair(test_type="1")
    pair.answer_key_doc = _doc("answer_key_final", test_type="2")
    ok, errors = validate_pair(pair)
    assert ok is False
    assert any("testType mismatch" in e for e in errors)


# --- question-level ---------------------------------------------------------

def test_valid_question_passes():
    ok, errors = validate_question(_valid_question())
    assert ok is True
    assert errors == []


def test_annulled_question_with_correct_shape_passes():
    ok, errors = validate_question(_annulled_question())
    assert ok is True


def test_annulled_question_with_an_answer_set_is_rejected():
    q = _annulled_question()
    q.official_answer = "A"
    ok, errors = validate_question(q)
    assert ok is False
    assert any("officialAnswer" in e for e in errors)


def test_non_annulled_question_without_answer_is_rejected():
    q = _valid_question()
    q.official_answer = None
    ok, errors = validate_question(q)
    assert ok is False


def test_question_missing_an_alternative_is_rejected():
    q = _valid_question()
    q.alternatives = [a for a in q.alternatives if a["letter"] != "D"]
    ok, errors = validate_question(q)
    assert ok is False
    assert any("conjunto de alternativas" in e for e in errors)


def test_question_with_an_empty_alternative_text_is_rejected():
    # Same A-E letter SET present, but one is blank — a different defect
    # than a missing letter, and still correctly caught.
    q = _valid_question()
    for alt in q.alternatives:
        if alt["letter"] == "D":
            alt["text"] = "   "
    ok, errors = validate_question(q)
    assert ok is False
    assert any("alternativas incompletas" in e and "D" in e for e in errors)


def test_ce_item_with_valid_c_e_alternatives_passes():
    q = _valid_question()
    q.alternatives = [{"letter": "C", "text": "Certo"}, {"letter": "E", "text": "Errado"}]
    q.official_answer = "C"
    q.official_answer_text = "Certo"
    ok, errors = validate_question(q)
    assert ok is True
    assert errors == []


def test_ce_item_missing_the_e_alternative_is_rejected():
    q = _valid_question()
    q.alternatives = [{"letter": "C", "text": "Certo"}]
    q.official_answer = "C"
    q.official_answer_text = "Certo"
    ok, errors = validate_question(q)
    assert ok is False
    assert any("conjunto de alternativas" in e for e in errors)


def test_question_with_extraction_warnings_is_rejected():
    q = _valid_question()
    q.warnings = ["numeração não sequencial: esperado 2, encontrado 3"]
    ok, errors = validate_question(q)
    assert ok is False
    assert errors == q.warnings


# --- full report -------------------------------------------------------

def test_full_report_all_valid_is_fully_importable():
    pair = _ready_pair()
    questions = [_valid_question(n) for n in range(1, 6)]
    report = validate_extraction(pair, questions)
    assert len(report.importable) == 5
    assert report.rejected == []


def test_full_report_numbering_gap_blocks_the_whole_pair():
    pair = _ready_pair()
    questions = [_valid_question(1), _valid_question(3)]  # missing 2
    report = validate_extraction(pair, questions)
    assert report.numbering_ok is False
    assert report.importable == []  # nothing imports until the gap is fixed


def test_full_report_one_bad_question_does_not_block_the_others():
    pair = _ready_pair()
    good = _valid_question(1)
    bad = _valid_question(2)
    bad.alternatives = [a for a in bad.alternatives if a["letter"] != "E"]
    report = validate_extraction(pair, [good, bad])
    assert report.numbering_ok is True
    assert [q.question_number for q in report.importable] == [1]
    assert len(report.rejected) == 1
