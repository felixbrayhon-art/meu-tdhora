from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from .db import DEFAULT_DB_PATH, connect
from .text_utils import normalize_for_index, strip_accents, tokenize_query

# Deterministic, non-AI search: exact-phrase FTS5 match first (highest
# priority tier), then a keyword/prefix fallback so paraphrased or
# inflected queries ("produzir" vs. the source's "produzi-lo") still
# surface the right provision via BM25 relevance over shared terms —
# never a semantic/embedding model, never an LLM.

CANDIDATE_POOL_MULTIPLIER = 6  # fetch this many candidates per tier before subject-filtering/truncating


@dataclass
class LegalSearchResult:
    diploma: str
    tipo: str
    numero: str
    artigo: str
    paragrafo: str | None
    inciso: str | None
    alinea: str | None
    texto: str
    referencia: str
    fonte: str
    url_oficial: str
    data_de_coleta: str
    score: float
    match_type: str  # "exact" | "keyword"

    def to_dict(self) -> dict:
        return {
            "diploma": self.diploma,
            "tipo": self.tipo,
            "numero": self.numero,
            "artigo": self.artigo,
            "paragrafo": self.paragrafo,
            "inciso": self.inciso,
            "alinea": self.alinea,
            "texto": self.texto,
            "referencia": self.referencia,
            "fonte": self.fonte,
            "url_oficial": self.url_oficial,
            "data_de_coleta": self.data_de_coleta,
            "score": self.score,
            "match_type": self.match_type,
        }


def _escape_fts_phrase(text: str) -> str:
    return text.replace('"', '""')


def _row_to_result(row: sqlite3.Row, match_type: str) -> LegalSearchResult:
    return LegalSearchResult(
        diploma=row["diploma"],
        tipo=row["tipo"],
        numero=row["numero"],
        artigo=row["artigo"],
        paragrafo=row["paragrafo"],
        inciso=row["inciso"],
        alinea=row["alinea"],
        texto=row["texto"],
        referencia=row["referencia"],
        fonte=row["fonte"],
        url_oficial=row["url_oficial"],
        data_de_coleta=row["data_de_coleta"],
        score=row["score"],
        match_type=match_type,
    )


def _run_match(conn: sqlite3.Connection, match_expr: str, pool_size: int) -> list[sqlite3.Row]:
    try:
        cur = conn.execute(
            """
            SELECT p.diploma, p.tipo, p.numero, p.artigo, p.paragrafo, p.inciso, p.alinea,
                   p.texto, p.referencia, p.fonte, p.url_oficial, p.data_de_coleta,
                   bm25(provisions_fts) AS score
            FROM provisions_fts
            JOIN provisions p ON p.id = provisions_fts.rowid
            WHERE provisions_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (match_expr, pool_size),
        )
        return cur.fetchall()
    except sqlite3.OperationalError:
        # A malformed FTS5 query (e.g. a lone operator after tokenization)
        # is treated as "no exact-tier match" rather than raised — the
        # keyword tier is the fallback safety net for this.
        return []


def search_legal_sources(
    query: str,
    subject: str | None = None,
    limit: int = 5,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """Deterministic legal-provision search. Returns a list of structured
    dicts (never a concatenated string) — each one a fully-cited provision
    ready to hand to a downstream consumer (a prompt builder, a review UI,
    a future re-ranker), with `score` and `match_type` explaining why it
    matched. No AI/embeddings anywhere in this function.
    """
    conn = connect(db_path)
    try:
        pool_size = max(limit * CANDIDATE_POOL_MULTIPLIER, limit)
        normalized_query = normalize_for_index(query).strip()
        terms = tokenize_query(query)

        results: list[LegalSearchResult] = []
        seen_keys: set[tuple] = set()

        def _key(row: sqlite3.Row) -> tuple:
            return (row["diploma"], row["artigo"], row["paragrafo"], row["inciso"], row["alinea"])

        def _matches_subject(diploma: str) -> bool:
            if not subject:
                return True
            return strip_accents(subject).lower() in strip_accents(diploma).lower()

        # Tier 1 — exact phrase.
        if normalized_query:
            phrase_expr = f'"{_escape_fts_phrase(normalized_query)}"'
            for row in _run_match(conn, phrase_expr, pool_size):
                key = _key(row)
                if key in seen_keys or not _matches_subject(row["diploma"]):
                    continue
                seen_keys.add(key)
                results.append(_row_to_result(row, "exact"))
                if len(results) >= limit:
                    break

        # Tier 2 — keyword/prefix fallback, only pulled in while there's
        # still room under `limit`.
        if len(results) < limit and terms:
            keyword_expr = " OR ".join(f"{t}*" for t in terms)
            for row in _run_match(conn, keyword_expr, pool_size):
                key = _key(row)
                if key in seen_keys or not _matches_subject(row["diploma"]):
                    continue
                seen_keys.add(key)
                results.append(_row_to_result(row, "keyword"))
                if len(results) >= limit:
                    break

        return [r.to_dict() for r in results[:limit]]
    finally:
        conn.close()


def get_article_text(diploma: str, artigo: str, db_path: Path | str = DEFAULT_DB_PATH) -> str | None:
    """Reassembles an article's full text (caput + every paragrafo/inciso/
    alínea belonging to it) from the fine-grained rows — the retrieval path
    for "cada artigo deve poder ser recuperado individualmente" when the
    caller wants the whole article rather than one specific provision.
    """
    conn = connect(db_path)
    try:
        cur = conn.execute(
            """
            SELECT paragrafo, inciso, alinea, texto FROM provisions
            WHERE diploma = ? AND artigo = ?
            ORDER BY id
            """,
            (diploma, artigo),
        )
        rows = cur.fetchall()
        if not rows:
            return None
        lines = []
        for row in rows:
            prefix = ""
            if row["alinea"]:
                prefix = f"{row['alinea']}) "
            elif row["inciso"]:
                prefix = f"{row['inciso']} - "
            elif row["paragrafo"] == "único":
                prefix = "Parágrafo único. "
            elif row["paragrafo"]:
                prefix = f"§ {row['paragrafo']}º "
            lines.append(f"{prefix}{row['texto']}")
        return "\n".join(lines)
    finally:
        conn.close()


def _unit_prefix(paragrafo: str | None, inciso: str | None, alinea: str | None) -> str:
    if alinea:
        return f"{alinea}) "
    if inciso:
        return f"{inciso} - "
    if paragrafo == "único":
        return "Parágrafo único. "
    if paragrafo:
        return f"§ {paragrafo}º "
    return ""


def get_article_units(diploma: str, artigo: str, db_path: Path | str = DEFAULT_DB_PATH) -> list[dict]:
    """Same underlying rows as `get_article_text`, but returned as
    individual structured units instead of one concatenated string — the
    granularity worker/legal_base/evidence_compaction.py needs to pick
    just the relevant caput/parágrafo/inciso/alínea instead of sending an
    entire (possibly huge) article to the model. Each unit carries a
    ready-made `label` (e.g. "VIII", "§ 3º") and `prefixed_texto` (the
    same "VIII - ..." / "§ 3º ..." rendering `get_article_text` uses) so
    compaction never has to re-derive that formatting.
    """
    conn = connect(db_path)
    try:
        cur = conn.execute(
            """
            SELECT id, paragrafo, inciso, alinea, texto FROM provisions
            WHERE diploma = ? AND artigo = ?
            ORDER BY id
            """,
            (diploma, artigo),
        )
        units = []
        for position, row in enumerate(cur.fetchall()):
            prefix = _unit_prefix(row["paragrafo"], row["inciso"], row["alinea"])
            units.append(
                {
                    "position": position,
                    "paragrafo": row["paragrafo"],
                    "inciso": row["inciso"],
                    "alinea": row["alinea"],
                    "texto": row["texto"],
                    "prefixed_texto": f"{prefix}{row['texto']}",
                    "is_caput": not (row["paragrafo"] or row["inciso"] or row["alinea"]),
                }
            )
        return units
    finally:
        conn.close()
