from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.unified_search import search_unified_legal_sources


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--subject", default=None)
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    start = time.perf_counter()

    results = search_unified_legal_sources(
        args.query,
        subject=args.subject,
        limit=args.limit,
    )

    elapsed = (time.perf_counter() - start) * 1000

    print("=" * 72)
    print("BUSCA UNIFICADA")
    print(f"QUERY: {args.query}")
    print(f"MATÉRIA: {args.subject}")
    print("=" * 72)

    for i, r in enumerate(results, 1):
        print()
        print(f"{i}. {r['referencia']}")
        print(f"confiança: {r['confidence']}")
        print(f"motivo: {r['confidence_reason']}")
        print(f"origem principal: {r['origin']}")
        print(
            "confirmado pelo Advocacia Aberta:",
            r["confirmed_by_advocacia_aberta"],
        )
        print("rank local:", r.get("local_rank"))
        print("rank AA:", r.get("advocacia_rank"))
        print(f"fusion score: {r.get('fusion_score', 0):.6f}")
        print("match local:", r.get("match_type"))
        print("match AA:", r.get("advocacia_match_type"))
        print("coverage AA:", r.get("advocacia_coverage"))
        print("keyword hits AA:", r.get("advocacia_keyword_hits"))

        trecho = r["texto"].replace("\n", " ")
        if len(trecho) > 420:
            trecho = trecho[:417] + "..."

        print("texto:", trecho)
        print("url:", r["url_oficial"])

    print()
    print(f"tempo total: {elapsed:.1f} ms")


if __name__ == "__main__":
    main()
