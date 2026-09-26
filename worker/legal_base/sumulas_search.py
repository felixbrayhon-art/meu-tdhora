from __future__ import annotations

import json
from pathlib import Path

from .advocacia_aberta import get_data_dir
from .text_utils import normalize_for_index, tokenize_query

# Deterministic súmula search (STF, STJ, vinculantes) — same Advocacia
# Aberta data directory as worker/legal_base/advocacia_aberta.py, but a
# separate module on purpose: súmulas are jurisprudência, never treated as
# the primary legal text for CF/CP/CPP (that's always the Planalto base in
# worker/legal_base/search.py). This is meant to be called SPARINGLY, as a
# supplement when legislation alone doesn't cover part of a claim — see
# worker/legal_base/evidence_coverage.py and the "augment" step in the exam
# scripts, not as a first-tier source.

SUMULA_FILES = {
    "STF": "sumulas_stf.json",
    "STJ": "sumulas_stj.json",
    "STF-Vinculante": "sumulas_vinculantes.json",
}

# A súmula must clear this bar to ever be surfaced — deliberately strict
# since jurisprudência should not "outrank" directly relevant legislation
# (rule 7/10 in the request this module was built for).
MIN_SHARED_TERMS_FOR_MATCH = 3


def _load_sumulas(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def search_sumulas(
    query: str,
    tribunal: str | None = None,
    limit: int = 3,
    data_dir: Path | str | None = None,
    min_shared_terms: int = MIN_SHARED_TERMS_FOR_MATCH,
) -> list[dict]:
    """Deterministic keyword search over súmulas (STF/STJ/vinculantes) —
    no AI, no embeddings. Returns dicts shaped close enough to the legal
    provision results (referencia/texto/url_oficial/fonte/score/match_type)
    to be mixed into an evidence list, tagged with tipo="Súmula" so callers
    can tell them apart from legislation.
    """
    root = Path(data_dir) if data_dir else get_data_dir()
    query_tokens = tokenize_query(query)
    if not query_tokens or not root.exists():
        return []

    files = SUMULA_FILES if not tribunal else {tribunal: SUMULA_FILES[tribunal]}
    normalized_query = normalize_for_index(query).strip()

    candidates: list[dict] = []
    for trib, filename in files.items():
        path = root / filename
        if not path.exists():
            continue
        data = _load_sumulas(path)
        for numero, record in data.get("sumulas", {}).items():
            enunciado = record.get("enunciado", "") or ""
            if record.get("status") == "cancelada":
                continue

            normalized_text = normalize_for_index(enunciado)
            text_tokens = tokenize_query(enunciado)
            shared = {t for t in query_tokens if t in text_tokens}

            exact = bool(normalized_query and normalized_query in normalized_text)
            if not exact and len(shared) < min_shared_terms:
                continue

            score = (100.0 if exact else 0.0) + len(shared) * 5.0

            candidates.append(
                {
                    "diploma": f"Súmula {record.get('numero', numero)} do {trib}",
                    "tipo": "Súmula",
                    "numero": str(record.get("numero", numero)),
                    "artigo": str(record.get("numero", numero)),
                    "paragrafo": None,
                    "inciso": None,
                    "alinea": None,
                    "texto": enunciado,
                    "referencia": f"Súmula {record.get('numero', numero)} do {trib}",
                    "fonte": f"Súmula {trib} nº {record.get('numero', numero)} ({record.get('orgao', '')})".strip(),
                    "url_oficial": record.get("url", ""),
                    "data_de_coleta": data.get("_meta", {}).get("gerado_em", ""),
                    "score": score,
                    "match_type": "sumula_exact" if exact else "sumula_keyword",
                    "origin": "sumula",
                    "tribunal": trib,
                    "shared_terms": sorted(shared),
                }
            )

    candidates.sort(key=lambda c: (-c["score"], c["diploma"]))
    return candidates[:limit]
