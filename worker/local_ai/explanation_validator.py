from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence


PUBLISHABLE_STATUSES = {
    "approved",
    "approved_with_gaps",
}


@dataclass
class ValidationResult:
    status: str
    publishable: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    sources_sufficient: Optional[bool] = None
    official_answer_supported: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "publishable": self.publishable,
            "errors": self.errors,
            "warnings": self.warnings,
            "sourcesSufficient": self.sources_sufficient,
            "officialAnswerSupported": self.official_answer_supported,
        }


REQUIRED_EXPLANATION_FIELDS = (
    "practicalCase",
    "concept",
    "classification",
    "legalBasis",
    "requirements",
    "traps",
    "caseAnalysis",
    "dontConfuse",
    "examSummary",
    "curiosities",
)


def _normalize(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _source_text(source: Any) -> str:
    if isinstance(source, str):
        return source

    if not isinstance(source, dict):
        return ""

    for field_name in (
        "text",
        "content",
        "quote",
        "body",
        "excerpt",
    ):
        value = source.get(field_name)

        if isinstance(value, str) and value.strip():
            return value

    return ""


def _source_id(source: Any, index: int) -> str:
    if isinstance(source, dict):
        value = (
            source.get("sourceId")
            or source.get("id")
            or source.get("source_id")
        )

        if value:
            return str(value)

    return f"S{index + 1}"


def _validate_required_structure(
    explanation: Dict[str, Any],
    errors: List[str],
) -> None:
    app_explanation = explanation.get("appExplanation")

    if not isinstance(app_explanation, dict):
        errors.append("Campo appExplanation ausente ou inválido.")
        return

    for field_name in REQUIRED_EXPLANATION_FIELDS:
        if field_name not in app_explanation:
            errors.append(
                f"Campo obrigatório ausente em appExplanation: {field_name}"
            )

    # Uma explicação totalmente vazia não deve ser publicável.
    meaningful_fields = (
        "practicalCase",
        "concept",
        "legalBasis",
        "caseAnalysis",
        "examSummary",
    )

    if not any(
        _normalize(app_explanation.get(field_name))
        for field_name in meaningful_fields
    ):
        errors.append("appExplanation está vazia.")


def _validate_question_id(
    expected_question_id: Optional[str],
    explanation: Dict[str, Any],
    errors: List[str],
) -> None:
    if not expected_question_id:
        return

    returned = _normalize(explanation.get("questionId"))

    if not returned:
        errors.append("A resposta não retornou questionId.")
        return

    if returned != _normalize(expected_question_id):
        errors.append(
            "questionId retornado pela IA é diferente da questão de entrada: "
            f"esperado={expected_question_id}, retornado={returned}."
        )


def _validate_official_answer(
    expected_official_answer: str,
    explanation: Dict[str, Any],
    errors: List[str],
) -> None:
    expected = _normalize(expected_official_answer).upper()
    returned = _normalize(explanation.get("officialAnswer")).upper()

    if not expected:
        errors.append("Questão sem gabarito oficial informado.")
        return

    if not returned:
        errors.append("A explicação não retornou officialAnswer.")
        return

    if returned != expected:
        errors.append(
            "Gabarito alterado pela IA: "
            f"esperado={expected}, retornado={returned}."
        )


def _validate_evidence_quotes(
    explanation: Dict[str, Any],
    sources: Sequence[Any],
    errors: List[str],
) -> None:
    evidence_quotes = explanation.get("evidenceQuotes", [])

    if evidence_quotes is None:
        evidence_quotes = []

    if not isinstance(evidence_quotes, list):
        errors.append("evidenceQuotes deve ser uma lista.")
        return

    source_map: Dict[str, str] = {}

    for index, source in enumerate(sources):
        sid = _source_id(source, index)
        source_map[sid] = _source_text(source)

    for index, evidence in enumerate(evidence_quotes):
        if not isinstance(evidence, dict):
            errors.append(
                f"evidenceQuotes[{index}] possui formato inválido."
            )
            continue

        sid = _normalize(evidence.get("sourceId"))
        quote = _normalize(evidence.get("quote"))

        if not sid:
            errors.append(
                f"evidenceQuotes[{index}] não possui sourceId."
            )
            continue

        if not quote:
            errors.append(
                f"evidenceQuotes[{index}] possui quote vazia."
            )
            continue

        source_content = source_map.get(sid)

        if source_content is None:
            errors.append(
                f"evidenceQuotes[{index}] referencia fonte inexistente: {sid}."
            )
            continue

        # evidenceQuote precisa ser literal.
        if quote not in source_content:
            errors.append(
                f"evidenceQuotes[{index}] não é citação literal da fonte {sid}."
            )


def _read_audit(
    explanation: Dict[str, Any],
    warnings: List[str],
) -> tuple[Optional[bool], Optional[bool]]:
    audit = explanation.get("audit")

    if not isinstance(audit, dict):
        warnings.append("Campo audit ausente ou inválido.")
        return None, None

    sources_sufficient = audit.get("sourcesSufficient")
    official_supported = audit.get("officialAnswerSupported")

    if sources_sufficient is False:
        warnings.append(
            "As fontes fornecidas foram consideradas limitadas. "
            "Isso não bloqueia a publicação automaticamente."
        )

    if official_supported is False:
        warnings.append(
            "O gabarito oficial não está totalmente sustentado pelas "
            "fontes fornecidas. Isso pode representar apenas limitação "
            "das sources."
        )

    issues = audit.get("issues", [])

    if isinstance(issues, list):
        for issue in issues:
            if issue:
                warnings.append(str(issue))

    return sources_sufficient, official_supported


def validate_explanation(
    *,
    explanation: Dict[str, Any],
    official_answer: str,
    sources: Sequence[Any],
    question_id: Optional[str] = None,
    legal_error_detected: bool = False,
    source_contradiction_detected: bool = False,
    question_complete: bool = True,
) -> ValidationResult:
    """
    Validação do Método VR.

    REGRA PRINCIPAL:

    Fonte limitada não significa explicação errada.

    A IA pode complementar as sources com conhecimento jurídico
    próprio, desde que:

    - preserve o gabarito oficial;
    - não contradiga as fontes;
    - não invente evidenceQuotes;
    - mantenha a estrutura esperada;
    - não haja erro jurídico material detectado.

    approved e approved_with_gaps são publicáveis.
    needs_review e error não são publicáveis.
    """

    errors: List[str] = []
    warnings: List[str] = []

    if not isinstance(explanation, dict):
        return ValidationResult(
            status="error",
            publishable=False,
            errors=["Resposta da IA não é um objeto JSON válido."],
        )

    if not question_complete:
        errors.append(
            "Questão incompleta ou entrada truncada."
        )

    _validate_required_structure(
        explanation=explanation,
        errors=errors,
    )

    _validate_question_id(
        expected_question_id=question_id,
        explanation=explanation,
        errors=errors,
    )

    _validate_official_answer(
        expected_official_answer=official_answer,
        explanation=explanation,
        errors=errors,
    )

    _validate_evidence_quotes(
        explanation=explanation,
        sources=sources,
        errors=errors,
    )

    sources_sufficient, official_supported = _read_audit(
        explanation=explanation,
        warnings=warnings,
    )

    if legal_error_detected:
        errors.append(
            "Foi detectado erro jurídico material na explicação."
        )

    if source_contradiction_detected:
        errors.append(
            "A explicação contradiz uma ou mais fontes fornecidas."
        )

    if errors:
        status = "needs_review"

        if not question_complete:
            status = "error"

        return ValidationResult(
            status=status,
            publishable=False,
            errors=errors,
            warnings=warnings,
            sources_sufficient=sources_sufficient,
            official_answer_supported=official_supported,
        )

    # Fonte limitada não bloqueia publicação.
    if sources_sufficient is False or official_supported is False:
        return ValidationResult(
            status="approved_with_gaps",
            publishable=True,
            warnings=warnings,
            sources_sufficient=sources_sufficient,
            official_answer_supported=official_supported,
        )

    return ValidationResult(
        status="approved",
        publishable=True,
        warnings=warnings,
        sources_sufficient=sources_sufficient,
        official_answer_supported=official_supported,
    )


def can_publish(validation: ValidationResult) -> bool:
    return (
        validation.publishable
        and validation.status in PUBLISHABLE_STATUSES
    )
