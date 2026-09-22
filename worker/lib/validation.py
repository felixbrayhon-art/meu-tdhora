from __future__ import annotations

MIN_ALTERNATIVES = 2
MAX_ALTERNATIVES = 5


def validate_question_structure(q: dict) -> list[str]:
    """Structural checks beyond what the parser's own `warnings` already
    cover — variable alternative count (A-D or A-E, never assume 5),
    correctLetter/isCorrect consistency, required text fields. Returns a
    list of problem descriptions; empty means the question is clean.
    """
    errors: list[str] = []

    alternatives = q.get("alternatives") or []
    if not (MIN_ALTERNATIVES <= len(alternatives) <= MAX_ALTERNATIVES):
        errors.append(
            f"Número de alternativas inválido: {len(alternatives)} (esperado {MIN_ALTERNATIVES} a {MAX_ALTERNATIVES})"
        )

    letters = [a.get("letter") for a in alternatives]
    if len(letters) != len(set(letters)):
        errors.append("Letras de alternativa repetidas")

    correct_letter = q.get("correctLetter")
    if not correct_letter:
        errors.append("correctLetter ausente")
    elif correct_letter not in letters:
        errors.append(f"correctLetter '{correct_letter}' não corresponde a nenhuma alternativa")

    correct_flags = [a for a in alternatives if a.get("isCorrect")]
    if len(correct_flags) != 1:
        errors.append(f"Esperada exatamente 1 alternativa com isCorrect=true, encontradas {len(correct_flags)}")
    elif correct_letter and correct_flags[0].get("letter") != correct_letter:
        errors.append("isCorrect não corresponde ao correctLetter")

    if not (q.get("statement") or "").strip():
        errors.append("statement vazio")

    if not (q.get("explanation") or "").strip():
        errors.append("explanation vazio")

    return errors


def validate_before_publish(q: dict, expected_subject: str, expected_year: int) -> list[str]:
    """Final gate immediately before writing to `questions` — re-runs the
    structural checks plus the import-batch-specific ones (importSubject/
    importYear match the batch, no pending warnings). Deliberately
    redundant with the earlier structural pass: this is the very last
    check before an irreversible write.
    """
    errors = validate_question_structure(q)
    if q.get("importSubject") != expected_subject:
        errors.append(f"importSubject inesperado: {q.get('importSubject')!r} (esperado {expected_subject!r})")
    if q.get("importYear") != expected_year:
        errors.append(f"importYear inesperado: {q.get('importYear')!r} (esperado {expected_year!r})")
    if q.get("warnings"):
        errors.append("possui warnings pendentes — não elegível para publicação automática")
    return errors
