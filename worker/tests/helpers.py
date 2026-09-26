from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from parsers.base import ParsedAlternative, ParsedQuestion  # noqa: E402

# No real question content anywhere in these fixtures — every statement,
# alternative and explanation below is synthetic placeholder text.


def make_parsed_question(
    number: int = 1,
    external_id: str = "1001",
    letters: str = "ABCD",
    correct: str = "B",
    statement: str | None = None,
    explanation: str = "Explicacao de teste, texto sintetico sem dado real.",
    source: str = "fc_concursos",
    subject_raw: str = "Materia de Teste",
    topic_raw: str = "Assunto de Teste",
    warnings: list[str] | None = None,
    exam_year: int | None = None,
) -> ParsedQuestion:
    statement = statement or f"Enunciado sintetico de teste numero {number}, sem conteudo real."
    alternatives = [
        ParsedAlternative(letter=letter, text=f"Alternativa {letter} sintetica", is_correct=(letter == correct), position=i)
        for i, letter in enumerate(letters)
    ]
    return ParsedQuestion(
        source=source,
        external_id=external_id,
        number=number,
        question_type="multipla_escolha",
        subject_raw=subject_raw,
        topic_raw=topic_raw,
        statement=statement,
        alternatives=alternatives,
        correct_letter=correct,
        explanation=explanation,
        source_page=1,
        warnings=list(warnings) if warnings else [],
        exam_year=exam_year,
    )


class FakeSourceModule:
    """Stands in for worker/parsers/fc_concursos.py in tests — same
    `.parse(path) -> (deck_metadata, [ParsedQuestion, ...])` contract,
    without touching a real PDF.
    """

    def __init__(self, parsed_questions: list[ParsedQuestion], title: str = "Deck de teste"):
        self._deck_metadata = SimpleNamespace(title=title)
        self._parsed_questions = parsed_questions

    def parse(self, path: str):
        return self._deck_metadata, self._parsed_questions
