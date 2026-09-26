from __future__ import annotations

import argparse
import copy
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent),
)

from local_ai.gemini_client import (  # noqa: E402
    DEFAULT_MODEL,
    generate,
    is_available,
)
from scripts.batch_support import atomic_write_json  # noqa: E402


AUDIT_VERSION = "semantic-evidence-v1"

VALID_VERDICTS = {
    "supports",
    "related_only",
    "contradicts",
    "unclear",
}


def parse_json_response(raw: str) -> dict:
    text = str(raw or "").strip()

    if text.startswith("```"):
        lines = text.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1 or end <= start:
            raise ValueError(
                "Gemini não retornou JSON utilizável."
            )

        parsed = json.loads(
            text[start : end + 1]
        )

    if not isinstance(parsed, dict):
        raise ValueError(
            "Resposta da auditoria precisa ser um objeto JSON."
        )

    return parsed


def collect_items(document: dict) -> list[dict]:
    items = []

    for result in document.get("results", []):
        if result.get("status") not in {
            "approved",
            "approved_with_gaps",
        }:
            continue

        question_number = result.get("questionNumber")

        explanation = result.get("explanation") or {}
        app = explanation.get("appExplanation") or {}

        audit = explanation.get("audit") or {}
        details = audit.get("sectionDetails") or {}

        if not isinstance(app, dict):
            continue

        if not isinstance(details, dict):
            continue

        for section, detail in details.items():
            if not isinstance(detail, dict):
                continue

            section_text = app.get(section)

            if not isinstance(section_text, str):
                continue

            section_text = section_text.strip()

            if not section_text:
                continue

            quotes = detail.get("evidenceQuotes") or []

            if not isinstance(quotes, list):
                continue

            for quote_index, evidence in enumerate(quotes):
                if not isinstance(evidence, dict):
                    continue

                source_id = evidence.get("sourceId")
                quote = evidence.get("quote")

                if (
                    not isinstance(source_id, str)
                    or not isinstance(quote, str)
                    or not quote.strip()
                ):
                    continue

                item_id = (
                    f"Q{question_number}:"
                    f"{section}:"
                    f"{quote_index}"
                )

                items.append(
                    {
                        "itemId": item_id,
                        "questionNumber": question_number,
                        "section": section,
                        "quoteIndex": quote_index,
                        "sectionText": section_text,
                        "evidenceQuote": {
                            "sourceId": source_id,
                            "quote": quote,
                        },
                    }
                )

    return items


def build_prompt(items: list[dict]) -> str:
    compact_items = [
        {
            "itemId": item["itemId"],
            "questionNumber": item["questionNumber"],
            "section": item["section"],
            "sectionText": item["sectionText"],
            "quote": item["evidenceQuote"]["quote"],
        }
        for item in items
    ]

    return f"""
Você é um auditor semântico de evidências jurídicas.

Sua tarefa NÃO é responder novamente às questões.
Sua tarefa NÃO é escolher o gabarito.
Sua tarefa NÃO é reescrever as explicações.

Você deve avaliar SOMENTE se cada citação literal apresentada
realmente sustenta alguma afirmação jurídica material existente
no texto do tópico ao qual foi associada.

Use estritamente estes veredictos:

1. "supports"
A citação sustenta DIRETAMENTE pelo menos uma afirmação jurídica
material expressa no texto do tópico.

Ela NÃO precisa sustentar todas as frases do tópico.
Basta sustentar diretamente uma afirmação material relevante.

2. "related_only"
A citação trata do mesmo assunto, instituto ou contexto, mas NÃO
sustenta diretamente nenhuma afirmação jurídica material feita no
texto.

Coincidência de palavras, tema semelhante ou relação genérica não
é suficiente para "supports".

3. "contradicts"
O conteúdo da citação entra em conflito material com uma afirmação
do texto do tópico.

4. "unclear"
Não é possível determinar com segurança, apenas pela relação entre
o texto e a citação, se há suporte direto.

REGRAS IMPORTANTES:

- Seja rigoroso.
- Não considere uma citação válida só porque pertence ao mesmo tema.
- Não use conhecimento jurídico externo para "salvar" uma relação
  que não aparece entre o texto e a citação.
- Analise a relação semântica entre sectionText e quote.
- Não critique a redação.
- Não avalie se o gabarito oficial está certo.
- Não invente informações.
- Não altere itemId.
- Deve existir exatamente um julgamento para cada item recebido.

Retorne SOMENTE JSON válido neste formato:

{{
  "judgments": [
    {{
      "itemId": "Q1:legalBasis:0",
      "verdict": "supports",
      "reason": "explicação curta e objetiva"
    }}
  ]
}}

ITENS:

{json.dumps(compact_items, ensure_ascii=False, indent=2)}
""".strip()


def validate_judgments(
    parsed: dict,
    items: list[dict],
) -> dict[str, dict]:
    judgments = parsed.get("judgments")

    if not isinstance(judgments, list):
        raise ValueError(
            'Resposta não contém lista "judgments".'
        )

    expected_ids = {
        item["itemId"]
        for item in items
    }

    by_id = {}

    for judgment in judgments:
        if not isinstance(judgment, dict):
            raise ValueError(
                "Julgamento com formato inválido."
            )

        item_id = judgment.get("itemId")
        verdict = judgment.get("verdict")
        reason = judgment.get("reason")

        if item_id not in expected_ids:
            raise ValueError(
                f"itemId inesperado: {item_id!r}"
            )

        if item_id in by_id:
            raise ValueError(
                f"itemId duplicado: {item_id}"
            )

        if verdict not in VALID_VERDICTS:
            raise ValueError(
                f"verdict inválido em {item_id}: {verdict!r}"
            )

        if not isinstance(reason, str):
            reason = str(reason or "")

        by_id[item_id] = {
            "itemId": item_id,
            "verdict": verdict,
            "reason": reason.strip(),
        }

    missing = expected_ids - set(by_id)

    if missing:
        raise ValueError(
            "Auditoria não retornou todos os itens: "
            + ", ".join(sorted(missing))
        )

    if len(by_id) != len(expected_ids):
        raise ValueError(
            "Quantidade de julgamentos não corresponde aos itens."
        )

    return by_id


def add_gap_once(
    downgrades: list,
    section: str,
    reason: str,
) -> None:
    for item in downgrades:
        if (
            isinstance(item, dict)
            and item.get("section") == section
        ):
            return

    downgrades.append(
        {
            "section": section,
            "reason": reason,
        }
    )


def apply_audit(
    document: dict,
    items: list[dict],
    judgments: dict[str, dict],
    model: str,
) -> dict:
    output = copy.deepcopy(document)

    result_map = {
        r.get("questionNumber"): r
        for r in output.get("results", [])
    }

    item_map = {
        item["itemId"]: item
        for item in items
    }

    grouped = defaultdict(list)

    for item_id, judgment in judgments.items():
        item = item_map[item_id]

        grouped[
            (
                item["questionNumber"],
                item["section"],
            )
        ].append(
            (
                item,
                judgment,
            )
        )

    global_counts = Counter()

    for judgment in judgments.values():
        global_counts[judgment["verdict"]] += 1

    for question_number, result in result_map.items():
        explanation = result.get("explanation")

        if not isinstance(explanation, dict):
            continue

        audit = explanation.setdefault(
            "audit",
            {},
        )

        details = audit.get("sectionDetails")

        if not isinstance(details, dict):
            continue

        safe_downgrades = result.get("safeDowngrades")

        if not isinstance(safe_downgrades, list):
            safe_downgrades = []

        result["safeDowngrades"] = safe_downgrades

        validation_errors = result.get("validationErrors")

        if not isinstance(validation_errors, list):
            validation_errors = []

        result["validationErrors"] = validation_errors

        question_items = [
            (item, judgments[item["itemId"]])
            for item in items
            if item["questionNumber"] == question_number
        ]

        q_counts = Counter(
            judgment["verdict"]
            for _, judgment in question_items
        )

        contradiction_items = []

        for (
            q_number,
            section,
        ), section_pairs in grouped.items():
            if q_number != question_number:
                continue

            detail = details.get(section)

            if not isinstance(detail, dict):
                continue

            original_quotes = detail.get(
                "evidenceQuotes"
            ) or []

            verdict_by_index = {
                item["quoteIndex"]: judgment
                for item, judgment in section_pairs
            }

            final_quotes = []

            for index, evidence in enumerate(
                original_quotes
            ):
                judgment = verdict_by_index.get(index)

                if judgment is None:
                    final_quotes.append(evidence)
                    continue

                verdict = judgment["verdict"]

                if verdict == "supports":
                    final_quotes.append(evidence)

                elif verdict in {
                    "related_only",
                    "unclear",
                }:
                    # Citação removida.
                    # O texto da explicação é preservado como
                    # conhecimento jurídico complementar.
                    pass

                elif verdict == "contradicts":
                    # Conservamos a evidência no arquivo auditado
                    # para facilitar revisão humana e bloqueamos
                    # a questão abaixo.
                    final_quotes.append(evidence)
                    contradiction_items.append(
                        {
                            "section": section,
                            "itemId": judgment["itemId"],
                            "reason": judgment["reason"],
                        }
                    )

            detail["evidenceQuotes"] = final_quotes

            source_ids = []

            for evidence in final_quotes:
                if not isinstance(evidence, dict):
                    continue

                sid = evidence.get("sourceId")

                if (
                    isinstance(sid, str)
                    and sid not in source_ids
                ):
                    source_ids.append(sid)

            detail["sourcesUsed"] = source_ids

            removed = [
                judgment
                for _, judgment in section_pairs
                if judgment["verdict"]
                in {
                    "related_only",
                    "unclear",
                }
            ]

            if removed and not final_quotes:
                add_gap_once(
                    safe_downgrades,
                    section,
                    (
                        "evidenceQuote removida pela auditoria "
                        "semântica por não demonstrar suporte "
                        "direto suficiente; texto preservado como "
                        "explicação jurídica complementar"
                    ),
                )

        # Sincroniza a cópia usada dentro do audit.
        audit["safeDowngrades"] = safe_downgrades

        semantic_details = []

        for item, judgment in question_items:
            semantic_details.append(
                {
                    "itemId": item["itemId"],
                    "section": item["section"],
                    "sourceId": item[
                        "evidenceQuote"
                    ]["sourceId"],
                    "quote": item[
                        "evidenceQuote"
                    ]["quote"],
                    "verdict": judgment["verdict"],
                    "reason": judgment["reason"],
                }
            )

        if contradiction_items:
            semantic_status = "needs_review"

            result["status"] = "rejected"

            validation_errors.append(
                "Auditoria semântica encontrou evidenceQuote "
                "em contradição com o texto da explicação."
            )

        elif (
            q_counts["related_only"]
            or q_counts["unclear"]
        ):
            semantic_status = "cleaned"

            if result.get("status") in {
                "approved",
                "approved_with_gaps",
            }:
                result["status"] = "approved_with_gaps"

        else:
            semantic_status = "passed"

        audit["semanticEvidenceAudit"] = {
            "version": AUDIT_VERSION,
            "model": model,
            "generatedAt": datetime.now(
                timezone.utc
            ).isoformat(),
            "status": semantic_status,
            "counts": dict(q_counts),
            "judgments": semantic_details,
            "contradictions": contradiction_items,
        }

    output["semanticEvidenceAudit"] = {
        "version": AUDIT_VERSION,
        "model": model,
        "generatedAt": datetime.now(
            timezone.utc
        ).isoformat(),
        "itemsAudited": len(items),
        "counts": dict(global_counts),
    }

    # Recalcula progress se existir.
    progress = output.get("progress")

    if isinstance(progress, dict):
        statuses = Counter(
            r.get("status")
            for r in output.get("results", [])
        )

        for key in (
            "approved",
            "approved_with_gaps",
            "rejected",
            "insufficient_evidence",
            "annulled",
            "error",
        ):
            progress[key] = statuses.get(
                key,
                0,
            )

    return output


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Audita semanticamente evidenceQuotes já "
            "validadas literalmente. Nunca toca no Firestore."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
    )

    parser.add_argument(
        "--output",
        required=True,
    )

    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
    )

    parser.add_argument(
        "--num-predict",
        type=int,
        default=4096,
    )

    parser.add_argument(
        "--max-items",
        type=int,
        default=80,
        help=(
            "Proteção contra auditorias grandes demais "
            "em uma única chamada."
        ),
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(
            f"Arquivo não encontrado: {input_path}"
        )

    if input_path.resolve() == output_path.resolve():
        raise SystemExit(
            "ERRO: --output deve ser diferente de --input."
        )

    document = json.loads(
        input_path.read_text(
            encoding="utf-8"
        )
    )

    items = collect_items(document)

    print("=" * 72)
    print("AUDITORIA SEMÂNTICA DE EVIDENCEQUOTES")
    print("=" * 72)
    print("Arquivo:", input_path)
    print("Itens com evidenceQuote:", len(items))
    print("Modelo:", args.model)

    if not items:
        raise SystemExit(
            "Nenhuma evidenceQuote encontrada. "
            "Nenhuma chamada Gemini foi realizada."
        )

    if len(items) > args.max_items:
        raise SystemExit(
            f"BLOQUEADO: {len(items)} itens excedem "
            f"--max-items={args.max_items}. "
            "Divida o lote antes de auditar."
        )

    if not is_available():
        raise SystemExit(
            "GEMINI_API_KEY/GOOGLE_API_KEY não disponível."
        )

    prompt = build_prompt(items)

    print()
    print(
        "Será feita 1 chamada Gemini "
        f"para auditar {len(items)} citações."
    )

    raw = generate(
        prompt,
        model=args.model,
        options={
            "num_predict": args.num_predict,
        },
    )

    parsed = parse_json_response(raw)

    judgments = validate_judgments(
        parsed,
        items,
    )

    audited = apply_audit(
        document,
        items,
        judgments,
        args.model,
    )

    atomic_write_json(
        output_path,
        audited,
    )

    counts = Counter(
        j["verdict"]
        for j in judgments.values()
    )

    result_semantic = Counter()

    for result in audited.get("results", []):
        semantic = (
            (result.get("explanation") or {})
            .get("audit", {})
            .get("semanticEvidenceAudit", {})
        )

        status = semantic.get("status")

        if status:
            result_semantic[status] += 1

    print()
    print("=" * 72)
    print("RESULTADO DA AUDITORIA")
    print("=" * 72)

    print("Citações auditadas:", len(items))
    print("supports:", counts["supports"])
    print("related_only:", counts["related_only"])
    print("unclear:", counts["unclear"])
    print("contradicts:", counts["contradicts"])

    print()
    print("Questões:")
    print("passed:", result_semantic["passed"])
    print("cleaned:", result_semantic["cleaned"])
    print(
        "needs_review:",
        result_semantic["needs_review"],
    )

    print()
    print("Saída:", output_path)
    print("Arquivo original NÃO foi alterado.")
    print("Firestore NÃO foi alterado.")


if __name__ == "__main__":
    main()
