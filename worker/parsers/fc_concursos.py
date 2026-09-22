from __future__ import annotations

import re
from dataclasses import dataclass

import pdfplumber

from .base import ParsedAlternative, ParsedQuestion

RE_START = re.compile(r"^(\d+)\s*·\s*FC\s*#(\d+)$")
RE_MATERIA = re.compile(r"^Matéria:\s*(.+)$")
RE_ASSUNTO = re.compile(r"^Assunto:\s*(.+)$")
RE_ALTERNATIVE = re.compile(r"^([a-eA-E])\)\s*(.*)$")
RE_GABARITO = re.compile(r"^Gabarito:\s*([A-Ea-e])\s*$")
RE_COMENTARIO = re.compile(r"^COMENTÁRIO DO PROFESSOR$")
RE_HEADER = re.compile(r"^\d{2}/\d{2}/\d{4},?\s*\d{2}:\d{2}\s")
RE_FOOTER_COPYRIGHT = re.compile(r"^©\s*FC Concursos")
RE_FOOTER_URL = re.compile(r"^https://flashcardsconcursos\.com\.br")
RE_DECK_META = re.compile(
    r"^(?P<name>.+?)\s*·\s*(?P<email>\S+@\S+)\s*·\s*Gerado em\s*(?P<generated_at>.+?)\s*·\s*(?P<bloco>Bloco .+)$"
)
# Floating UI chrome ("Ask" AI button, etc.) that FC Concursos' print export
# occasionally leaks into the text layer as a standalone line.
NOISE_EXACT_LINES = {"Ask"}


@dataclass
class DeckMetadata:
    title: str | None
    owner_name: str | None
    owner_email: str | None
    generated_at: str | None
    bloco: str | None

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "ownerName": self.owner_name,
            "ownerEmail": self.owner_email,
            "generatedAt": self.generated_at,
            "bloco": self.bloco,
        }


def _denoise(raw_lines: list[str], page_no: int) -> list[tuple[str, int]]:
    out: list[tuple[str, int]] = []
    for raw in raw_lines:
        line = raw.strip()
        if not line:
            continue
        if RE_HEADER.match(line) or RE_FOOTER_COPYRIGHT.match(line) or RE_FOOTER_URL.match(line):
            continue
        if line in NOISE_EXACT_LINES:
            continue
        out.append((line, page_no))
    return out


def _extract_deck_metadata(first_page_lines: list[str]) -> DeckMetadata:
    title = first_page_lines[0] if first_page_lines else None
    for line in first_page_lines[:5]:
        m = RE_DECK_META.match(line)
        if m:
            return DeckMetadata(
                title=title,
                owner_name=m.group("name").strip(),
                owner_email=m.group("email").strip(),
                generated_at=m.group("generated_at").strip(),
                bloco=m.group("bloco").strip(),
            )
    return DeckMetadata(title=title, owner_name=None, owner_email=None, generated_at=None, bloco=None)


def _parse_block(block: list[tuple[str, int]]) -> ParsedQuestion:
    lines = [text for text, _ in block]
    pages = [page for _, page in block]
    warnings: list[str] = []

    start_match = RE_START.match(lines[0])
    number = int(start_match.group(1))
    external_id = start_match.group(2)
    source_page = pages[0]
    i = 1

    subject_raw = None
    if i < len(lines) and RE_MATERIA.match(lines[i]):
        subject_raw = RE_MATERIA.match(lines[i]).group(1)
        i += 1
    else:
        warnings.append("Linha 'Matéria:' não encontrada")

    topic_raw = None
    if i < len(lines) and RE_ASSUNTO.match(lines[i]):
        topic_raw = RE_ASSUNTO.match(lines[i]).group(1)
        i += 1
    else:
        warnings.append("Linha 'Assunto:' não encontrada")

    statement_lines: list[str] = []
    while i < len(lines) and not RE_ALTERNATIVE.match(lines[i]):
        statement_lines.append(lines[i])
        i += 1
    statement = " ".join(statement_lines).strip()

    alternatives: list[ParsedAlternative] = []
    current_letter: str | None = None
    current_text: list[str] = []

    def flush_alternative() -> None:
        if current_letter is not None:
            alternatives.append(
                ParsedAlternative(
                    letter=current_letter.upper(),
                    text=" ".join(current_text).strip(),
                    is_correct=False,
                    position=len(alternatives),
                )
            )

    while i < len(lines) and not RE_GABARITO.match(lines[i]):
        alt_match = RE_ALTERNATIVE.match(lines[i])
        if alt_match:
            flush_alternative()
            current_letter = alt_match.group(1)
            current_text = [alt_match.group(2)]
        else:
            current_text.append(lines[i])
        i += 1
    flush_alternative()

    correct_letter: str | None = None
    if i < len(lines) and RE_GABARITO.match(lines[i]):
        correct_letter = RE_GABARITO.match(lines[i]).group(1).upper()
        i += 1
    else:
        warnings.append("Linha 'Gabarito:' não encontrada")

    if i < len(lines) and RE_COMENTARIO.match(lines[i]):
        i += 1
    else:
        warnings.append("Marcador 'COMENTÁRIO DO PROFESSOR' não encontrado")

    explanation = "\n".join(lines[i:]).strip()

    if not statement:
        warnings.append("Enunciado vazio")
    if len(alternatives) < 2:
        warnings.append(f"Apenas {len(alternatives)} alternativa(s) reconhecida(s)")
    letters = {a.letter for a in alternatives}
    if correct_letter and correct_letter not in letters:
        warnings.append(f"Gabarito '{correct_letter}' não corresponde a nenhuma alternativa extraída")
    if not explanation:
        warnings.append("Explicação vazia")

    for alt in alternatives:
        alt.is_correct = alt.letter == correct_letter

    return ParsedQuestion(
        source="fc_concursos",
        external_id=external_id,
        number=number,
        question_type="multipla_escolha",
        subject_raw=subject_raw,
        topic_raw=topic_raw,
        statement=statement,
        alternatives=alternatives,
        correct_letter=correct_letter,
        explanation=explanation,
        source_page=source_page,
        warnings=warnings,
    )


def parse(path: str) -> tuple[DeckMetadata, list[ParsedQuestion]]:
    all_lines: list[tuple[str, int]] = []

    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages):
            page_no = index + 1
            text = page.extract_text() or ""
            all_lines.extend(_denoise(text.split("\n"), page_no))

    first_page_lines = [text for text, page_no in all_lines if page_no == 1]
    deck_metadata = _extract_deck_metadata(first_page_lines)

    start_indices = [i for i, (text, _) in enumerate(all_lines) if RE_START.match(text)]
    questions: list[ParsedQuestion] = []
    for k, start in enumerate(start_indices):
        end = start_indices[k + 1] if k + 1 < len(start_indices) else len(all_lines)
        questions.append(_parse_block(all_lines[start:end]))

    return deck_metadata, questions
