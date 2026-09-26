from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exam_discovery.to_draft import import_subject_bucket
from parsers.base import content_hash


QUESTION_RE = re.compile(
    r"(?m)^\s*(\d+)\.\s*\[(Q\d+)\]\s*"
)

ANSWER_RE = re.compile(
    r"\((\d+)\s*=\s*([A-Ea-e]|n\s*/\s*a)\)",
    flags=re.IGNORECASE,
)

ALT_RE = re.compile(
    r"(?m)^\s*([A-Ea-e])\s*\)\s*"
)


def collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def remove_pdf_noise(text: str) -> str:
    lines = []

    for raw_line in text.splitlines():
        line = raw_line.strip()

        if not line:
            lines.append("")
            continue

        if re.fullmatch(
            r"\d{2}/\d{2}/\d{4},\s*\d{2}:\d{2}",
            line,
        ):
            continue

        if line.startswith(
            "Gran Cursos Questões - Questões de concursos públicos"
        ):
            continue

        if line.startswith("https://questoes.grancursosonline.com.br/"):
            continue

        if re.fullmatch(r"\d+/\d+", line):
            continue

        lines.append(raw_line)

    return "\n".join(lines)


def extract_pdf_text(pdf_path: Path) -> str:
    try:
        from pdfminer.high_level import extract_text
    except ImportError as exc:
        raise SystemExit(
            "pdfminer não encontrado. Execute este script com "
            "worker/.venv/bin/python."
        ) from exc

    return extract_text(str(pdf_path))


def find_page(raw_text: str, position: int) -> int:
    """
    O PDF do Gran traz rodapé 1/21, 2/21 etc.
    Conta quantos rodapés completos aparecem antes do início da questão.
    """
    before = raw_text[:position]
    footers = re.findall(
        r"(?m)^\s*\d+\s*/\s*\d+\s*$",
        before,
    )
    return len(footers) + 1


def detect_subject(topic_raw: str, fallback: str) -> str:
    known = (
        "Direito Administrativo",
        "Direito Constitucional",
        "Direito Penal",
        "Direito Processual Penal",
        "Direito Civil",
        "Direito Processual Civil",
        "Direito Tributário",
        "Direito Ambiental",
        "Direito Empresarial",
        "Direito do Trabalho",
        "Direito Eleitoral",
        "Direito Previdenciário",
        "Direito Financeiro",
        "Direito Econômico",
        "Direito do Consumidor",
    )

    lower = topic_raw.casefold()

    for subject in known:
        if subject.casefold() in lower:
            return subject

    return fallback


def parse_source_info(source_info: str) -> dict:
    normalized = collapse(source_info)

    parts = [
        part.strip()
        for part in re.split(r"\s+/\s+", normalized)
        if part.strip()
    ]

    organization = None
    position = None
    original_question_number = None

    if len(parts) >= 2:
        organization = parts[1]

    if len(parts) >= 4:
        position = " / ".join(parts[2:-1])
    elif len(parts) == 3 and not parts[2].lower().startswith("questão"):
        position = parts[2]

    q_match = re.search(
        r"Quest[aã]o:\s*(\d+)",
        normalized,
        flags=re.IGNORECASE,
    )

    if q_match:
        original_question_number = int(q_match.group(1))

    year_match = re.search(
        r"\bFGV\s+(20\d{2})\b",
        normalized,
        flags=re.IGNORECASE,
    )

    exam_year = int(year_match.group(1)) if year_match else 2025

    return {
        "examYear": exam_year,
        "examBoard": "FGV",
        "organization": organization,
        "position": position,
        "originalQuestionNumber": original_question_number,
        "sourceDescription": normalized,
    }


def _deck_board_year_label(questions: list[dict]) -> str:
    """Derives the deck-level "<board> <year>" label from what each
    question's own parse_source_info() actually found — never a hardcoded
    literal (a real bug: this used to say "FGV 2025" verbatim even for a
    2026 deck, because no one had updated the string since the first PDF
    this script was written against). Picks the most common (board, year)
    pair when questions disagree — real Gran Cursos "simulado" decks can
    legitimately mix a few different exams — and falls back to "Gran
    Cursos" alone when nothing was detected at all.
    """
    from collections import Counter

    pairs = [(q.get("examBoard"), q.get("examYear")) for q in questions if q.get("examBoard") or q.get("examYear")]
    if not pairs:
        return "Gran Cursos"

    (board, year), _count = Counter(pairs).most_common(1)[0]
    if board and year:
        return f"{board} {year}"
    return str(board or year)


def parse_block(
    number: int,
    gran_id: str,
    block: str,
    correct_letter: str,
    page: int,
    subject_fallback: str,
) -> dict:
    cleaned = remove_pdf_noise(block)

    topic_match = re.search(
        r"Disciplinas/Assuntos vinculados:\s*(.*?)"
        r"(?=\n\s*Fonte:|\Z)",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )

    topic_raw = collapse(topic_match.group(1)) if topic_match else ""

    source_match = re.search(
        r"(?m)^\s*Fonte:\s*(.*)\Z",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )

    source_info = (
        collapse(source_match.group(1))
        if source_match
        else ""
    )

    content_end = len(cleaned)

    for marker in (
        "Disciplinas/Assuntos vinculados:",
        "\nFonte:",
    ):
        idx = cleaned.find(marker)
        if idx >= 0:
            content_end = min(content_end, idx)

    content = cleaned[:content_end].strip()

    alt_matches = list(ALT_RE.finditer(content))
    warnings = []

    if len(alt_matches) < 2 or len(alt_matches) > 5:
        warnings.append(
            f"Número de alternativas extraídas inválido: {len(alt_matches)}"
        )

    if not alt_matches:
        statement = collapse(content)
        alternatives = []
    else:
        statement = collapse(content[:alt_matches[0].start()])
        alternatives = []

        for index, match in enumerate(alt_matches):
            letter = match.group(1).upper()

            start = match.end()
            end = (
                alt_matches[index + 1].start()
                if index + 1 < len(alt_matches)
                else len(content)
            )

            alt_text = collapse(content[start:end])

            alternatives.append(
                {
                    "letter": letter,
                    "text": alt_text,
                    "isCorrect": letter == correct_letter,
                    "position": index,
                }
            )

    if not statement:
        warnings.append("Enunciado vazio")

    letters = [a["letter"] for a in alternatives]

    if correct_letter not in letters:
        warnings.append(
            f"Gabarito {correct_letter} não encontrado nas alternativas"
        )

    if len(set(letters)) != len(letters):
        warnings.append("Letras de alternativas repetidas")

    source_meta = parse_source_info(source_info)

    subject_raw = detect_subject(
        topic_raw,
        subject_fallback,
    )

    return {
        "source": "gran_cursos",
        "externalId": gran_id,
        "number": number,
        "questionType": "multipla_escolha",
        "subjectRaw": subject_raw,
        "topicRaw": topic_raw or None,
        # push_drafts.py/import_batch.py never derive this on their own — a
        # PDF-batch source has always set it itself (e.g. import_batch.py's
        # own --subject flag). Previously missing here, which made every
        # gran_cursos question invisible in the app's "Por Matéria" tab
        # (listBankImportSubjects filters on this field) even once
        # published — see worker/scripts/backfill_gran_cursos_exam_metadata.py.
        "importSubject": import_subject_bucket(subject_raw),
        "importYear": source_meta["examYear"],
        "statement": statement,
        "alternatives": alternatives,
        "correctLetter": correct_letter,
        "explanation": "",
        "sourcePage": page,
        "contentHash": content_hash(statement),
        "status": "needs_attention" if warnings else "pending_review",
        "warnings": warnings,
        "examYear": source_meta["examYear"],
        "examBoard": source_meta["examBoard"],
        "organization": source_meta["organization"],
        "position": source_meta["position"],
        "originalQuestionNumber": source_meta[
            "originalQuestionNumber"
        ],
        "sourceDescription": source_meta[
            "sourceDescription"
        ],
    }


def parse_gran_pdf(
    pdf_path: Path,
    subject: str,
) -> dict:
    raw = extract_pdf_text(pdf_path)

    gabarito_pos = raw.rfind("Gabarito")

    if gabarito_pos < 0:
        raise SystemExit(
            "ERRO: seção 'Gabarito' não encontrada no PDF."
        )

    answer_section = raw[gabarito_pos:]

    answer_matches = ANSWER_RE.findall(answer_section)

    answers = {}

    for number, value in answer_matches:
        normalized = re.sub(r"\s+", "", value).lower()

        answers[int(number)] = (
            None
            if normalized == "n/a"
            else value.upper()
        )

    matches = list(QUESTION_RE.finditer(raw[:gabarito_pos]))

    if not matches:
        raise SystemExit(
            "ERRO: nenhuma questão no formato "
            "'1. [Q123456]' foi encontrada."
        )

    questions = []
    skipped_questions = []

    for index, match in enumerate(matches):
        number = int(match.group(1))
        gran_id = match.group(2)

        block_start = match.end()
        block_end = (
            matches[index + 1].start()
            if index + 1 < len(matches)
            else gabarito_pos
        )

        block = raw[block_start:block_end]

        if number not in answers:
            raise SystemExit(
                f"ERRO: gabarito da questão {number} não encontrado."
            )

        correct_letter = answers[number]

        if correct_letter is None:
            skipped_questions.append(
                {
                    "number": number,
                    "externalId": gran_id,
                    "reason": "gabarito n/a no PDF",
                }
            )
            continue

        page = find_page(raw, match.start())

        question = parse_block(
            number=number,
            gran_id=gran_id,
            block=block,
            correct_letter=correct_letter,
            page=page,
            subject_fallback=subject,
        )

        questions.append(question)

    question_numbers = {
        int(match.group(1))
        for match in matches
    }
    answer_numbers = set(answers)

    missing_answers = question_numbers - answer_numbers

    if missing_answers:
        raise SystemExit(
            "ERRO: faltam gabaritos para: "
            + ", ".join(
                str(n) for n in sorted(missing_answers)
            )
        )

    generated_match = re.search(
        r"Criado em:\s*([^\n]+)",
        raw,
        flags=re.IGNORECASE,
    )

    generated_at = (
        collapse(generated_match.group(1))
        if generated_match
        else None
    )

    board_year_label = _deck_board_year_label(questions)

    meta = {
        "title": f"Gran Cursos - {board_year_label} - {subject}",
        "ownerName": None,
        "ownerEmail": None,
        "generatedAt": generated_at,
        "bloco": f"{board_year_label} - {len(questions)} questões",
    }

    return {
        "meta": meta,
        "questions": questions,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Converte PDF de simulado do Gran Cursos "
            "para o JSON aceito por push_drafts.py."
        )
    )

    parser.add_argument(
        "pdf_path",
        help="PDF exportado pelo Gran Cursos",
    )

    parser.add_argument(
        "--subject",
        default="Direito Administrativo",
        help="Disciplina principal do lote",
    )

    parser.add_argument(
        "--out",
        required=True,
        help="Arquivo JSON de saída",
    )

    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    out_path = Path(args.out)

    if not pdf_path.exists():
        raise SystemExit(
            f"ERRO: PDF não encontrado: {pdf_path}"
        )

    payload = parse_gran_pdf(
        pdf_path,
        args.subject,
    )

    out_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    out_path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    questions = payload["questions"]

    print("=" * 50)
    print("IMPORTADOR GRAN CURSOS")
    print("=" * 50)
    print(f"PDF: {pdf_path}")
    print(f"Questões extraídas: {len(questions)}")
    print(
        "Sem explicação:",
        sum(
            1
            for q in questions
            if not q["explanation"].strip()
        ),
    )
    print(
        "Com warnings:",
        sum(
            1
            for q in questions
            if q["warnings"]
        ),
    )
    print()
    print(
        "Gabarito:",
        " ".join(
            f"{q['number']}={q['correctLetter']}"
            for q in questions
        ),
    )
    print()
    print(f"JSON: {out_path}")
    print("=" * 50)


if __name__ == "__main__":
    main()
