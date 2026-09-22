from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import firebase_admin  # noqa: E402
from firebase_admin import credentials, firestore  # noqa: E402

from lib.backup import write_backup  # noqa: E402
from lib.publish import filter_not_yet_published, publish_drafts  # noqa: E402
from lib.validation import validate_before_publish  # noqa: E402

"""Bulk-publishes the still-pending question_drafts of an existing importId
— for the "MODO SEM PUBLICAR" flow: run import_batch.py without --publish,
review the drafts in the admin panel (or spot-check them), then run this to
publish everything that's ready, without needing the original PDF again.

Only drafts with zero warnings are published by default, exactly like
import_batch.py --publish. --include-warnings overrides that per-question
gate; it does not skip the structural/import-field pre-publish validation.
"""


def run_pipeline(
    db, import_id: str, approved_by: str, include_warnings: bool = False, backups_dir: Path | None = None
) -> dict:
    import_ref = db.collection("imports").document(import_id)
    import_doc = import_ref.get()
    if not import_doc.exists:
        raise SystemExit(f"imports/{import_id} não encontrado.")
    import_data = import_doc.to_dict() or {}
    subject = import_data.get("importSubject")
    year = import_data.get("importYear")

    draft_docs: list[tuple[str, dict]] = []
    skipped_warnings = 0
    for doc in db.collection("question_drafts").where("importId", "==", import_id).stream():
        draft = doc.to_dict() or {}
        if draft.get("warnings") and not include_warnings:
            skipped_warnings += 1
            continue
        draft_docs.append((doc.id, draft))

    result = {"published": 0, "alreadyExisting": 0, "skippedWarnings": skipped_warnings, "backupPath": None}

    if not draft_docs:
        print("Nada para publicar (0 drafts elegíveis).")
        print(f"Ignoradas por warnings: {skipped_warnings}")
        return result

    # Backup happens before the first write batch — including before
    # pre-publish validation, exactly like import_batch.py --publish — and
    # a failure here aborts the whole run: no imports.update, no
    # publish_drafts, nothing touched in Firestore.
    try:
        backup_path = write_backup(
            subject or "sem-materia", year or 0, import_id, [draft for _, draft in draft_docs], backups_dir
        )
    except Exception as exc:  # disk full, permission error, etc.
        print(f"Falha ao criar backup — abortando publicação sem gravar nada: {exc}")
        raise SystemExit(1)
    result["backupPath"] = str(backup_path)
    print(f"Backup: {backup_path}")

    pre_publish_errors: dict[str, list[str]] = {}
    for doc_id, draft in draft_docs:
        errs = validate_before_publish(draft, subject, year)
        if errs:
            pre_publish_errors[doc_id] = errs

    if pre_publish_errors:
        print(f"Pré-validação falhou para {len(pre_publish_errors)} questão(ões) — abortando, nada publicado:")
        for doc_id, errs in pre_publish_errors.items():
            print(f"  {doc_id}: {', '.join(errs)}")
        raise SystemExit(1)

    still_eligible, already_existing = filter_not_yet_published(db, draft_docs)
    published = publish_drafts(db, still_eligible, approved_by)

    import_ref.update(
        {
            "status": "published",
            "publishedCount": firestore.Increment(published),
            "publishedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    result["published"] = published
    result["alreadyExisting"] = len(already_existing)

    print(f"Publicadas: {published}")
    print(f"Já existentes (ignoradas): {len(already_existing)}")
    print(f"Ignoradas por warnings: {skipped_warnings}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Publica em lote os question_drafts pendentes de um importId.")
    parser.add_argument("import_id")
    parser.add_argument("--credentials", required=True, help="Caminho do service-account.json (Admin SDK)")
    parser.add_argument("--imported-by-uid", required=True, help="uid a gravar em approvedBy")
    parser.add_argument(
        "--include-warnings",
        action="store_true",
        help="Também publica questões com warnings (normalmente revise-as no painel admin antes).",
    )
    args = parser.parse_args()

    firebase_admin.initialize_app(credentials.Certificate(args.credentials))
    db = firestore.client()

    run_pipeline(db, args.import_id, args.imported_by_uid, args.include_warnings)


if __name__ == "__main__":
    main()
