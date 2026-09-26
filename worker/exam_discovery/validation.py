from __future__ import annotations

from dataclasses import dataclass, field

from .models import ExamPair, ExtractedQuestion

EXPECTED_ALTERNATIVES = ("A", "B", "C", "D", "E")
# The only two complete alternative shapes this pipeline produces: a
# standard A-E multiple-choice question, or a Cebraspe Certo/Errado item
# (see exam_discovery/extraction.py::build_extracted_items). Anything
# else is a structural defect, not a board-specific variant to special-case.
VALID_ALTERNATIVE_LETTER_SETS = (frozenset(EXPECTED_ALTERNATIVES), frozenset(("C", "E")))


@dataclass
class QuestionValidation:
    question: ExtractedQuestion
    ok: bool
    errors: list[str] = field(default_factory=list)


@dataclass
class ValidationReport:
    pair_ok: bool
    pair_errors: list[str]
    numbering_ok: bool
    numbering_errors: list[str]
    questions: list[QuestionValidation]

    @property
    def importable(self) -> list[ExtractedQuestion]:
        # A numbering problem (a gap, a duplicate number, out-of-order
        # questions) is a whole-document defect, not a single question's
        # — nothing from this pair imports until it's fixed, rather than
        # silently importing everything except the affected question.
        if not self.pair_ok or not self.numbering_ok:
            return []
        return [qv.question for qv in self.questions if qv.ok]

    @property
    def rejected(self) -> list[QuestionValidation]:
        return [qv for qv in self.questions if not qv.ok]


def validate_pair(pair: ExamPair) -> tuple[bool, list[str]]:
    """"Prova e gabarito correspondem" — the pairing-level checks. Only a
    pair already marked "ready" by pairing.py may even reach import;
    this re-validates the invariants that made it ready, defensively.
    """
    errors: list[str] = []
    if pair.status != "ready":
        errors.append(f"pair status is {pair.status!r}, not 'ready' — never eligible for import")
    if pair.answer_key_doc is None:
        errors.append("pair has no answer_key_doc")
    elif pair.answer_key_doc.document_type != "answer_key_final":
        errors.append(
            f"answer key document_type is {pair.answer_key_doc.document_type!r}, "
            "not 'answer_key_final' — only a definitive key may release import"
        )
    if pair.exam_doc.document_type != "exam":
        errors.append(f"exam document_type is {pair.exam_doc.document_type!r}, expected 'exam'")
    if (
        pair.answer_key_doc is not None
        and pair.answer_key_doc.test_type is not None
        and pair.answer_key_doc.test_type != pair.exam_doc.test_type
    ):
        errors.append(
            f"testType mismatch: exam is {pair.exam_doc.test_type!r}, "
            f"answer key is {pair.answer_key_doc.test_type!r}"
        )
    return not errors, errors


def validate_question(question: ExtractedQuestion) -> tuple[bool, list[str]]:
    errors: list[str] = []

    if question.warnings:
        errors.extend(question.warnings)

    if not question.statement.strip():
        errors.append("enunciado vazio")

    by_letter = {alt.get("letter"): alt.get("text", "") for alt in question.alternatives}
    present_letters = frozenset(by_letter.keys())
    if present_letters not in VALID_ALTERNATIVE_LETTER_SETS:
        errors.append(
            f"conjunto de alternativas inesperado: {sorted(present_letters)} "
            f"(esperado A-E ou C-E)"
        )
    else:
        missing = [l for l in sorted(present_letters) if not (by_letter.get(l) or "").strip()]
        if missing:
            errors.append(f"alternativas incompletas: {', '.join(missing)}")

    if question.annulled:
        if question.official_answer is not None:
            errors.append("anulada mas officialAnswer não é None")
        if question.official_answer_text is not None:
            errors.append("anulada mas officialAnswerText não é None")
    else:
        if question.official_answer is None:
            errors.append("não anulada mas officialAnswer é None")
        elif question.official_answer not in by_letter or not by_letter[question.official_answer].strip():
            errors.append(f"resposta oficial {question.official_answer!r} não existe entre as alternativas")

    return not errors, errors


def validate_extraction(pair: ExamPair, questions: list[ExtractedQuestion]) -> ValidationReport:
    """Runs every check from the spec's VALIDAÇÃO section except
    duplicidade, which needs the catalog/Firestore context that
    dedup.py's caller (scripts/discover_exams.py) supplies separately —
    see dedup.split_new_and_duplicate.
    """
    pair_ok, pair_errors = validate_pair(pair)

    numbers = [q.question_number for q in questions]
    numbering_errors: list[str] = []
    if numbers != sorted(numbers):
        numbering_errors.append("questões fora de ordem")
    if len(set(numbers)) != len(numbers):
        numbering_errors.append("números de questão duplicados")
    # Sequential without gaps, relative to whatever number the list
    # itself starts at — NOT necessarily 1. A single Cebraspe "bloco"
    # legitimately starts wherever the previous bloco of the same exam
    # left off (see exam_discovery/extraction.py::build_extracted_items);
    # only the caller assembling a FULL exam from its blocos is in a
    # position to know whether the combined result should start at 1.
    expected_run = list(range(numbers[0], numbers[0] + len(numbers))) if numbers else []
    if sorted(numbers) != expected_run:
        numbering_errors.append("numeração não forma sequência contígua, sem lacunas")

    question_validations: list[QuestionValidation] = []
    for question in questions:
        ok, errors = validate_question(question)
        question_validations.append(QuestionValidation(question=question, ok=ok, errors=errors))

    return ValidationReport(
        pair_ok=pair_ok,
        pair_errors=pair_errors,
        numbering_ok=not numbering_errors,
        numbering_errors=numbering_errors,
        questions=question_validations,
    )
