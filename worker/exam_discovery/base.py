from __future__ import annotations

from abc import ABC, abstractmethod

from .models import DiscoveredDocument, ExamSourceConfig


class SourceUnsupportedError(RuntimeError):
    """Raised by a provider when a configured source page can't be read
    reliably (blocked, unexpected shape, non-2xx, wrong content-type,
    ...). The caller (registry.discover_all) catches this per-source and
    records it rather than letting one bad source take down the whole
    discovery run — see the module docstring in registry.py.
    """


class ExamProvider(ABC):
    """One board's discovery adapter (worker/exam_discovery/fgv.py is the
    first). A provider ONLY reads configured pages (from `sources`,
    supplied by registry.py) and returns structured documents — it never
    downloads, imports, or writes anything, and never crawls beyond the
    pages it's explicitly given.
    """

    board: str

    @abstractmethod
    def discover(self, sources: list[ExamSourceConfig]) -> list[DiscoveredDocument]:
        """Returns every document found across `sources` (already
        filtered to this provider's own `board`). Raises
        SourceUnsupportedError for a page that can't be parsed reliably —
        never falls back to fragile heuristics or visual-position
        scraping to force a result out of it.
        """
        raise NotImplementedError
