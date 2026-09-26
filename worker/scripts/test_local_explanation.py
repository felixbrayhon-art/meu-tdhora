from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.db import DEFAULT_DB_PATH  # noqa: E402
from legal_base.evidence_selector import select_question_evidence  # noqa: E402
from local_ai.ollama_client import DEFAULT_MODEL, OllamaError, generate, is_available  # noqa: E402
from local_ai.prompt_builder import QuestionInput, build_explanation_prompt  # noqa: E402

# Experimental, manual-only test of the full local pipeline:
#   questão + alternativas + gabarito -> busca jurídica local -> Ollama local -> explicação
# Does NOT write to Firestore, does NOT touch `questions`/`explanation`, does
# NOT run in batch — one question per invocation, printed to stdout only.

DEMO_STATEMENT = (
    "Em um assalto, o agente efetua disparos contra a vítima mesmo sabendo que, "
    "pela posição em que atirava, poderia matá-la, e aceita esse risco como possível "
    "consequência de sua conduta. A vítima vem a falecer. Segundo o Código Penal, "
    "o agente agiu com:"
)
DEMO_ALTERNATIVES = [
    ("A", "Dolo direto."),
    ("B", "Dolo eventual, por ter assumido o risco de produzir o resultado."),
    ("C", "Culpa consciente."),
    ("D", "Culpa imprudente."),
    ("E", "Caso fortuito."),
]
DEMO_CORRECT = "B"
DEMO_SUBJECT = "Direito Penal"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Teste experimental: busca jurídica local + Ollama local para gerar uma explicação. "
        "Não publica nada — só imprime no terminal."
    )
    parser.add_argument("--statement", default=DEMO_STATEMENT)
    parser.add_argument(
        "--alternative", action="append", nargs=2, metavar=("LETTER", "TEXT"),
        help="Repetível: --alternative A 'texto da alternativa A'. Se omitido, usa o exemplo padrão.",
    )
    parser.add_argument("--correct-letter", default=DEMO_CORRECT)
    parser.add_argument("--subject", default=DEMO_SUBJECT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--legal-db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--legal-sources-limit", type=int, default=3)
    args = parser.parse_args()

    alternatives = [(l.upper(), t) for l, t in args.alternative] if args.alternative else DEMO_ALTERNATIVES

    if not is_available():
        print("ERRO: não foi possível falar com o Ollama em http://localhost:11434 — ele está rodando?")
        raise SystemExit(1)

    print("=" * 40)
    print("1) QUESTÃO")
    print("=" * 40)
    print(args.statement)
    for letter, text in alternatives:
        print(f"{letter}) {text}")
    print(f"Gabarito oficial: {args.correct_letter}")

    print()
    print("=" * 40)
    print("2) SELEÇÃO DE EVIDÊNCIAS JURÍDICAS (sem IA)")
    print("=" * 40)

    correct_letter = args.correct_letter.upper()
    correct_text = next(
        (text for letter, text in alternatives if letter == correct_letter),
        "",
    )

    if not correct_text:
        print(
            f"ERRO: não encontrei a alternativa correspondente ao gabarito "
            f"{correct_letter}."
        )
        raise SystemExit(1)

    search_start = time.perf_counter()

    sources = select_question_evidence(
        statement=args.statement,
        correct_text=correct_text,
        subject=args.subject,
        limit=args.legal_sources_limit,
        db_path=args.legal_db,
    )

    search_elapsed_ms = (time.perf_counter() - search_start) * 1000

    if not sources:
        print("(nenhuma evidência suficientemente forte foi selecionada)")

    for s in sources:
        print()
        print(f"- {s['referencia']}")
        print(f"  confiança: {s['confidence']}")
        print(f"  seleção: {s['selection_reason']}")
        print(
            "  consultas fortes:",
            ", ".join(s.get("selection_strong_query_hits", [])),
        )

        trecho = s["texto"].replace("\n", " ")
        if len(trecho) > 300:
            trecho = trecho[:297] + "..."

        print(f"  texto: {trecho}")
        print(f"  url: {s['url_oficial']}")

    print(f"tempo de recuperação/seleção: {search_elapsed_ms:.1f} ms")

    question = QuestionInput(
        statement=args.statement,
        alternatives=alternatives,
        correct_letter=correct_letter,
        subject=args.subject,
    )
    prompt = build_explanation_prompt(question, sources)

    print()
    print("=" * 40)
    print(f"3) GERAÇÃO PELO OLLAMA ({args.model})")
    print("=" * 40)
    generation_start = time.perf_counter()
    try:
        explanation = generate(
            prompt,
            model=args.model,
            options={
                "temperature": 0.0,
                "top_p": 0.1,
            },
        )
    except OllamaError as exc:
        print(f"ERRO: {exc}")
        raise SystemExit(1)
    generation_elapsed_ms = (time.perf_counter() - generation_start) * 1000

    print(explanation.strip())
    print()
    print("=" * 40)
    print("TEMPOS")
    print("=" * 40)
    print(f"recuperação/seleção jurídica: {search_elapsed_ms:.1f} ms")
    print(f"geração pelo Ollama: {generation_elapsed_ms:.1f} ms ({generation_elapsed_ms / 1000:.1f} s)")
    print()
    print("Nada foi salvo — nenhuma escrita no Firestore, nenhuma alteração em `questions`.")


if __name__ == "__main__":
    main()
