from __future__ import annotations

import json
import os
from pathlib import Path

from .text_utils import normalize_for_index, tokenize_query


DEFAULT_ADVOCACIA_ABERTA_DATA_DIR = (
    Path.home()
    / "Downloads"
    / "advocacia-aberta"
    / "ferramentas"
    / "pesquisa"
    / "vade-mecum"
    / "data"
)

LEGISLATION_FILES = {
    "Constituição Federal": "lei_cf.json",
    "Código Penal": "lei_cp.json",
    "Código de Processo Penal": "lei_cpp.json",
}


def get_data_dir() -> Path:
    override = os.environ.get("ADVOCACIA_ABERTA_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return DEFAULT_ADVOCACIA_ABERTA_DATA_DIR


def _token_matches(query_token: str, source_token: str) -> bool:
    if query_token == source_token:
        return True

    # Pequena tolerância lexical determinística:
    # produzir ↔ produzi-lo, doloso ↔ dolo etc.
    if min(len(query_token), len(source_token)) >= 5:
        if query_token.startswith(source_token) or source_token.startswith(query_token):
            return True

    return False


def _subject_matches(subject: str | None, diploma: str) -> bool:
    if not subject:
        return True

    s = normalize_for_index(subject)
    d = normalize_for_index(diploma)

    aliases = {
        "direito penal": "codigo penal",
        "penal": "codigo penal",
        "direito processual penal": "codigo de processo penal",
        "processual penal": "codigo de processo penal",
        "direito constitucional": "constituicao federal",
        "constitucional": "constituicao federal",
    }

    normalized_subject = aliases.get(s, s)

    return normalized_subject in d or d in normalized_subject


def _load_diploma(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def search_advocacia_aberta(
    query: str,
    subject: str | None = None,
    limit: int = 5,
    data_dir: Path | str | None = None,
) -> list[dict]:
    """
    Busca determinística nos JSONs do projeto Advocacia Aberta.

    Nesta primeira versão:
      - CF
      - Código Penal
      - CPP

    Usa texto oficial + keywords apenas para RECUPERAÇÃO.
    Keywords nunca são tratadas como fonte jurídica factual para o Ollama.
    """
    root = Path(data_dir) if data_dir else get_data_dir()

    if not root.exists():
        raise FileNotFoundError(
            f"Base Advocacia Aberta não encontrada em: {root}\n"
            "Defina ADVOCACIA_ABERTA_DATA_DIR se o repositório estiver em outro local."
        )

    normalized_query = normalize_for_index(query).strip()
    query_tokens = tokenize_query(query)

    if not query_tokens:
        return []

    candidates: list[dict] = []

    for expected_diploma, filename in LEGISLATION_FILES.items():
        path = root / filename
        if not path.exists():
            continue

        data = _load_diploma(path)
        meta = data.get("_meta", {})
        diploma = meta.get("nome") or expected_diploma

        if not _subject_matches(subject, diploma):
            continue

        for artigo, record in data.get("artigos", {}).items():
            texto = record.get("texto", "") or ""
            keywords = record.get("keywords", []) or []

            normalized_text = normalize_for_index(texto)
            normalized_keywords = [
                normalize_for_index(str(keyword))
                for keyword in keywords
            ]

            source_tokens = tokenize_query(
                " ".join([texto, *[str(k) for k in keywords]])
            )

            matched_query_tokens: list[str] = []

            for qtoken in query_tokens:
                if any(_token_matches(qtoken, stoken) for stoken in source_tokens):
                    matched_query_tokens.append(qtoken)

            keyword_hits = 0
            for keyword in normalized_keywords:
                keyword_tokens = tokenize_query(keyword)
                if keyword_tokens and all(
                    any(_token_matches(kt, qt) for qt in query_tokens)
                    for kt in keyword_tokens
                ):
                    keyword_hits += 1

            exact_in_text = bool(
                normalized_query and normalized_query in normalized_text
            )

            exact_in_keyword = bool(
                normalized_query
                and any(normalized_query in keyword for keyword in normalized_keywords)
            )

            coverage = (
                len(set(matched_query_tokens)) / len(query_tokens)
                if query_tokens
                else 0.0
            )

            # Para consultas maiores exigimos alguma concorrência de termos,
            # evitando que um único termo genérico abra a porta.
            minimum_matches = 1 if len(query_tokens) <= 2 else 2

            if (
                not exact_in_text
                and not exact_in_keyword
                and len(set(matched_query_tokens)) < minimum_matches
                and keyword_hits == 0
            ):
                continue

            score = 0.0

            if exact_in_text:
                score += 100.0

            if exact_in_keyword:
                score += 90.0

            score += coverage * 40.0
            score += keyword_hits * 15.0
            score += len(set(matched_query_tokens)) * 2.0

            match_type = (
                "advocacia_exact"
                if exact_in_text or exact_in_keyword
                else "advocacia_keyword"
            )

            hierarchy = record.get("hierarchy") or {}

            candidates.append(
                {
                    "diploma": diploma,
                    "tipo": meta.get("lei", ""),
                    "numero": meta.get("lei", ""),
                    "artigo": str(record.get("numero") or artigo),
                    "paragrafo": None,
                    "inciso": None,
                    "alinea": None,
                    "texto": texto,
                    "referencia": f"{diploma}, art. {record.get('numero') or artigo}",
                    "fonte": "Advocacia Aberta / fonte oficial",
                    "url_oficial": record.get("url") or meta.get("url_base", ""),
                    "data_de_coleta": meta.get("gerado_em", ""),
                    "score": score,
                    "match_type": match_type,
                    "origin": "advocacia_aberta",
                    "coverage": coverage,
                    "keyword_hits": keyword_hits,
                    "matched_query_tokens": sorted(set(matched_query_tokens)),
                    "keywords": keywords,
                    "hierarchy": hierarchy,
                }
            )

    candidates.sort(
        key=lambda r: (
            -r["score"],
            -r["coverage"],
            -r["keyword_hits"],
            r["diploma"],
            int(r["artigo"]) if str(r["artigo"]).isdigit() else 999999,
        )
    )

    return candidates[:limit]
