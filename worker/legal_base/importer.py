from __future__ import annotations

import sqlite3
from datetime import date, datetime

from .models import LegalProvisionRecord
from .planalto_parser import parse_planalto_text
from .sources import LegalSource, SOURCES, read_raw_text


def _records_for_source(source: LegalSource, collected_at: str) -> list[LegalProvisionRecord]:
    raw_text = read_raw_text(source)

    segments: list[tuple[str, str, str]] = [(source.diploma, source.fonte, raw_text)]
    if source.split_marker and source.split_marker in raw_text:
        idx = raw_text.find(source.split_marker)
        main_text, tail_text = raw_text[:idx], raw_text[idx:]
        segments = [
            (source.diploma, source.fonte, main_text),
            (source.split_diploma_after or source.diploma, source.split_fonte_after or source.fonte, tail_text),
        ]

    records: list[LegalProvisionRecord] = []
    for diploma, fonte, text in segments:
        for parsed in parse_planalto_text(text):
            records.append(
                LegalProvisionRecord(
                    diploma=diploma,
                    tipo=source.tipo,
                    numero=source.numero,
                    artigo=parsed.artigo,
                    paragrafo=parsed.paragrafo,
                    inciso=parsed.inciso,
                    alinea=parsed.alinea,
                    texto=parsed.texto,
                    fonte=fonte,
                    url_oficial=source.url_oficial,
                    data_de_coleta=collected_at,
                )
            )
    return records


def build_legal_base(conn: sqlite3.Connection, sources: list[LegalSource] | None = None) -> dict[str, int]:
    """Parses every configured source and inserts every provision into an
    already-connected (and already-reset, if a clean rebuild is wanted) db.
    Returns a per-diploma count, e.g. {"Código Penal": 1331, ...} — the
    diploma key already reflects the CF/ADCT split (two distinct diplomas).
    """
    sources = sources if sources is not None else SOURCES
    collected_at = date.today().isoformat()
    counts: dict[str, int] = {}

    cur = conn.cursor()
    for source in sources:
        for record in _records_for_source(source, collected_at):
            referencia = _referencia(record)
            cur.execute(
                """
                INSERT INTO provisions
                    (diploma, tipo, numero, artigo, paragrafo, inciso, alinea,
                     texto, referencia, fonte, url_oficial, data_de_coleta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.diploma, record.tipo, record.numero, record.artigo,
                    record.paragrafo, record.inciso, record.alinea,
                    record.texto, referencia, record.fonte, record.url_oficial, record.data_de_coleta,
                ),
            )
            counts[record.diploma] = counts.get(record.diploma, 0) + 1
    conn.commit()
    return counts


def _referencia(record: LegalProvisionRecord) -> str:
    parts = [record.diploma, f"art. {record.artigo}"]
    if record.paragrafo:
        parts.append("parágrafo único" if record.paragrafo == "único" else f"§ {record.paragrafo}º")
    if record.inciso:
        parts.append(f"inciso {record.inciso}")
    if record.alinea:
        parts.append(f"alínea {record.alinea}")
    return ", ".join(parts)
