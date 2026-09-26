from __future__ import annotations

import math
import re

from .text_utils import tokenize_query

# Deterministic evidence-coverage assessment — no LLM judges this. Answers
# "do the selected sources actually sustain every relevant part of the
# official alternative?", not just "did we find something that looks
# related?". See the module's callers (worker/scripts/test_exam_explanation.py,
# worker/scripts/batch_exam_explanations.py): Ollama is only invoked when
# status == "complete".

RE_AFFIRMATIVE_MARKER = re.compile(r"(?:^|\n)\s*([IVXLCDM]+)\.\s+")
RE_NUMERAL_TOKEN = re.compile(r"\b([IVXLCDM]+)\b")

MIN_SHARED_TERM_RATIO = 0.5
MIN_SHARED_TERMS_ABSOLUTE = 2


def _terms_match(a: str, b: str) -> bool:
    """Same tiny fuzzy-match rule already used in unified_search.py/
    advocacia_aberta.py (mutual prefix once both tokens are long enough) —
    reimplemented locally rather than importing a private helper from
    those modules, to avoid coupling this module's behavior to internals
    they might change independently.
    """
    if a == b:
        return True
    if min(len(a), len(b)) >= 5:
        return a.startswith(b) or b.startswith(a)
    return False


def extract_enumerated_affirmatives(statement: str) -> dict[str, str]:
    """Parses "I. ...\\nII. ...\\nIII. ..." style enumerations out of a
    question statement. Requires at least two markers to avoid treating a
    single stray roman numeral (e.g. inside a citation) as an enumeration.
    Returns an ordered dict (insertion order == I, II, III... as they
    appear in the statement).
    """
    matches = list(RE_AFFIRMATIVE_MARKER.finditer(statement))
    if len(matches) < 2:
        return {}

    result: dict[str, str] = {}
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(statement)
        result[m.group(1)] = statement[start:end].strip()
    return result


def _referenced_numerals(correct_text: str, known_numerals: list[str]) -> list[str]:
    found = set(RE_NUMERAL_TOKEN.findall(correct_text))
    return [n for n in known_numerals if n in found]


def split_claims(text: str) -> list[str]:
    """Splits a (typically compound) alternative into independently
    checkable claims. Deterministic comma-splitting — matches how every
    real compound alternative in the exam corpus is actually phrased
    ("roubo consumado, com a incidência da causa de aumento..."). A
    fragment too short to carry its own meaning (fewer than 2 significant
    tokens — e.g. a lone connector like "pois") is merged back into the
    previous claim instead of becoming a spurious independent one.
    """
    text = text.strip().rstrip(".")
    if not text:
        return []

    raw_parts = [p.strip() for p in text.split(",") if p.strip()]
    if not raw_parts:
        return [text]

    claims: list[str] = []
    for part in raw_parts:
        if claims and len(tokenize_query(part)) < 2:
            claims[-1] = f"{claims[-1]}, {part}"
        else:
            claims.append(part)
    return claims


def claim_supported_by(
    claim_text: str,
    evidence_text: str,
    min_ratio: float = MIN_SHARED_TERM_RATIO,
    min_absolute: int = MIN_SHARED_TERMS_ABSOLUTE,
) -> bool:
    """Whether a SINGLE evidence text, on its own, carries enough of the
    claim's significant vocabulary to be considered support for it. Never
    combines partial matches across multiple sources — a claim is either
    sustained by one source or it isn't (conservative on purpose).
    """
    claim_tokens = tokenize_query(claim_text)
    if not claim_tokens:
        return True

    evidence_tokens = tokenize_query(evidence_text)
    matched = sum(1 for ct in claim_tokens if any(_terms_match(ct, et) for et in evidence_tokens))
    required = max(min_absolute, math.ceil(len(claim_tokens) * min_ratio))
    return matched >= required


def assess_evidence_coverage(
    statement: str,
    correct_text: str,
    sources: list[dict],
) -> dict:
    """Deterministic coverage assessment. Returns:

        {
          "status": "complete" | "partial" | "insufficient",
          "claims": ["I", "II", "III"] or ["trecho 1", "trecho 2"],
          "supported": [...],
          "missing": [...],
          "claim_sources": {"I": ["CPP, art. 155"], ...},
          "sources": ["CPP, art. 155", ...],
        }

    Two claim-extraction modes, chosen deterministically:
      - if the statement enumerates "I./II./III." affirmatives AND the
        correct alternative references a subset of them (e.g. "I e III,
        apenas."), each REFERENCED affirmative is its own claim;
      - otherwise, the correct alternative itself is split into
        comma-separated claims (handles compound alternatives like
        "roubo consumado, com a incidência da causa de aumento...").
    """
    enumerated = extract_enumerated_affirmatives(statement)
    referenced = _referenced_numerals(correct_text, list(enumerated.keys())) if enumerated else []

    if referenced:
        claim_items = [(numeral, enumerated[numeral]) for numeral in referenced]
    else:
        claim_items = [(f"trecho {i + 1}", c) for i, c in enumerate(split_claims(correct_text))]

    all_refs = [s.get("referencia", "?") for s in sources]

    if len(claim_items) <= 1:
        # A single, atomic claim (the whole alternative is one thing, not
        # an enumeration or a compound "X, com Y" statement) is often just
        # the crime's DOCTRINAL NAME — e.g. "tráfico de influência" for CP
        # art. 332, whose statutory text describes the CONDUCT and never
        # spells out that name. Literal lexical overlap would wrongly flag
        # this as unsupported. For this one-part case, trust the selector
        # instead: worker/legal_base/evidence_selector.py already requires
        # HIGH confidence, or MEDIUM confirmed across >= 2 independent
        # query variants (including one built from the alternative text
        # itself), before a source is even allowed into `sources` — that
        # cross-confirmation already IS the coverage for an atomic claim.
        # Multi-part claims (below) get the finer per-claim lexical check,
        # since that's genuinely something the selector doesn't verify.
        label = claim_items[0][0] if claim_items else "trecho 1"
        if sources:
            return {
                "status": "complete",
                "claims": [label],
                "supported": [label],
                "missing": [],
                "claim_sources": {label: all_refs},
                "sources": all_refs,
            }
        return {
            "status": "insufficient",
            "claims": [label] if claim_items else [],
            "supported": [],
            "missing": [label] if claim_items else [],
            "claim_sources": {},
            "sources": all_refs,
        }

    evidence_texts = [(s.get("referencia", "?"), s.get("texto", "")) for s in sources]

    supported: list[str] = []
    missing: list[str] = []
    claim_sources: dict[str, list[str]] = {}

    for label, claim_text in claim_items:
        matches = [ref for ref, text in evidence_texts if claim_supported_by(claim_text, text)]
        if matches:
            supported.append(label)
            claim_sources[label] = matches
        else:
            missing.append(label)

    if not missing:
        status = "complete"
    elif supported:
        status = "partial"
    else:
        status = "insufficient"

    return {
        "status": status,
        "claims": [label for label, _ in claim_items],
        "supported": supported,
        "missing": missing,
        "claim_sources": claim_sources,
        "sources": [s.get("referencia", "?") for s in sources],
    }
