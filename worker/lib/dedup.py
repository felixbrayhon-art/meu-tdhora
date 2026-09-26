from __future__ import annotations

import hashlib
import re
import unicodedata


# Campos mínimos necessários para reconstruir a impressão digital forte
# de uma questão já armazenada no Firestore.
DEDUP_FIELDS = [
    "source",
    "externalId",
    "statement",
    "alternatives",
]


def sanitize_doc_id(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", raw)[:1400]


def build_doc_id(source: str, external_id: str) -> str:
    return sanitize_doc_id(f"{source}_{external_id}")


def _normalize(text: str) -> str:
    text = text or ""

    normalized = (
        unicodedata.normalize("NFKD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    return re.sub(
        r"\s+",
        " ",
        normalized,
    ).strip().lower()


def question_fingerprint(q: dict) -> str:
    """
    Fingerprint forte para deduplicação.

    Não usa apenas o enunciado, porque enunciados genéricos como
    "Assinale a alternativa correta:" podem existir em diversas questões
    completamente diferentes.

    A impressão digital considera:
      - enunciado;
      - texto de todas as alternativas.

    As alternativas são ordenadas pelo texto para detectar a mesma questão
    mesmo quando uma fonte muda a ordem A/B/C/D/E.
    """

    statement = _normalize(
        q.get("statement") or ""
    )

    alternative_texts = []

    for alternative in q.get("alternatives") or []:
        if isinstance(alternative, dict):
            alternative_texts.append(
                _normalize(
                    alternative.get("text") or ""
                )
            )

    alternative_texts.sort()

    canonical = (
        statement
        + "\n"
        + "\n".join(alternative_texts)
    )

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()


def fetch_existing_keys(
    db,
) -> tuple[set[tuple[str, str]], set[str]]:
    """
    Retorna:
      1. pares (source, externalId);
      2. fingerprints fortes do conteúdo já existente.

    Verifica tanto questions quanto question_drafts.
    """

    pairs: set[tuple[str, str]] = set()
    fingerprints: set[str] = set()

    for collection_name in (
        "questions",
        "question_drafts",
    ):
        for doc in (
            db.collection(collection_name)
            .select(DEDUP_FIELDS)
            .stream()
        ):
            data = doc.to_dict() or {}

            source = data.get("source")
            external_id = data.get("externalId")

            if source and external_id:
                pairs.add(
                    (source, external_id)
                )

            if (
                data.get("statement")
                and data.get("alternatives")
            ):
                fingerprints.add(
                    question_fingerprint(data)
                )

    return pairs, fingerprints


def dedup_internal(
    questions: list[dict],
) -> tuple[list[dict], int]:
    """
    Remove duplicatas dentro de um mesmo lote.

    Considera:
      - source + externalId;
      - fingerprint forte de enunciado + alternativas.
    """

    seen_pairs: set[tuple[str, str]] = set()
    seen_fingerprints: set[str] = set()

    unique: list[dict] = []
    removed = 0

    for q in questions:
        key = (
            q["source"],
            q["externalId"],
        )

        fingerprint = question_fingerprint(q)

        if (
            key in seen_pairs
            or fingerprint in seen_fingerprints
        ):
            removed += 1
            continue

        seen_pairs.add(key)
        seen_fingerprints.add(fingerprint)
        unique.append(q)

    return unique, removed


def split_by_existing(
    questions: list[dict],
    existing_pairs: set[tuple[str, str]],
    existing_fingerprints: set[str],
) -> tuple[list[dict], int]:
    """
    Separa questões novas das que já existem no Firestore.
    """

    new_questions: list[dict] = []
    existing_count = 0

    for q in questions:
        key = (
            q["source"],
            q["externalId"],
        )

        fingerprint = question_fingerprint(q)

        if (
            key in existing_pairs
            or fingerprint in existing_fingerprints
        ):
            existing_count += 1
        else:
            new_questions.append(q)

    return new_questions, existing_count
