from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .models import DiscoveredDocument, DOCUMENT_STATUSES

DEFAULT_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "exam_sources" / "catalog.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    source_url TEXT PRIMARY KEY,
    download_url TEXT NOT NULL,
    board TEXT NOT NULL,
    institution TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    role TEXT,
    year INTEGER,
    test_type TEXT,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    sha256 TEXT,
    download_path TEXT,
    discovered_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256);
CREATE INDEX IF NOT EXISTS idx_documents_group
    ON documents(board, institution, role, year, test_type);
"""


def connect(db_path: Path | str = DEFAULT_CATALOG_PATH) -> sqlite3.Connection:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_discovered(conn: sqlite3.Connection, doc: DiscoveredDocument) -> bool:
    """Inserts a newly discovered document if its source_url isn't
    already known; a known one is left completely untouched (discovery
    must never downgrade or overwrite a document that's already further
    along, e.g. already downloaded/processed). Returns True if this call
    actually inserted a new row.
    """
    existing = conn.execute(
        "SELECT 1 FROM documents WHERE source_url = ?", (doc.download_url,)
    ).fetchone()
    if existing:
        return False

    now = _now()
    conn.execute(
        """
        INSERT INTO documents (
            source_url, download_url, board, institution, exam_name, role, year,
            test_type, document_type, title, status, sha256, download_path,
            discovered_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', NULL, NULL, ?, ?)
        """,
        (
            doc.download_url,  # the catalog keys on the FILE's own URL, not the listing page
            doc.download_url,
            doc.board,
            doc.institution,
            doc.exam_name,
            doc.role,
            doc.year,
            doc.test_type,
            doc.document_type,
            doc.title,
            doc.discovered_at,
            now,
        ),
    )
    conn.commit()
    return True


def get_by_download_url(conn: sqlite3.Connection, download_url: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM documents WHERE source_url = ?", (download_url,)).fetchone()


def get_by_sha256(conn: sqlite3.Connection, sha256: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM documents WHERE sha256 = ?", (sha256,)).fetchone()


def set_downloaded(conn: sqlite3.Connection, download_url: str, sha256: str, download_path: str) -> None:
    conn.execute(
        "UPDATE documents SET status = 'downloaded', sha256 = ?, download_path = ?, updated_at = ? "
        "WHERE source_url = ?",
        (sha256, download_path, _now(), download_url),
    )
    conn.commit()


def set_status(conn: sqlite3.Connection, download_url: str, status: str) -> None:
    if status not in DOCUMENT_STATUSES:
        raise ValueError(f"unknown document status: {status!r}")
    conn.execute(
        "UPDATE documents SET status = ?, updated_at = ? WHERE source_url = ?",
        (status, _now(), download_url),
    )
    conn.commit()


def list_documents(
    conn: sqlite3.Connection,
    board: str | None = None,
    institution: str | None = None,
    status: str | None = None,
) -> list[sqlite3.Row]:
    query = "SELECT * FROM documents WHERE 1=1"
    params: list = []
    if board is not None:
        query += " AND board = ?"
        params.append(board)
    if institution is not None:
        query += " AND institution = ?"
        params.append(institution)
    if status is not None:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY discovered_at"
    return conn.execute(query, params).fetchall()
