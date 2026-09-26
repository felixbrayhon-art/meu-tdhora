from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.auth import resolve_uid  # noqa: E402
from lib.dedup import fetch_existing_keys, question_fingerprint, sanitize_doc_id  # noqa: E402
from lib.exclusion import excluded_summary, split_valid_and_excluded  # noqa: E402
from lib.validation import validate_question_structure  # noqa: E402

# Batched writes are capped at 500 operations by Firestore; a 300-question
# deck fits in one batch, but nothing here assumes that stays true.
BATCH_LIMIT = 400

EXCLUDED_DIR = Path(__file__).resolve().parent.parent / "output" / "excluded"


def _slugify(text: str) -> str:
    import re
    import unicodedata

    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "sem-titulo"


def derive_batch_subject_year(questions: list[dict]) -> tuple[str | None, int | None, list[str]]:
    """Derives the `imports` doc's own importSubject/importYear from the
    questions actually becoming drafts (`new_questions` — the same set
    approve_import.py compares its stored importSubject/importYear
    against). Previously these two fields were never written on `imports`
    at all, even when every draft agreed on the same value, which made
    approve_import.py's comparison fail against None and block a
    perfectly consistent batch (see PR notes / worker/output/backups —
    this happened for real on the 198-question Direito Administrativo
    2026 batch and had to be fixed by hand in Firestore).

    Returns (subject, year, warnings). A batch that genuinely mixes more
    than one subject or year (e.g. a multi-concurso simulado PDF) gets
    None for that field rather than an arbitrary guess — `warnings`
    explains why, so the operator sees it in the printed summary instead
    of silently getting an import doc that doesn't describe its own
    drafts.
    """
    warnings: list[str] = []

    subjects = {q.get("importSubject") for q in questions if q.get("importSubject")}
    years = {q.get("importYear") for q in questions if q.get("importYear")}

    subject = next(iter(subjects)) if len(subjects) == 1 else None
    if len(subjects) > 1:
        warnings.append(
            f"lote mistura {len(subjects)} importSubject diferentes ({sorted(subjects)}) — "
            "imports.importSubject gravado como null"
        )

    year = next(iter(years)) if len(years) == 1 else None
    if len(years) > 1:
        warnings.append(
            f"lote mistura {len(years)} importYear diferentes ({sorted(years)}) — "
            "imports.importYear gravado como null"
        )

    return subject, year, warnings


def write_excluded_report(title: str, import_id: str, questions: list[dict], excluded_dir: Path | None = None) -> Path:
    excluded_dir = excluded_dir or EXCLUDED_DIR
    excluded_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = excluded_dir / f"{_slugify(title)}-{import_id}-{timestamp}.json"
    path.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def push(db, payload: dict, imported_by: str, excluded_dir: Path | None = None) -> dict:
    meta = payload["meta"]
    raw_questions = payload["questions"]
    source = raw_questions[0]["source"] if raw_questions else "unknown"

    # Same structural bar as import_batch.py: a question failing it gets
    # `warnings` merged in here, then dropped by the exclusion filter below
    # before it ever becomes a draft. Never auto-corrected.
    questions = []
    for q in raw_questions:
        structural_errors = validate_question_structure(q)
        if structural_errors:
            q = dict(q)
            q["warnings"] = [*q.get("warnings", []), *structural_errors]
            q["status"] = "needs_attention"
        questions.append(q)

    valid_questions, excluded_questions = split_valid_and_excluded(questions)
    excluded_info = excluded_summary(excluded_questions)

    existing_pairs, existing_fingerprints = fetch_existing_keys(db)

    seen_pairs: set[tuple[str, str]] = set()
    seen_fingerprints: set[str] = set()

    new_questions = []
    duplicate_count = 0

    for q in valid_questions:
        key = (q["source"], q["externalId"])
        fingerprint = question_fingerprint(q)

        if (
            key in existing_pairs
            or fingerprint in existing_fingerprints
            or key in seen_pairs
            or fingerprint in seen_fingerprints
        ):
            duplicate_count += 1
            continue

        seen_pairs.add(key)
        seen_fingerprints.add(fingerprint)
        new_questions.append(q)

    import_id = str(uuid.uuid4())

    excluded_report_path = None
    if excluded_questions:
        excluded_report_path = write_excluded_report(meta.get("title") or "import", import_id, excluded_questions, excluded_dir)

    import_subject, import_year, subject_year_warnings = derive_batch_subject_year(new_questions)

    db.collection("imports").document(import_id).set(
        {
            "source": source,
            "title": meta.get("title"),
            "ownerName": meta.get("ownerName"),
            "ownerEmail": meta.get("ownerEmail"),
            "generatedAt": meta.get("generatedAt"),
            "bloco": meta.get("bloco"),
            # approve_import.py compares these against the drafts it's
            # about to publish — see derive_batch_subject_year's docstring.
            "importSubject": import_subject,
            "importYear": import_year,
            "totalQuestions": len(raw_questions),
            "excludedQuestions": len(excluded_questions),
            "excluded": excluded_info,
            "validQuestions": len(valid_questions),
            "newQuestions": len(new_questions),
            "duplicateQuestions": duplicate_count,
            "importedAt": firestore.SERVER_TIMESTAMP,
            "importedBy": imported_by,
        }
    )

    batch = db.batch()
    ops_in_batch = 0
    for q in new_questions:
        doc_id = sanitize_doc_id(f"{q['source']}_{q['externalId']}")
        draft = dict(q)
        draft["importId"] = import_id
        batch.set(db.collection("question_drafts").document(doc_id), draft)
        ops_in_batch += 1
        if ops_in_batch >= BATCH_LIMIT:
            batch.commit()
            batch = db.batch()
            ops_in_batch = 0
    if ops_in_batch:
        batch.commit()

    return {
        "importId": import_id,
        "total": len(raw_questions),
        "excluded": len(excluded_questions),
        "duplicates": duplicate_count,
        "new": len(new_questions),
        "excludedReportPath": excluded_report_path,
        "importSubject": import_subject,
        "importYear": import_year,
        "subjectYearWarnings": subject_year_warnings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Envia o JSON gerado por import_pdf.py para o Firestore.")
    parser.add_argument("json_path", help="Saída de import_pdf.py")
    parser.add_argument("--credentials", required=True, help="Caminho do service-account.json (Admin SDK)")
    parser.add_argument("--imported-by-uid", default=None)
    parser.add_argument("--imported-by-email", default=None, help="Resolvido via Firebase Auth se uid não for informado")
    args = parser.parse_args()

    payload = json.loads(Path(args.json_path).read_text(encoding="utf-8"))
    app = firebase_admin.initialize_app(credentials.Certificate(args.credentials))
    db = firestore.client()

    imported_by = resolve_uid(app, args.imported_by_uid, args.imported_by_email or payload["meta"].get("ownerEmail"))
    result = push(db, payload, imported_by)

    print(f"Import criado: imports/{result['importId']}")
    print(f"Total recebido: {result['total']}")
    print(f"Excluídas (warnings/needs_attention/estrutural): {result['excluded']}")
    print(f"Duplicadas ignoradas: {result['duplicates']}")
    print(f"Novas importadas: {result['new']}")
    print(f"importSubject: {result['importSubject']!r} / importYear: {result['importYear']!r}")
    for warning in result["subjectYearWarnings"]:
        print(f"AVISO: {warning}")
    if result["excludedReportPath"]:
        print(f"Relatório de excluídas: {result['excludedReportPath']}")
    if result["new"]:
        print("Abra a tela de revisão no app (admin) para aprovar.")


if __name__ == "__main__":
    main()
