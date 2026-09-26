from __future__ import annotations

import re
from pathlib import Path

from .db import DEFAULT_DB_PATH
from .search import get_article_text


REFERENCE_RE = re.compile(
    r"\bart\.?\s*(\d+(?:-[A-Za-z])?)"
    r"(?:º)?"
    r"(?:\s*,?\s*(?:§|parágrafo|inciso|alínea).*)?",
    re.IGNORECASE,
)


def enrich_with_full_articles(
    sources: list[dict],
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """
    Adiciona contexto do artigo completo quando a evidência selecionada
    representa apenas inciso/parágrafo/alínea.

    Não substitui a fonte fina.
    Não usa IA.
    """
    enriched: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    for source in sources:
        original_key = (
            source.get("diploma", ""),
            str(source.get("artigo", "")),
            source.get("referencia", ""),
        )

        if original_key not in seen:
            enriched.append(source)
            seen.add(original_key)

        has_subdivision = bool(
            source.get("paragrafo")
            or source.get("inciso")
            or source.get("alinea")
        )

        if not has_subdivision:
            continue

        diploma = source.get("diploma")
        artigo = str(source.get("artigo", ""))

        if not diploma or not artigo:
            continue

        full_text = get_article_text(
            diploma,
            artigo,
            db_path=db_path,
        )

        if not full_text:
            continue

        full_reference = f"{diploma}, art. {artigo} — artigo completo"

        key = (
            diploma,
            artigo,
            full_reference,
        )

        if key in seen:
            continue

        enriched.append(
            {
                **source,
                "paragrafo": None,
                "inciso": None,
                "alinea": None,
                "texto": full_text,
                "referencia": full_reference,
                "origin": "local_article_context",
                "confidence": source.get("confidence"),
                "selection_reason": (
                    "contexto completo de artigo já selecionado"
                ),
                "is_article_context": True,
            }
        )

        seen.add(key)

    return enriched


def enrich_articles_when_coverage_incomplete(
    sources: list[dict],
    coverage_status: str,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """Complements `enrich_with_full_articles`, which only widens an
    evidence row that IS already a sub-division (inciso/parágrafo/alínea).
    It misses the opposite, equally real case: a CAPUT (or a single
    parágrafo) was selected and sustains one part of the alternative, but a
    SIBLING parágrafo of that same article — never itself selected,
    because nothing in the query pointed at it directly — is needed for
    another part. Example: CPP art. 157 caput was selected (supports "as
    provas ilícitas são inadmissíveis"), but a question's third affirmative
    depends on art. 157 § 3º, which the selector never had a reason to
    surface on its own.

    Deliberately gated on `coverage_status` (only runs when coverage is
    NOT already "complete") so this doesn't inflate every prompt with
    full-article text when the selected evidence already suffices.
    """
    if coverage_status == "complete":
        return sources

    enriched = list(sources)
    seen = {
        (source.get("diploma", ""), str(source.get("artigo", "")), source.get("referencia", ""))
        for source in sources
    }

    for source in sources:
        diploma = source.get("diploma")
        artigo = str(source.get("artigo", ""))
        if not diploma or not artigo:
            continue

        full_text = get_article_text(diploma, artigo, db_path=db_path)
        if not full_text:
            continue

        full_reference = f"{diploma}, art. {artigo} — artigo completo"
        key = (diploma, artigo, full_reference)
        if key in seen:
            continue

        enriched.append(
            {
                **source,
                "paragrafo": None,
                "inciso": None,
                "alinea": None,
                "texto": full_text,
                "referencia": full_reference,
                "origin": "local_article_context",
                "confidence": source.get("confidence"),
                "selection_reason": "contexto completo de artigo já selecionado (coverage incompleta)",
                "is_article_context": True,
            }
        )
        seen.add(key)

    return enriched


def extract_article_references(
    sources: list[dict],
) -> list[tuple[str, str]]:
    """
    Extrai referências explícitas do tipo 'art. 5º' presentes
    no texto das fontes já selecionadas.

    Apenas identifica referências; não decide relevância.
    """
    refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for source in sources:
        diploma = source.get("diploma")

        if not diploma:
            continue

        texto = source.get("texto", "")

        for match in REFERENCE_RE.finditer(texto):
            artigo = match.group(1)

            key = (diploma, artigo)

            if key not in seen:
                refs.append(key)
                seen.add(key)

    return refs


def enrich_referenced_articles(
    sources: list[dict],
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """
    Segue referências explícitas a outros artigos do mesmo diploma.

    Exemplo:
    CF art. 15, IV menciona art. 5º, VIII
    -> adiciona o texto completo do art. 5º.

    Não usa IA.
    """
    enriched = list(sources)

    existing = {
        (
            source.get("diploma", ""),
            str(source.get("artigo", "")),
        )
        for source in sources
    }

    for diploma, artigo in extract_article_references(sources):
        key = (diploma, artigo)

        if key in existing:
            continue

        full_text = get_article_text(
            diploma,
            artigo,
            db_path=db_path,
        )

        if not full_text:
            continue

        enriched.append(
            {
                "diploma": diploma,
                "artigo": artigo,
                "paragrafo": None,
                "inciso": None,
                "alinea": None,
                "referencia": (
                    f"{diploma}, art. {artigo} "
                    "— referência interna"
                ),
                "texto": full_text,
                "fonte": "base jurídica local",
                "url_oficial": "",
                "origin": "internal_reference_context",
                "confidence": "CONTEXT",
                "selection_reason": (
                    "artigo citado expressamente por "
                    "outra evidência selecionada"
                ),
                "is_article_context": True,
            }
        )

        existing.add(key)

    return enriched
