from __future__ import annotations

from dataclasses import dataclass, field

# Shared vocabulary for the whole exam_discovery pipeline. No AI, no
# guessing anywhere in this package — every classification here comes
# from a deterministic match against a link's own text/href/surrounding
# metadata (see exam_discovery/fgv.py), never from visual position or a
# model's judgment.

DOCUMENT_TYPES = ("exam", "answer_key_preliminary", "answer_key_final")

# Mirrors worker/exam_discovery/catalog.py's `documents` table. A document
# moves through these states roughly in order, except "duplicate" and
# "needs_attention"/"failed", which are terminal off-ramps.
DOCUMENT_STATUSES = (
    "discovered",
    "downloaded",
    "waiting_final_key",
    "ready",
    "processed",
    "needs_attention",
    "duplicate",
    "failed",
)


@dataclass
class ExamSourceConfig:
    """One explicitly configured page to check for new documents — the
    registry (worker/exam_discovery/registry.py) holds a short, curated
    list of these. Discovery never crawls beyond the configured pages
    themselves; it only follows the document links found ON them.
    """

    board: str  # e.g. "FGV" — must match a key in registry.PROVIDERS
    institution: str  # e.g. "PCMG"
    exam_name: str  # e.g. "Concurso PCMG 2024"
    url: str  # the page to fetch and parse
    year: int | None = None  # the concurso's own year (from its edital/URL), not inferred from page content
    key: str = ""  # short id for logs/tests; defaults to institution if empty

    def __post_init__(self) -> None:
        if not self.key:
            self.key = self.institution


@dataclass
class DiscoveredDocument:
    """One document (a PDF, almost always) found on a configured source
    page, with everything needed to download it, classify it, and pair
    it with its counterpart later — nothing here is inferred beyond what
    the page itself states.
    """

    source_url: str  # the page it was found on
    download_url: str  # the direct link to the file
    discovered_at: str  # ISO 8601 timestamp of this discovery run
    board: str
    institution: str
    exam_name: str
    role: str | None  # e.g. "Investigador de Polícia I"; None if the page doesn't split by role
    year: int | None
    test_type: str | None  # e.g. "1", "2"... None for a document that isn't type-specific (most gabaritos)
    document_type: str  # one of DOCUMENT_TYPES
    title: str  # the link's own visible text — kept for audit/debugging
    published_at: str | None = None  # the page's own publication date for this item, if present

    def to_dict(self) -> dict:
        return {
            "sourceUrl": self.source_url,
            "downloadUrl": self.download_url,
            "discoveredAt": self.discovered_at,
            "board": self.board,
            "institution": self.institution,
            "examName": self.exam_name,
            "role": self.role,
            "year": self.year,
            "testType": self.test_type,
            "documentType": self.document_type,
            "title": self.title,
            "publishedAt": self.published_at,
        }


@dataclass
class DownloadResult:
    document: DiscoveredDocument
    path: str
    sha256: str
    size_bytes: int
    already_cached: bool  # True when this sha256 was already on disk — no network re-fetch happened


@dataclass
class ExamPair:
    """A deterministic match between one exam document (a specific
    board/institution/role/year/testType) and the answer-key document
    that governs it. `status` is "waiting_final_key" until an
    answer_key_final exists for the group — only "ready" pairs may ever
    reach Firestore.
    """

    board: str
    institution: str
    role: str | None
    year: int | None
    test_type: str | None
    exam_doc: DiscoveredDocument
    answer_key_doc: DiscoveredDocument | None
    status: str  # "ready" | "waiting_final_key" | "needs_attention"
    reason: str | None = None  # populated for "needs_attention"

    def to_dict(self) -> dict:
        return {
            "board": self.board,
            "institution": self.institution,
            "role": self.role,
            "year": self.year,
            "testType": self.test_type,
            "examDoc": self.exam_doc.to_dict(),
            "answerKeyDoc": self.answer_key_doc.to_dict() if self.answer_key_doc else None,
            "status": self.status,
            "reason": self.reason,
        }


@dataclass
class ExtractedQuestion:
    """One question pulled from an exam PDF and cross-referenced against
    its answer-key PDF. Mirrors worker/parsers/base.py's ParsedQuestion
    shape (statement/alternatives/correct_letter/content_hash) so it can
    reuse the exact same dedup hashing the rest of the project already
    relies on, plus the fields this pipeline additionally needs
    (annulled, the pair's own provenance).
    """

    question_number: int
    subject: str | None
    statement: str
    alternatives: list[dict]  # [{"letter": "A", "text": "..."}, ...]
    official_answer: str | None  # None when annulled
    official_answer_text: str | None
    annulled: bool
    status: str  # "valid" | "needs_attention" | "excluded"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "questionNumber": self.question_number,
            "subject": self.subject,
            "statement": self.statement,
            "alternatives": self.alternatives,
            "officialAnswer": self.official_answer,
            "officialAnswerText": self.official_answer_text,
            "annulled": self.annulled,
            "status": self.status,
            "warnings": self.warnings,
        }
