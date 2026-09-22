from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import firebase_admin  # noqa: E402
from firebase_admin import credentials, firestore  # noqa: E402

from lib.auth import resolve_uid  # noqa: E402
from lib.dedup import build_doc_id, dedup_internal, fetch_existing_keys, split_by_existing  # noqa: E402
from lib.exclusion import excluded_summary, split_valid_and_excluded  # noqa: E402
from lib.publish import filter_not_yet_published, publish_drafts  # noqa: E402
from lib.validation import validate_before_publish, validate_question_structure  # noqa: E402
from parsers import fc_concursos  # noqa: E402

"""
Policy: a question with any warning (parser-level or the structural checks
below) — equivalently, status == "needs_attention" — is EXCLUDED from the
pipeline entirely, before any draft is created. It is never published, its
content/alternatives/gabarito are never auto-corrected, and it is recorded
(number, externalId, reasons) both in the `imports` doc and in a local audit
report under worker/output/excluded/ — the only place its full content is
kept once it's dropped.
"""

PARSERS = {"fc_concursos": fc_concursos}

# Batched writes are capped at 500 ops; question_drafts creation is a SET
# per question (no DELETE involved yet), so this can stay generous.
DRAFT_BATCH_LIMIT = 400

BACKUPS_DIR = Path(__file__).resolve().parent.parent / "output" / "backups"
EXCLUDED_DIR = Path(__file__).resolve().parent.parent / "output" / "excluded"


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "sem-titulo"


def _write_report(directory: Path, subject: str, year: int, import_id: str, questions: list[dict]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    # subject + year + importId + timestamp in the filename: never the same
    # name twice, so an old report is never at risk of being overwritten.
    filename = f"{slugify(subject)}-{year}-{import_id}-{timestamp}.json"
    path = directory / filename
    path.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def write_backup(subject: str, year: int, import_id: str, questions: list[dict], backups_dir: Path | None = None) -> Path:
    return _write_report(backups_dir or BACKUPS_DIR, subject, year, import_id, questions)


def write_excluded_report(
    subject: str, year: int, import_id: str, questions: list[dict], excluded_dir: Path | None = None
) -> Path:
    return _write_report(excluded_dir or EXCLUDED_DIR, subject, year, import_id, questions)


def prepare_questions(pdf_path: str, subject: str, year: int, source_name: str) -> tuple[object, list[dict]]:
    module = PARSERS[source_name]
    deck_metadata, parsed_questions = module.parse(pdf_path)

    questions = []
    for pq in parsed_questions:
        q = pq.to_dict()
        q["importSubject"] = subject
        q["importYear"] = year
        # Structural problems (variable alternative count, correctLetter/
        # isCorrect consistency, missing text) are additive to whatever
        # warnings the parser itself already attached. Any warning at all
        # means this question gets excluded below — never auto-fixed.
        structural_errors = validate_question_structure(q)
        if structural_errors:
            q["warnings"] = [*q["warnings"], *structural_errors]
            q["status"] = "needs_attention"
        questions.append(q)

    return deck_metadata, questions


def print_summary(
    subject: str,
    year: int,
    total_extracted: int,
    excluded_count: int,
    excluded: list[dict],
    valid_count: int,
    internal_duplicates: int,
    unique_count: int,
    existing_duplicates: int,
    new_count: int,
    import_id: str | None,
    backup_path: Path | None,
    excluded_report_path: Path | None,
    published_count: int | None,
    failures: int | None,
    status: str,
) -> None:
    print("=" * 40)
    print("IMPORTAÇÃO DE QUESTÕES")
    print("=" * 40)
    print(f"Matéria: {subject}")
    print(f"Ano: {year}")
    print()
    print(f"PDF: {total_extracted}")
    print(f"Extraídas: {total_extracted}")
    print(f"Excluídas (warnings/needs_attention/estrutural): {excluded_count}")
    for item in excluded:
        print(f"  Q{item['number']} (externalId {item['externalId']}): {', '.join(item['reasons'])}")
    print(f"Válidas: {valid_count}")
    print(f"Duplicadas internas: {internal_duplicates}")
    print(f"Únicas: {unique_count}")
    print(f"Já existentes no Firestore: {existing_duplicates}")
    print(f"Novas: {new_count}")
    if import_id:
        print()
        if excluded_report_path:
            print(f"Relatório de excluídas: {excluded_report_path}")
        if backup_path:
            print(f"Backup: {backup_path}")
        print(f"Import ID: {import_id}")
    if published_count is not None:
        print()
        print(f"Publicadas: {published_count}")
        print(f"Falhas: {failures}")
    print()
    print(f"STATUS: {status}")
    print("=" * 40)


def run_pipeline(
    pdf_path: str,
    subject: str,
    year: int,
    db,
    resolve_imported_by: Callable[[], str],
    source_name: str = "fc_concursos",
    dry_run: bool = False,
    publish: bool = False,
    backups_dir: Path | None = None,
    excluded_dir: Path | None = None,
) -> dict:
    """The actual pipeline, decoupled from real Firebase bootstrap so it can
    run against a fake Firestore client in tests. `resolve_imported_by` is
    deferred (called only once a write is actually about to happen) so
    dry-run never needs a resolvable uid at all. Returns a dict of the
    computed counters, mainly so tests can assert on them directly instead
    of parsing stdout.
    """
    deck_metadata, questions = prepare_questions(pdf_path, subject, year, source_name)
    total_extracted = len(questions)
    if total_extracted == 0:
        print_summary(subject, year, 0, 0, [], 0, 0, 0, 0, 0, None, None, None, None, None, "ABORTADO — nenhuma questão extraída do PDF")
        raise SystemExit(1)

    # Exclusion happens first, before any dedup or draft creation — a
    # flagged question never even reaches question_drafts.
    valid_questions, excluded_questions = split_valid_and_excluded(questions)
    excluded_info = excluded_summary(excluded_questions)

    unique_questions, internal_duplicates = dedup_internal(valid_questions)

    existing_pairs, existing_hashes = fetch_existing_keys(db)
    new_questions, existing_duplicates = split_by_existing(unique_questions, existing_pairs, existing_hashes)

    result = {
        "totalExtracted": total_extracted,
        "excludedQuestions": len(excluded_questions),
        "validQuestions": len(valid_questions),
        "internalDuplicates": internal_duplicates,
        "uniqueQuestions": len(unique_questions),
        "existingDuplicates": existing_duplicates,
        "newQuestions": len(new_questions),
        "importId": None,
        "publishedCount": None,
        "failures": None,
    }

    if dry_run:
        print_summary(
            subject, year, total_extracted, len(excluded_questions), excluded_info, len(valid_questions),
            internal_duplicates, len(unique_questions), existing_duplicates, len(new_questions),
            import_id=None, backup_path=None, excluded_report_path=None, published_count=None, failures=None,
            status="DRY-RUN — nada foi gravado",
        )
        return result

    if not new_questions and not excluded_questions:
        # Nothing new and nothing excluded — a pure duplicate re-run, no
        # audit-worthy activity, so no imports doc is created.
        print_summary(
            subject, year, total_extracted, 0, [], len(valid_questions),
            internal_duplicates, len(unique_questions), existing_duplicates, 0,
            import_id=None, backup_path=None, excluded_report_path=None, published_count=None, failures=None,
            status="CONCLUÍDO — nada novo para importar",
        )
        return result

    resolved_uid = resolve_imported_by()
    import_id = str(uuid.uuid4())
    result["importId"] = import_id

    # Written whenever there's anything excluded, even if that means every
    # question in the batch was dropped and there's nothing new to stage —
    # the audit trail matters independent of whether any draft is created.
    excluded_report_path = None
    if excluded_questions:
        excluded_report_path = write_excluded_report(subject, year, import_id, excluded_questions, excluded_dir)

    db.collection("imports").document(import_id).set(
        {
            "importSubject": subject,
            "importYear": year,
            "source": source_name,
            "title": deck_metadata.title,
            "totalQuestions": total_extracted,
            "excludedQuestions": len(excluded_questions),
            "excluded": excluded_info,
            "validQuestions": len(valid_questions),
            "uniqueQuestions": len(unique_questions),
            "duplicateQuestions": internal_duplicates + existing_duplicates,
            "internalDuplicates": internal_duplicates,
            "existingDuplicates": existing_duplicates,
            "newQuestions": len(new_questions),
            "importedBy": resolved_uid,
            "importedAt": firestore.SERVER_TIMESTAMP,
            "status": "drafts_created" if new_questions else "no_new_questions",
        }
    )

    if not new_questions:
        print_summary(
            subject, year, total_extracted, len(excluded_questions), excluded_info, len(valid_questions),
            internal_duplicates, len(unique_questions), existing_duplicates, 0,
            import_id=import_id, backup_path=None, excluded_report_path=excluded_report_path,
            published_count=None, failures=None,
            status="CONCLUÍDO — nenhuma questão nova (só exclusões registradas)",
        )
        return result

    draft_docs = [(build_doc_id(q["source"], q["externalId"]), {**q, "importId": import_id}) for q in new_questions]

    batch = db.batch()
    ops_in_batch = 0
    for doc_id, draft in draft_docs:
        batch.set(db.collection("question_drafts").document(doc_id), draft)
        ops_in_batch += 1
        if ops_in_batch >= DRAFT_BATCH_LIMIT:
            batch.commit()
            batch = db.batch()
            ops_in_batch = 0
    if ops_in_batch:
        batch.commit()

    published_count = None
    failures = None
    backup_path = None
    status = "CONCLUÍDO — drafts criados para revisão"

    if publish:
        # Every draft here already passed the exclusion filter, so nothing
        # is skipped for warnings at this point — but validate_before_publish
        # still runs as the final gate right before the irreversible write.
        if draft_docs:
            backup_path = write_backup(subject, year, import_id, [draft for _, draft in draft_docs], backups_dir)

            pre_publish_errors: dict[str, list[str]] = {}
            for doc_id, draft in draft_docs:
                errs = validate_before_publish(draft, subject, year)
                if errs:
                    pre_publish_errors[doc_id] = errs

            if pre_publish_errors:
                # Conservative: any inconsistency between the earlier
                # structural pass and this final gate means something is
                # wrong — abort the whole publish step, keep the drafts
                # untouched for manual review, don't publish partially.
                db.collection("imports").document(import_id).update(
                    {"status": "publish_aborted", "publishAbortedAt": firestore.SERVER_TIMESTAMP}
                )
                print(f"Pré-validação falhou para {len(pre_publish_errors)} questão(ões):")
                for doc_id, errs in pre_publish_errors.items():
                    print(f"  {doc_id}: {', '.join(errs)}")
                print_summary(
                    subject, year, total_extracted, len(excluded_questions), excluded_info, len(valid_questions),
                    internal_duplicates, len(unique_questions), existing_duplicates, len(new_questions),
                    import_id=import_id, backup_path=backup_path, excluded_report_path=excluded_report_path,
                    published_count=0, failures=len(pre_publish_errors),
                    status="ABORTADO — pré-validação falhou, nada foi publicado (drafts preservados)",
                )
                raise SystemExit(1)

            still_eligible, already_existing = filter_not_yet_published(db, draft_docs)
            failures = len(already_existing)
            published_count = publish_drafts(db, still_eligible, resolved_uid)

            db.collection("imports").document(import_id).update(
                {
                    "status": "published",
                    "publishedCount": published_count,
                    "publishedAt": firestore.SERVER_TIMESTAMP,
                }
            )
            status = "CONCLUÍDO"

    result["publishedCount"] = published_count
    result["failures"] = failures

    print_summary(
        subject, year, total_extracted, len(excluded_questions), excluded_info, len(valid_questions),
        internal_duplicates, len(unique_questions), existing_duplicates, len(new_questions),
        import_id=import_id, backup_path=backup_path, excluded_report_path=excluded_report_path,
        published_count=published_count, failures=failures,
        status=status,
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa um PDF de questões, exclui inválidas, deduplica e (opcionalmente) publica.")
    parser.add_argument("pdf_path")
    parser.add_argument("--subject", required=True, help="Disciplina principal do lote (importSubject)")
    parser.add_argument("--year", required=True, type=int, help="Ano do lote (importYear)")
    parser.add_argument("--credentials", required=True, help="Caminho do service-account.json (Admin SDK)")
    parser.add_argument("--imported-by-uid", default=None)
    parser.add_argument("--imported-by-email", default=None)
    parser.add_argument("--source", default="fc_concursos", choices=PARSERS.keys())
    parser.add_argument("--dry-run", action="store_true", help="Só analisa, exclui e deduplica, não grava nada")
    parser.add_argument("--publish", action="store_true", help="Publica automaticamente as questões válidas")
    args = parser.parse_args()

    app = firebase_admin.initialize_app(credentials.Certificate(args.credentials))
    db = firestore.client()

    run_pipeline(
        args.pdf_path,
        args.subject,
        args.year,
        db,
        lambda: resolve_uid(app, args.imported_by_uid, args.imported_by_email),
        source_name=args.source,
        dry_run=args.dry_run,
        publish=args.publish,
    )


if __name__ == "__main__":
    main()
