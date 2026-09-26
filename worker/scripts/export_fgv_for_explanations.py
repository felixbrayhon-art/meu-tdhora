from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exam_discovery import catalog, download, validation  # noqa: E402
from exam_discovery.extraction import build_extracted_questions  # noqa: E402
from exam_discovery.to_draft import build_explanation_batch_document  # noqa: E402
from scripts.discover_exams import build_pairs, run_discovery_and_download  # noqa: E402

# Stage 1 of "discovered exam -> app question bank": runs the SAME
# discovery/download/pairing/extraction/validation exam_discovery already
# does, then — instead of writing to Firestore (exam_discovery/
# firestore_sync.py, a separate/older path) — writes one local JSON per
# "ready" pair in exactly the input shape worker/scripts/
# batch_exam_explanations.py expects. Never touches Firestore. Stage 2 is
# running batch_exam_explanations.py on that file; stage 3 is
# worker/scripts/push_fgv_drafts.py.

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "exams"


def _slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower() or "sem-nome"


def export_pair(conn, pair, output_dir: Path) -> dict:
    exam_row = catalog.get_by_download_url(conn, pair.exam_doc.download_url)
    key_row = catalog.get_by_download_url(conn, pair.answer_key_doc.download_url) if pair.answer_key_doc else None

    if not exam_row or not exam_row["download_path"]:
        return {"status": "skipped", "reason": "exam PDF not downloaded yet"}
    if not key_row or not key_row["download_path"]:
        return {"status": "skipped", "reason": "answer key PDF not downloaded yet"}

    questions = build_extracted_questions(
        exam_row["download_path"], key_row["download_path"], test_type=pair.test_type
    )
    report = validation.validate_extraction(pair, questions)

    document = build_explanation_batch_document(pair, report.importable)

    parts = [pair.institution, str(pair.year or ""), pair.role or "", f"tipo{pair.test_type}" if pair.test_type else ""]
    filename = _slugify("-".join(p for p in parts if p)) + ".json"
    output_path = output_dir / filename
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "status": "exported",
        "outputPath": str(output_path),
        "totalQuestions": len(questions),
        "importable": len(report.importable),
        "rejected": len(report.rejected),
        "pairOk": report.pair_ok,
        "pairErrors": report.pair_errors,
        "numberingOk": report.numbering_ok,
        "numberingErrors": report.numbering_errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descobre/baixa/pareia/extrai provas da FGV configuradas e exporta cada par "
        "'ready' como um JSON local no formato de entrada de batch_exam_explanations.py. "
        "Nunca escreve no Firestore."
    )
    parser.add_argument("--board", default="FGV", help="Só exporta pares deste board (default: FGV).")
    parser.add_argument("--catalog", default=str(catalog.DEFAULT_CATALOG_PATH))
    parser.add_argument("--cache-dir", default=str(download.DEFAULT_CACHE_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    conn = catalog.connect(args.catalog)
    cache_dir = Path(args.cache_dir)
    output_dir = Path(args.output_dir)

    print("=" * 70)
    print("1) DISCOVERY + DOWNLOAD")
    print("=" * 70)
    discovery_result = run_discovery_and_download(conn, cache_dir)
    print(f"documentos descobertos nesta execução: {discovery_result['discovered_total']}")
    print(f"documentos NOVOS no catálogo: {discovery_result['new_documents']}")
    print(f"downloads novos nesta execução: {discovery_result['downloaded_now']}")
    if discovery_result["download_failures"]:
        print("falhas de download:")
        for failure in discovery_result["download_failures"]:
            print(f"  - {failure}")

    print()
    print("=" * 70)
    print("2) PAREAMENTO + EXPORTAÇÃO")
    print("=" * 70)
    pairs = [p for p in build_pairs(conn) if p.board == args.board]
    ready_pairs = [p for p in pairs if p.status == "ready"]
    print(f"pares '{args.board}': {len(pairs)} ({len(ready_pairs)} 'ready')")

    for pair in pairs:
        label = f"{pair.institution} / {pair.role or '(sem role)'} / tipo {pair.test_type or '(único)'}"
        if pair.status != "ready":
            print(f"  - {label}: {pair.status} ({pair.reason or 'sem gabarito definitivo ainda'})")
            continue
        result = export_pair(conn, pair, output_dir)
        if result["status"] == "skipped":
            print(f"  - {label}: pulado ({result['reason']})")
            continue
        print(
            f"  - {label}: {result['totalQuestions']} questões extraídas, "
            f"{result['importable']} importáveis, {result['rejected']} rejeitadas "
            f"-> {result['outputPath']}"
        )
        if not result["pairOk"]:
            print(f"    pair inválido: {result['pairErrors']}")
        if not result["numberingOk"]:
            print(f"    numeração: {result['numberingErrors']}")

    conn.close()


if __name__ == "__main__":
    main()
