from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import firebase_admin  # noqa: E402
from firebase_admin import credentials, firestore  # noqa: E402

from scripts.batch_exam_explanations_gemini import process_question  # noqa: E402
from scripts.batch_support import BatchLock, atomic_write_json  # noqa: E402
from local_ai.gemini_client import DEFAULT_MODEL  # noqa: E402

# Generic version of batch_exam_explanations_gemini.py's per-question
# pipeline, pointed at the WHOLE `questions` collection (fc_concursos,
# gran_cursos, fgv, ...) instead of one exam JSON. process_question()
# itself is exam-agnostic already — it only needs statement/alternatives/
# officialAnswer/subject, all present on every published question
# regardless of source. This script only READS Firestore and writes a
# local checkpoint JSON; it never touches Firestore. Applying results
# back is a separate, explicitly --apply-gated step (apply_bank_explanations.py).

DEFAULT_CRED_PATH = "/Users/brayhonmartinsfelix/firebase-keys/gen-lang-client-0709783251-firebase-adminsdk-fbsvc-46522b9cf7.json"
ALL_STATUSES = ("approved", "approved_with_gaps", "rejected", "error")


def _init_firestore(cred_path: str):
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()


def _alternatives_list_to_dict(alternatives: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for alt in alternatives:
        letter = alt.get("letter")
        text = alt.get("text")
        if letter and text is not None:
            out[letter] = text
    return out


def _official_answer_text(alternatives: dict[str, str], correct_letter: str | None) -> str | None:
    if not correct_letter:
        return None
    return alternatives.get(correct_letter)


def build_question_dict(doc_id: str, data: dict) -> dict | None:
    statement = data.get("statement")
    correct_letter = data.get("correctLetter")
    raw_alternatives = data.get("alternatives")

    if not statement or not correct_letter or not raw_alternatives:
        return None

    if isinstance(raw_alternatives, list):
        alternatives = _alternatives_list_to_dict(raw_alternatives)
    elif isinstance(raw_alternatives, dict):
        alternatives = raw_alternatives
    else:
        return None

    if not alternatives:
        return None

    official_answer_text = _official_answer_text(alternatives, correct_letter)
    if official_answer_text is None:
        return None

    subject = data.get("subjectRaw") or data.get("importSubject")

    return {
        "questionNumber": doc_id,
        "subject": subject,
        "officialAnswer": correct_letter,
        "officialAnswerText": official_answer_text,
        "annulled": bool(data.get("annulled")),
        "statement": statement,
        "alternatives": alternatives,
    }


def needs_upgrade(data: dict, min_words: int) -> bool:
    explanation = data.get("explanation")
    if not explanation or not isinstance(explanation, str):
        return True
    return len(explanation.split()) < min_words


def fetch_candidates(db, source: str | None, min_words: int, limit: int | None) -> list[tuple[str, dict]]:
    query = db.collection("questions")
    if source and source != "all":
        query = query.where("source", "==", source)

    candidates: list[tuple[str, dict]] = []
    for doc in query.stream():
        data = doc.to_dict()
        if not needs_upgrade(data, min_words):
            continue
        candidates.append((doc.id, data))
        if limit and len(candidates) >= limit:
            break
    return candidates


def _build_output_document(model: str, source_filter: str, all_ids: list[str], results_by_id: dict[str, dict]) -> dict:
    """Mirrors the cumulative-`all_ids` fix in batch_exam_explanations_gemini.py:
    a narrower follow-up run must never shrink this file back down to just
    its own subset — see that module's _build_output_document docstring
    for the real incident this pattern fixed."""
    ordered_results = [results_by_id[i] for i in all_ids if i in results_by_id]
    counts = {status: 0 for status in ALL_STATUSES}
    for r in ordered_results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "sourceFilter": source_filter,
        "progress": {
            "total": len(all_ids),
            "completed": len(ordered_results),
            "remaining": len(all_ids) - len(ordered_results),
            **counts,
        },
        "results": ordered_results,
    }


def run(args: argparse.Namespace) -> None:
    output_path = Path(args.output)
    lock = BatchLock(output_path)
    lock.acquire()

    try:
        db = _init_firestore(args.cred_path)

        results_by_id: dict[str, dict] = {}
        if args.resume and output_path.exists():
            import json

            existing = json.loads(output_path.read_text(encoding="utf-8"))
            for r in existing.get("results", []):
                results_by_id[str(r["questionNumber"])] = r
            print(f"Resumindo: {len(results_by_id)} resultados já no arquivo.")

        print(f"Buscando candidatos (source={args.source}, min_words={args.min_words})...")
        candidates = fetch_candidates(db, args.source, args.min_words, args.limit)
        print(f"{len(candidates)} questões candidatas nesta busca.")

        pending = [(doc_id, data) for doc_id, data in candidates if doc_id not in results_by_id]
        print(f"{len(pending)} ainda não processadas neste --output.")

        all_ids = sorted(set(results_by_id.keys()) | {doc_id for doc_id, _ in candidates})

        skipped_no_shape = 0
        for i, (doc_id, data) in enumerate(pending, 1):
            question = build_question_dict(doc_id, data)
            if question is None:
                skipped_no_shape += 1
                continue

            t0 = time.perf_counter()
            result = process_question(question, args.model, args.sources_limit)
            result["source"] = data.get("source")
            elapsed = time.perf_counter() - t0

            results_by_id[doc_id] = result
            doc = _build_output_document(args.model, args.source or "all", all_ids, results_by_id)
            atomic_write_json(output_path, doc)

            print(
                f"[{i}/{len(pending)}] {doc_id} ({data.get('source')}) -> "
                f"{result['status']} ({elapsed:.1f}s)"
            )

            if args.sleep:
                time.sleep(args.sleep)

        if skipped_no_shape:
            print(f"Aviso: {skipped_no_shape} questões puladas por faltar statement/alternatives/correctLetter.")

        final = _build_output_document(args.model, args.source or "all", all_ids, results_by_id)
        print("\nResumo final:", final["progress"])
    finally:
        lock.release()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="all", help="fc_concursos | gran_cursos | fgv | all")
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sources-limit", type=int, default=3)
    parser.add_argument("--min-words", type=int, default=400, help="Explicações com menos palavras que isso são consideradas desatualizadas.")
    parser.add_argument("--limit", type=int, default=None, help="Máximo de questões a processar nesta execução (para testes).")
    parser.add_argument("--sleep", type=float, default=1.0, help="Segundos de espera entre chamadas ao Gemini.")
    parser.add_argument("--no-resume", dest="resume", action="store_false")
    parser.add_argument("--cred-path", default=DEFAULT_CRED_PATH)
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
