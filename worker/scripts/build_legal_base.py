from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.db import DEFAULT_DB_PATH, connect, reset_db  # noqa: E402
from legal_base.importer import build_legal_base  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="(Re)constrói a base jurídica local (SQLite + FTS5) a partir dos textos oficiais "
        "já coletados em worker/legal_base/raw_sources/. Não acessa a internet, não escreve no Firestore."
    )
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Caminho do arquivo SQLite de saída")
    args = parser.parse_args()

    reset_db(args.db)
    conn = connect(args.db)
    try:
        counts = build_legal_base(conn)
    finally:
        conn.close()

    total = sum(counts.values())
    db_size_kb = Path(args.db).stat().st_size / 1024
    print("=" * 40)
    print("BASE JURÍDICA LOCAL CONSTRUÍDA")
    print("=" * 40)
    for diploma, count in counts.items():
        print(f"  {diploma}: {count} dispositivos")
    print(f"Total: {total} dispositivos")
    print(f"Banco: {args.db} ({db_size_kb:.0f} KB)")
    print("=" * 40)


if __name__ == "__main__":
    main()
