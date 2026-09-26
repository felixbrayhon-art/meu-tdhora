from pathlib import Path
from collections import Counter
import copy
import json

BASE = Path("worker/output/gemini-admin-2026-batches")
EXAM = Path("worker/output/gemini-admin-2026-198-exam.json")
FINAL = Path("worker/output/gemini-admin-2026-final-198.json")

FILES = [
    Path("worker/output/gemini-admin-2026-pilot-5-audited.json"),
    *[BASE / f"batch-{n:02d}-audited.json" for n in range(1, 11)],
]

SECTIONS = {
    "practicalCase",
    "concept",
    "classification",
    "legalBasis",
    "requirements",
    "traps",
    "caseAnalysis",
    "dontConfuse",
    "examSummary",
    "curiosities",
}

exam = json.loads(EXAM.read_text(encoding="utf-8"))
questions = {
    int(q["questionNumber"]): q
    for q in exam["questions"]
}

results = []

for path in FILES:
    data = json.loads(path.read_text(encoding="utf-8"))
    results.extend(copy.deepcopy(data.get("results", [])))

numbers = [int(r["questionNumber"]) for r in results]
counts = Counter(numbers)

duplicates = sorted(n for n, c in counts.items() if c > 1)
missing = sorted(set(questions) - set(numbers))
unexpected = sorted(set(numbers) - set(questions))

statuses = Counter()
semantic_statuses = Counter()
semantic_verdicts = Counter()

problems = []
remaining_quotes = 0
downgrades = 0

for r in results:
    n = int(r["questionNumber"])
    q = questions.get(n)

    if not q:
        continue

    statuses[r.get("status")] += 1

    if r.get("status") not in {"approved", "approved_with_gaps"}:
        problems.append(f"Q{n}: status={r.get('status')}")

    if str(r.get("officialAnswer")).upper() != str(q["officialAnswer"]).upper():
        problems.append(f"Q{n}: gabarito divergente")

    if r.get("validationErrors"):
        problems.append(f"Q{n}: validationErrors={r['validationErrors']}")

    if r.get("error"):
        problems.append(f"Q{n}: error={r['error']}")

    exp = r.get("explanation") or {}
    app = exp.get("appExplanation") or {}
    audit = exp.get("audit") or {}
    details = audit.get("sectionDetails") or {}

    if set(app) != SECTIONS:
        problems.append(f"Q{n}: appExplanation não possui os 10 tópicos")

    if set(details) != SECTIONS:
        problems.append(f"Q{n}: sectionDetails não possui os 10 tópicos")

    for section, text in app.items():
        if not isinstance(text, str) or not text.strip():
            problems.append(f"Q{n}: {section} vazio")

    q_quotes = 0

    for detail in details.values():
        if not isinstance(detail, dict):
            continue

        quotes = detail.get("evidenceQuotes") or []

        if isinstance(quotes, list):
            q_quotes += len(quotes)

    remaining_quotes += q_quotes

    safe = r.get("safeDowngrades") or []

    if isinstance(safe, list):
        downgrades += len(safe)

    semantic = audit.get("semanticEvidenceAudit")

    if isinstance(semantic, dict):
        status = semantic.get("status")

        if status:
            semantic_statuses[status] += 1

        if status == "needs_review":
            problems.append(f"Q{n}: auditoria semântica needs_review")

        if semantic.get("contradictions"):
            problems.append(f"Q{n}: contradição semântica")

        for judgment in semantic.get("judgments") or []:
            if isinstance(judgment, dict):
                verdict = judgment.get("verdict")
                if verdict:
                    semantic_verdicts[verdict] += 1

    elif q_quotes:
        problems.append(
            f"Q{n}: possui evidenceQuote sem auditoria semântica"
        )

    # Enriquece o arquivo final com os dados originais da questão.
    r["externalId"] = q.get("externalId")
    r["statement"] = q.get("statement")
    r["alternatives"] = q.get("alternatives")
    r["subject"] = q.get("subject")
    r["officialAnswer"] = q.get("officialAnswer")
    r["officialAnswerText"] = q.get("officialAnswerText")

print("=" * 72)
print("AUDITORIA GLOBAL — 198 EXPLICAÇÕES")
print("=" * 72)

print("Resultados:", len(results))
print("Questões únicas:", len(set(numbers)))
print("Ausentes:", len(missing))
print("Duplicadas:", len(duplicates))
print("Inesperadas:", len(unexpected))

print()
print("Status:")
for k, v in sorted(statuses.items()):
    print(f"  {k}: {v}")

print()
print("Auditoria semântica:")
for k, v in sorted(semantic_statuses.items()):
    print(f"  {k}: {v}")

print()
print("Veredictos das evidenceQuotes:")
for k in ("supports", "related_only", "unclear", "contradicts"):
    print(f"  {k}: {semantic_verdicts[k]}")

print()
print("evidenceQuotes restantes:", remaining_quotes)
print("safeDowngrades:", downgrades)

print()
print("Problemas encontrados:", len(problems))

if missing:
    print("Ausentes:", missing)

if duplicates:
    print("Duplicadas:", duplicates)

if unexpected:
    print("Inesperadas:", unexpected)

if problems:
    for p in problems[:20]:
        print(" -", p)

if (
    len(results) != 198
    or len(set(numbers)) != 198
    or missing
    or duplicates
    or unexpected
    or problems
    or semantic_verdicts["contradicts"]
):
    raise SystemExit("\nSTATUS FINAL: REVISAR — arquivo final não criado")

results.sort(key=lambda r: int(r["questionNumber"]))

final = {
    "meta": {
        **(exam.get("meta") or {}),
        "source": "gran_cursos",
        "subject": "Direito Administrativo",
        "year": 2026,
        "totalQuestions": 198,
        "semanticEvidenceAudit": True,
    },
    "progress": {
        "total": 198,
        **dict(statuses),
    },
    "auditSummary": {
        "uniqueQuestions": 198,
        "remainingEvidenceQuotes": remaining_quotes,
        "safeDowngrades": downgrades,
        "semanticStatuses": dict(semantic_statuses),
        "semanticVerdicts": dict(semantic_verdicts),
        "problems": 0,
    },
    "results": results,
}

FINAL.write_text(
    json.dumps(final, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print()
print("=" * 72)
print("STATUS FINAL: 198/198 CONSOLIDADAS E VALIDADAS")
print("=" * 72)
print("Arquivo:", FINAL)
print("Gemini NÃO foi chamado.")
print("Firestore NÃO foi alterado.")
