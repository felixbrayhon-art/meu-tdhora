from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.evidence_pipeline import build_evidence_for_question
from legal_base.text_utils import strip_accents


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

    return subject


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--question", type=int, required=True)
    parser.add_argument("--exam", default=str(DEFAULT_EXAM))
    args = parser.parse_args()

    data = json.loads(
        Path(args.exam).read_text(encoding="utf-8")
    )

    question = next(
        (
            q for q in data["questions"]
            if q["questionNumber"] == args.question
        ),
        None,
    )

    if question is None:
        raise SystemExit(
            f"Questão {args.question} não encontrada."
        )

    print("=" * 80)
    print(f"QUESTÃO {question['questionNumber']}")
    print("=" * 80)

    print("Matéria:", question.get("subject"))
    print()
    print(question["statement"])
    print()

    for letter, text in question["alternatives"].items():
        print(f"{letter}) {text}")

    print()

    if question.get("annulled"):
        print("⚠️ QUESTÃO ANULADA — não gerar explicação.")
        return

    correct_letter = question["officialAnswer"]
    correct_text = question["officialAnswerText"]

    print(
        f"GABARITO OFICIAL: "
        f"{correct_letter}) {correct_text}"
    )

    retrieval_subject = normalize_subject(
        question.get("subject")
    )

    print(
        "Matéria usada no retriever:",
        retrieval_subject,
    )

    print()
    print("=" * 80)
    print("EVIDÊNCIAS")
    print("=" * 80)

    sources, coverage = build_evidence_for_question(
        statement=question["statement"],
        correct_text=correct_text,
        subject=retrieval_subject,
        limit=3,
    )

    if not sources:
        print(
            "❌ Nenhuma evidência suficientemente "
            "forte foi selecionada."
        )
        return

    print()
    print("=" * 80)
    print("EVIDÊNCIAS (após enrichment/augmentation)")
    print("=" * 80)

    for i, source in enumerate(sources, 1):
        print()
        print(f"{i}. {source['referencia']}")
        print("confiança:", source.get("confidence"))
        print("seleção:", source.get("selection_reason"))
        if source.get("is_article_context"):
            print("(contexto adicionado pelo enrichment, não pela seleção original)")
        if source.get("origin") == "sumula":
            print("(jurisprudência adicionada pelo augmentation)")

        text = source["texto"].replace("\n", " ")

        if len(text) > 700:
            text = text[:697] + "..."

        print("texto:", text)
        print("url:", source["url_oficial"])

    print()
    print("=" * 80)
    print("COVERAGE")
    print("=" * 80)
    print("status:", coverage["status"])
    print("claims:", coverage["claims"])
    print("supported:", coverage["supported"])
    print("missing:", coverage["missing"])
    for label, refs in coverage["claim_sources"].items():
        print(f"  {label} <- {', '.join(refs)}")

    added_by_augmentation = [s for s in sources if s.get("origin") == "sumula"]
    if added_by_augmentation:
        print()
        print("Súmulas adicionadas pelo augmentation:")
        for s in added_by_augmentation:
            print(f"  - {s['referencia']}")


if __name__ == "__main__":
    main()
