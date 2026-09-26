from __future__ import annotations

import re
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser

from .base import ExamProvider, SourceUnsupportedError
from .models import DiscoveredDocument, ExamSourceConfig

# FGV's "conhecimento.fgv.br/concursos/<slug>" pages publish each exam
# announcement as a "paragraph--type--texto-data" block: a <time> element
# (the item's own publication date) followed by a short, consistently
# indented list of <p> lines — a plain category line ("Prova Objetiva" or
# a gabarito title, sometimes itself the link), an "Indent1" role line,
# and "Indent2" lines that are the actual "Tipo N" document links. This
# parser reads exactly that structure (via real tag/class/href/text —
# never coordinates or visual position) and ignores everything else on
# the page (news, comunicados, unrelated PDFs).
_UA = "Mozilla/5.0 (compatible; TDHoraExamDiscovery/1.0)"
_TIMEOUT_SECONDS = 20.0
_MAX_PAGE_BYTES = 8 * 1024 * 1024  # 8 MB — an HTML page has no business being bigger than this

_RE_TIPO = re.compile(r"tipo\s*(\d+)", re.IGNORECASE)


def _strip_accents_lower(text: str) -> str:
    import unicodedata

    stripped = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return stripped.lower()


class _Line:
    __slots__ = ("p_class", "text", "href")

    def __init__(self, p_class: str | None, text: str, href: str | None):
        self.p_class = p_class
        self.text = text
        self.href = href


class _TextoDataBlockParser(HTMLParser):
    """Collects every "paragraph--type--texto-data" block on the page as
    (published_at, [_Line, ...]). Deliberately narrow: only <time>,
    <p class="...">, <strong> and <a href> are tracked; anything else is
    structural noise this provider doesn't need.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[tuple[str | None, list[_Line]]] = []

        self._in_block_depth = 0  # >0 while inside a texto-data block's own div
        self._div_depth_at_block_start = 0
        self._div_depth = 0

        self._current_lines: list[_Line] = []
        self._current_published_at: str | None = None

        self._in_p = False
        self._p_class: str | None = None
        self._p_text_parts: list[str] = []
        self._p_href: str | None = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == "div":
            self._div_depth += 1
            classes = attrs_dict.get("class", "")
            if self._in_block_depth == 0 and "paragraph--type--texto-data" in classes:
                self._in_block_depth = 1
                self._div_depth_at_block_start = self._div_depth
                self._current_lines = []
                self._current_published_at = None
            elif self._in_block_depth > 0:
                self._in_block_depth += 1

        if not self._in_block_depth:
            return

        if tag == "time":
            dt = attrs_dict.get("datetime")
            if dt and self._current_published_at is None:
                self._current_published_at = dt

        if tag == "p":
            self._in_p = True
            self._p_class = attrs_dict.get("class")
            self._p_text_parts = []
            self._p_href = None

        if tag == "a" and self._in_p and self._p_href is None:
            href = attrs_dict.get("href")
            if href:
                self._p_href = href

    def handle_endtag(self, tag):
        if tag == "div":
            if self._in_block_depth and self._div_depth == self._div_depth_at_block_start:
                self.blocks.append((self._current_published_at, self._current_lines))
                self._in_block_depth = 0
            elif self._in_block_depth:
                self._in_block_depth -= 1
            self._div_depth -= 1

        if not self._in_block_depth:
            if tag == "p":
                self._in_p = False
            return

        if tag == "p" and self._in_p:
            text = re.sub(r"\s+", " ", "".join(self._p_text_parts)).strip()
            if text:
                self._current_lines.append(_Line(self._p_class, text, self._p_href))
            self._in_p = False

    def handle_data(self, data):
        if self._in_block_depth and self._in_p:
            self._p_text_parts.append(data)


def _is_pdf_url(url: str) -> bool:
    return url.split("?", 1)[0].split("#", 1)[0].lower().endswith(".pdf")


def _classify_category(text: str) -> str | None:
    """Classifies a line's own text. Deliberately strict about "exam":
    FGV's results/recursos announcements also contain the words "Prova
    Objetiva" inside a much longer sentence (e.g. "Relação Definitiva dos
    Candidatos Aprovados... na Prova Objetiva") — a substring match would
    misclassify those as exam documents. The real category header is
    always just the phrase itself, so this requires a near-exact match.
    Gabarito titles are the opposite case (the real title IS a longer,
    fairly fixed phrase), so those stay substring-matched — but any
    non-PDF link (a recursos portal, a results page) is rejected by the
    caller via _is_pdf_url regardless of what this returns.
    """
    normalized = _strip_accents_lower(text).strip()
    if normalized in ("prova objetiva", "prova"):
        return "exam"
    if "gabarito" in normalized and "definitivo" in normalized:
        return "answer_key_final"
    if "gabarito" in normalized and "preliminar" in normalized:
        return "answer_key_preliminary"
    return None


def _parse_year_from_source(source: ExamSourceConfig) -> int | None:
    return source.year


def _extract_documents_from_html(html: str, source: ExamSourceConfig, discovered_at: str) -> list[DiscoveredDocument]:
    parser = _TextoDataBlockParser()
    parser.feed(html)
    parser.close()

    documents: list[DiscoveredDocument] = []
    year = _parse_year_from_source(source)

    for published_at, lines in parser.blocks:
        current_category: str | None = None
        current_role: str | None = None

        for line in lines:
            # A self-contained document line: has BOTH a link and no
            # special indent class (the gabarito pattern: the category
            # title IS the link).
            if line.href and not line.p_class:
                doc_type = _classify_category(line.text)
                if doc_type is not None and _is_pdf_url(line.href):
                    documents.append(
                        DiscoveredDocument(
                            source_url=source.url,
                            download_url=line.href,
                            discovered_at=discovered_at,
                            board=source.board,
                            institution=source.institution,
                            exam_name=source.exam_name,
                            role=current_role,
                            year=year,
                            test_type=None,
                            document_type=doc_type,
                            title=line.text,
                            published_at=published_at,
                        )
                    )
                # Whether or not it was classifiable, a self-contained
                # link line doesn't change the running category/role.
                continue

            if not line.href and not line.p_class:
                current_category = _classify_category(line.text)
                current_role = None  # a new category line resets the role scope
                continue

            if line.p_class == "Indent1":
                current_role = line.text
                continue

            if line.p_class == "Indent2" and line.href and _is_pdf_url(line.href):
                if current_category == "exam":
                    m = _RE_TIPO.search(line.text)
                    test_type = m.group(1) if m else None
                    documents.append(
                        DiscoveredDocument(
                            source_url=source.url,
                            download_url=line.href,
                            discovered_at=discovered_at,
                            board=source.board,
                            institution=source.institution,
                            exam_name=source.exam_name,
                            role=current_role,
                            year=year,
                            test_type=test_type,
                            document_type="exam",
                            title=line.text,
                            published_at=published_at,
                        )
                    )
                elif current_category in ("answer_key_preliminary", "answer_key_final"):
                    m = _RE_TIPO.search(line.text)
                    test_type = m.group(1) if m else None
                    documents.append(
                        DiscoveredDocument(
                            source_url=source.url,
                            download_url=line.href,
                            discovered_at=discovered_at,
                            board=source.board,
                            institution=source.institution,
                            exam_name=source.exam_name,
                            role=current_role,
                            year=year,
                            test_type=test_type,
                            document_type=current_category,
                            title=line.text,
                            published_at=published_at,
                        )
                    )
                # else: an Indent2 link under an unrecognized/absent
                # category — skipped. Better to miss a document than to
                # mislabel it.
                continue

    return documents


def fetch_page(url: str) -> str:
    """GETs `url` with a bounded timeout and a hard size cap, and refuses
    anything that isn't a successful HTML response. Never executes
    downloaded content, never follows anything beyond normal HTTP
    redirects (which urllib itself limits).
    """
    request = urllib.request.Request(url, headers={"User-Agent": _UA})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", 200)
            if status != 200:
                raise SourceUnsupportedError(f"{url}: HTTP {status}")
            content_type = response.headers.get("Content-Type", "")
            if "html" not in content_type.lower():
                raise SourceUnsupportedError(f"{url}: unexpected Content-Type {content_type!r}")
            raw = response.read(_MAX_PAGE_BYTES + 1)
            if len(raw) > _MAX_PAGE_BYTES:
                raise SourceUnsupportedError(f"{url}: page exceeds {_MAX_PAGE_BYTES} bytes, refusing")
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
        raise SourceUnsupportedError(f"{url}: could not fetch page ({exc})") from exc

    encoding = response.headers.get_content_charset() or "utf-8"
    try:
        return raw.decode(encoding, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


class FGVProvider(ExamProvider):
    board = "FGV"

    def discover(self, sources: list[ExamSourceConfig]) -> list[DiscoveredDocument]:
        discovered_at = datetime.now(timezone.utc).isoformat()
        documents: list[DiscoveredDocument] = []

        for source in sources:
            if source.board != self.board:
                continue
            html = fetch_page(source.url)  # SourceUnsupportedError propagates to the caller per-source
            documents.extend(_extract_documents_from_html(html, source, discovered_at))

        return documents
