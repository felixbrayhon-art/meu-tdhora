from __future__ import annotations

from pathlib import Path

from .db import DEFAULT_DB_PATH
from .text_utils import normalize_for_index
from .unified_search import search_unified_legal_sources


CONFIDENCE_WEIGHT = {
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


def _article_key(item: dict) -> tuple[str, str]:
    return (
        normalize_for_index(item.get("diploma", "")).strip(),
        str(item.get("artigo", "")).strip().lower(),
    )


def build_query_variants(
    statement: str,
    correct_text: str,
    subject: str | None,
) -> list[tuple[str, str]]:
    """
    Gera consultas determinísticas.

    Nenhuma IA é usada para reescrever ou interpretar a pergunta.
    """
    raw = [
        ("enunciado", statement),
        ("alternativa_correta", correct_text),
        (
            "enunciado_mais_alternativa",
            f"{statement} {correct_text}",
        ),
        (
            "materia_mais_alternativa",
            f"{subject or ''} {correct_text}".strip(),
        ),
    ]

    result: list[tuple[str, str]] = []
    seen: set[str] = set()

    for name, query in raw:
        query = query.strip()

        if not query:
            continue

        normalized = normalize_for_index(query).strip()

        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        result.append((name, query))

    return result


def _candidate_quality(
    item: dict,
    rank: int,
) -> tuple:
    confidence = CONFIDENCE_WEIGHT.get(
        item.get("confidence", "LOW"),
        0,
    )

    exact = int(
        item.get("match_type") == "exact"
        or item.get("advocacia_match_type") == "advocacia_exact"
    )

    confirmed = int(
        bool(item.get("confirmed_by_advocacia_aberta"))
    )

    specific = int(
        bool(
            item.get("paragrafo")
            or item.get("inciso")
            or item.get("alinea")
        )
    )

    return (
        confidence,
        exact,
        confirmed,
        specific,
        -rank,
    )


def select_question_evidence(
    statement: str,
    correct_text: str,
    subject: str | None = None,
    limit: int = 3,
    per_query_limit: int = 5,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """
    Recupera e seleciona fontes jurídicas para UMA questão.

    Regras conservadoras:
      - LOW sozinho nunca entra.
      - qualquer HIGH pode entrar;
      - MEDIUM só entra quando o mesmo artigo possui evidência
        MEDIUM/HIGH em pelo menos duas consultas diferentes;
      - máximo padrão de 3 artigos;
      - scores internos de bases diferentes nunca são comparados.
    """
    variants = build_query_variants(
        statement,
        correct_text,
        subject,
    )

    aggregated: dict[tuple[str, str], dict] = {}

    for query_name, query in variants:
        results = search_unified_legal_sources(
            query=query,
            subject=subject,
            limit=per_query_limit,
            db_path=db_path,
        )

        for rank, item in enumerate(results, start=1):
            key = _article_key(item)

            entry = aggregated.setdefault(
                key,
                {
                    "best": None,
                    "best_quality": None,
                    "query_hits": set(),
                    "strong_query_hits": set(),
                    "high_hits": set(),
                    "medium_hits": set(),
                    "rrf": 0.0,
                    "best_rank": 999999,
                },
            )

            entry["query_hits"].add(query_name)
            entry["rrf"] += 1.0 / (60 + rank)
            entry["best_rank"] = min(
                entry["best_rank"],
                rank,
            )

            confidence = item.get(
                "confidence",
                "LOW",
            )

            if confidence in {"HIGH", "MEDIUM"}:
                entry["strong_query_hits"].add(query_name)

            if confidence == "HIGH":
                entry["high_hits"].add(query_name)

            if confidence == "MEDIUM":
                entry["medium_hits"].add(query_name)

            quality = _candidate_quality(
                item,
                rank,
            )

            if (
                entry["best"] is None
                or quality > entry["best_quality"]
            ):
                entry["best"] = dict(item)
                entry["best_quality"] = quality

    selected: list[dict] = []

    for entry in aggregated.values():
        best = entry["best"]

        if not best:
            continue

        high_count = len(entry["high_hits"])
        strong_count = len(entry["strong_query_hits"])

        if high_count >= 1:
            eligible = True
            selection_reason = (
                f"HIGH em {high_count} consulta(s)"
            )

        elif strong_count >= 2:
            eligible = True
            selection_reason = (
                "MEDIUM/HIGH confirmado por "
                f"{strong_count} consultas diferentes"
            )

        else:
            eligible = False
            selection_reason = (
                "evidência insuficiente para envio ao modelo"
            )

        if not eligible:
            continue

        best["selection_query_hits"] = sorted(
            entry["query_hits"]
        )
        best["selection_strong_query_hits"] = sorted(
            entry["strong_query_hits"]
        )
        best["selection_high_hits"] = sorted(
            entry["high_hits"]
        )
        best["selection_rrf"] = entry["rrf"]
        best["selection_reason"] = selection_reason

        selected.append(best)

    selected.sort(
        key=lambda item: (
            -CONFIDENCE_WEIGHT.get(
                item.get("confidence", "LOW"),
                0,
            ),
            -len(
                item.get(
                    "selection_high_hits",
                    [],
                )
            ),
            -len(
                item.get(
                    "selection_strong_query_hits",
                    [],
                )
            ),
            -item.get("selection_rrf", 0.0),
        )
    )

    return selected[:limit]
