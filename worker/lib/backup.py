from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

BACKUPS_DIR = Path(__file__).resolve().parent.parent / "output" / "backups"


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "sem-titulo"


def write_json_report(directory: Path, subject: str, year: int, import_id: str, questions: list[dict]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    # subject + year + importId + timestamp: never the same name twice, so
    # an old file is never at risk of being overwritten.
    filename = f"{slugify(subject)}-{year}-{import_id}-{timestamp}.json"
    path = directory / filename
    path.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def write_backup(subject: str, year: int, import_id: str, questions: list[dict], backups_dir: Path | None = None) -> Path:
    """Writes a full snapshot of the questions about to be published, before
    any write batch runs — the last line of defense if something needs to be
    recovered after the fact. Shared by import_batch.py (--publish) and
    approve_import.py so there's exactly one implementation of "how a backup
    file is named and written".
    """
    return write_json_report(backups_dir or BACKUPS_DIR, subject, year, import_id, questions)
