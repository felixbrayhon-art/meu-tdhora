from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

RAW_SOURCES_DIR = Path(__file__).resolve().parent / "raw_sources"

ADCT_MARKER = "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS"


@dataclass
class LegalSource:
    key: str
    diploma: str
    tipo: str
    numero: str
    fonte: str
    url_oficial: str
    raw_file: str
    # Only set for the Constituição Federal: when present, the raw text is
    # split at this literal marker into two independently-numbered sources
    # (both restart article numbering at 1, so they can't share one
    # `diploma` label without colliding) — the "corpo permanente" and the
    # ADCT, which is still officially part of the same constitutional text.
    split_marker: str | None = None
    split_diploma_after: str | None = None
    split_fonte_after: str | None = None


# Official, primary sources only (planalto.gov.br "texto consolidado" —
# the government's own consolidated/updated text, not a summary or a
# third-party course's rendering). No cursinho, blog or resumo used.
SOURCES: list[LegalSource] = [
    LegalSource(
        key="cf",
        diploma="Constituição Federal",
        tipo="Constituição",
        numero="1988",
        fonte="Constituição da República Federativa do Brasil de 1988",
        url_oficial="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
        raw_file="constituicao_federal_full.txt",
        split_marker=ADCT_MARKER,
        split_diploma_after="Constituição Federal - ADCT",
        split_fonte_after="Ato das Disposições Constitucionais Transitórias (ADCT) da Constituição de 1988",
    ),
    LegalSource(
        key="cp",
        diploma="Código Penal",
        tipo="Decreto-Lei",
        numero="2.848/1940",
        fonte="Código Penal (Decreto-Lei nº 2.848, de 7 de dezembro de 1940)",
        url_oficial="https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
        raw_file="codigo_penal.txt",
    ),
    LegalSource(
        key="cpp",
        diploma="Código de Processo Penal",
        tipo="Decreto-Lei",
        numero="3.689/1941",
        fonte="Código de Processo Penal (Decreto-Lei nº 3.689, de 3 de outubro de 1941)",
        url_oficial="https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
        raw_file="codigo_processo_penal.txt",
    ),
    LegalSource(
        key="lia",
        diploma="Lei de Improbidade Administrativa",
        tipo="Lei",
        numero="8.429/1992",
        fonte="Lei de Improbidade Administrativa (Lei nº 8.429, de 2 de junho de 1992)",
        url_oficial="https://www.planalto.gov.br/ccivil_03/leis/l8429.htm",
        # Extracted from planalto's own compiled-text page, which shows
        # both the original (pre-2021) wording and the current one for
        # every amended article, the revoked original struck through
        # inline. The extraction step explicitly drops everything inside
        # <strike> before this file is written, so only the text
        # currently in force (post-Lei nº 14.230/2021) ends up here —
        # verified article-by-article (no duplicate "Art. N" headers, and
        # every amended article carries its "(Redação dada pela Lei nº
        # 14.230, de 2021)" annotation) before being wired in here.
        raw_file="lei_8429_1992.txt",
    ),
]


def read_raw_text(source: LegalSource) -> str:
    path = RAW_SOURCES_DIR / source.raw_file
    return path.read_text(encoding="utf-8")
