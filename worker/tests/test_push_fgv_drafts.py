from __future__ import annotations

from scripts.push_fgv_drafts import build_drafts

EXAM_JSON = {
    "meta": {"institution": "PCMG", "board": "FGV", "role": "Investigador de Polícia I", "year": 2024, "testType": "1"},
    "questions": [
        {
            "questionNumber": 1,
            "subject": None,
            "statement": "Enunciado 1.",
            "alternatives": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"},
            "annulled": False,
            "officialAnswer": "B",
            "officialAnswerText": "b",
        },
        {
            "questionNumber": 2,
            "subject": None,
            "statement": "Enunciado anulado.",
            "alternatives": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"},
            "annulled": True,
            "officialAnswer": None,
            "officialAnswerText": None,
        },
    ],
}


def test_build_drafts_with_approved_explanation_is_eligible():
    explanations_json = {
        "results": [
            {"questionNumber": 1, "status": "approved", "explanation": {"appExplanation": {"concept": "explicação real."}}},
        ]
    }
    drafts = build_drafts(EXAM_JSON, explanations_json, source="fgv")
    q1 = next(d for d in drafts if d["externalId"].endswith("q1"))
    assert q1["status"] == "pending_review"
    assert q1["explanation"]
    assert q1["source"] == "fgv"


def test_build_drafts_annulled_question_excluded_with_reason():
    drafts = build_drafts(EXAM_JSON, explanations_json=None, source="fgv")
    q2 = next(d for d in drafts if d["externalId"].endswith("q2"))
    assert q2["status"] == "needs_attention"
    assert any("anulada" in w for w in q2["warnings"])


def test_build_drafts_without_explanations_json_flags_missing_result():
    drafts = build_drafts(EXAM_JSON, explanations_json=None, source="fgv")
    q1 = next(d for d in drafts if d["externalId"].endswith("q1"))
    assert q1["status"] == "needs_attention"
    assert any("sem resultado de geração de explicação" in w for w in q1["warnings"])


def test_build_drafts_fills_import_subject_from_subject_raw():
    exam_json = {
        "meta": EXAM_JSON["meta"],
        "questions": [{**EXAM_JSON["questions"][0], "subject": "Noções de Direito Constitucional"}],
    }
    drafts = build_drafts(exam_json, explanations_json=None, source="fgv")
    assert drafts[0]["subjectRaw"] == "Noções de Direito Constitucional"
    assert drafts[0]["importSubject"] == "Direito Constitucional"
    assert drafts[0]["importYear"] == 2024


def test_build_drafts_import_subject_is_none_when_subject_unknown():
    drafts = build_drafts(EXAM_JSON, explanations_json=None, source="fgv")
    assert drafts[0]["subjectRaw"] is None
    assert drafts[0]["importSubject"] is None
