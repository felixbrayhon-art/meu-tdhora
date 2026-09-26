from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.evidence_compaction import compact_evidence_for_generation
from legal_base.evidence_pipeline import build_evidence_for_question
from legal_base.text_utils import strip_accents
from local_ai.ollama_client import (
    DEFAULT_MODEL,
    OllamaError,
    generate,
    is_available,
)
from local_ai.prompt_builder import QuestionInput
from local_ai.structured_explanation import (
    SECTION_GROUPS,
    SECTIONS,
    build_structured_explanation_prompt,
    merge_processed_explanations,
    process_structured_explanation,
)


DEFAULT_EXAM = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "exams"
    / "pcmg_investigador_2025_tipo1.json"
)


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

    # An unmapped subject must never pass through as-is — see the
    # matching comment in scripts/batch_exam_explanations.py: an
    # unrecognized label silently becomes a diploma-name filter that
    # matches nothing, turning perfectly good evidence into
    # insufficient_evidence. None means "search unfiltered" instead.
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Teste de uma questão real com gabarito oficial, "
            "retrieval jurídico e Ollama local."
        )
    )
    parser.add_argument("--question", type=int, required=True)
    parser.add_argument("--exam", default=str(DEFAULT_EXAM))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sources-limit", type=int, default=3)
    parser.add_argument(
        "--num-predict",
        type=int,
        default=None,
        help="Limite de tokens gerados pelo Ollama (options.num_predict). "
        "Sem valor padrão fixo — teste antes de escolher um.",
    )
    args = parser.parse_args()

    exam_path = Path(args.exam)

    if not exam_path.exists():
        raise SystemExit(
            f"Arquivo da prova não encontrado: {exam_path}"
        )

    data = json.loads(
        exam_path.read_text(encoding="utf-8")
    )

    item = next(
        (
            q for q in data["questions"]
            if q["questionNumber"] == args.question
        ),
        None,
    )

    if item is None:
        raise SystemExit(
            f"Questão {args.question} não encontrada."
        )

    print("=" * 80)
    print(f"1) QUESTÃO REAL — Nº {item['questionNumber']}")
    print("=" * 80)

    print("Matéria:", item.get("subject"))
    print()
    print(item["statement"])
    print()

    alternatives = [
        (letter, text)
        for letter, text in item["alternatives"].items()
    ]

    for letter, text in alternatives:
        print(f"{letter}) {text}")

    print()

    if item.get("annulled"):
        print(
            "⚠️ QUESTÃO ANULADA NO GABARITO OFICIAL. "
            "Nenhuma explicação será gerada."
        )
        return

    correct_letter = item["officialAnswer"]
    correct_text = item["officialAnswerText"]

    print(
        f"GABARITO OFICIAL DEFINITIVO: "
        f"{correct_letter}) {correct_text}"
    )

    subject = normalize_subject(
        item.get("subject")
    )

    print()
    print("=" * 80)
    print("2) RECUPERAÇÃO E SELEÇÃO DE EVIDÊNCIAS")
    print("=" * 80)

    retrieval_start = time.perf_counter()

    sources, coverage = build_evidence_for_question(
        statement=item["statement"],
        correct_text=correct_text,
        subject=subject,
        limit=args.sources_limit,
    )

    retrieval_ms = (
        time.perf_counter() - retrieval_start
    ) * 1000

    if not sources:
        print(
            "❌ Nenhuma evidência suficientemente "
            "forte foi encontrada."
        )
        print(
            "O Ollama NÃO será executado."
        )
        return

    for index, source in enumerate(sources, 1):
        print()
        print(f"S{index} — {source['referencia']}")
        print("confiança:", source.get("confidence"))
        print("seleção:", source.get("selection_reason"))
        if source.get("is_article_context"):
            print("(contexto do enrichment)")
        if source.get("origin") == "sumula":
            print("(jurisprudência do augmentation)")

        trecho = source["texto"].replace("\n", " ")

        if len(trecho) > 700:
            trecho = trecho[:697] + "..."

        print("texto:", trecho)
        print("url:", source["url_oficial"])

    print()
    print(
        f"tempo de retrieval: {retrieval_ms:.1f} ms"
    )

    print()
    print("=" * 80)
    print("COVERAGE")
    print("=" * 80)
    print("status:", coverage["status"])
    print("claims:", coverage["claims"])
    print("supported:", coverage["supported"])
    print("missing:", coverage["missing"])

    if coverage["status"] != "complete":
        print()
        print(
            "❌ Coverage incompleta — o Ollama NÃO será executado "
            "(prefiro admitir evidência insuficiente a gerar explicação "
            "sobre fundamento parcial)."
        )
        return

    # Compaction runs only on evidence that already justified
    # coverage=complete, and never returns a set whose recomputed coverage
    # is worse than that — see worker/legal_base/evidence_compaction.py.
    sources, coverage_after_compaction, compaction_metrics = compact_evidence_for_generation(
        statement=item["statement"],
        correct_text=correct_text,
        sources=sources,
        coverage=coverage,
    )

    print()
    print("=" * 80)
    print("COMPACTAÇÃO DE EVIDÊNCIAS")
    print("=" * 80)
    print(f"caracteres antes: {compaction_metrics['original_total_chars']}")
    print(f"caracteres depois: {compaction_metrics['compacted_total_chars']}")
    print(f"redução: {compaction_metrics['reduction_pct']}%")
    if compaction_metrics.get("restored"):
        print(f"⚠️  restaurado: {compaction_metrics.get('restore_reason')}")
    for p in compaction_metrics.get("per_source", []):
        print(f"  - {p['referencia']}: {p['original_length']} -> {p['compacted_length']} chars ({p['compaction_reason']})")
    print("coverage após compactação:", coverage_after_compaction["status"])

    if not is_available():
        raise SystemExit(
            "ERRO: Ollama não está respondendo em "
            "http://localhost:11434"
        )

    question = QuestionInput(
        statement=item["statement"],
        alternatives=alternatives,
        correct_letter=correct_letter,
        subject=item.get("subject"),
    )

    print()
    print("=" * 80)
    print(f"3) GERAÇÃO PELO OLLAMA — {args.model}")
    print("=" * 80)
    print(
        f"(dividido em {len(SECTION_GROUPS)} chamadas de "
        f"{len(SECTION_GROUPS[0])} tópicos cada, para reduzir o "
        "tamanho de cada geração e o risco de timeout)"
    )

    options = {"temperature": 0.0, "top_p": 0.1}
    if args.num_predict:
        options["num_predict"] = args.num_predict

    group_results = []
    group_raw_by_index = []
    total_prompt_chars = 0
    generation_ms = 0.0

    for group_index, group in enumerate(SECTION_GROUPS, start=1):
        prompt = build_structured_explanation_prompt(question, sources, section_keys=group)
        total_prompt_chars += len(prompt)

        group_start = time.perf_counter()
        try:
            raw = generate(prompt, model=args.model, options=options)
        except OllamaError as exc:
            raise SystemExit(f"ERRO DO OLLAMA (bloco {group_index}, {', '.join(group)}): {exc}")
        group_ms = (time.perf_counter() - group_start) * 1000
        generation_ms += group_ms

        print(
            f"  bloco {group_index}/{len(SECTION_GROUPS)} ({', '.join(group)}): "
            f"{group_ms:.1f} ms, prompt {len(prompt)} caracteres"
        )

        group_raw_by_index.append(raw)
        group_results.append(process_structured_explanation(raw, sources, section_keys=group))

    print()
    print(f"tamanho total do prompt (soma dos blocos): {total_prompt_chars} caracteres")

    result = merge_processed_explanations(group_results)

    print()
    print("=" * 80)
    print("4) VALIDAÇÃO ESTRUTURAL")
    print("=" * 80)

    if result["status"] == "rejected":
        print("❌ RESPOSTA REJEITADA")

        for error in result["errors"]:
            print("-", error)

        print()
        print("RESPOSTAS BRUTAS (por bloco):")
        for group_index, (group, raw) in enumerate(zip(SECTION_GROUPS, group_raw_by_index), start=1):
            print(f"-- bloco {group_index} ({', '.join(group)}) --")
            print(raw.strip())

    else:
        if result["status"] == "approved":
            print("✅ ESTRUTURA APROVADA")
        else:
            print("⚠️  ESTRUTURA APROVADA COM LACUNAS (safe downgrade aplicado)")
            print(f"Seções rebaixadas para insuficiência: {len(result['downgrades'])}")
            for d in result["downgrades"]:
                print(f"  - {d['section']}: {d['reason']}")

        print(
            "Observação: esta aprovação verifica formato, "
            "âncoras literais (evidenceQuotes) e regras estruturais; "
            "a auditoria jurídica ainda é separada."
        )

        for key, title in SECTIONS.items():
            section = result["sections"][key]

            print()
            print("-" * 80)
            print(title)
            print("-" * 80)
            print(section["text"])
            print(
                "Fontes usadas (derivadas de evidenceQuotes):",
                ", ".join(section["sourcesUsed"])
                if section["sourcesUsed"]
                else "nenhuma",
            )

    print()
    print("=" * 80)
    print("TEMPOS")
    print("=" * 80)
    print(
        f"retrieval: {retrieval_ms:.1f} ms"
    )
    print(
        f"Ollama: {generation_ms:.1f} ms "
        f"({generation_ms / 1000:.1f} s)"
    )
    print()
    print(
        "Nada foi salvo no Firebase/Firestore."
    )


if __name__ == "__main__":
    main()
