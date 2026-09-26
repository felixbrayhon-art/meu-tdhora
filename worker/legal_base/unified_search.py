from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from .advocacia_aberta import search_advocacia_aberta
from .db import DEFAULT_DB_PATH
from .search import get_article_text, search_legal_sources
from .text_utils import tokenize_query


SUBJECT_TO_DIPLOMA = {
    "direito penal": "Código Penal",
    "penal": "Código Penal",
    "direito processual penal": "Código de Processo Penal",
    "processual penal": "Código de Processo Penal",
    "direito constitucional": "Constituição Federal",
    "constitucional": "Constituição Federal",
}

CONFIDENCE_ORDER = {
    "HIGH": 0,
    "MEDIUM": 1,
    "LOW": 2,
}


def _normalize(text: str | None) -> str:
    if not text:
        return ""

    text = "".join(
        c
        for c in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(c)
    )

    return re.sub(r"\s+", " ", text.lower().strip())


def _local_subject(subject: str | None) -> str | None:
    if not subject:
        return None

    normalized = _normalize(subject)
    return SUBJECT_TO_DIPLOMA.get(normalized, subject)


def _anchor(diploma: str, artigo: str) -> tuple[str, str]:
    return (
        _normalize(diploma),
        str(artigo).strip().lower(),
    )


def _token_matches(a: str, b: str) -> bool:
    if a == b:
        return True

    if min(len(a), len(b)) >= 5:
        return a.startswith(b) or b.startswith(a)

    return False


def _direct_text_match_count(query: str, text: str) -> int:
    """
    Conta quantos termos significativos da consulta aparecem no TEXTO
    jurídico propriamente dito.

    Keywords/metadados não entram aqui.
    """
    query_tokens = tokenize_query(query)
    text_tokens = tokenize_query(text)

    matched = set()

    for qtoken in query_tokens:
        if any(_token_matches(qtoken, token) for token in text_tokens):
            matched.add(qtoken)

    return len(matched)


def _rrf(rank: int | None, k: int = 60) -> float:
    if rank is None:
        return 0.0
    return 1.0 / (k + rank)


def _confidence(
    local: dict | None,
    advocacia: dict | None,
    local_rank: int | None,
    advocacia_rank: int | None,
    query: str,
) -> tuple[str, str]:

    if local and advocacia:

        local_direct_matches = _direct_text_match_count(
            query,
            local.get("texto", ""),
        )

        advocacia_direct_matches = _direct_text_match_count(
            query,
            advocacia.get("texto", ""),
        )

        direct_matches = max(
            local_direct_matches,
            advocacia_direct_matches,
        )

        # Concordância de ranking sozinha não basta.
        # HIGH exige também sustentação lexical no texto jurídico,
        # e não apenas nas keywords.
        if local_rank == 1 and advocacia_rank == 1:
            if (
                local.get("match_type") == "exact"
                or direct_matches >= 3
            ):
                return (
                    "HIGH",
                    "1º lugar nas duas bases com forte correspondência no texto jurídico",
                )

            return (
                "MEDIUM",
                "1º lugar nas duas bases, mas com correspondência direta limitada no texto jurídico",
            )

        # Frase normativa exata na base local, confirmada pelo
        # Advocacia Aberta entre seus primeiros resultados.
        if (
            local.get("match_type") == "exact"
            and advocacia_rank is not None
            and advocacia_rank <= 3
        ):
            return (
                "HIGH",
                "frase exata na base normativa local com confirmação externa",
            )

        # Frase exata no artigo estruturado e confirmação forte
        # pela base normativa local.
        if (
            advocacia.get("match_type") == "advocacia_exact"
            and local_rank is not None
            and local_rank <= 3
        ):
            return (
                "HIGH",
                "frase exata no artigo estruturado com confirmação da base local",
            )

        # Concordância razoável, mas não forte o suficiente para HIGH.
        if (
            local_rank is not None
            and advocacia_rank is not None
            and local_rank <= 3
            and advocacia_rank <= 3
        ):
            return (
                "MEDIUM",
                "mesmo artigo apareceu entre os 3 primeiros nas duas bases",
            )

        return (
            "LOW",
            "mesmo artigo apareceu nas duas bases, mas com ranking fraco",
        )

    if local:
        if local.get("match_type") == "exact":
            return (
                "MEDIUM",
                "frase exata encontrada apenas na base normativa local",
            )

        return (
            "LOW",
            "correspondência lexical apenas na base normativa local",
        )

    if advocacia:
        if advocacia.get("match_type") == "advocacia_exact":
            return (
                "MEDIUM",
                "frase exata encontrada apenas no artigo estruturado",
            )

        return (
            "LOW",
            "resultado recuperado apenas por busca lexical/keywords",
        )

    return "LOW", "sem evidência suficiente"


def search_unified_legal_sources(
    query: str,
    subject: str | None = None,
    limit: int = 5,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:

    candidate_limit = max(limit * 4, 12)

    local_results = search_legal_sources(
        query,
        subject=_local_subject(subject),
        limit=candidate_limit,
        db_path=db_path,
    )

    advocacia_results = search_advocacia_aberta(
        query,
        subject=subject,
        limit=candidate_limit,
    )

    local_by_anchor: dict[tuple[str, str], list[dict]] = {}
    local_rank_by_anchor: dict[tuple[str, str], int] = {}

    for rank, item in enumerate(local_results, start=1):
        key = _anchor(item["diploma"], item["artigo"])

        local_by_anchor.setdefault(key, []).append(item)
        local_rank_by_anchor.setdefault(key, rank)

    aa_by_anchor: dict[tuple[str, str], dict] = {}
    aa_rank_by_anchor: dict[tuple[str, str], int] = {}

    for rank, item in enumerate(advocacia_results, start=1):
        key = _anchor(item["diploma"], item["artigo"])

        aa_by_anchor.setdefault(key, item)
        aa_rank_by_anchor.setdefault(key, rank)

    all_anchors = set(local_by_anchor) | set(aa_by_anchor)

    merged: list[dict] = []

    for key in all_anchors:
        locals_for_article = local_by_anchor.get(key, [])
        aa = aa_by_anchor.get(key)

        local = locals_for_article[0] if locals_for_article else None

        local_rank = local_rank_by_anchor.get(key)
        aa_rank = aa_rank_by_anchor.get(key)

        confidence, reason = _confidence(
            local,
            aa,
            local_rank,
            aa_rank,
            query,
        )

        fusion_score = (
            _rrf(local_rank)
            + _rrf(aa_rank)
        )

        if local:
            result = dict(local)
            result["origin"] = "local"

        else:
            assert aa is not None

            article_text = get_article_text(
                aa["diploma"],
                aa["artigo"],
                db_path=db_path,
            )

            result = {
                "diploma": aa["diploma"],
                "tipo": aa.get("tipo", ""),
                "numero": aa.get("numero", ""),
                "artigo": aa["artigo"],
                "paragrafo": None,
                "inciso": None,
                "alinea": None,
                "texto": article_text or aa["texto"],
                "referencia": aa["referencia"],
                "fonte": (
                    "Base normativa local — texto oficial"
                    if article_text
                    else aa["fonte"]
                ),
                "url_oficial": aa["url_oficial"],
                "data_de_coleta": aa.get("data_de_coleta", ""),
                "score": aa["score"],
                "match_type": aa["match_type"],
                "origin": (
                    "advocacia_aberta_recovered_from_local"
                    if article_text
                    else "advocacia_aberta"
                ),
            }

        result["confidence"] = confidence
        result["confidence_reason"] = reason

        result["local_rank"] = local_rank
        result["advocacia_rank"] = aa_rank
        result["fusion_score"] = fusion_score

        result["confirmed_by_advocacia_aberta"] = aa is not None

        if aa:
            result["advocacia_match_type"] = aa.get("match_type")
            result["advocacia_coverage"] = aa.get("coverage")
            result["advocacia_keyword_hits"] = aa.get(
                "keyword_hits",
                0,
            )
            result["advocacia_keywords"] = aa.get(
                "keywords",
                [],
            )
        else:
            result["advocacia_match_type"] = None
            result["advocacia_coverage"] = None
            result["advocacia_keyword_hits"] = 0
            result["advocacia_keywords"] = []

        merged.append(result)

    merged.sort(
        key=lambda r: (
            CONFIDENCE_ORDER[r["confidence"]],
            -r["fusion_score"],
            r["local_rank"] if r["local_rank"] is not None else 999999,
            r["advocacia_rank"] if r["advocacia_rank"] is not None else 999999,
            r["diploma"],
            str(r["artigo"]),
        )
    )

    return merged[:limit]
