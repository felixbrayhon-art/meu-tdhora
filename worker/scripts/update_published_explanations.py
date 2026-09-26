from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exam_discovery.to_draft import render_explanation_text


def norm(value) -> str:
    return " ".join(str(value or "").split())


def canonical_alternatives(value):
    if isinstance(value, dict):
        items = value.items()

    elif isinstance(value, list):
        items = [
            (
                item.get("letter"),
                item.get("text"),
            )
            for item in value
            if isinstance(item, dict)
        ]

    else:
        return []

    return sorted(
        (
            norm(letter).upper(),
            norm(text),
        )
        for letter, text in items
    )


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Atualiza SOMENTE o campo explanation de questões "
            "já publicadas. Por padrão executa DRY-RUN."
        )
    )

    parser.add_argument("--input", required=True)
    parser.add_argument("--credentials", required=True)
    parser.add_argument("--source", default="gran_cursos")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica as alterações. Sem esta flag, nada é escrito.",
    )

    args = parser.parse_args()

    input_path = Path(args.input)

    payload = json.loads(
        input_path.read_text(encoding="utf-8")
    )

    results = payload.get("results", [])

    if not isinstance(results, list) or not results:
        raise SystemExit(
            "ERRO: arquivo de entrada não possui resultados válidos."
        )

    expected_count = len(results)

    app = firebase_admin.initialize_app(
        credentials.Certificate(args.credentials)
    )

    db = firestore.client(app)

    print("=" * 76)
    print(
        "UPDATE DE EXPLICAÇÕES — "
        + ("APPLY" if args.apply else "DRY-RUN")
    )
    print("=" * 76)
    print("Fonte:", args.source)
    print("Resultados Gemini:", len(results))
    print()
    print("Lendo questões publicadas do Firestore...")

    published_docs = list(
        db.collection("questions")
        .where("source", "==", args.source)
        .stream()
    )

    by_external = {}

    for doc in published_docs:
        data = doc.to_dict()
        external_id = data.get("externalId")

        if not external_id:
            continue

        by_external.setdefault(
            str(external_id),
            [],
        ).append(
            (doc.reference, data)
        )

    problems = []
    plan = []

    for result in results:
        external_id = str(result.get("externalId") or "")
        number = result.get("questionNumber")

        status = result.get("status")

        if status not in {
            "approved",
            "approved_with_gaps",
        }:
            problems.append(
                f"Q{number} {external_id}: status={status}"
            )
            continue

        matches = by_external.get(external_id, [])

        if len(matches) == 0:
            problems.append(
                f"Q{number} {external_id}: não encontrada no Firestore."
            )
            continue

        if len(matches) > 1:
            problems.append(
                f"Q{number} {external_id}: "
                f"{len(matches)} documentos encontrados."
            )
            continue

        ref, current = matches[0]

        # Validação do gabarito.
        if norm(current.get("correctLetter")).upper() != norm(
            result.get("officialAnswer")
        ).upper():
            problems.append(
                f"Q{number} {external_id}: gabarito divergente."
            )
            continue

        # Validação do enunciado.
        if norm(current.get("statement")) != norm(
            result.get("statement")
        ):
            problems.append(
                f"Q{number} {external_id}: enunciado divergente."
            )
            continue

        # Validação das alternativas.
        current_alts = canonical_alternatives(
            current.get("alternatives")
        )

        expected_alts = canonical_alternatives(
            result.get("alternatives")
        )

        if current_alts != expected_alts:
            problems.append(
                f"Q{number} {external_id}: alternativas divergentes."
            )
            continue

        explanation_obj = result.get("explanation") or {}
        app_explanation = explanation_obj.get(
            "appExplanation"
        )

        if not app_explanation:
            problems.append(
                f"Q{number} {external_id}: "
                "appExplanation ausente."
            )
            continue

        new_explanation = render_explanation_text(
            app_explanation
        )

        if not isinstance(new_explanation, str):
            problems.append(
                f"Q{number} {external_id}: "
                "renderer não retornou string."
            )
            continue

        new_explanation = new_explanation.strip()

        if not new_explanation:
            problems.append(
                f"Q{number} {external_id}: "
                "explicação renderizada vazia."
            )
            continue

        old_explanation = current.get("explanation")

        plan.append({
            "docId": ref.id,
            "externalId": external_id,
            "questionNumber": number,
            "oldExplanation": old_explanation,
            "newExplanation": new_explanation,
            "sameAsCurrent": (
                norm(old_explanation)
                == norm(new_explanation)
            ),
        })

    timestamp = datetime.now(
        timezone.utc
    ).strftime("%Y%m%dT%H%M%SZ")

    backup_path = Path(
        "worker/output/backups/"
        f"gemini-explanations-before-update-{timestamp}.json"
    )

    plan_path = Path(
        "worker/output/"
        f"gemini-processual-fgv-2025-update-plan-{timestamp}.json"
    )

    backup_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    backup_payload = {
        "createdAt": datetime.now(
            timezone.utc
        ).isoformat(),
        "source": args.source,
        "count": len(plan),
        "documents": [
            {
                "docId": item["docId"],
                "externalId": item["externalId"],
                "questionNumber": item["questionNumber"],
                "explanation": item["oldExplanation"],
            }
            for item in plan
        ],
    }

    backup_path.write_text(
        json.dumps(
            backup_payload,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    plan_path.write_text(
        json.dumps(
            {
                "createdAt": datetime.now(
                    timezone.utc
                ).isoformat(),
                "source": args.source,
                "input": str(input_path),
                "count": len(plan),
                "items": plan,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    empty_current = sum(
        not norm(item["oldExplanation"])
        for item in plan
    )

    nonempty_current = (
        len(plan) - empty_current
    )

    same = sum(
        item["sameAsCurrent"]
        for item in plan
    )

    different = len(plan) - same

    print()
    print("=" * 76)
    print("VALIDAÇÃO")
    print("=" * 76)

    print(
        "Documentos gran_cursos encontrados:",
        len(published_docs),
    )
    print("Questões alvo validadas:", len(plan))
    print("Problemas:", len(problems))
    print()
    print("Explanation atual vazia:", empty_current)
    print(
        "Explanation atual não vazia:",
        nonempty_current,
    )
    print("Já iguais ao Gemini:", same)
    print("Seriam alteradas:", different)

    if problems:
        print()
        print("PROBLEMAS:")
        for problem in problems:
            print(" -", problem)

    print()
    print("Backup:")
    print(backup_path)

    print()
    print("Plano:")
    print(plan_path)

    # Segurança absoluta: nunca aplicar com qualquer divergência.
    if (
        len(plan) != expected_count
        or problems
    ):
        raise SystemExit(
            f"\nBLOQUEADO: esperado {expected_count}/{expected_count} "
            "sem divergências. Nenhuma escrita foi feita."
        )

    if not args.apply:
        print()
        print("=" * 76)
        print("STATUS: DRY-RUN APROVADO")
        print("=" * 76)
        print(
            "Nenhuma alteração foi feita no Firestore."
        )
        return

    # Só chegamos aqui com --apply e todas as questões validadas.
    batch = db.batch()
    writes = 0

    for item in plan:
        if item["sameAsCurrent"]:
            continue

        ref = db.collection(
            "questions"
        ).document(
            item["docId"]
        )

        # IMPORTANTE:
        # somente explanation é alterado.
        batch.update(
            ref,
            {
                "explanation": item[
                    "newExplanation"
                ]
            },
        )

        writes += 1

    if writes:
        batch.commit()

    print()
    print("=" * 76)
    print("UPDATE CONCLUÍDO")
    print("=" * 76)
    print("Documentos alterados:", writes)
    print(
        "Único campo alterado: explanation"
    )


if __name__ == "__main__":
    main()
