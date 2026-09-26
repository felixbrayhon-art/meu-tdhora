from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exam_discovery.to_draft import import_subject_bucket  # noqa: E402

# One-off, source-scoped repair: worker/lib/publish.py's build_published_fields()
# never copied examBoard/organization/position/examYear from draft to
# published question (the same bug class already fixed in the app's own
# approveDraft() — see services/questionBankService.ts), and
# worker/scripts/import_gran_pdf.py never set importSubject at all. Both
# are fixed going forward (see the diffs alongside this file); THIS script
# repairs the 127 gran_cursos questions already published before that fix,
# using the pre-publish drafts preserved in worker/output/backups/ (import_batch.py
# always backs up the full draft — including these fields — right before
# publishing). Touches ONLY importSubject/subjectRaw/examBoard/organization/
# position/examYear on an existing doc; statement/alternatives/correctLetter/
# explanation/contentHash are read for verification only, never written.

DEFAULT_BACKUP_PATHS = [
    "output/backups/sem-materia-0-80a1b265-6032-42ac-8037-96bf3ece354d-20260925T032033Z.json",
    "output/backups/sem-materia-0-f0f58191-3a2d-4d7e-9f26-1045a3493867-20260925T034027Z.json",
]


def load_backup_index(backup_paths: list[Path]) -> dict[str, dict]:
    """Keyed by externalId — both known backups are entirely source=gran_cursos
    and externalId is unique within/across them (Gran Cursos' own question ids)."""
    index: dict[str, dict] = {}
    for path in backup_paths:
        entries = json.loads(path.read_text(encoding="utf-8"))
        for entry in entries:
            if entry.get("source") != "gran_cursos":
                continue
            index[entry["externalId"]] = entry
    return index


def compute_updates(published: dict, backup_entry: dict) -> tuple[dict | None, str | None]:
    """Returns (update_fields, skip_reason). update_fields is None when
    skip_reason is set. Never overwrites a field that already has a real
    value in `published` (idempotent — safe to re-run)."""
    if published.get("statement") != backup_entry.get("statement"):
        return None, "statement do publicado diverge do backup — pulado por segurança"
    if published.get("contentHash") != backup_entry.get("contentHash"):
        return None, "contentHash do publicado diverge do backup — pulado por segurança"

    subject_raw = backup_entry.get("subjectRaw")
    update_fields: dict = {}

    if not published.get("importSubject"):
        bucket = import_subject_bucket(subject_raw)
        if bucket:
            update_fields["importSubject"] = bucket
    if not published.get("subjectRaw") and subject_raw:
        update_fields["subjectRaw"] = subject_raw
    if not published.get("topicRaw") and backup_entry.get("topicRaw"):
        update_fields["topicRaw"] = backup_entry["topicRaw"]

    for field in ("examBoard", "organization", "position", "examYear"):
        if not published.get(field) and backup_entry.get(field):
            update_fields[field] = backup_entry[field]

    if not published.get("importYear") and backup_entry.get("examYear"):
        update_fields["importYear"] = backup_entry["examYear"]

    if not update_fields:
        return {}, "já completo — nada a atualizar"
    return update_fields, None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Recupera examBoard/organization/position/examYear/importSubject nas questões "
        "gran_cursos já publicadas (perdidos por um bug em lib/publish.py), usando os backups de "
        "pré-publicação em worker/output/backups/. Dry-run por padrão."
    )
    parser.add_argument("--credentials", required=True, help="service-account.json (Admin SDK)")
    parser.add_argument("--commit", action="store_true", help="Grava de verdade. Sem isso, só mostra o que faria.")
    parser.add_argument(
        "--backup", action="append", default=None,
        help="Caminho de um backup extra (repetível). Sem isso, usa os 2 backups conhecidos do lote gran_cursos.",
    )
    args = parser.parse_args()

    backup_paths = [Path(p) for p in (args.backup or DEFAULT_BACKUP_PATHS)]
    for p in backup_paths:
        if not p.exists():
            raise SystemExit(f"Backup não encontrado: {p}")

    backup_index = load_backup_index(backup_paths)
    print(f"Backups carregados: {len(backup_paths)} arquivo(s), {len(backup_index)} questões indexadas por externalId.")

    import firebase_admin
    from firebase_admin import credentials, firestore

    try:
        firebase_admin.initialize_app(credentials.Certificate(args.credentials))
    except ValueError:
        pass  # already initialized (e.g. re-run in the same process)
    db = firestore.client()

    docs = list(db.collection("questions").where("source", "==", "gran_cursos").stream())
    print(f"Questões gran_cursos publicadas encontradas: {len(docs)}")

    updated = 0
    already_complete = 0
    missing_in_backup = []
    skipped_mismatch = []

    for doc in docs:
        data = doc.to_dict() or {}
        external_id = data.get("externalId")
        backup_entry = backup_index.get(external_id)
        if backup_entry is None:
            missing_in_backup.append(external_id)
            continue

        update_fields, skip_reason = compute_updates(data, backup_entry)
        if skip_reason == "já completo — nada a atualizar":
            already_complete += 1
            continue
        if skip_reason:
            skipped_mismatch.append((external_id, skip_reason))
            continue

        if args.commit:
            doc.reference.update(update_fields)
        updated += 1
        if updated <= 5 or args.commit:
            print(f"  {'ATUALIZADO' if args.commit else 'SERIA ATUALIZADO'} {external_id}: {update_fields}")

    print()
    print("=" * 70)
    print(f"{'COMMIT' if args.commit else 'DRY-RUN'} — resumo")
    print("=" * 70)
    print(f"Já completas (nada a fazer): {already_complete}")
    print(f"{'Atualizadas' if args.commit else 'Seriam atualizadas'}: {updated}")
    print(f"Sem entrada correspondente no backup: {len(missing_in_backup)}")
    if missing_in_backup:
        print(f"  externalIds: {missing_in_backup}")
    print(f"Puladas por divergência (statement/contentHash): {len(skipped_mismatch)}")
    for ext_id, reason in skipped_mismatch:
        print(f"  {ext_id}: {reason}")

    if not args.commit:
        print()
        print("Nada foi escrito no Firestore (sem --commit).")


if __name__ == "__main__":
    main()
