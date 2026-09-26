from __future__ import annotations

from exam_discovery.dedup import pair_fingerprint, split_new_and_duplicate, statement_hash
from exam_discovery.models import DiscoveredDocument, ExamPair, ExtractedQuestion


def _question(number, statement) -> ExtractedQuestion:
    alts = [{"letter": l, "text": f"alt {l}"} for l in "ABCDE"]
    return ExtractedQuestion(
        question_number=number, subject=None, statement=statement, alternatives=alts,
        official_answer="A", official_answer_text="alt A", annulled=False, status="valid", warnings=[],
    )


def test_statement_hash_ignores_accents_case_and_whitespace():
    a = statement_hash("Qual é o crime  de  roubo?")
    b = statement_hash("qual e o crime de roubo?")
    assert a == b


def test_statement_hash_differs_for_different_statements():
    assert statement_hash("Enunciado A") != statement_hash("Enunciado B")


def _pair(test_type="1"):
    exam = DiscoveredDocument(
        source_url="x", download_url=f"x-{test_type}", discovered_at="2026-01-01T00:00:00Z",
        board="FGV", institution="PCMG", exam_name="Concurso", role="Investigador de Polícia I",
        year=2024, test_type=test_type, document_type="exam", title="t",
    )
    return ExamPair(
        board="FGV", institution="PCMG", role="Investigador de Polícia I", year=2024,
        test_type=test_type, exam_doc=exam, answer_key_doc=None, status="ready", reason=None,
    )


def test_pair_fingerprint_is_stable_for_same_inputs():
    assert pair_fingerprint(_pair("1")) == pair_fingerprint(_pair("1"))


def test_pair_fingerprint_differs_for_different_test_type():
    assert pair_fingerprint(_pair("1")) != pair_fingerprint(_pair("2"))


def test_split_new_and_duplicate_against_existing_hashes():
    q1 = _question(1, "Sobre o crime de roubo, é correto afirmar que...")
    q2 = _question(2, "Sobre o crime de furto, é correto afirmar que...")
    existing = {statement_hash(q1.statement)}

    new, duplicates = split_new_and_duplicate([q1, q2], existing_hashes=existing)

    assert [q.question_number for q in new] == [2]
    assert [q.question_number for q, _ in duplicates] == [1]


def test_split_new_and_duplicate_catches_duplicates_within_the_same_batch():
    # Same statement text appearing twice in the SAME list (e.g. two exam
    # "tipos" that happen to reuse a question) — the second occurrence
    # must be flagged even with an empty existing_hashes set.
    q1 = _question(1, "Mesmo enunciado, question A.")
    q2 = _question(15, "Mesmo enunciado, question A.")
    new, duplicates = split_new_and_duplicate([q1, q2], existing_hashes=set())
    assert [q.question_number for q in new] == [1]
    assert [q.question_number for q, _ in duplicates] == [15]


def test_split_new_and_duplicate_never_mutates_input_list():
    q1 = _question(1, "Enunciado único.")
    original = list([q1])
    split_new_and_duplicate([q1], existing_hashes=set())
    assert original == [q1]
