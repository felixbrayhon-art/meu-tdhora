#!/bin/bash

set -euo pipefail

cd "$HOME/Downloads/meu-tdhora-main 6"

BASE="worker/output/gemini-admin-2026-batches"
EXAM="worker/output/gemini-admin-2026-198-exam.json"
MODEL="gemini-3.8-flash"

for N in 05 06 07 08 09 10
do
    SPEC="$BASE/batch-$N-spec.txt"
    GEN="$BASE/batch-$N-explanations.json"
    AUD="$BASE/batch-$N-audited.json"

    echo
    echo "========================================================================"
    echo "BATCH $N"
    echo "========================================================================"

    EXPECTED="$(
        worker/.venv/bin/python - "$SPEC" <<'PY'
import sys
from pathlib import Path

spec = Path(sys.argv[1]).read_text(encoding="utf-8").strip()
print(len([x for x in spec.split(",") if x.strip()]))
PY
    )"

    EXISTING=0

    if [ -f "$GEN" ]; then
        EXISTING="$(
            worker/.venv/bin/python - "$GEN" <<'PY'
import json
import sys
from pathlib import Path

try:
    data = json.loads(
        Path(sys.argv[1]).read_text(encoding="utf-8")
    )
    print(len(data.get("results", [])))
except Exception:
    print(0)
PY
        )"
    fi

    echo "Esperadas: $EXPECTED"
    echo "Já geradas: $EXISTING"

    QUESTIONS_SPEC="$(cat "$SPEC")"

    if [ "$EXISTING" -eq "$EXPECTED" ]; then
        echo "Geração já completa. Gemini NÃO será chamado novamente."

    elif [ "$EXISTING" -gt 0 ]; then
        echo "Geração parcial. Retomando apenas o que falta..."

        worker/.venv/bin/python \
            worker/scripts/batch_exam_explanations_gemini.py \
            --exam "$EXAM" \
            --questions "$QUESTIONS_SPEC" \
            --output "$GEN" \
            --model "$MODEL" \
            --sources-limit 6 \
            --num-predict 4096 \
            --resume \
            --stop-on-error

    else
        echo "Iniciando geração do Batch $N..."

        worker/.venv/bin/python \
            worker/scripts/batch_exam_explanations_gemini.py \
            --exam "$EXAM" \
            --questions "$QUESTIONS_SPEC" \
            --output "$GEN" \
            --model "$MODEL" \
            --sources-limit 6 \
            --num-predict 4096 \
            --stop-on-error
    fi

    echo
    echo "Validando geração..."

    worker/.venv/bin/python - "$GEN" "$EXPECTED" <<'PY'
import json
import sys
from collections import Counter
from pathlib import Path

data = json.loads(
    Path(sys.argv[1]).read_text(encoding="utf-8")
)

expected = int(sys.argv[2])
results = data.get("results", [])
counts = Counter(r.get("status") for r in results)

print("Resultados:", len(results))
print("approved:", counts["approved"])
print("approved_with_gaps:", counts["approved_with_gaps"])
print("rejected:", counts["rejected"])
print("error:", counts["error"])

if len(results) != expected:
    raise SystemExit(
        f"ERRO: esperava {expected} resultados, encontrei {len(results)}."
    )

if counts["rejected"] or counts["error"]:
    raise SystemExit(
        "ERRO: lote contém rejected/error."
    )

print("GERAÇÃO: OK")
PY

    if [ -f "$AUD" ]; then
        echo
        echo "Auditoria já existe. Gemini NÃO será chamado novamente."

    else
        QUOTES="$(
            worker/.venv/bin/python - "$GEN" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(
    Path(sys.argv[1]).read_text(encoding="utf-8")
)

total = 0

for result in data.get("results", []):
    details = (
        (result.get("explanation") or {})
        .get("audit", {})
        .get("sectionDetails", {})
    )

    for detail in details.values():
        if isinstance(detail, dict):
            quotes = detail.get("evidenceQuotes") or []
            if isinstance(quotes, list):
                total += len(quotes)

print(total)
PY
        )"

        echo
        echo "evidenceQuotes encontradas: $QUOTES"

        if [ "$QUOTES" -gt 0 ]; then
            echo "Executando auditoria semântica..."

            worker/.venv/bin/python \
                worker/scripts/audit_explanations_gemini.py \
                --input "$GEN" \
                --output "$AUD" \
                --model "$MODEL" \
                --num-predict 4096 \
                --max-items 160
        else
            echo "Sem evidenceQuotes. Criando cópia auditada local..."

            cp "$GEN" "$AUD"
        fi
    fi

    echo
    echo "Validando auditoria..."

    worker/.venv/bin/python - "$AUD" "$EXPECTED" <<'PY'
import json
import sys
from collections import Counter
from pathlib import Path

data = json.loads(
    Path(sys.argv[1]).read_text(encoding="utf-8")
)

expected = int(sys.argv[2])
results = data.get("results", [])

statuses = Counter(
    r.get("status")
    for r in results
)

semantic = Counter()
contradictions = 0

for result in results:
    sa = (
        (result.get("explanation") or {})
        .get("audit", {})
        .get("semanticEvidenceAudit", {})
    )

    if sa.get("status"):
        semantic[sa["status"]] += 1

    contradictions += len(
        sa.get("contradictions") or []
    )

top = data.get("semanticEvidenceAudit") or {}
counts = top.get("counts") or {}

print("Resultados:", len(results))
print("Status geração:", dict(statuses))
print("Status semântico:", dict(semantic))
print("supports:", counts.get("supports", 0))
print("related_only:", counts.get("related_only", 0))
print("unclear:", counts.get("unclear", 0))
print("contradicts:", counts.get("contradicts", 0))

bad = (
    len(results) != expected
    or statuses.get("rejected", 0)
    or statuses.get("error", 0)
    or semantic.get("needs_review", 0)
    or contradictions
    or counts.get("contradicts", 0)
)

if bad:
    print("STATUS: BLOQUEADO PARA REVISÃO")
    sys.exit(30)

print("STATUS: BATCH APROVADO")
PY

    echo
    echo "BATCH $N CONCLUÍDO COM SEGURANÇA"
done

echo
echo "========================================================================"
echo "TODOS OS BATCHES 05–10 CONCLUÍDOS"
echo "========================================================================"
echo "Firestore não foi alterado."
