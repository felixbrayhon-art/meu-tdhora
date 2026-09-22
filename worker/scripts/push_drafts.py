from __future__ import annotations

import argparse
import json
import uuid
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials, firestore

# Batched writes are capped at 500 operations by Firestore; a 300-question
# deck fits in one batch, but nothing here assumes that stays true.
BATCH_LIMIT = 400


def resolve_uid(app, uid: str | None, email: str | None) -> str:
    if uid:
        return uid
    if email:
        return auth.get_user_by_email(email, app=app).uid
    raise SystemExit("Informe --imported-by-uid ou --imported-by-email (ou deixe o JSON trazer ownerEmail).")


def push(db, payload: dict, imported_by: str) -> str:
    meta = payload["meta"]
    questions = payload["questions"]

    import_id = str(uuid.uuid4())
    db.collection("imports").document(import_id).set(
        {
            "source": questions[0]["source"] if questions else "unknown",
            "title": meta.get("title"),
            "ownerName": meta.get("ownerName"),
            "ownerEmail": meta.get("ownerEmail"),
            "generatedAt": meta.get("generatedAt"),
            "bloco": meta.get("bloco"),
            "totalQuestions": len(questions),
            "importedAt": firestore.SERVER_TIMESTAMP,
            "importedBy": imported_by,
        }
    )

    batch = db.batch()
    ops_in_batch = 0
    for q in questions:
        draft_ref = db.collection("question_drafts").document()
        draft = dict(q)
        draft["importId"] = import_id
        batch.set(draft_ref, draft)
        ops_in_batch += 1
        if ops_in_batch >= BATCH_LIMIT:
            batch.commit()
            batch = db.batch()
            ops_in_batch = 0
    if ops_in_batch:
        batch.commit()

    return import_id


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
    import_id = push(db, payload, imported_by)

    print(f"Import criado: imports/{import_id}")
    print(f"{len(payload['questions'])} questões enviadas para question_drafts (status pending_review/needs_attention)")
    print("Abra a tela de revisão no app (admin) para aprovar.")


if __name__ == "__main__":
    main()
