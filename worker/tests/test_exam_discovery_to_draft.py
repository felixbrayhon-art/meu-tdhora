from __future__ import annotations

from exam_discovery.models import DiscoveredDocument, ExamPair, ExtractedQuestion
from exam_discovery.to_draft import (
    ANNULLED_WARNING,
    build_explanation_batch_document,
    build_parsed_question,
    build_parsed_questions_from_explanations,
    external_id_for,
    import_subject_bucket,
    render_explanation_text,
)
from lib.validation import validate_question_structure

EXAM_DOC = DiscoveredDocument(
    source_url="https://conhecimento.fgv.br/concursos/pcmg24/04",
    download_url="https://conhecimento.fgv.br/sites/x/prova.pdf",
    discovered_at="2026-01-01T00:00:00Z",
    board="FGV",
    institution="PCMG",
    exam_name="Concurso PCMG 2024",
    role="Investigador de Polícia I",
    year=2024,
    test_type="1",
    document_type="exam",
    title="Prova Tipo 1",
)

PAIR = ExamPair(
    board="FGV",
    institution="PCMG",
    role="Investigador de Polícia I",
    year=2024,
    test_type="1",
    exam_doc=EXAM_DOC,
    answer_key_doc=None,
    status="ready",
)


def _question(number=1, annulled=False, official_answer="B", warnings=None) -> ExtractedQuestion:
    return ExtractedQuestion(
        question_number=number,
        subject=None,
        statement="Enunciado da questão.",
        alternatives=[
            {"letter": "A", "text": "primeira"},
            {"letter": "B", "text": "segunda"},
            {"letter": "C", "text": "terceira"},
            {"letter": "D", "text": "quarta"},
            {"letter": "E", "text": "quinta"},
        ],
        official_answer=None if annulled else official_answer,
        official_answer_text=None if annulled else "segunda",
        annulled=annulled,
        status="valid",
        warnings=warnings or [],
    )


def test_external_id_is_stable_and_slugified():
    ext_id = external_id_for(PAIR, _question(number=7))
    assert ext_id == "pcmg-2024-investigador-de-policia-i-tipo1-q7"
    # Re-running discovery/extraction must produce the exact same id.
    assert ext_id == external_id_for(PAIR, _question(number=7))


def test_external_id_handles_missing_role_and_test_type():
    pair = ExamPair(
        board="Cebraspe", institution="PF", role=None, year=2025, test_type=None,
        exam_doc=EXAM_DOC, answer_key_doc=None, status="ready",
    )
    assert external_id_for(pair, _question(number=97)) == "pf-2025-geral-unico-q97"


def test_build_explanation_batch_document_shape_matches_batch_script_input():
    doc = build_explanation_batch_document(PAIR, [_question(number=1), _question(number=2, annulled=True)])
    assert doc["meta"] == {"institution": "PCMG", "board": "FGV", "role": "Investigador de Polícia I", "year": 2024, "testType": "1"}
    assert doc["questions"][0]["alternatives"] == {"A": "primeira", "B": "segunda", "C": "terceira", "D": "quarta", "E": "quinta"}
    assert doc["questions"][0]["officialAnswer"] == "B"
    assert doc["questions"][1]["annulled"] is True
    assert doc["questions"][1]["officialAnswer"] is None


def test_render_explanation_text_orders_by_sections_and_skips_empty():
    app_explanation = {"curiosities": "curiosidade final.", "concept": "o conceito é X."}
    text = render_explanation_text(app_explanation)
    # "concept" (CONCEITO) is declared before "curiosities" (CURIOSIDADES) in SECTIONS.
    assert text.index("CONCEITO") < text.index("CURIOSIDADES")
    assert "o conceito é X." in text
    assert "curiosidade final." in text


def test_render_explanation_text_empty_dict_returns_empty_string():
    assert render_explanation_text({}) == ""


def test_build_parsed_question_marks_correct_alternative():
    pq = build_parsed_question(PAIR, _question(official_answer="C"), explanation_text="explicação.")
    assert pq.correct_letter == "C"
    correct = [a for a in pq.alternatives if a.is_correct]
    assert len(correct) == 1
    assert correct[0].letter == "C"
    assert pq.exam_board == "FGV"
    assert pq.organization == "PCMG"
    assert pq.position == "Investigador de Polícia I"
    assert pq.exam_year == 2024


def test_build_parsed_question_annulled_gets_warning_and_no_correct_letter():
    pq = build_parsed_question(PAIR, _question(annulled=True), explanation_text=None)
    assert pq.correct_letter is None
    assert ANNULLED_WARNING in pq.warnings
    assert not any(a.is_correct for a in pq.alternatives)


def test_annulled_question_fails_structural_validation_and_is_excluded():
    # Confirms the whole point of the ANNULLED_WARNING: even without it,
    # the existing pipeline (lib/validation.py, shared with every other
    # source) already refuses to draft a question with no correct answer —
    # this locks that behavior in explicitly rather than relying on it
    # only incidentally.
    pq = build_parsed_question(PAIR, _question(annulled=True), explanation_text=None)
    errors = validate_question_structure(pq.to_dict())
    assert errors  # must never pass validation silently


def test_build_parsed_questions_from_explanations_merges_approved_result():
    question = _question(number=1)
    explanations_by_number = {
        1: {
            "status": "approved",
            "explanation": {"appExplanation": {"concept": "explicação real do conceito."}},
        }
    }
    parsed = build_parsed_questions_from_explanations(PAIR, [question], explanations_by_number)
    assert len(parsed) == 1
    assert "explicação real do conceito." in parsed[0].explanation
    assert parsed[0].warnings == []


def test_build_parsed_questions_from_explanations_flags_missing_result():
    question = _question(number=5)
    parsed = build_parsed_questions_from_explanations(PAIR, [question], explanations_by_number={})
    assert parsed[0].explanation == ""
    assert "sem resultado de geração de explicação" in parsed[0].warnings[0]


def test_build_parsed_questions_from_explanations_flags_rejected_result():
    question = _question(number=9)
    explanations_by_number = {9: {"status": "rejected"}}
    parsed = build_parsed_questions_from_explanations(PAIR, [question], explanations_by_number)
    assert parsed[0].explanation == ""
    assert "status='rejected'" in parsed[0].warnings[0]


def test_build_parsed_questions_from_explanations_annulled_needs_no_explanation_result():
    question = _question(number=59, annulled=True)
    parsed = build_parsed_questions_from_explanations(PAIR, [question], explanations_by_number={})
    # Only the annulled warning, never the "sem resultado" one (annulled
    # questions never get sent to batch_exam_explanations.py in the first
    # place — see process_question's own annulled shortcut).
    assert parsed[0].warnings == [ANNULLED_WARNING]


def test_question_type_is_certo_errado_for_ce_alternatives():
    ce_question = ExtractedQuestion(
        question_number=1, subject=None, statement="Item.",
        alternatives=[{"letter": "C", "text": "Certo"}, {"letter": "E", "text": "Errado"}],
        official_answer="C", official_answer_text="Certo", annulled=False, status="valid", warnings=[],
    )
    pq = build_parsed_question(PAIR, ce_question, explanation_text="x")
    assert pq.question_type == "certo_errado"


def test_import_subject_bucket_strips_noções_de_prefix():
    assert import_subject_bucket("Noções de Direito Constitucional") == "Direito Constitucional"
    assert import_subject_bucket("Noções de Direito Processual Penal") == "Direito Processual Penal"


def test_import_subject_bucket_leaves_labels_without_the_prefix_untouched():
    assert import_subject_bucket("Língua Portuguesa") == "Língua Portuguesa"
    assert import_subject_bucket("Lei Orgânica da Polícia Civil do Estado de Minas Gerais") == (
        "Lei Orgânica da Polícia Civil do Estado de Minas Gerais"
    )


def test_import_subject_bucket_none_stays_none():
    assert import_subject_bucket(None) is None


def test_build_parsed_question_carries_subject_raw_from_extracted_question():
    q = _question(official_answer="C")
    q.subject = "Noções de Direito Constitucional"
    pq = build_parsed_question(PAIR, q, explanation_text="x")
    assert pq.subject_raw == "Noções de Direito Constitucional"
