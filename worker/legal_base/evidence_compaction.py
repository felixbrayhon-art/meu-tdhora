from __future__ import annotations

import math
from pathlib import Path

from .db import DEFAULT_DB_PATH
from .evidence_coverage import assess_evidence_coverage
from .search import get_article_units
from .text_utils import normalize_for_index, tokenize_query

# Deterministic evidence compaction — runs AFTER retrieval/enrichment/
# augmentation/coverage (see worker/legal_base/evidence_pipeline.py), right
# before building the Ollama prompt. No AI, no embeddings: a large
# "artigo completo" source gets broken back into its individual caput/
# parágrafo/inciso/alínea rows (worker/legal_base/search.py::get_article_units)
# and only the unit(s) with real lexical relevance to THIS question are
# kept — e.g. CF art. 5º's 78 incisos collapse down to just inciso VIII
# when that's what the question actually needs. This exists because a 4B
# local model was observed hallucinating, reproducibly, on a ~14k-char
# prompt built from an unpruned full article (see the batch run that
# motivated this module) — the fix is less context, not a bigger model or
# a longer timeout.

MAX_CHARS_PER_SOURCE = 2000
MAX_TOTAL_CHARS = 6000


def _terms_match(a: str, b: str) -> bool:
    """Same tiny fuzzy-match rule reimplemented in every worker/legal_base/
    module that needs it (unified_search.py, advocacia_aberta.py,
    evidence_coverage.py) — kept local here too rather than importing a
    private helper across modules that can change independently.
    """
    if a == b:
        return True
    if min(len(a), len(b)) >= 5:
        return a.startswith(b) or b.startswith(a)
    return False


def _score_unit(unit_texto: str, query_terms: list[str], exact_phrase: str) -> tuple[int, int]:
    """(exact_phrase_hit, term_coverage_count) — sorted descending, this
    directly encodes the priority order requested: 1) exact expression
    match, 2) term coverage, (3) lexical intersection is implied by using
    fuzzy per-term matching rather than a raw count, 4) position is the
    caller's tie-break, not part of this score.
    """
    normalized_unit = normalize_for_index(unit_texto)
    exact_hit = 1 if (exact_phrase and exact_phrase in normalized_unit) else 0
    unit_tokens = tokenize_query(unit_texto)
    covered = sum(1 for t in query_terms if any(_terms_match(t, ut) for ut in unit_tokens))
    return (exact_hit, covered)


def _select_units(ranked: list[tuple[tuple[int, int], dict]], max_chars_per_source: int) -> list[dict]:
    """Always keeps the single best-ranked unit whole, even if it alone
    exceeds the per-source budget — never cuts a unit mid-text. Adds more
    units only while they (a) still carry real lexical signal and (b) fit
    the remaining budget, then returns them in original document order.
    """
    if not ranked:
        return []

    chosen = [ranked[0][1]]
    total = len(chosen[0]["prefixed_texto"])

    # A second (or third...) unit only earns its place if it's genuinely
    # near-tied with the best match — otherwise, on a long article with a
    # long narrative enunciado (dozens of tokens), nearly every unit
    # shares two or three generic legal words ("lei", "direito",
    # "pessoa"...) purely by chance, and any looser bar just re-admits
    # that noise instead of actually compacting (observed empirically on
    # CF art. 5º: the real top match had 7 shared terms, but a "half of
    # top" bar of 3 pulled in ten unrelated incisos that also happened to
    # clear 3). 80% of the top score's own count, floored at 2.
    top_score = ranked[0][0]
    min_covered_to_include = max(2, math.ceil(top_score[1] * 0.8))

    for score, unit in ranked[1:]:
        exact_hit, covered = score
        if not exact_hit and covered < min_covered_to_include:
            break  # sorted descending — nothing further down scores any better
        candidate_len = len(unit["prefixed_texto"])
        if total + candidate_len > max_chars_per_source:
            continue  # this one doesn't fit, but a smaller later one still might
        chosen.append(unit)
        total += candidate_len

    chosen.sort(key=lambda u: u["position"])
    return chosen


def _unit_short_label(unit: dict) -> str:
    if unit.get("alinea"):
        return f"alínea {unit['alinea']}"
    if unit.get("inciso"):
        return f"inciso {unit['inciso']}"
    if unit.get("paragrafo") == "único":
        return "parágrafo único"
    if unit.get("paragrafo"):
        return f"§ {unit['paragrafo']}º"
    return "caput"


def _referencia_for_units(diploma: str, artigo: str, units: list[dict]) -> str:
    labels = [_unit_short_label(u) for u in units]
    if len(units) == 1:
        label = labels[0]
        return f"{diploma}, art. {artigo}" + (f", {label}" if label != "caput" else "")
    return f"{diploma}, art. {artigo} ({', '.join(labels)})"


def compact_sources(
    statement: str,
    correct_text: str,
    sources: list[dict],
    max_chars_per_source: int = MAX_CHARS_PER_SOURCE,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """Per-source compaction only (no cross-source total budget — see
    `enforce_total_budget`). Every returned dict keeps every original key
    (referencia, diploma, artigo, paragrafo/inciso/alinea if available,
    url_oficial, origin, confidence, selection_reason, ...) and adds
    `original_length`, `compacted_length`, `compaction_reason` for audit.
    """
    query_terms = tokenize_query(f"{statement} {correct_text}")
    exact_phrase = normalize_for_index(correct_text).strip()

    compacted: list[dict] = []
    for source in sources:
        texto = source.get("texto", "")
        original_length = len(texto)

        if original_length <= max_chars_per_source:
            compacted.append(
                {
                    **source,
                    "original_length": original_length,
                    "compacted_length": original_length,
                    "compaction_reason": "já dentro do limite por fonte — sem alteração",
                }
            )
            continue

        has_subdivision = bool(source.get("paragrafo") or source.get("inciso") or source.get("alinea"))
        diploma = source.get("diploma")
        artigo = str(source.get("artigo")) if source.get("artigo") not in (None, "") else ""

        if has_subdivision or not diploma or not artigo:
            # Already a single specific unit (just a long one), or we lack
            # the identifiers needed to re-decompose it (e.g. a súmula) —
            # never truncate mid-unit, so this is kept whole; only the
            # total budget (below) may drop it entirely later.
            compacted.append(
                {
                    **source,
                    "original_length": original_length,
                    "compacted_length": original_length,
                    "compaction_reason": "unidade específica já selecionada, ou não decomponível — mantida inteira",
                }
            )
            continue

        units = get_article_units(diploma, artigo, db_path=db_path)
        if not units:
            compacted.append(
                {
                    **source,
                    "original_length": original_length,
                    "compacted_length": original_length,
                    "compaction_reason": "artigo não encontrado na base para recorte — mantido inteiro",
                }
            )
            continue

        ranked = sorted(
            ((_score_unit(u["texto"], query_terms, exact_phrase), u) for u in units),
            key=lambda pair: (-pair[0][0], -pair[0][1], pair[1]["position"]),
        )
        chosen = _select_units(ranked, max_chars_per_source)

        if not chosen:
            compacted.append(
                {
                    **source,
                    "original_length": original_length,
                    "compacted_length": original_length,
                    "compaction_reason": "nenhuma unidade com sinal lexical suficiente — mantido inteiro",
                }
            )
            continue

        new_texto = "\n".join(u["prefixed_texto"] for u in chosen)
        single = chosen[0] if len(chosen) == 1 else None

        compacted.append(
            {
                **source,
                "paragrafo": single["paragrafo"] if single else None,
                "inciso": single["inciso"] if single else None,
                "alinea": single["alinea"] if single else None,
                "texto": new_texto,
                "referencia": _referencia_for_units(diploma, artigo, chosen),
                "original_length": original_length,
                "compacted_length": len(new_texto),
                "compaction_reason": (
                    f"artigo completo ({original_length} caracteres) reduzido a "
                    f"{len(chosen)} unidade(s) relevante(s): {', '.join(_unit_short_label(u) for u in chosen)}"
                ),
            }
        )

    return compacted


def enforce_total_budget(sources: list[dict], max_total_chars: int = MAX_TOTAL_CHARS) -> list[dict]:
    """Drops whole (already per-source-compacted) sources, lowest
    confidence first, until the combined `compacted_length` fits the
    total budget — never truncates a source's text to make it fit.
    Always keeps at least one source. Preserves original relative order.
    """
    total = sum(s.get("compacted_length", len(s.get("texto", ""))) for s in sources)
    if total <= max_total_chars or not sources:
        return sources

    priority = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    order = sorted(
        range(len(sources)),
        key=lambda i: (priority.get(sources[i].get("confidence"), 3), i),
    )

    kept: set[int] = set()
    running_total = 0
    for i in order:
        length = sources[i].get("compacted_length", len(sources[i].get("texto", "")))
        if running_total + length <= max_total_chars or not kept:
            kept.add(i)
            running_total += length

    return [sources[i] for i in sorted(kept)]


def compact_evidence_for_generation(
    statement: str,
    correct_text: str,
    sources: list[dict],
    coverage: dict,
    max_chars_per_source: int = MAX_CHARS_PER_SOURCE,
    max_total_chars: int = MAX_TOTAL_CHARS,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> tuple[list[dict], dict, dict]:
    """The safe entry point callers (worker/scripts/test_exam_explanation.py,
    worker/scripts/batch_exam_explanations.py) should use. Returns
    (final_sources, final_coverage, metrics).

    Safety invariant (never violated): if `coverage` going in was
    "complete", the returned `final_coverage` is ALSO "complete" — if
    per-source unit selection or the total-budget trim would break that,
    this falls back to a less-compacted (or fully uncompacted) version
    rather than ever handing Ollama a set of sources that no longer
    justifies the gabarito. It never silently proceeds on broken coverage.
    """
    original_total_chars = sum(len(s.get("texto", "")) for s in sources)
    metrics: dict = {"original_total_chars": original_total_chars}

    if coverage.get("status") != "complete":
        # Nothing to protect and nothing worth compacting — the caller
        # shouldn't be generating from this anyway.
        metrics.update(compacted_total_chars=original_total_chars, reduction_pct=0.0, restored=False, per_source=[])
        return sources, coverage, metrics

    step1 = compact_sources(statement, correct_text, sources, max_chars_per_source, db_path=db_path)
    coverage_after_units = assess_evidence_coverage(statement, correct_text, step1)

    if coverage_after_units["status"] != "complete":
        metrics.update(
            compacted_total_chars=original_total_chars,
            reduction_pct=0.0,
            restored=True,
            restore_reason="recorte por unidade removeria fundamento necessário — fontes originais mantidas",
            per_source=[],
        )
        return sources, coverage, metrics

    step2 = enforce_total_budget(step1, max_total_chars)
    coverage_after_budget = assess_evidence_coverage(statement, correct_text, step2)

    if coverage_after_budget["status"] != "complete":
        final_sources, final_coverage = step1, coverage_after_units
        restored = True
        restore_reason = "corte por orçamento total removeria fundamento necessário — mantido só o recorte por unidade"
    else:
        final_sources, final_coverage = step2, coverage_after_budget
        restored = False
        restore_reason = None

    compacted_total_chars = sum(len(s.get("texto", "")) for s in final_sources)
    metrics.update(
        compacted_total_chars=compacted_total_chars,
        reduction_pct=(
            round(100 * (1 - compacted_total_chars / original_total_chars), 1) if original_total_chars else 0.0
        ),
        restored=restored,
        restore_reason=restore_reason,
        per_source=[
            {
                "referencia": s.get("referencia"),
                "original_length": s.get("original_length", len(s.get("texto", ""))),
                "compacted_length": s.get("compacted_length", len(s.get("texto", ""))),
                "compaction_reason": s.get("compaction_reason"),
            }
            for s in final_sources
        ],
    )
    return final_sources, final_coverage, metrics
