from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field


@dataclass
class ParsedAlternative:
    letter: str
    text: str
    is_correct: bool
    position: int

    def to_dict(self) -> dict:
        return {
            "letter": self.letter,
            "text": self.text,
            "isCorrect": self.is_correct,
            "position": self.position,
        }


@dataclass
class ParsedQuestion:
    source: str
    external_id: str
    number: int
    question_type: str
    statement: str
    alternatives: list[ParsedAlternative]
    correct_letter: str | None
    explanation: str
    source_page: int
    subject_raw: str | None = None
    topic_raw: str | None = None
    warnings: list[str] = field(default_factory=list)
    # Optional, source-specific metadata (e.g. worker/parsers/direto_ao_ponto.py).
    # fc_concursos.py never sets these, so they stay None there and this is a
    # purely additive change — no existing behavior changes.
    exam_year: int | None = None
    exam_board: str | None = None
    organization: str | None = None
    position: str | None = None

    @property
    def content_hash(self) -> str:
        return content_hash(self.statement)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "externalId": self.external_id,
            "number": self.number,
            "questionType": self.question_type,
            "subjectRaw": self.subject_raw,
            "topicRaw": self.topic_raw,
            "statement": self.statement,
            "alternatives": [a.to_dict() for a in self.alternatives],
            "correctLetter": self.correct_letter,
            "explanation": self.explanation,
            "sourcePage": self.source_page,
            "contentHash": self.content_hash,
            "status": "needs_attention" if self.warnings else "pending_review",
            "warnings": self.warnings,
            "examYear": self.exam_year,
            "examBoard": self.exam_board,
            "organization": self.organization,
            "position": self.position,
        }


def normalize_for_hash(text: str) -> str:
    stripped = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", stripped).strip().lower()


def content_hash(statement: str) -> str:
    return hashlib.sha256(normalize_for_hash(statement).encode("utf-8")).hexdigest()
