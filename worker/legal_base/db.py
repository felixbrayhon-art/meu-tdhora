from __future__ import annotations

import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "legal" / "legal.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS provisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diploma TEXT NOT NULL,
    tipo TEXT NOT NULL,
    numero TEXT NOT NULL,
    artigo TEXT NOT NULL,
    paragrafo TEXT,
    inciso TEXT,
    alinea TEXT,
    texto TEXT NOT NULL,
    referencia TEXT NOT NULL,
    fonte TEXT NOT NULL,
    url_oficial TEXT NOT NULL,
    data_de_coleta TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provisions_diploma ON provisions(diploma);
CREATE INDEX IF NOT EXISTS idx_provisions_diploma_artigo ON provisions(diploma, artigo);

CREATE VIRTUAL TABLE IF NOT EXISTS provisions_fts USING fts5(
    texto,
    referencia,
    content='provisions',
    content_rowid='id',
    tokenize = "unicode61 remove_diacritics 2"
);

CREATE TRIGGER IF NOT EXISTS provisions_ai AFTER INSERT ON provisions BEGIN
    INSERT INTO provisions_fts(rowid, texto, referencia) VALUES (new.id, new.texto, new.referencia);
END;

CREATE TRIGGER IF NOT EXISTS provisions_ad AFTER DELETE ON provisions BEGIN
    INSERT INTO provisions_fts(provisions_fts, rowid, texto, referencia) VALUES ('delete', old.id, old.texto, old.referencia);
END;

CREATE TRIGGER IF NOT EXISTS provisions_au AFTER UPDATE ON provisions BEGIN
    INSERT INTO provisions_fts(provisions_fts, rowid, texto, referencia) VALUES ('delete', old.id, old.texto, old.referencia);
    INSERT INTO provisions_fts(rowid, texto, referencia) VALUES (new.id, new.texto, new.referencia);
END;
"""


def connect(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def reset_db(db_path: Path | str = DEFAULT_DB_PATH) -> None:
    """Drops and recreates every table — used by the (re)build script so
    re-running it is idempotent instead of accumulating duplicate rows.
    """
    conn = connect(db_path)
    conn.executescript(
        """
        DROP TRIGGER IF EXISTS provisions_ai;
        DROP TRIGGER IF EXISTS provisions_ad;
        DROP TRIGGER IF EXISTS provisions_au;
        DROP TABLE IF EXISTS provisions_fts;
        DROP TABLE IF EXISTS provisions;
        """
    )
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
