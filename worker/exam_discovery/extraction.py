from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

from .models import ExtractedQuestion

# Deterministic, regex-based extraction of an FGV-style two-column exam
# PDF plus its table-shaped answer-key PDF. No AI anywhere in this
# module: every question that doesn't cleanly match the expected shape
# is marked "needs_attention" with a specific reason instead of being
# guessed at or silently dropped.
#
# Verified byte-for-byte (after whitespace normalization) against the
# already-validated worker/data/exams/pcmg_investigador_2025_tipo1.json
# — see the mini-batch report in this session: 70/70 statements, 350/350
# alternatives, and the official answer key (Q59 annulled included) all
# matched exactly. That verification is specific to this one exam/board
# layout; a differently laid-out FGV exam (or another board entirely)
# may need adjustments here — this module doesn't claim more than what
# was actually checked.

RE_QUESTION_NUMBER_LINE = re.compile(r"\n\s*(\d{1,3})\s*\n")
RE_ALTERNATIVE = re.compile(r"\((A|B|C|D|E)\)\s*")
RE_PAGE_FOOTER = re.compile(r"TIPO\s+\S+\s*[–-]\s*P[ÁA]GINA\s*\d+", re.IGNORECASE)
RE_TERMINAL_PUNCTUATION = re.compile(r"[.!?](?!\S)")
# Other page-transition furniture observed bleeding into the LAST
# alternative of a page's/section's final question, alongside
# RE_PAGE_FOOTER: a credits/source URL line, and a base64-ish tracking
# watermark some downloaded copies carry (seen split across both
# columns by the page-crop boundary — see extract_exam_text). Unlike
# RE_PAGE_FOOTER (checked per-column, at a line's own start/end),
# these are checked as a substring anywhere in the trailing text
# in _truncate_trailing_heading, because page-transition text can end
# up composited from two different columns/pages once blocks are
# resplit by question number.
RE_TRAILING_JUNK = re.compile(
    r"(www\.\S+|\bpcimarkpci\b|[A-Za-z0-9+/=]{24,})", re.IGNORECASE
)

# Two real FGV header conventions observed for an answer-key section's
# own title line: "{role} – Prova Tipo N" (PCMG) and "{role} - N - Turno
# {turno}" (DPE-PE's actual definitive key, straight from FGV's own
# site — a third, ALL-CAPS "PROVA TIPO N" variant also showed up in an
# aggregator-sourced copy of the same exam's preliminary key, already
# covered by the first alternative + IGNORECASE).
RE_ANSWER_KEY_SECTION = re.compile(
    r"Prova\s+Tipo\s+(\d+)|[-–]\s*(\d+)\s*[-–]\s*Turno", re.IGNORECASE
)
RE_NUMBER_ROW = re.compile(r"^(\d+\s*)+$")
# "X" alongside "*": Cebraspe marks an annulled question/item with "X"
# ("Obs.: ( X ) item anulado."), not "*" — verified against real PC/PE
# and PF gabarito PDFs. Both boards' markers are accepted everywhere this
# regex is used, since which one appears is a property of the BANCA that
# produced the document, not of the hosting site or the question format
# (Cebraspe used "X" even in a straightforward A-E gabarito, PC/PE).
RE_ANSWER_ROW = re.compile(r"^([A-E*X]\s*)+$")
# A gabarito row is sometimes prefixed with its own label — "Questão"/
# "Item" for the number row, "Gabarito" for the answer row (Cebraspe);
# FGV's rows have no such label. Stripped before RE_NUMBER_ROW/
# RE_ANSWER_ROW matching so both shapes are handled by the same code.
RE_ROW_LABEL = re.compile(r"^(item|quest[aã]o|gabarito)\s+", re.IGNORECASE)

EXPECTED_ALTERNATIVES = ("A", "B", "C", "D", "E")
# The only two "alternatives" a Cebraspe Certo/Errado item ever has — not
# printed in the PDF (the item is just a bare assertion to judge), but
# modeled the same way as an A-E question's alternatives so every
# downstream module (validation, dedup, firestore_sync) needs no
# board-specific branch at all.
CE_ALTERNATIVES = ("C", "E")
# An item boundary is an inline-prefixed number ("97 Uma empresa..."),
# never its own line — unlike RE_QUESTION_NUMBER_LINE. Requires the
# digits to start right after a newline and be followed by the start of
# a real sentence (whitespace then an uppercase letter), so a number
# that's part of wrapped monetary/table text (which is never itself
# right after a newline followed by a capitalized word) isn't mistaken
# for a new item.
RE_ITEM_NUMBER_PREFIX = re.compile(r"\n(\d{1,3})\s+(?=[A-ZÀ-Ü])")


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _strip_page_furniture(column_text: str) -> str:
    """Drops a running page header (a leading all-caps line — the
    institution/board/role banner repeated at the top of every page) and
    a trailing page footer ("TIPO ... – PÁGINA N"), both of which would
    otherwise bleed into the statement/alternative text adjacent to a
    page break.
    """
    lines = column_text.split("\n")
    while lines and lines[0].strip() and lines[0].strip() == lines[0].strip().upper() and not lines[0].strip()[0].isdigit():
        lines.pop(0)
    while lines and RE_PAGE_FOOTER.search(lines[-1]):
        lines.pop()
    return "\n".join(lines)


def _truncate_trailing_heading(raw_alternative_text: str) -> str:
    """A subject/module section header ("Raciocínio Lógico-Matemático",
    "MÓDULO II - CONHECIMENTOS ESPECÍFICOS...") occasionally starts right
    after the LAST alternative of a section's last question, inside the
    same text block (not at a page boundary, so _strip_page_furniture
    doesn't catch it). Real alternative text always ends in terminal
    punctuation; a short, capitalized, punctuation-less fragment found
    after the last '.'/'!'/'?' is such a bled-in heading and is dropped.
    """
    matches = list(RE_TERMINAL_PUNCTUATION.finditer(raw_alternative_text))
    if not matches:
        return raw_alternative_text
    last = matches[-1]
    trailing = raw_alternative_text[last.end():].strip()
    if not trailing:
        return raw_alternative_text

    # A page-transition artifact (running footer, a source/credits URL, a
    # tracking watermark) — these can run well past 80 characters once a
    # footer and the next page's header/watermark both end up composited
    # into the same trailing chunk, so this check has no length cap.
    if RE_TRAILING_JUNK.search(trailing):
        return raw_alternative_text[: last.end()]

    # Otherwise, fall back to the narrower "short bled-in section title"
    # case (e.g. "INVESTIGADOR DE POLÍCIA I", "Raciocínio Lógico-
    # Matemático") — capped at 80 chars specifically so this branch never
    # swallows a genuine, longer continuation of the answer text.
    if len(trailing) <= 80 and trailing[0].isupper() and not RE_TERMINAL_PUNCTUATION.search(trailing):
        return raw_alternative_text[: last.end()]
    return raw_alternative_text


def _column_text(pdf_page) -> list[str]:
    width, height = pdf_page.width, pdf_page.height
    left = pdf_page.crop((0, 0, width / 2, height)).extract_text() or ""
    right = pdf_page.crop((width / 2, 0, width, height)).extract_text() or ""
    return [_strip_page_furniture(left), _strip_page_furniture(right)]


def _split_statement_and_alternatives(block_text: str) -> tuple[str, dict[str, str]]:
    match = RE_ALTERNATIVE.search(block_text)
    if not match:
        return _normalize_whitespace(block_text), {}

    statement = _normalize_whitespace(block_text[: match.start()])
    rest = block_text[match.start() :]
    pieces = RE_ALTERNATIVE.split(rest)

    alternatives: dict[str, str] = {}
    for i in range(1, len(pieces), 2):
        letter = pieces[i]
        raw_text = pieces[i + 1] if i + 1 < len(pieces) else ""
        alternatives[letter] = _normalize_whitespace(_truncate_trailing_heading(raw_text))
    return statement, alternatives


def extract_exam_text(pdf_path: Path | str) -> dict[int, str]:
    """Returns {question_number: raw_block_text}, one entry per numbered
    question found in the PDF, in column-then-page reading order.
    """
    parts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            parts.extend(_column_text(page))
    full_text = "\n".join(parts)

    pieces = RE_QUESTION_NUMBER_LINE.split("\n" + full_text)
    blocks: dict[int, str] = {}
    # pieces alternates [preamble, number, text, number, text, ...]
    for i in range(1, len(pieces), 2):
        number = int(pieces[i])
        text = pieces[i + 1] if i + 1 < len(pieces) else ""
        blocks.setdefault(number, text)  # first occurrence wins (a later duplicate number is page/column noise)
    return blocks


def _strip_trailing_zero_padding(line: str) -> str:
    """Cebraspe's gabarito tables are printed at a fixed 20-column width,
    padding a short final row (e.g. "117 118 119 120") out to 20 slots
    with literal "0"s on BOTH the number row and its answer row. "0" is
    never a real question/item number or a valid answer letter, so this
    is unambiguous to strip — without it, RE_NUMBER_ROW/RE_ANSWER_ROW
    simply fail to match the padded row at all and the whole row (a real
    item, possibly annulled) silently disappears.
    """
    tokens = line.split()
    while tokens and tokens[-1] == "0":
        tokens.pop()
    return " ".join(tokens)


def _fill_answers_from_block(block: str, answers: dict[int, str | None]) -> None:
    pending_numbers: list[str] | None = None
    for raw_line in (l.strip() for l in block.split("\n") if l.strip()):
        line = _strip_trailing_zero_padding(RE_ROW_LABEL.sub("", raw_line))
        if RE_NUMBER_ROW.match(line):
            pending_numbers = line.split()
        elif RE_ANSWER_ROW.match(line) and pending_numbers:
            for number_str, letter in zip(pending_numbers, line.split()):
                answers[int(number_str)] = None if letter in ("*", "X") else letter
            pending_numbers = None


def extract_answer_key(pdf_path: Path | str) -> dict[str | None, dict[int, str | None]]:
    """Returns {test_type: {question_or_item_number: letter_or_None}} —
    None means the question/item was marked annulled ("*" or "X",
    board-dependent — see RE_ANSWER_ROW) in the official key. A gabarito
    that never splits its rows by "Tipo"/"Turno" at all (observed on a
    real Cebraspe PC/PE key: one cargo, one canonical version, no
    per-tipo sections) is returned under the single key `None`, which
    build_extracted_questions/build_extracted_items fall back to when no
    explicit `test_type` matches.
    """
    text = ""
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"

    sections = list(RE_ANSWER_KEY_SECTION.finditer(text))
    answers_by_type: dict[str | None, dict[int, str | None]] = {}

    if not sections:
        _fill_answers_from_block(text, answers_by_type.setdefault(None, {}))
        return answers_by_type

    for idx, section_match in enumerate(sections):
        test_type = section_match.group(1) or section_match.group(2)
        start = section_match.end()
        end = sections[idx + 1].start() if idx + 1 < len(sections) else len(text)
        _fill_answers_from_block(text[start:end], answers_by_type.setdefault(test_type, {}))

    return answers_by_type


def build_extracted_questions(
    exam_pdf_path: Path | str,
    answer_key_pdf_path: Path | str,
    test_type: str | None,
    subject_by_question: dict[int, str] | None = None,
) -> list[ExtractedQuestion]:
    """The full extraction step for one paired (exam, answer_key)
    document: parses both PDFs, cross-references them by question
    number, and classifies each question as valid or needs_attention.
    Never uses an LLM to patch a badly-extracted question — a structural
    problem is flagged, not fixed.
    """
    blocks = extract_exam_text(exam_pdf_path)
    answers_by_type = extract_answer_key(answer_key_pdf_path)
    answers = answers_by_type.get(test_type, answers_by_type.get(None, {}))

    questions: list[ExtractedQuestion] = []
    numbers = sorted(blocks.keys())

    for offset, number in enumerate(numbers):
        warnings: list[str] = []

        # Sequential-without-gaps relative to the FIRST number found —
        # never assumes numbering starts at 1: a single bloco of a
        # multi-bloco Cebraspe exam legitimately starts wherever the
        # previous bloco left off (see build_extracted_items).
        expected = numbers[0] + offset
        if number != expected:
            warnings.append(f"numeração não sequencial: esperado {expected}, encontrado {number}")

        statement, alternatives = _split_statement_and_alternatives(blocks[number])

        if not statement:
            warnings.append("enunciado vazio após extração")

        missing_letters = [l for l in EXPECTED_ALTERNATIVES if l not in alternatives or not alternatives[l]]
        if missing_letters:
            warnings.append(f"alternativas ausentes ou vazias: {', '.join(missing_letters)}")

        if number not in answers:
            warnings.append("questão não encontrada no gabarito oficial")
            annulled = False
            official_answer = None
        else:
            official_answer = answers[number]
            annulled = official_answer is None

        official_answer_text = None
        if official_answer is not None:
            official_answer_text = alternatives.get(official_answer)
            if official_answer_text is None:
                warnings.append(f"gabarito aponta letra {official_answer!r}, ausente nas alternativas extraídas")
        elif not annulled and number in answers:
            # answers[number] is None and number is present -> genuinely annulled, nothing to warn about.
            pass

        status = "needs_attention" if warnings else "valid"

        questions.append(
            ExtractedQuestion(
                question_number=number,
                subject=(subject_by_question or {}).get(number),
                statement=statement,
                alternatives=[{"letter": l, "text": alternatives.get(l, "")} for l in EXPECTED_ALTERNATIVES],
                official_answer=official_answer,
                official_answer_text=official_answer_text,
                annulled=annulled,
                status=status,
                warnings=warnings,
            )
        )

    return questions


# --- Cebraspe-style Certo/Errado items -----------------------------------
#
# A genuinely different question shape, not just a different PDF layout:
# an "item" is a bare assertion ("Julgue os itens subsequentes... 97 Uma
# empresa que realiza...") with NO printed alternatives at all — the
# candidate marks Certo or Errado. Modeled as an ExtractedQuestion with
# alternatives fixed to CE_ALTERNATIVES, so every downstream module
# (validation, dedup, firestore_sync) needs no board-specific branch.
#
# Verified against a real PF/2025 (Cebraspe) exam, Cargo 16 — Conhecimentos
# Específicos, Bloco III, items 97-120, cross-referenced against its real
# definitive gabarito: 21/24 items extracted cleanly. The remaining 3
# (118-120) sit on a page whose layout switches from two columns to one
# column partway through — this module's column-cropping (borrowed as-is
# from extract_exam_text/_column_text) assumes a page is two columns
# throughout, so a page that isn't corrupts the tail of whatever landed in
# the wrong half. This is a KNOWN, NOT YET SOLVED gap (see the module's
# closing note) — those 3 items come out short/truncated and are expected
# to fail validation (empty or clearly incomplete statement) rather than
# silently look valid.


def extract_item_text(pdf_path: Path | str) -> dict[int, str]:
    """Returns {item_number: raw_assertion_text} — analogous to
    extract_exam_text, but split on an inline item-number PREFIX
    ("97 Uma empresa...") instead of a bare number line, since Cebraspe
    never gives an item its own line.
    """
    parts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            parts.extend(_column_text(page))
    full_text = "\n".join(parts)

    pieces = RE_ITEM_NUMBER_PREFIX.split("\n" + full_text)
    items: dict[int, str] = {}
    for i in range(1, len(pieces), 2):
        number = int(pieces[i])
        text = pieces[i + 1] if i + 1 < len(pieces) else ""
        items.setdefault(number, text)
    return items


def _item_assertion_text(raw_text: str) -> str:
    """An item is reliably ONE sentence — unlike an A-E alternative
    (which may legitimately be a short multi-clause fragment, handled by
    _truncate_trailing_heading's "last period" logic), so the boundary
    here is the FIRST terminal punctuation, full stop. Anything after it
    (a bleeding page footer/header, an accounting table, the next shared
    "julgue os itens..." instruction paragraph) is never part of THIS
    item's own assertion.
    """
    match = RE_TERMINAL_PUNCTUATION.search(raw_text)
    if not match:
        return raw_text
    return raw_text[: match.end()]


def build_extracted_items(
    exam_pdf_path: Path | str,
    answer_key_pdf_path: Path | str,
    test_type: str | None,
    subject_by_item: dict[int, str] | None = None,
) -> list[ExtractedQuestion]:
    """The Certo/Errado counterpart to build_extracted_questions. Each
    ExtractedQuestion's alternatives are always exactly
    [{"letter": "C", "text": "Certo"}, {"letter": "E", "text": "Errado"}]
    — never printed in the source PDF, but modeled this way so every
    existing downstream check (an official_answer must exist among the
    alternatives, etc.) applies unchanged.
    """
    raw_items = extract_item_text(exam_pdf_path)
    answers_by_type = extract_answer_key(answer_key_pdf_path)
    answers = answers_by_type.get(test_type, answers_by_type.get(None, {}))

    ce_alternatives = [{"letter": "C", "text": "Certo"}, {"letter": "E", "text": "Errado"}]

    items: list[ExtractedQuestion] = []
    numbers = sorted(raw_items.keys())

    for offset, number in enumerate(numbers):
        warnings: list[str] = []

        expected = numbers[0] + offset
        if number != expected:
            warnings.append(f"numeração não sequencial: esperado {expected}, encontrado {number}")

        statement = _normalize_whitespace(_item_assertion_text(raw_items[number]))

        if not statement:
            warnings.append("enunciado vazio após extração")
        elif not RE_TERMINAL_PUNCTUATION.search(raw_items[number]):
            # No terminal punctuation was found AT ALL in the raw item —
            # the assertion almost certainly got cut short (e.g. the
            # single/two-column layout-detection gap noted above).
            warnings.append("item sem pontuação final — provável corte na extração")

        if number not in answers:
            warnings.append("item não encontrado no gabarito oficial")
            annulled = False
            official_answer = None
        else:
            official_answer = answers[number]
            annulled = official_answer is None
            if official_answer is not None and official_answer not in CE_ALTERNATIVES:
                warnings.append(f"gabarito aponta letra {official_answer!r}, fora de C/E")

        official_answer_text = "Certo" if official_answer == "C" else "Errado" if official_answer == "E" else None

        status = "needs_attention" if warnings else "valid"

        items.append(
            ExtractedQuestion(
                question_number=number,
                subject=(subject_by_item or {}).get(number),
                statement=statement,
                alternatives=[dict(a) for a in ce_alternatives],
                official_answer=official_answer,
                official_answer_text=official_answer_text,
                annulled=annulled,
                status=status,
                warnings=warnings,
            )
        )

    return items
