from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from local_ai.structured_explanation import SECTIONS
from parsers.base import ParsedAlternative, ParsedQuestion

from .models import ExamPair, ExtractedQuestion

# Bridges this package's own output (ExamPair + ExtractedQuestion) into the
# app's ALREADY-ESTABLISHED question-bank pipeline (worker/parsers/base.py's
# ParsedQuestion -> worker/scripts/push_drafts.py -> question_drafts ->
# admin review UI -> questions), instead of writing to Firestore directly.
# types.ts's PublishedQuestion already reserves examBoard/organization/
# position/examYear specifically for a source like this one.

ANNULLED_WARNING = "questão anulada pelo gabarito oficial — sem alternativa correta, não elegível para o banco"

_RE_LEADING_NOCOES_DE = re.compile(r"^no[cç][oõ]es\s+de\s+", re.IGNORECASE)


def import_subject_bucket(subject_raw: str | None) -> str | None:
    """Derives the coarser `importSubject` matéria bucket (what the app's
    "Por Matéria" tab groups by — see listBankImportSubjects in
    services/questionBankService.ts) from a raw subject label like FGV's
    own "Noções de Direito Constitucional" edital wording. Purely a text
    normalization (strips the "Noções de " prefix editais commonly use),
    never a classifier — the raw label itself must already be known and
    correct (see build_parsed_question's `question.subject`), not guessed
    here.
    """
    if not subject_raw:
        return None
    return _RE_LEADING_NOCOES_DE.sub("", subject_raw).strip() or None


@dataclass
class PairMeta:
    """The 5 fields every function below actually needs from an ExamPair
    (board/institution/role/year/testType) — with no exam_doc/answer_key_doc
    of its own. Lets worker/scripts/push_fgv_drafts.py reconstruct "which
    exam this is" purely from an exported JSON's `meta` block (see
    export_fgv_for_explanations.py / batch_exam_explanations.py's own
    input format), without needing to re-run discovery just to get a real
    ExamPair object again. An ExamPair satisfies this same shape by
    duck-typing (same attribute names), so every function below accepts
    either interchangeably.
    """

    board: str
    institution: str
    role: str | None
    year: int | None
    test_type: str | None


def external_id_for(pair: ExamPair | PairMeta, question: ExtractedQuestion) -> str:
    """Deterministic, human-legible externalId — stable across re-runs of
    the same exam so re-discovery/re-extraction never creates duplicate
    drafts (dedup in lib/dedup.py keys on (source, externalId) too, not
    just contentHash).
    """

    def _slug(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower() or "x"

    parts = [
        pair.institution,
        str(pair.year) if pair.year is not None else "sem-ano",
        pair.role or "geral",
        f"tipo{pair.test_type}" if pair.test_type else "unico",
        f"q{question.question_number}",
    ]
    return "-".join(_slug(p) for p in parts)


def build_explanation_batch_document(pair: ExamPair | PairMeta, questions: list[ExtractedQuestion]) -> dict:
    """The exact input schema worker/scripts/batch_exam_explanations.py
    expects (meta + questions, alternatives as a {letter: text} dict) —
    see worker/data/exams/pcmg_investigador_2025_tipo1.json for the
    hand-built reference this mirrors. `subject` is left None for every
    question: this pipeline has no per-question subject classifier (see
    ExtractedQuestion.subject / subject_by_question), so
    batch_exam_explanations.py's normalize_subject(None) falls back to an
    unfiltered legal-base search rather than a wrong guess.
    """
    return {
        "meta": {
            "institution": pair.institution,
            "board": pair.board,
            "role": pair.role,
            "year": pair.year,
            "testType": pair.test_type,
        },
        "questions": [
            {
                "questionNumber": q.question_number,
                "subject": q.subject,
                "statement": q.statement,
                "alternatives": {a["letter"]: a["text"] for a in q.alternatives},
                "annulled": q.annulled,
                "officialAnswer": q.official_answer,
                "officialAnswerText": q.official_answer_text,
            }
            for q in questions
        ],
    }


def render_explanation_text(app_explanation: dict[str, str]) -> str:
    """Flattens batch_exam_explanations.py's structured
    {sectionKey: text} result (see build_app_explanation) into the single
    plain-text `explanation` string the draft/question schema expects —
    section order follows SECTIONS' own declaration order, and a section
    with no content (downgraded to the insufficiency sentence, and
    therefore already absent from app_explanation) is simply skipped.
    """
    parts = []
    for key, title in SECTIONS.items():
        text = app_explanation.get(key)
        if text:
            parts.append(f"**{title}**\n{text}")
    return "\n\n".join(parts)


def build_parsed_question(
    pair: ExamPair | PairMeta,
    question: ExtractedQuestion,
    explanation_text: str | None,
    source: str = "fgv",
) -> ParsedQuestion:
    """Converts one already-extracted, already-explained question into the
    same ParsedQuestion shape every other source in this project produces
    — so it flows through worker/scripts/push_drafts.py's existing
    validate_question_structure/dedup/exclusion logic completely
    unchanged, with zero special-casing for this source anywhere else.
    """
    warnings = list(question.warnings)
    if question.annulled:
        warnings.append(ANNULLED_WARNING)

    alternatives = [
        ParsedAlternative(
            letter=alt["letter"],
            text=alt["text"],
            is_correct=(alt["letter"] == question.official_answer),
            position=index,
        )
        for index, alt in enumerate(question.alternatives)
    ]

    question_type = "certo_errado" if {a["letter"] for a in question.alternatives} == {"C", "E"} else "multipla_escolha"

    return ParsedQuestion(
        source=source,
        external_id=external_id_for(pair, question),
        number=question.question_number,
        question_type=question_type,
        subject_raw=question.subject,
        topic_raw=None,
        statement=question.statement,
        alternatives=alternatives,
        correct_letter=question.official_answer,
        explanation=explanation_text or "",
        source_page=0,
        warnings=warnings,
        exam_year=pair.year,
        exam_board=pair.board,
        organization=pair.institution,
        position=pair.role,
    )


def build_parsed_questions_from_explanations(
    pair: ExamPair | PairMeta,
    questions: list[ExtractedQuestion],
    explanations_by_number: dict[int, dict],
    source: str = "fgv",
) -> list[ParsedQuestion]:
    """Merges extracted questions with batch_exam_explanations.py's output
    (keyed by questionNumber, each a `results[]` entry from that script's
    output document). A question with no matching explanation result yet
    (batch not run / not reached that number) still gets a ParsedQuestion
    back — with an explicit warning instead of a silent empty explanation
    — so it shows up as excluded-with-a-reason rather than vanishing.
    """
    parsed: list[ParsedQuestion] = []
    for question in questions:
        result = explanations_by_number.get(question.question_number)
        explanation_text = None
        extra_warning = None

        if question.annulled:
            pass  # ANNULLED_WARNING already added by build_parsed_question; no explanation expected.
        elif result is None:
            extra_warning = "sem resultado de geração de explicação para esta questão"
        elif result.get("status") in ("approved", "approved_with_gaps"):
            app_explanation = (result.get("explanation") or {}).get("appExplanation") or {}
            explanation_text = render_explanation_text(app_explanation)
        else:
            extra_warning = f"explicação não aprovada (status={result.get('status')!r})"

        pq = build_parsed_question(pair, question, explanation_text, source=source)
        if extra_warning:
            pq.warnings.append(extra_warning)
        parsed.append(pq)

    return parsed
