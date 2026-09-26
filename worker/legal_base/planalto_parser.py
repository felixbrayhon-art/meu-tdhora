from __future__ import annotations

import re

from .models import ParsedProvision
from .text_utils import normalize_whitespace

# Deterministic, regex-based parsing of the plain-text extraction of a
# planalto.gov.br "texto consolidado" page (Constituição, Código Penal,
# Código de Processo Penal — all three follow this same editorial format).
# No AI, no guessing: a paragraph block that doesn't match one of the
# patterns below (typically a marginal rubric like "Crime doloso" placed
# by the editor right before its inciso) is simply skipped, never merged
# into whatever provision came before or after it.

RE_ARTICLE = re.compile(
    r"^Art\.\s*(?P<num>\d+(?:-[A-Za-z])?)\s*(?:[ºo°])?\.?\s*[-–]?\s*(?P<rest>.*)$"
)
RE_PARAGRAFO_UNICO = re.compile(r"^Par[aá]grafo [uú]nico\.?\s*[-–]?\s*(?P<rest>.*)$", re.IGNORECASE)
RE_PARAGRAFO_NUM = re.compile(r"^§\s*(?P<num>\d+)\s*(?:[ºo°])?\.?\s*[-–]?\s*(?P<rest>.*)$")
RE_INCISO = re.compile(r"^(?P<num>[IVXLCDM]+)\s*[-–]\s*(?P<rest>.+)$")
RE_ALINEA = re.compile(r"^(?P<letter>[a-z])\)\s*(?P<rest>.+)$")

# Trailing legislative-history annotations the compiler (Planalto) adds
# inline — not part of the enacted norm's own text, stripped for clean,
# matchable content. Applied repeatedly since some lines carry two, e.g.
# "...pena.  (Incluído pela Lei nº X)  (Vigência)".
RE_TRAILING_ANNOTATION = re.compile(
    r"\s*\((?:[^()]*(?:Reda[cç][aã]o|Inclu[ií]do|Revogad[oa]|Vide|Vig[eê]ncia|Renumerad[oa])[^()]*)\)\s*$",
    re.IGNORECASE,
)


def _strip_annotations(text: str) -> str:
    while True:
        new_text = RE_TRAILING_ANNOTATION.sub("", text).strip()
        if new_text == text:
            return text
        text = new_text


def parse_planalto_text(raw_text: str) -> list[ParsedProvision]:
    text = normalize_whitespace(raw_text)
    # Planalto's HTML→text extraction puts one logical element (article,
    # paragraph, inciso, rubric...) per blank-line-separated block — this is
    # the same paragraph-block assumption worker/parsers/fc_concursos.py and
    # worker/parsers/direto_ao_ponto.py make about their own sources, just
    # applied to a much more regular, official-text format here.
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]

    provisions: list[ParsedProvision] = []
    current_article: str | None = None
    current_paragrafo: str | None = None
    current_inciso: str | None = None

    def emit(paragrafo: str | None, inciso: str | None, alinea: str | None, texto: str) -> None:
        texto = _strip_annotations(texto)
        if not texto:
            return
        if current_article is None:
            return
        provisions.append(
            ParsedProvision(
                artigo=current_article,
                texto=texto,
                paragrafo=paragrafo,
                inciso=inciso,
                alinea=alinea,
            )
        )

    for block in blocks:
        m = RE_ARTICLE.match(block)
        if m:
            current_article = m.group("num")
            current_paragrafo = None
            current_inciso = None
            emit(None, None, None, m.group("rest"))
            continue

        m = RE_PARAGRAFO_UNICO.match(block)
        if m:
            current_paragrafo = "único"
            current_inciso = None
            emit("único", None, None, m.group("rest"))
            continue

        m = RE_PARAGRAFO_NUM.match(block)
        if m:
            current_paragrafo = m.group("num")
            current_inciso = None
            emit(current_paragrafo, None, None, m.group("rest"))
            continue

        m = RE_INCISO.match(block)
        if m:
            current_inciso = m.group("num")
            emit(current_paragrafo, current_inciso, None, m.group("rest"))
            continue

        m = RE_ALINEA.match(block)
        if m:
            emit(current_paragrafo, current_inciso, m.group("letter"), m.group("rest"))
            continue

        # Anything else (marginal rubrics, section/title headers, the
        # signature block at the end of the document, etc.) is intentionally
        # not stored — see module docstring.

    return provisions
