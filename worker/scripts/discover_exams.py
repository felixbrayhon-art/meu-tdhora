from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exam_discovery import catalog, dedup, download, pairing, registry, validation  # noqa: E402
from exam_discovery.extraction import build_extracted_questions  # noqa: E402
from exam_discovery.firestore_sync import fetch_existing_content_hashes, sync_pair  # noqa: E402
from exam_discovery.models import DiscoveredDocument  # noqa: E402

# Idempotent by design: a document already in the catalog is never
# re-discovered/re-downloaded, and a question already imported (by
# doc_id — see exam_discovery/firestore_sync.py) is never re-written. A
# second run with nothing new to do reports 0/0/0 and exits normally —
# see the "AUTOMAÇÃO" section of the spec this implements.
#
#   (no flags)  -> discover, download, pair, report. Never touches Firestore.
#   --process   -> additionally extracts + validates every "ready" pair,
#                  and prints a Firestore DRY RUN (what would be written).
#   --commit    -> the ONLY mode that writes to Firestore (implies --process;
#                  requires --credentials — a service-account JSON path,
#                  never committed to the repo).


def _row_to_document(row) -> DiscoveredDocument:
    return DiscoveredDocument(
        source_url=row["source_url"],
        download_url=row["download_url"],
        discovered_at=row["discovered_at"],
        board=row["board"],
        institution=row["institution"],
        exam_name=row["exam_name"],
        role=row["role"],
        year=row["year"],
        test_type=row["test_type"],
        document_type=row["document_type"],
        title=row["title"],
    )


def run_discovery_and_download(conn, cache_dir: Path) -> dict:
    outcome = registry.discover_all()

    new_documents = 0
    for doc in outcome.documents:
        if catalog.upsert_discovered(conn, doc):
            new_documents += 1

    to_download = catalog.list_documents(conn, status="discovered")
    downloaded_now = 0
    download_failures: list[str] = []
    for row in to_download:
        doc = _row_to_document(row)
        try:
            result = download.download_document(doc, conn, cache_dir)
            if not result.already_cached:
                downloaded_now += 1
        except Exception as exc:  # noqa: BLE001 — a bad single document must not abort the run
            download_failures.append(f"{doc.download_url}: {exc}")
            catalog.set_status(conn, doc.download_url, "failed")

    return {
        "discovered_total": len(outcome.documents),
        "new_documents": new_documents,
        "unsupported_sources": outcome.unsupported,
        "downloaded_now": downloaded_now,
        "download_failures": download_failures,
    }


def build_pairs(conn) -> list:
    rows = catalog.list_documents(conn)
    documents = [_row_to_document(row) for row in rows if row["status"] not in ("failed",)]
    return pairing.pair_documents(documents)


def process_pair(conn, pair, commit: bool, db, existing_hashes: set) -> dict:
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

    importable = report.importable
    # `existing_hashes` is shared across every pair processed THIS run (the
    # caller mutates it in place after each call) — so if two pairs in the
    # same run reuse the same question content (e.g. shuffled-but-identical
    # statements across exam types), the second one correctly sees the
    # first's questions as duplicates instead of re-importing them.
    new_questions, duplicates = dedup.split_new_and_duplicate(importable, existing_hashes=existing_hashes)
    existing_hashes.update(dedup.statement_hash(q.statement) for q in new_questions)

    sync_report = sync_pair(pair, new_questions, db=db, commit=commit)

    return {
        "status": "processed",
        "totalQuestions": len(questions),
        "importable": len(importable),
        "rejected": len(report.rejected),
        "pairOk": report.pair_ok,
        "pairErrors": report.pair_errors,
        "numberingOk": report.numbering_ok,
        "numberingErrors": report.numbering_errors,
        "newAfterDedup": len(new_questions),
        "duplicates": len(duplicates),
        "syncReport": sync_report,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descobre, baixa, pareia e (opcionalmente) importa provas oficiais de fontes "
        "públicas configuradas (worker/exam_discovery/registry.py). Sem flags: só discovery/"
        "download/pareamento, nunca escreve Firestore."
    )
    parser.add_argument("--process", action="store_true", help="Extrai e valida os pares 'ready' (dry-run Firestore).")
    parser.add_argument("--commit", action="store_true", help="Escreve no Firestore. Implica --process. Requer --credentials.")
    parser.add_argument("--credentials", default=None, help="Caminho do service-account JSON (só necessário com --commit).")
    parser.add_argument("--catalog", default=str(catalog.DEFAULT_CATALOG_PATH))
    parser.add_argument("--cache-dir", default=str(download.DEFAULT_CACHE_DIR))
    args = parser.parse_args()

    if args.commit and not args.credentials:
        raise SystemExit("--commit requer --credentials <service-account.json>")

    conn = catalog.connect(args.catalog)
    cache_dir = Path(args.cache_dir)

    print("=" * 70)
    print("1) DISCOVERY")
    print("=" * 70)
    discovery_result = run_discovery_and_download(conn, cache_dir)
    print(f"fontes configuradas: {len(registry.SOURCES)}")
    print(f"documentos descobertos nesta execução: {discovery_result['discovered_total']}")
    print(f"documentos NOVOS no catálogo: {discovery_result['new_documents']}")
    if discovery_result["unsupported_sources"]:
        print("fontes com problema (registradas como unsupported, não tentei burlar nada):")
        for key, reason in discovery_result["unsupported_sources"].items():
            print(f"  - {key}: {reason}")

    print()
    print("=" * 70)
    print("2) DOWNLOAD")
    print("=" * 70)
    print(f"downloads novos nesta execução: {discovery_result['downloaded_now']}")
    if discovery_result["download_failures"]:
        print("falhas de download:")
        for failure in discovery_result["download_failures"]:
            print(f"  - {failure}")

    print()
    print("=" * 70)
    print("3) PAREAMENTO")
    print("=" * 70)
    pairs = build_pairs(conn)
    by_status: dict[str, int] = {}
    for pair in pairs:
        by_status[pair.status] = by_status.get(pair.status, 0) + 1
    print(f"pares formados: {len(pairs)}")
    for status, count in sorted(by_status.items()):
        print(f"  {status}: {count}")
    for pair in pairs:
        key_title = pair.answer_key_doc.title if pair.answer_key_doc else "(nenhum)"
        print(
            f"  - {pair.institution} / {pair.role or '(sem role)'} / "
            f"tipo {pair.test_type or '(único)'} / {pair.year} -> {pair.status}"
            + (f" ({pair.reason})" if pair.reason else f" [gabarito: {key_title}]")
        )

    if not args.process and not args.commit:
        print()
        print("Nada foi escrito no Firestore (sem --process nem --commit).")
        conn.close()
        return

    db = None
    if args.commit:
        import firebase_admin
        from firebase_admin import credentials, firestore

        firebase_admin.initialize_app(credentials.Certificate(args.credentials))
        db = firestore.client()

    print()
    print("=" * 70)
    print(f"4) {'COMMIT' if args.commit else 'PROCESS (dry-run)'}")
    print("=" * 70)

    # Accumulated across every pair processed in THIS run, so duplicate
    # content between e.g. "Tipo 1" and "Tipo 2" of the same concurso is
    # caught even though they come from different PDFs/pairs. When
    # committing, this is ALSO seeded per (board, institution, role, year)
    # group from Firestore itself before that group's pairs are processed
    # — so a statement already imported in an earlier, separate run is
    # recognized too, not just duplicates within this one run. (sync_pair's
    # own per-doc_id existence check remains the last line of defense
    # either way — this is what makes the *pre*-write dedup report
    # accurate, so "0 duplicadas" in the printed summary can be trusted
    # before anything is written, not just discovered after the fact.)
    existing_hashes: set[str] = set()
    hashes_fetched_for_group: set[tuple] = set()

    total_new = 0
    for pair in pairs:
        if pair.status != "ready":
            continue
        if db is not None:
            group_key = (pair.board, pair.institution, pair.role, pair.year)
            if group_key not in hashes_fetched_for_group:
                existing_hashes.update(
                    fetch_existing_content_hashes(db, pair.board, pair.institution, pair.role, pair.year)
                )
                hashes_fetched_for_group.add(group_key)
        result = process_pair(conn, pair, commit=args.commit, db=db, existing_hashes=existing_hashes)
        label = f"{pair.institution} / {pair.role or '(sem role)'} / tipo {pair.test_type or '(único)'}"
        if result["status"] == "skipped":
            print(f"  - {label}: pulado ({result['reason']})")
            continue
        print(
            f"  - {label}: {result['totalQuestions']} questões, "
            f"{result['importable']} importáveis, {result['rejected']} rejeitadas, "
            f"{result['duplicates']} duplicadas, {result['newAfterDedup']} novas"
        )
        if not result["pairOk"]:
            print(f"    pair inválido: {result['pairErrors']}")
        if not result["numberingOk"]:
            print(f"    numeração: {result['numberingErrors']}")
        total_new += result["newAfterDedup"]

    print()
    if args.commit:
        print(f"TOTAL importado no Firestore: {total_new} questões novas.")
    else:
        print(f"TOTAL que SERIA importado (dry-run, nada escrito): {total_new} questões novas.")

    conn.close()


if __name__ == "__main__":
    main()
