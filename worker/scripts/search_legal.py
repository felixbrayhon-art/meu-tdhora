from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.db import DEFAULT_DB_PATH  # noqa: E402
from legal_base.search import search_legal_sources  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Busca dispositivos jurídicos na base local (SQLite + FTS5) — sem IA."
    )
    parser.add_argument("--query", required=True, help="Texto/afirmação a buscar")
    parser.add_argument("--subject", default=None, help="Filtra por diploma (ex.: 'Código Penal')")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args()

    start = time.perf_counter()
    results = search_legal_sources(args.query, subject=args.subject, limit=args.limit, db_path=args.db)
    elapsed_ms = (time.perf_counter() - start) * 1000

    print("=" * 40)
    print(f'BUSCA: "{args.query}"')
    if args.subject:
        print(f"Filtro (diploma): {args.subject}")
    print("=" * 40)

    if not results:
        print("Nenhum dispositivo correspondente encontrado.")
    for r in results:
        print()
        print(r["referencia"])
        print(f"score: {r['score']:.4f} ({r['match_type']})")
        trecho = r["texto"] if len(r["texto"]) <= 220 else r["texto"][:217] + "..."
        print(f"trecho: {trecho}")
        print(f"fonte: {r['fonte']}")
        print(f"url: {r['url_oficial']}")

    print()
    print(f"tempo de busca: {elapsed_ms:.1f} ms")


if __name__ == "__main__":
    main()
