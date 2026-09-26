from __future__ import annotations

from dataclasses import dataclass

from .base import ExamProvider, SourceUnsupportedError
from .cebraspe import CebraspeProvider
from .fgv import FGVProvider
from .models import DiscoveredDocument, ExamSourceConfig

# The curated, explicit list of pages this pipeline is allowed to check.
# Adding a board means: write its provider (worker/exam_discovery/<board>.py
# implementing ExamProvider), register it in PROVIDERS below, and add its
# pages here — never implicit/unrestricted crawling. FGV and Cebraspe are
# implemented; vunesp.py/ibfc.py/aocp.py follow the same ExamProvider
# contract later.
SOURCES: list[ExamSourceConfig] = [
    ExamSourceConfig(
        board="FGV",
        institution="PCMG",
        exam_name="Concurso PCMG 2024 - Investigador de Polícia I",
        url="https://conhecimento.fgv.br/concursos/pcmg24/04",
        year=2024,
        key="pcmg24-investigador",
    ),
    ExamSourceConfig(
        board="Cebraspe",
        institution="PF",
        exam_name="Concurso PF 2025",
        # CebraspeProvider fetches this as a JSON API, not an HTML page —
        # see exam_discovery/cebraspe.py's module docstring.
        url="https://apis.cebraspe.org.br/cebraspe/eventos/PF_25",
        year=2025,
        key="pf25",
    ),
]

PROVIDERS: dict[str, ExamProvider] = {
    "FGV": FGVProvider(),
    "Cebraspe": CebraspeProvider(),
}


@dataclass
class DiscoveryOutcome:
    documents: list[DiscoveredDocument]
    # {source.key: error message} for every source a provider could not
    # read reliably this run — never silently dropped.
    unsupported: dict[str, str]


def discover_all(sources: list[ExamSourceConfig] | None = None) -> DiscoveryOutcome:
    """Runs discovery across every configured source, grouped by board so
    each provider only ever sees its own sources. A source whose provider
    raises SourceUnsupportedError is recorded in `unsupported` (with the
    reason) instead of aborting the whole run or being retried with a
    looser/fragile fallback.
    """
    sources = sources if sources is not None else SOURCES

    by_board: dict[str, list[ExamSourceConfig]] = {}
    for source in sources:
        by_board.setdefault(source.board, []).append(source)

    documents: list[DiscoveredDocument] = []
    unsupported: dict[str, str] = {}

    for board, board_sources in by_board.items():
        provider = PROVIDERS.get(board)
        if provider is None:
            for source in board_sources:
                unsupported[source.key] = f"no provider registered for board {board!r}"
            continue

        for source in board_sources:
            try:
                documents.extend(provider.discover([source]))
            except SourceUnsupportedError as exc:
                unsupported[source.key] = str(exc)

    return DiscoveryOutcome(documents=documents, unsupported=unsupported)
