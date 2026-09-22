from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from parsers import fc_concursos  # noqa: E402

PARSERS = {
    "fc_concursos": fc_concursos,
}


def main() -> None:
    arg_parser = argparse.ArgumentParser(description="Importa um PDF de questões para JSON estruturado.")
    arg_parser.add_argument("pdf_path", help="Caminho do PDF de entrada")
    arg_parser.add_argument("--source", choices=PARSERS.keys(), default="fc_concursos")
    arg_parser.add_argument("--out", default=None, help="Caminho do JSON de saída (default: ao lado do PDF)")
    args = arg_parser.parse_args()

    module = PARSERS[args.source]
    deck_metadata, questions = module.parse(args.pdf_path)

    out_path = Path(args.out) if args.out else Path(args.pdf_path).with_suffix(".json")
    payload = {
        "meta": deck_metadata.to_dict(),
        "questions": [q.to_dict() for q in questions],
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    needing_review = [q for q in questions if q.warnings]
    print(f"Deck: {deck_metadata.title!r} — {deck_metadata.bloco}")
    print(f"Gerado em {deck_metadata.generated_at} por {deck_metadata.owner_name} <{deck_metadata.owner_email}>")
    print(f"{len(questions)} questões detectadas")
    print(f"  {len(questions) - len(needing_review)} aparentemente completas")
    print(f"  {len(needing_review)} precisam de revisão")
    for q in needing_review:
        print(f"    Q{q.number} (pág. {q.source_page}): {', '.join(q.warnings)}")
    print(f"Saída: {out_path}")


if __name__ == "__main__":
    main()
