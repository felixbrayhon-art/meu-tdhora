from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exam_discovery.models import ExtractedQuestion  # noqa: E402
from exam_discovery.to_draft import PairMeta, build_parsed_questions_from_explanations, import_subject_bucket  # noqa: E402
from lib.exclusion import excluded_summary, split_valid_and_excluded  # noqa: E402
from lib.validation import validate_question_structure  # noqa: E402

# Stage 3 of "discovered exam -> app question bank" (see
# export_fgv_for_explanations.py for stage 1 and worker/scripts/
# batch_exam_explanations.py for stage 2). Reads the pair's own exam JSON
# and the matching explanations JSON, converts every question into the
# same ParsedQuestion shape every other source already produces, and —
# by default — ONLY prints what WOULD be sent to question_drafts (no
# Firestore access at all). --commit is the only mode that writes
# anything, via worker/scripts/push_drafts.py's already-tested push(),
# so a real run gets the exact same dedup/exclusion/backup-audit
# guarantees any other source's import already has.


def _question_from_dict(q: dict) -> ExtractedQuestion:
    return ExtractedQuestion(
        question_number=q["questionNumber"],
        subject=q.get("subject"),
        statement=q["statement"],
        alternatives=[{"letter": letter, "text": text} for letter, text in q["alternatives"].items()],
        official_answer=q.get("officialAnswer"),
        official_answer_text=q.get("officialAnswerText"),
        annulled=bool(q.get("annulled")),
        status="valid",
        warnings=[],
    )


def build_drafts(exam_json: dict, explanations_json: dict | None, source: str) -> list[dict]:
    meta = exam_json["meta"]
    pair = PairMeta(
        board=meta["board"], institution=meta["institution"], role=meta.get("role"),
        year=meta.get("year"), test_type=meta.get("testType"),
    )
    questions = [_question_from_dict(q) for q in exam_json["questions"]]

    explanations_by_number: dict[int, dict] = {}
    if explanations_json:
        for result in explanations_json.get("results", []):
            explanations_by_number[result["questionNumber"]] = result

    parsed_questions = build_parsed_questions_from_explanations(pair, questions, explanations_by_number, source=source)

    drafts = []
    for pq in parsed_questions:
        d = pq.to_dict()
        # importSubject is what the app's "Por Matéria" tab actually groups
        # by (see listBankImportSubjects) — ParsedQuestion.to_dict() has no
        # such field (only import_batch.py's PDF-batch path adds it, from
        # its own --subject flag), so this source needs to set it itself,
        # derived from the same subjectRaw the question already carries.
        d["importSubject"] = import_subject_bucket(d["subjectRaw"])
        d["importYear"] = d["examYear"]
        structural_errors = validate_question_structure(d)
        if structural_errors:
            d["warnings"] = [*d["warnings"], *structural_errors]
            d["status"] = "needs_attention"
        drafts.append(d)
    return drafts


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Converte um JSON exportado por export_fgv_for_explanations.py (+ o JSON de "
        "explicações de batch_exam_explanations.py) em drafts para revisão do admin. Por padrão só "
        "mostra o que SERIA enviado (nenhum acesso ao Firestore); --commit grava de verdade via "
        "worker/scripts/push_drafts.py."
    )
    parser.add_argument("--exam", required=True, help="JSON exportado por export_fgv_for_explanations.py")
    parser.add_argument("--explanations", default=None, help="JSON de saída de batch_exam_explanations.py")
    parser.add_argument("--source", default="fgv")
    parser.add_argument("--commit", action="store_true", help="Grava de verdade em question_drafts.")
    parser.add_argument("--credentials", default=None, help="service-account.json (só com --commit)")
    parser.add_argument("--imported-by-uid", default=None)
    parser.add_argument("--imported-by-email", default=None)
    args = parser.parse_args()

    if args.commit and not args.credentials:
        raise SystemExit("--commit requer --credentials <service-account.json>")

    exam_json = json.loads(Path(args.exam).read_text(encoding="utf-8"))
    explanations_json = json.loads(Path(args.explanations).read_text(encoding="utf-8")) if args.explanations else None

    drafts = build_drafts(exam_json, explanations_json, args.source)
    valid, excluded = split_valid_and_excluded(drafts)

    print("=" * 70)
    print(f"{'COMMIT' if args.commit else 'DRY-RUN'} — worker/scripts/push_fgv_drafts.py")
    print("=" * 70)
    print(f"Total de questões convertidas: {len(drafts)}")
    print(f"Elegíveis para draft: {len(valid)}")
    print(f"Excluídas (warnings/needs_attention): {len(excluded)}")
    for item in excluded_summary(excluded):
        print(f"  Q{item['number']} ({item['externalId']}): {', '.join(item['reasons'])}")

    if not args.commit:
        print()
        print("Nada foi escrito no Firestore (sem --commit). Rode com --commit --credentials "
              "<service-account.json> quando estiver pronto.")
        return

    import firebase_admin
    from firebase_admin import credentials, firestore

    from lib.auth import resolve_uid
    from scripts.push_drafts import push

    app = firebase_admin.initialize_app(credentials.Certificate(args.credentials))
    db = firestore.client()
    imported_by = resolve_uid(app, args.imported_by_uid, args.imported_by_email)

    payload = {
        "meta": {
            "title": f"{exam_json['meta']['institution']} {exam_json['meta'].get('year') or ''} — "
                     f"{exam_json['meta'].get('role') or ''} (descoberta automática)",
        },
        "questions": drafts,
    }
    result = push(db, payload, imported_by)

    print()
    print(f"Import criado: imports/{result['importId']}")
    print(f"Novas importadas: {result['new']}")
    print(f"Duplicadas ignoradas: {result['duplicates']}")
    if result["new"]:
        print("Abra a tela de revisão no app (admin) para aprovar.")


if __name__ == "__main__":
    main()
