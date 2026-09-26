from __future__ import annotations

from exam_discovery.models import DiscoveredDocument
from exam_discovery.pairing import pair_documents


def _doc(document_type, test_type=None, role="Investigador de Polícia I", title=None, **overrides):
    fields = dict(
        source_url="https://x.fgv.br/page", download_url=f"https://x.fgv.br/{document_type}-{test_type}.pdf",
        discovered_at="2026-01-01T00:00:00Z", board="FGV", institution="PCMG",
        exam_name="Concurso PCMG 2024", role=role, year=2024, test_type=test_type,
        document_type=document_type, title=title or document_type,
    )
    fields.update(overrides)
    return DiscoveredDocument(**fields)


def test_exam_pairs_with_final_key_when_both_present():
    exam = _doc("exam", test_type="1")
    final = _doc("answer_key_final", test_type=None, download_url="https://x.fgv.br/final.pdf")
    pairs = pair_documents([exam, final])
    assert len(pairs) == 1
    assert pairs[0].status == "ready"
    assert pairs[0].answer_key_doc is final


def test_exam_with_only_preliminary_key_waits():
    exam = _doc("exam", test_type="1")
    prelim = _doc("answer_key_preliminary", test_type=None, download_url="https://x.fgv.br/prelim.pdf")
    pairs = pair_documents([exam, prelim])
    assert len(pairs) == 1
    assert pairs[0].status == "waiting_final_key"
    assert pairs[0].answer_key_doc is prelim


def test_preliminary_key_alone_never_releases_import_even_with_final_missing():
    exam = _doc("exam", test_type="1")
    prelim = _doc("answer_key_preliminary", test_type=None, download_url="https://x.fgv.br/prelim.pdf")
    pairs = pair_documents([exam, prelim])
    assert pairs[0].status != "ready"


def test_exam_with_no_answer_key_at_all_needs_attention():
    exam = _doc("exam", test_type="1")
    pairs = pair_documents([exam])
    assert pairs[0].status == "needs_attention"
    assert pairs[0].answer_key_doc is None


def test_testtype_specific_key_only_pairs_with_matching_testtype():
    exam1 = _doc("exam", test_type="1")
    exam2 = _doc("exam", test_type="2")
    key_for_1 = _doc(
        "answer_key_final", test_type="1", download_url="https://x.fgv.br/final-1.pdf"
    )
    pairs = pair_documents([exam1, exam2, key_for_1])
    by_type = {p.test_type: p for p in pairs}
    assert by_type["1"].status == "ready"
    assert by_type["1"].answer_key_doc is key_for_1
    # Tipo 2 has no matching-testType key and no generic (None) key either.
    assert by_type["2"].status == "needs_attention"


def test_ambiguous_multiple_final_keys_needs_attention():
    exam = _doc("exam", test_type="1")
    key_a = _doc("answer_key_final", test_type=None, download_url="https://x.fgv.br/final-a.pdf")
    key_b = _doc("answer_key_final", test_type=None, download_url="https://x.fgv.br/final-b.pdf")
    pairs = pair_documents([exam, key_a, key_b])
    assert pairs[0].status == "needs_attention"
    assert "ambiguous" in pairs[0].reason
    assert pairs[0].answer_key_doc is None


def test_generic_key_pairs_with_every_testtype_in_its_group():
    exam1 = _doc("exam", test_type="1")
    exam2 = _doc("exam", test_type="2")
    exam3 = _doc("exam", test_type="3")
    final = _doc("answer_key_final", test_type=None, download_url="https://x.fgv.br/final.pdf")
    pairs = pair_documents([exam1, exam2, exam3, final])
    assert all(p.status == "ready" for p in pairs)
    assert all(p.answer_key_doc is final for p in pairs)


def test_different_institutions_never_pair_across_groups():
    exam_pcmg = _doc("exam", test_type="1", institution="PCMG")
    final_other = _doc(
        "answer_key_final", test_type=None, institution="OUTRA", download_url="https://x.fgv.br/final-outra.pdf"
    )
    pairs = pair_documents([exam_pcmg, final_other])
    assert pairs[0].status == "needs_attention"
    assert pairs[0].answer_key_doc is None
