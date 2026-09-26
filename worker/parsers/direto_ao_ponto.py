from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

import pdfplumber

from .base import ParsedAlternative, ParsedQuestion, content_hash

# Redesigned from a structural audit of a real "Direto ao Ponto: Promotorias"
# PDF (worker/pdfs/direito-penal/direito-penal-2026.pdf). Real layout facts
# that drive every decision below:
#
#   - "Questão" always starts its own line, but what follows is NOT fixed
#     position: sometimes year/banca/órgão/cargo are on separate lines,
#     sometimes all merged onto the "Questão ..." line itself, sometimes the
#     year/banca/órgão line comes BEFORE "Questão" rather than after.
#   - externalId is always a bare 6-10 digit line, always somewhere in the
#     opening region of the question (before the statement gets going).
#   - "Solução" always starts its own line, immediately followed by exactly
#     one "Gabarito:" line in one of several shapes: "Gabarito: E)",
#     "Gabarito: C) full text of the alternative", or bare "Gabarito: C" with
#     no parenthesis at all. A DIFFERENT label, "Gabarito definitivo da
#     banca: ...", can appear later in the same explanation and must never be
#     confused with the real one — only the line immediately after "Solução"
#     is ever consulted.
#   - Alternative letters (and, less often, the Gabarito line itself) are
#     sometimes rendered as a small left-margin badge that pdfplumber's line
#     extraction places roughly at the vertical MIDDLE of a wrapped
#     paragraph rather than at its start. When that happens there is no
#     reliable way to know, from text order alone, how many of the
#     surrounding lines belong to that alternative — so a question with any
#     such "bare" marker (no text on the same line as the letter) is
#     excluded rather than guessed at. Measured on the real PDF: 13 of 31
#     questions have zero bare markers and parse cleanly; 18 have at least
#     one and are excluded by this rule.
#
# No LLM/heuristic guessing anywhere — every field is either found by an
# explicit, testable pattern or left None with a warning.

RE_QUESTION_START = re.compile(r"^Quest(ã|a)o\b")
RE_QUESTION_PREFIX = re.compile(r"^Quest(ã|a)o\b\s*")
RE_YEAR_TOKEN = re.compile(r"^(19|20)\d{2}\b")
# Gate for "does this line, on its own, look like the start of a year/banca
# preamble" — used only to decide whether the single line immediately
# before a "Questão" trigger belongs to THIS question's metadata (see
# `parse_lines`). Deliberately strict (year must lead the line) so it can
# never mistake an ordinary sentence for metadata.
RE_YEAR_LED = re.compile(r"^(19|20)\d{2}\s")

RE_EXTERNAL_ID = re.compile(r"^\d{6,10}$")

RE_ALT_CLEAN = re.compile(r"^([A-Ea-e])\)\s*(\S.*)$")
RE_ALT_BARE = re.compile(r"^([A-Ea-e])\)\s*$")

RE_SOLUCAO = re.compile(r"^Solu(ç|c)(ã|a)o\s*$", re.IGNORECASE)
# ")" is optional — real variants include "Gabarito: E)", "Gabarito: C) full
# text" and bare "Gabarito: C" with no parenthesis at all. Anchored so that
# "Gabarito definitivo da banca: ..." (a different, later label) never
# matches — this pattern requires the colon immediately after "Gabarito".
RE_GABARITO = re.compile(r"^Gabarito:\s*([A-Ea-e])\)?")

MIN_YEAR = 2021
MAX_YEAR = 2026

# Deliberately literal, closed vocabularies — recognized by exact
# substring match, never inferred/guessed. Extend as new "Direto ao Ponto"
# volumes for other career tracks are processed.
KNOWN_POSITIONS = ["Promotor de Justiça"]
ORG_MARKER = "Ministério Público"

# How many lines after the "Questão" trigger to scan for
# metadata/externalId before giving up and starting the statement anyway.
PREAMBLE_LOOKAHEAD = 8

# Chrome-detection thresholds: a candidate header/footer string must repeat
# at least this often to be treated as real running chrome rather than a
# one-off coincidence.
MIN_CHROME_REPEATS = 3


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


RE_HEADER_SHAPE = re.compile(r"^\d+\.\s+\S.+$")
RE_FOOTER_SHAPE = re.compile(r"^(?P<prefix>.+?)\s+(?P<page>\d+)/(?P<total>\d+)$")


def _detect_repeating_chrome(
    raw_lines: list[str], num_pages: int, footer_total_pages: int | None = None
) -> tuple[str | None, str | None]:
    """Self-calibrates this document's own repeating chapter-header and
    page-footer strings by frequency, instead of hardcoding subject-specific
    text (e.g. never strips a line just because it contains "Direito
    Penal" — only an exact, frequently-repeating match is removed). Returns
    (header_line, footer_prefix); either can be None if nothing repeats
    often enough to be trusted as chrome.

    `num_pages` is how many pages were actually scanned (drives the
    repeat-count threshold below); `footer_total_pages` is the "N" a real
    footer's "page/N" suffix is expected to match and defaults to
    `num_pages` — they're only ever different in tests that reuse a real
    footer string (which says "/564", the real book's page count) inside a
    fixture with far fewer pages.
    """
    footer_total_pages = footer_total_pages if footer_total_pages is not None else num_pages
    header_candidates: Counter[str] = Counter()
    footer_candidates: Counter[str] = Counter()

    for raw in raw_lines:
        line = raw.strip()
        if not line:
            continue
        if RE_HEADER_SHAPE.match(line):
            header_candidates[line] += 1
        m = RE_FOOTER_SHAPE.match(line)
        if m and m.group("total") == str(footer_total_pages):
            footer_candidates[m.group("prefix")] += 1

    threshold = max(MIN_CHROME_REPEATS, num_pages // 4)

    header = None
    if header_candidates:
        text, count = header_candidates.most_common(1)[0]
        if count >= threshold:
            header = text

    footer_prefix = None
    if footer_candidates:
        prefix, count = footer_candidates.most_common(1)[0]
        if count >= threshold:
            footer_prefix = prefix

    return header, footer_prefix


def _denoise(
    raw_lines: list[str], page_no: int, header: str | None = None, footer_prefix: str | None = None
) -> list[tuple[str, int]]:
    footer_re = re.compile(rf"^{re.escape(footer_prefix)}\s+\d+/\d+$") if footer_prefix else None
    out: list[tuple[str, int]] = []
    for raw in raw_lines:
        line = raw.strip()
        if not line:
            continue
        if header is not None and line == header:
            continue
        if footer_re and footer_re.match(line):
            continue
        out.append((line, page_no))
    return out


def _extract_deck_metadata(first_page_lines: list[str]) -> DeckMetadata:
    title = first_page_lines[0] if first_page_lines else None
    return DeckMetadata(title=title, owner_name=None, owner_email=None, generated_at=None, bloco=None)


def _is_certo_errado(alternatives: list[ParsedAlternative]) -> bool:
    if len(alternatives) != 2:
        return False
    if {a.letter for a in alternatives} != {"A", "B"}:
        return False
    return all(re.match(r"^(certo|errado)\b", a.text, re.IGNORECASE) for a in alternatives)


def _extract_metadata_from_text(text: str) -> tuple[int | None, str | None, str | None, str | None]:
    """Extracts (exam_year, exam_board, organization, position) from a
    SINGLE preamble line's text — which may or may not have a leading
    "Questão" token, and may or may not have several fields merged onto it.
    Returns None for anything not found on this specific line; callers
    merge results across the handful of preamble lines they scan. Every
    extraction here is either an anchored regex match or an exact substring
    match against a closed vocabulary — never a guess.
    """
    working = RE_QUESTION_PREFIX.sub("", text).strip()

    exam_year = None
    year_match = RE_YEAR_TOKEN.match(working)
    if year_match:
        exam_year = int(year_match.group(0))
        working = working[year_match.end() :].strip()

    position = None
    for candidate in KNOWN_POSITIONS:
        idx = working.find(candidate)
        if idx != -1:
            position = candidate
            working = (working[:idx] + working[idx + len(candidate) :]).strip()
            break

    organization = None
    org_idx = working.find(ORG_MARKER)
    if org_idx != -1:
        organization = working[org_idx:].strip() or None
        working = working[:org_idx].strip()

    # exam_board is only ever "whatever text is left after removing a year
    # token" — an ordinary line of prose with no year, no org and no known
    # position must never be treated as banca text, or every line of the
    # statement would get misread as metadata and swallow the real
    # enunciado (this was a real bug: "Assinale a alternativa correta" was
    # being read back as exam_board before this guard was added).
    exam_board = (working or None) if year_match else None
    return exam_year, exam_board, organization, position


def _read_preamble(
    lines: list[str], lookback_text: str | None
) -> tuple[int | None, str | None, str | None, str | None, str | None, int]:
    """READ_PREAMBLE: scans a bounded window after the "Questão" trigger
    (plus, if present, the single line immediately before it — see
    `parse_lines`) for exam_year/exam_board/organization/position/
    externalId. Returns those five fields plus the offset (within `lines`)
    where the statement should start — i.e. right after the last line that
    contributed a recognized metadata field or the externalId.

    Metadata never comes from anywhere past this bounded preamble window —
    a "2025" that shows up later, inside the statement, an alternative, or
    the explanation, is never treated as the exam year (rule: exam_year is
    preamble-only, never inferred from jurisprudence/legislation/comments).
    """
    solucao_or_alt_offset = len(lines)
    for idx in range(1, len(lines)):
        if RE_SOLUCAO.match(lines[idx]) or RE_ALT_CLEAN.match(lines[idx]) or RE_ALT_BARE.match(lines[idx]):
            solucao_or_alt_offset = idx
            break
    scan_limit = min(len(lines), solucao_or_alt_offset, PREAMBLE_LOOKAHEAD)

    exam_year: int | None = None
    exam_board: str | None = None
    organization: str | None = None
    position: str | None = None
    external_id: str | None = None
    last_consumed_offset = 0  # offset 0 (the trigger line) is always excluded from the statement

    if lookback_text is not None:
        y, b, o, p = _extract_metadata_from_text(lookback_text)
        exam_year = exam_year if exam_year is not None else y
        exam_board = exam_board if exam_board is not None else b
        organization = organization if organization is not None else o
        position = position if position is not None else p

    for offset in range(0, scan_limit):
        line = lines[offset]
        if RE_EXTERNAL_ID.match(line):
            if external_id is None:
                external_id = line.strip()
                last_consumed_offset = offset
            continue
        y, b, o, p = _extract_metadata_from_text(line)
        if y is not None or b is not None or o is not None or p is not None:
            last_consumed_offset = offset
        exam_year = exam_year if exam_year is not None else y
        exam_board = exam_board if exam_board is not None else b
        organization = organization if organization is not None else o
        position = position if position is not None else p

    statement_start_offset = max(1, last_consumed_offset + 1)
    return exam_year, exam_board, organization, position, external_id, statement_start_offset


def _parse_block(block: list[tuple[str, int]], number: int, lookback_line: tuple[str, int] | None) -> ParsedQuestion:
    lines = [text for text, _ in block]
    pages = [page for _, page in block]
    warnings: list[str] = []
    source_page = pages[0]

    lookback_text = lookback_line[0] if lookback_line else None
    exam_year, exam_board, organization, position, external_id, i = _read_preamble(lines, lookback_text)

    if external_id is None:
        warnings.append("externalId não encontrado na região de abertura da questão")
        # Deterministic, content-derived fallback so dedup (which also keys
        # on contentHash independently) still works even without a real
        # externalId — never a value derived from parse order (page/number
        # aren't stable across re-extractions). The warning above still
        # excludes the question from drafts either way; this only matters
        # if that policy ever changes.
        external_id = f"contenthash-{content_hash(' '.join(lines[i:]))[:16]}"

    if exam_year is None:
        warnings.append("Ano não identificado no preâmbulo da questão")
    elif not (MIN_YEAR <= exam_year <= MAX_YEAR):
        warnings.append(f"Ano fora do intervalo permitido ({MIN_YEAR}-{MAX_YEAR}): {exam_year}")

    # READ_STATEMENT
    statement_lines: list[str] = []
    while i < len(lines) and not RE_ALT_CLEAN.match(lines[i]) and not RE_ALT_BARE.match(lines[i]) and not RE_SOLUCAO.match(lines[i]):
        statement_lines.append(lines[i])
        i += 1
    statement = " ".join(statement_lines).strip()

    # READ_ALTERNATIVES — a marker is only ever recognized here, up to
    # "Solução"; after that state is left, "A)"/"B)"/etc. in the
    # explanation is plain text (rule 3). A bare marker (letter with no
    # text on its own line) means the badge is very likely displaced from
    # its paragraph (see module docstring) — flagged, never reconstructed.
    alternatives: list[ParsedAlternative] = []
    current_letter: str | None = None
    current_text: list[str] = []
    orphan_lines: list[str] = []
    saw_bare_marker = False

    def flush_alternative() -> None:
        if current_letter is not None:
            alternatives.append(
                ParsedAlternative(
                    letter=current_letter.upper(),
                    text=" ".join(t for t in current_text if t.strip()).strip(),
                    is_correct=False,
                    position=len(alternatives),
                )
            )

    while i < len(lines) and not RE_SOLUCAO.match(lines[i]):
        clean_match = RE_ALT_CLEAN.match(lines[i])
        bare_match = RE_ALT_BARE.match(lines[i])
        if clean_match:
            flush_alternative()
            current_letter = clean_match.group(1)
            current_text = [clean_match.group(2)]
        elif bare_match:
            saw_bare_marker = True
            flush_alternative()
            current_letter = bare_match.group(1)
            current_text = []
        elif current_letter is None:
            orphan_lines.append(lines[i])
        else:
            current_text.append(lines[i])
        i += 1
    flush_alternative()

    if orphan_lines:
        warnings.append("Texto não atribuído a nenhuma alternativa antes do primeiro marcador")
    if saw_bare_marker:
        warnings.append(
            "Marcador de alternativa sem texto na própria linha — possível badge deslocado do parágrafo, "
            "bloco excluído por segurança (não reconstruído por adivinhação)"
        )

    # READ_SOLUTION
    if i < len(lines) and RE_SOLUCAO.match(lines[i]):
        i += 1
    else:
        warnings.append("Marcador 'Solução' não encontrado")

    correct_letter: str | None = None
    if i < len(lines) and RE_GABARITO.match(lines[i]):
        correct_letter = RE_GABARITO.match(lines[i]).group(1).upper()
        i += 1
    else:
        warnings.append("Linha 'Gabarito:' não encontrada")

    # FINALIZE — everything left is the explanation. Already denoised of
    # this document's real header/footer chrome at extraction time (see
    # `_detect_repeating_chrome`/`_denoise`), and already bounded to this
    # question alone since each block stops at the next "Questão" trigger.
    explanation = "\n".join(lines[i:]).strip()

    if not statement:
        warnings.append("Enunciado vazio")
    if len(alternatives) < 2:
        warnings.append(f"Apenas {len(alternatives)} alternativa(s) reconhecida(s)")
    letters = [a.letter for a in alternatives]
    if correct_letter and correct_letter not in letters:
        warnings.append(f"Gabarito '{correct_letter}' não corresponde a nenhuma alternativa extraída")
    if not explanation:
        warnings.append("Explicação vazia")

    for alt in alternatives:
        alt.is_correct = alt.letter == correct_letter

    question_type = "certo_errado" if _is_certo_errado(alternatives) else "multipla_escolha"

    return ParsedQuestion(
        source="direto_ao_ponto",
        external_id=external_id,
        number=number,
        question_type=question_type,
        subject_raw=None,
        topic_raw=None,
        statement=statement,
        alternatives=alternatives,
        correct_letter=correct_letter,
        explanation=explanation,
        source_page=source_page,
        warnings=warnings,
        exam_year=exam_year,
        exam_board=exam_board,
        organization=organization,
        position=position,
    )


def parse_lines(all_lines: list[tuple[str, int]]) -> tuple[DeckMetadata, list[ParsedQuestion]]:
    """Parses an already-denoised, page-tagged, continuous line stream (see
    `parse()`). Split out so tests can exercise the real
    boundary-detection/state-machine logic — including questions/comments
    spanning multiple pages, and metadata that precedes the "Questão"
    trigger — without needing an actual PDF file.
    """
    first_page_lines = [text for text, page_no in all_lines if page_no == 1]
    deck_metadata = _extract_deck_metadata(first_page_lines)

    texts = [text for text, _ in all_lines]
    start_indices = [i for i, text in enumerate(texts) if RE_QUESTION_START.match(text)]

    questions: list[ParsedQuestion] = []
    for k, start in enumerate(start_indices):
        raw_end = start_indices[k + 1] if k + 1 < len(start_indices) else len(all_lines)

        # If the line immediately before the NEXT trigger is itself that
        # next question's own year-led metadata (SEEK_QUESTION gate below),
        # exclude it from THIS block so it isn't consumed twice — once as
        # noise in this explanation, once as the next question's preamble.
        effective_end = raw_end
        if k + 1 < len(start_indices):
            next_start = start_indices[k + 1]
            if next_start > 0 and RE_YEAR_LED.match(texts[next_start - 1]):
                effective_end = next_start - 1

        lookback_line = None
        if start > 0 and RE_YEAR_LED.match(texts[start - 1]):
            lookback_line = all_lines[start - 1]

        block = all_lines[start:effective_end]
        questions.append(_parse_block(block, number=k + 1, lookback_line=lookback_line))

    return deck_metadata, questions


def parse(path: str) -> tuple[DeckMetadata, list[ParsedQuestion]]:
    raw_pages: list[tuple[int, list[str]]] = []
    with pdfplumber.open(path) as pdf:
        total_pages = len(pdf.pages)
        for index, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            raw_pages.append((index + 1, text.split("\n")))

    all_raw_lines = [line for _, lines in raw_pages for line in lines]
    header, footer_prefix = _detect_repeating_chrome(all_raw_lines, num_pages=total_pages)

    all_lines: list[tuple[str, int]] = []
    for page_no, lines in raw_pages:
        all_lines.extend(_denoise(lines, page_no, header=header, footer_prefix=footer_prefix))

    return parse_lines(all_lines)
