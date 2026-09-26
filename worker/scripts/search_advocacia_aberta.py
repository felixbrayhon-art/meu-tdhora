from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.advocacia_aberta import search_advocacia_aberta  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Busca jurídica nos JSONs locais do Advocacia Aberta."
    )
    parser.add_argument("--query", required=True)
    parser.add_argument("--subject", default=None)
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    start = time.perf_counter()

    results = search_advocacia_aberta(
        args.query,
        subject=args.subject,
        limit=args.limit,
    )

    elapsed_ms = (time.perf_counter() - start) * 1000

    print("=" * 70)
    print(f'BUSCA: "{args.query}"')
    if args.subject:
        print(f"MATÉRIA: {args.subject}")
    print("=" * 70)

    if not results:
        print("Nenhum resultado encontrado.")

    for i, r in enumerate(results, 1):
        print()
        print(f"{i}. {r['referencia']}")
        print(f"score: {r['score']:.2f}")
        print(f"coverage: {r['coverage']:.2%}")
        print(f"match: {r['match_type']}")
        print(f"tokens: {r['matched_query_tokens']}")
        print(f"keyword hits: {r['keyword_hits']}")
        print(f"keywords: {r['keywords']}")

        trecho = r["texto"].replace("\n", " ")
        if len(trecho) > 500:
            trecho = trecho[:497] + "..."

        print(f"texto: {trecho}")
        print(f"url: {r['url_oficial']}")

    print()
    print(f"tempo: {elapsed_ms:.1f} ms")


if __name__ == "__main__":
    main()
