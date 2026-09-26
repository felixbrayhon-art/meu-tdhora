from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import firebase_admin  # noqa: E402
from firebase_admin import credentials, firestore  # noqa: E402

from exam_discovery.to_draft import render_explanation_text  # noqa: E402

# Applies worker/output/bank-explanations-full.json (from generate_bank_explanations.py)
# onto Firestore's `questions` collection. DRY-RUN by default; --apply required to
# actually write. Only ever touches the `explanation` field, only for status
# "approved" (and "approved_with_gaps" if --include-gaps is passed), and only after
# confirming the live doc's correctLetter still matches what generation saw (cheap
# drift guard — the doc ID IS the exact document, so this just catches the rare
# case of the question changing between generation and apply).

DEFAULT_CRED_PATH = "/Users/brayhonmartinsfelix/firebase-keys/gen-lang-client-0709783251-firebase-adminsdk-fbsvc-46522b9cf7.json"


def _init_firestore(cred_path: str):
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="output/bank-explanations-full.json")
    parser.add_argument("--apply", action="store_true", help="Actually write to Firestore. Omit for a dry run.")
    parser.add_argument("--include-gaps", action="store_true", help="Also apply approved_with_gaps results.")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--cred-path", default=DEFAULT_CRED_PATH)
    args = parser.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    allowed_statuses = {"approved"} | ({"approved_with_gaps"} if args.include_gaps else set())
    candidates = [r for r in data["results"] if r["status"] in allowed_statuses]
    if args.limit:
        candidates = candidates[: args.limit]

    print(f"{len(candidates)} resultados elegíveis ({'/'.join(sorted(allowed_statuses))}) de {len(data['results'])} no arquivo.")

    db = _init_firestore(args.cred_path)

    plan = []
    skipped_missing = 0
    skipped_mismatch = 0
    skipped_no_app_explanation = 0

    for r in candidates:
        doc_id = str(r["questionNumber"])
        app_explanation = (r.get("explanation") or {}).get("appExplanation")
        if not app_explanation:
            skipped_no_app_explanation += 1
            continue

        doc_ref = db.collection("questions").document(doc_id)
        snap = doc_ref.get()
        if not snap.exists:
            skipped_missing += 1
            continue

        current = snap.to_dict()
        if current.get("correctLetter") != r.get("officialAnswer"):
            skipped_mismatch += 1
            continue

        new_explanation = render_explanation_text(app_explanation)
        if not isinstance(new_explanation, str) or not new_explanation.strip():
            skipped_no_app_explanation += 1
            continue

        plan.append({
            "docId": doc_id,
            "source": r.get("source"),
            "oldExplanation": current.get("explanation"),
            "newExplanation": new_explanation.strip(),
            "wordCount": len(new_explanation.split()),
        })

    print(f"Plano final: {len(plan)} documentos serão atualizados.")
    print(f"  Pulados (doc não encontrado): {skipped_missing}")
    print(f"  Pulados (correctLetter divergente): {skipped_mismatch}")
    print(f"  Pulados (sem appExplanation válido): {skipped_no_app_explanation}")
    if plan:
        avg_words = sum(p["wordCount"] for p in plan) / len(plan)
        print(f"  Média de palavras por explicação nova: {avg_words:.0f}")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = Path("output/backups")
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.apply:
        preview_path = out_dir / f"bank-apply-dry-run-{timestamp}.json"
        preview_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nDRY RUN — nada escrito no Firestore. Plano salvo em {preview_path}")
        return

    backup_path = out_dir / f"bank-explanations-before-apply-{timestamp}.json"
    backup_path.write_text(
        json.dumps([{"docId": p["docId"], "explanation": p["oldExplanation"]} for p in plan], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nBackup das explicações antigas salvo em {backup_path}")

    written = 0
    for p in plan:
        db.collection("questions").document(p["docId"]).update({"explanation": p["newExplanation"]})
        written += 1
        if written % 50 == 0:
            print(f"  {written}/{len(plan)} aplicados...")

    print(f"\nAplicado: {written} documentos atualizados no Firestore.")


if __name__ == "__main__":
    main()
