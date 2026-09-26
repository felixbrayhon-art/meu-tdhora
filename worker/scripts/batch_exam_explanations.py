from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.evidence_compaction import compact_evidence_for_generation  # noqa: E402
from legal_base.evidence_pipeline import build_evidence_for_question  # noqa: E402
from legal_base.text_utils import strip_accents  # noqa: E402
from local_ai.ollama_client import DEFAULT_MODEL, generate, is_available  # noqa: E402
from local_ai.prompt_builder import QuestionInput  # noqa: E402
from local_ai.structured_explanation import (  # noqa: E402
    SECTION_GROUPS,
    build_app_explanation,
    build_structured_explanation_prompt,
    merge_processed_explanations,
    process_structured_explanation,
)
from scripts.batch_support import (  # noqa: E402
    BatchLock,
    atomic_write_json,
    parse_question_spec,
    should_reprocess_status,
)

# Offline, local-only batch runner. For each requested question, exactly
# one of these terminal statuses is recorded:
#   annulled              -> official gabarito marks it annulled, no Ollama call
#   insufficient_evidence -> no/incomplete evidence, or Ollama unreachable, no generation attempted
#   approved               -> juridically safe explanation (the source set is an anchor for
#                              evidenceQuotes/gabarito, not a requirement for every sentence —
#                              complementary legal knowledge with no local quote still counts
#                              as approved, see local_ai/structured_explanation.py)
#   approved_with_gaps     -> safe, but a source-ID leak in one or more sections could not be
#                              sanitized and was replaced by the insufficiency sentence
#   rejected                -> the model's output is unusable (bad JSON/structure) OR contains a
#                              fabricated/non-literal evidenceQuote (evidenceQuotes stay 100% literal)
#   error                    -> an operational failure (Ollama down, exception, ...) — NOT the same as rejected
# Writes ONE local JSON file (--output), checkpointed atomically after
# EVERY question. Never touches Firestore/Firebase.

ALL_STATUSES = ("approved", "approved_with_gaps", "rejected", "insufficient_evidence", "annulled", "error")


def normalize_subject(subject: str | None) -> str | None:
    if not subject:
        return None
    s = strip_accents(subject).lower()
    if "processual penal" in s:
        return "Direito Processual Penal"
    if "direito penal" in s:
        return "Direito Penal"
    if "constitucional" in s:
        return "Direito Constitucional"
    # An unmapped subject (e.g. "Direito Administrativo", "Direitos
    # Humanos") must never be passed through as-is: legal_base.
    # unified_search._local_subject() treats a subject it doesn't
    # recognize as a literal diploma-name filter, so an unmapped raw
    # label silently filters every search result out (a real diploma
    # like "Lei de Improbidade Administrativa" never equals "Noções de
    # Direito Administrativo") — always insufficient_evidence, even when
    # the legal base has perfectly good matching content. None means
    # "search unfiltered across every diploma" instead.
    return None


def _brief_sources(sources: list[dict]) -> list[dict]:
    return [
        {"referencia": s.get("referencia"), "fonte": s.get("fonte"), "url_oficial": s.get("url_oficial")}
        for s in sources
    ]


def _empty_result(question: dict, model: str) -> dict:
    return {
        "questionNumber": question["questionNumber"],
        "subject": question.get("subject"),
        "officialAnswer": question.get("officialAnswer"),
        "officialAnswerText": question.get("officialAnswerText"),
        "annulled": bool(question.get("annulled")),
        "status": None,
        "coverage": None,
        "sources": None,
        "evidenceBeforeChars": None,
        "evidenceAfterChars": None,
        "compactionReductionPercent": None,
        "safeDowngrades": None,
        "retrievalMs": None,
        "ollamaMs": None,
        "totalMs": None,
        "model": model,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "validationErrors": None,
        "error": None,
        "explanation": None,
    }


def process_question(question: dict, model: str, sources_limit: int, num_predict: int | None = None) -> dict:
    """Never raises (except KeyboardInterrupt, which isn't an Exception
    subclass and passes straight through) — any unexpected failure is
    caught and recorded as status="error" so one bad question never takes
    down the rest of a batch. Always returns a fully-shaped result dict.
    """
    result = _empty_result(question, model)

    if question.get("annulled"):
        result["status"] = "annulled"
        result["totalMs"] = 0.0
        return result

    start = time.perf_counter()
    try:
        correct_letter = question["officialAnswer"]
        correct_text = question["officialAnswerText"]
        subject = normalize_subject(question.get("subject"))

        retrieval_start = time.perf_counter()
        sources, coverage = build_evidence_for_question(
            statement=question["statement"],
            correct_text=correct_text,
            subject=subject,
            limit=sources_limit,
        )
        result["retrievalMs"] = round((time.perf_counter() - retrieval_start) * 1000, 1)
        result["coverage"] = coverage

        if not sources or coverage["status"] != "complete":
            result["status"] = "insufficient_evidence"
            result["sources"] = _brief_sources(sources)
            result["totalMs"] = round((time.perf_counter() - start) * 1000, 1)
            return result

        # Compaction runs only on evidence that already justified coverage=
        # complete, and never returns a set whose recomputed coverage is
        # worse than that — see worker/legal_base/evidence_compaction.py.
        sources, coverage_after_compaction, compaction_metrics = compact_evidence_for_generation(
            statement=question["statement"],
            correct_text=correct_text,
            sources=sources,
            coverage=coverage,
        )
        result["coverage"] = coverage_after_compaction
        result["sources"] = _brief_sources(sources)
        result["evidenceBeforeChars"] = compaction_metrics["original_total_chars"]
        result["evidenceAfterChars"] = compaction_metrics["compacted_total_chars"]
        result["compactionReductionPercent"] = compaction_metrics["reduction_pct"]

        if not is_available():
            result["status"] = "insufficient_evidence"
            result["validationErrors"] = ["Ollama indisponível em http://localhost:11434 durante o batch."]
            result["totalMs"] = round((time.perf_counter() - start) * 1000, 1)
            return result

        alternatives = list(question["alternatives"].items())
        question_input = QuestionInput(
            statement=question["statement"],
            alternatives=alternatives,
            correct_letter=correct_letter,
            subject=question.get("subject"),
        )

        # One 10-section call routinely took 150-320s locally and some
        # generations exceeded the 600s Ollama timeout outright — split
        # into SECTION_GROUPS (two independent, stateless calls of 5
        # topics each) to roughly halve each call's output and timeout
        # risk. See worker/local_ai/structured_explanation.py::SECTION_GROUPS.
        options = {"temperature": 0.0, "top_p": 0.1}
        if num_predict:
            options["num_predict"] = num_predict

        prompt_chars_total = 0
        ollama_ms_total = 0.0
        ollama_ms_by_block: list[float] = []
        processed_parts = []

        for group in SECTION_GROUPS:
            prompt = build_structured_explanation_prompt(question_input, sources, section_keys=group)
            prompt_chars_total += len(prompt)

            block_start = time.perf_counter()
            raw = generate(prompt, model=model, options=options)  # may raise OllamaError -> caught below as "error"
            block_ms = round((time.perf_counter() - block_start) * 1000, 1)
            ollama_ms_by_block.append(block_ms)
            ollama_ms_total += block_ms

            processed_parts.append(process_structured_explanation(raw, sources, section_keys=group))

        result["ollamaMs"] = round(ollama_ms_total, 1)

        merged = merge_processed_explanations(processed_parts)

        if merged["status"] == "rejected":
            result["status"] = "rejected"
            result["validationErrors"] = merged["errors"]
            result["totalMs"] = round((time.perf_counter() - start) * 1000, 1)
            return result

        result["status"] = merged["status"]  # "approved" or "approved_with_gaps"
        result["safeDowngrades"] = merged["downgrades"]
        result["explanation"] = {
            "appExplanation": build_app_explanation(merged["sections"]),
            "audit": {
                "sources": result["sources"],
                "sectionDetails": {
                    key: {"sourcesUsed": s["sourcesUsed"], "evidenceQuotes": s["evidenceQuotes"]}
                    for key, s in merged["sections"].items()
                },
                "coverage": coverage_after_compaction,
                "validation": {"errors": []},
                "safeDowngrades": merged["downgrades"],
                "compaction": compaction_metrics,
                "promptChars": prompt_chars_total,
                "ollamaMsByBlock": ollama_ms_by_block,
            },
        }
        result["totalMs"] = round((time.perf_counter() - start) * 1000, 1)
        return result

    except Exception as exc:  # operational failure — never lose the question, never crash the batch
        result["status"] = "error"
        result["error"] = f"{type(exc).__name__}: {exc}"
        result["totalMs"] = round((time.perf_counter() - start) * 1000, 1)
        return result


def _build_output_document(
    model: str,
    exam_path: Path,
    exam_meta: dict | None,
    all_numbers: list[int],
    results_by_number: dict[int, dict],
) -> dict:
    """`all_numbers` is the FULL cumulative set of question numbers this
    --output file has ever seen (this run's --questions unioned with
    whatever --resume loaded from disk) — never just this invocation's
    own --questions. See run_batch's docstring for the real incident this
    fixed: a narrower follow-up --questions run used to silently drop
    every other already-completed question from the file.
    """
    ordered_results = [results_by_number[n] for n in all_numbers if n in results_by_number]
    counts = {status: 0 for status in ALL_STATUSES}
    for r in ordered_results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    total = len(all_numbers)
    completed = len(ordered_results)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "exam": {"sourceFile": str(exam_path), "meta": exam_meta},
        "questionsRequested": all_numbers,
        "progress": {
            "total": total,
            "completed": completed,
            "remaining": total - completed,
            **counts,
        },
        "results": ordered_results,
    }


def run_batch(
    wanted_numbers: list[int],
    by_number: dict[int, dict],
    process_fn,
    *,
    output_path: Path,
    exam_path: Path,
    exam_meta: dict | None,
    model: str,
    resume: bool,
    retry_rejected: bool = False,
    retry_gaps: bool = False,
    retry_insufficient: bool = False,
    retry_error: bool = False,
    stop_on_error: bool = False,
    print_fn=print,
) -> dict:
    """Drives the question loop: resume/retry skip logic, atomic
    per-question checkpointing (nothing is lost if the process dies or is
    interrupted mid-batch), stop-on-error, and a graceful KeyboardInterrupt
    path. Returns the final output document (the same shape written to
    disk, plus an "interrupted" flag) so callers/tests can inspect it
    without re-reading the file.

    `--output` is treated as a durable, cumulative record of every
    question ever completed at that path — not just this invocation's own
    --questions. A later, narrower --questions run (e.g. retrying 3 failed
    numbers out of a 198-question file) must never drop the rest of an
    already-completed batch: every write here is keyed on the UNION of
    what --resume loaded from disk and this run's own --questions, never
    on --questions alone.

    `process_fn(question: dict) -> dict` is the only thing that actually
    talks to Ollama/retrieval — tests pass a fake here instead.
    """
    results_by_number: dict[int, dict] = {}
    if resume and output_path.exists():
        loaded = json.loads(output_path.read_text(encoding="utf-8"))
        for r in loaded.get("results", []):
            results_by_number[r["questionNumber"]] = r

    all_numbers = sorted(set(wanted_numbers) | set(results_by_number.keys()))

    total = len(wanted_numbers)  # this run's own request, for the "[i/total]" progress line below
    interrupted = False

    try:
        for index, number in enumerate(wanted_numbers, start=1):
            question = by_number.get(number)
            if question is None:
                print_fn(f"⚠️  Questão {number} não encontrada na prova — pulando.")
                continue

            existing = results_by_number.get(number) if resume else None
            if existing is not None and not should_reprocess_status(
                existing.get("status"),
                retry_rejected=retry_rejected,
                retry_gaps=retry_gaps,
                retry_insufficient=retry_insufficient,
                retry_error=retry_error,
            ):
                print_fn(f"[{index}/{total}] Q{number} - {existing.get('status')} - já existente, pulada")
                continue

            result = process_fn(question)
            results_by_number[number] = result

            atomic_write_json(
                output_path,
                _build_output_document(model, exam_path, exam_meta, all_numbers, results_by_number),
            )

            elapsed_s = (result.get("totalMs") or 0.0) / 1000
            print_fn(f"[{index}/{total}] Q{number} - {result['status']} - {elapsed_s:.1f}s")

            if result["status"] == "error" and stop_on_error:
                print_fn("⏹  --stop-on-error ativo — interrompendo o lote.")
                break
    except KeyboardInterrupt:
        interrupted = True
        print_fn("")
        print_fn("Batch interrompido com segurança.")
        print_fn("Execute novamente com --resume.")

    document = _build_output_document(model, exam_path, exam_meta, all_numbers, results_by_number)
    atomic_write_json(output_path, document)
    document["interrupted"] = interrupted
    return document


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera explicações localmente (retrieval + Ollama) para um lote de questões de uma "
        "prova, com coverage/validação determinísticas. Checkpoint atômico por questão. "
        "Só grava um JSON local — nunca Firestore."
    )
    parser.add_argument("--exam", required=True)
    parser.add_argument(
        "--questions",
        required=True,
        help='Ex.: "38,43,45" ou "31-70" ou "31-40,45,52-60" (combináveis, ordem e duplicatas não importam)',
    )
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sources-limit", type=int, default=3)
    parser.add_argument(
        "--num-predict",
        type=int,
        default=None,
        help="Limite de tokens gerados pelo Ollama (options.num_predict). "
        "Sem valor padrão fixo — teste antes de escolher um.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Pula questões já concluídas em --output (approved/annulled sempre; "
        "rejected/approved_with_gaps/insufficient_evidence/error também, a menos que "
        "o --retry-* correspondente seja passado).",
    )
    parser.add_argument("--retry-rejected", action="store_true", help="Com --resume, reprocessa status=rejected.")
    parser.add_argument("--retry-gaps", action="store_true", help="Com --resume, reprocessa status=approved_with_gaps.")
    parser.add_argument(
        "--retry-insufficient", action="store_true", help="Com --resume, reprocessa status=insufficient_evidence."
    )
    parser.add_argument(
        "--retry-error",
        action="store_true",
        help="Com --resume, reprocessa status=error. (Extensão própria, análoga aos outros "
        "--retry-*, não pedida explicitamente — sem ela um --resume nunca voltaria a tentar "
        "uma questão que falhou por erro operacional.)",
    )
    parser.add_argument(
        "--stop-on-error",
        action="store_true",
        help="Para o lote inteiro no primeiro status=error (debug/desenvolvimento). Padrão: continua.",
    )
    args = parser.parse_args()

    exam_path = Path(args.exam)
    if not exam_path.exists():
        raise SystemExit(f"Arquivo da prova não encontrado: {exam_path}")

    data = json.loads(exam_path.read_text(encoding="utf-8"))
    by_number = {q["questionNumber"]: q for q in data["questions"]}

    try:
        wanted_numbers = parse_question_spec(args.questions)
    except ValueError as exc:
        raise SystemExit(f"--questions inválido: {exc}")

    output_path = Path(args.output)

    def _process(question: dict) -> dict:
        return process_question(
            question,
            model=args.model,
            sources_limit=args.sources_limit,
            num_predict=args.num_predict,
        )

    lock = BatchLock(output_path)
    lock.acquire()
    try:
        batch_start = time.perf_counter()
        document = run_batch(
            wanted_numbers,
            by_number,
            _process,
            output_path=output_path,
            exam_path=exam_path,
            exam_meta=data.get("meta"),
            model=args.model,
            resume=args.resume,
            retry_rejected=args.retry_rejected,
            retry_gaps=args.retry_gaps,
            retry_insufficient=args.retry_insufficient,
            retry_error=args.retry_error,
            stop_on_error=args.stop_on_error,
        )
        batch_elapsed_s = time.perf_counter() - batch_start
    finally:
        lock.release()

    if document["interrupted"]:
        return

    progress = document["progress"]
    results = document["results"]
    total_times = [r["totalMs"] for r in results if r.get("totalMs") is not None]
    ollama_times = [r["ollamaMs"] for r in results if r.get("ollamaMs") is not None]

    print()
    print("=" * 60)
    print("RESUMO DO BATCH")
    print("=" * 60)
    print(f"TOTAL: {progress['total']}")
    for status in ALL_STATUSES:
        print(f"  {status}: {progress[status]}")
    print(f"tempo total: {batch_elapsed_s:.1f}s")
    if total_times:
        print(f"tempo médio por questão gerada: {sum(total_times) / len(total_times) / 1000:.1f}s")
    if ollama_times:
        print(f"tempo médio Ollama: {sum(ollama_times) / len(ollama_times) / 1000:.1f}s")
    print(f"saída: {output_path}")
    print()
    print("Nada foi salvo no Firebase/Firestore — apenas o JSON local acima.")


if __name__ == "__main__":
    main()
