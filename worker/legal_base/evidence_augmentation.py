from __future__ import annotations

from .evidence_coverage import assess_evidence_coverage, claim_supported_by, extract_enumerated_affirmatives, split_claims
from .sumulas_search import search_sumulas

# Súmula augmentation — deliberately the LAST step, and only ever touches
# claims that legislation-only coverage left MISSING. Jurisprudência never
# gets a chance to outrank directly relevant legislation (it's not even
# consulted when coverage is already complete), and a súmula is only kept
# if it actually re-satisfies the same lexical-support check every other
# claim has to pass — never accepted on trust just because the search
# returned something.


def _claim_text_lookup(statement: str, correct_text: str) -> dict[str, str]:
    lookup = dict(extract_enumerated_affirmatives(statement))
    for i, claim in enumerate(split_claims(correct_text), start=1):
        lookup[f"trecho {i}"] = claim
    return lookup


def augment_missing_claims_with_sumulas(
    statement: str,
    correct_text: str,
    sources: list[dict],
    coverage: dict,
    tribunal: str = "STJ",
    candidates_per_claim: int = 3,
) -> tuple[list[dict], dict]:
    """If `coverage` already reports "complete", returns (sources, coverage)
    unchanged — súmulas are a supplement for gaps, never a first-tier
    source. Otherwise, tries one deterministic súmula search per MISSING
    claim; a candidate is only added when it independently passes the same
    `claim_supported_by` check used to compute coverage in the first
    place. Recomputes coverage afterward so callers see the real, final
    picture instead of trusting that the addition helped.
    """
    if coverage.get("status") == "complete" or not coverage.get("missing"):
        return sources, coverage

    claim_text_by_label = _claim_text_lookup(statement, correct_text)
    augmented = list(sources)
    added_any = False

    for label in coverage["missing"]:
        claim_text = claim_text_by_label.get(label)
        if not claim_text:
            continue

        query = f"{statement} {claim_text}"
        for candidate in search_sumulas(query, tribunal=tribunal, limit=candidates_per_claim):
            if claim_supported_by(claim_text, candidate["texto"]):
                augmented.append(candidate)
                added_any = True
                break

    if not added_any:
        return sources, coverage

    new_coverage = assess_evidence_coverage(statement, correct_text, augmented)
    return augmented, new_coverage
