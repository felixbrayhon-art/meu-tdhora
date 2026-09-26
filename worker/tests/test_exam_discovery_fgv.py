from __future__ import annotations

import pytest

from exam_discovery.base import SourceUnsupportedError
from exam_discovery.fgv import FGVProvider, _extract_documents_from_html
from exam_discovery.models import ExamSourceConfig

SOURCE = ExamSourceConfig(
    board="FGV",
    institution="PCMG",
    exam_name="Concurso PCMG 2024 - Investigador de Polícia I",
    url="https://conhecimento.fgv.br/concursos/pcmg24/04",
    year=2024,
)


def _block(inner: str, published: str = "2025-01-27T12:00:00Z") -> str:
    return (
        '<div class="paragraph paragraph--type--texto-data paragraph--view-mode--default">'
        f'<time datetime="{published}" class="datetime">27/01/2025</time>'
        '<div class="field field--name-field-td-texto"><div class="field__item">'
        f"{inner}"
        "</div></div></div>"
    )


EXAM_BLOCK = _block(
    "<p><strong>Prova Objetiva</strong></p>"
    '<p class="Indent1"><strong>Investigador de Polícia I</strong></p>'
    '<p class="Indent2"><a href="https://x.fgv.br/files/concursos/prova-tipo-1.pdf">Tipo 1</a></p>'
    '<p class="Indent2"><a href="https://x.fgv.br/files/concursos/prova-tipo-2.pdf">Tipo 2</a></p>'
)
FINAL_KEY_BLOCK = _block(
    '<p><a href="https://x.fgv.br/files/concursos/gabarito-definitivo.pdf">'
    "<strong>Gabarito Oficial Definitivo da Prova Objetiva</strong></a></p>"
)
PRELIM_KEY_BLOCK = _block(
    '<p><a href="https://x.fgv.br/files/concursos/gabarito-preliminar.pdf">'
    "<strong>Gabarito Oficial Preliminar da Prova Objetiva</strong></a></p>"
)
# A results/recursos announcement whose text happens to CONTAIN "Prova
# Objetiva" as a substring, and whose link isn't even a PDF — must never
# be classified as an exam document.
NOISE_BLOCK = _block(
    '<p><a href="http://www50.fgv.br/ConsultaResultadoObjetivaV2.aspx?key=x">'
    "Relação Definitiva dos Candidatos Aprovados e Não Eliminados na Prova Objetiva</a></p>"
)


def test_discovers_exam_documents_with_test_type_and_role():
    html = f"<html><body>{EXAM_BLOCK}</body></html>"
    docs = _extract_documents_from_html(html, SOURCE, "2026-01-01T00:00:00Z")
    exam_docs = [d for d in docs if d.document_type == "exam"]
    assert {d.test_type for d in exam_docs} == {"1", "2"}
    assert all(d.role == "Investigador de Polícia I" for d in exam_docs)
    assert all(d.board == "FGV" and d.institution == "PCMG" and d.year == 2024 for d in exam_docs)


def test_discovers_final_answer_key():
    html = f"<html><body>{FINAL_KEY_BLOCK}</body></html>"
    docs = _extract_documents_from_html(html, SOURCE, "2026-01-01T00:00:00Z")
    assert len(docs) == 1
    assert docs[0].document_type == "answer_key_final"


def test_discovers_preliminary_answer_key():
    html = f"<html><body>{PRELIM_KEY_BLOCK}</body></html>"
    docs = _extract_documents_from_html(html, SOURCE, "2026-01-01T00:00:00Z")
    assert len(docs) == 1
    assert docs[0].document_type == "answer_key_preliminary"


def test_never_misclassifies_a_results_announcement_as_an_exam_document():
    html = f"<html><body>{NOISE_BLOCK}{EXAM_BLOCK}</body></html>"
    docs = _extract_documents_from_html(html, SOURCE, "2026-01-01T00:00:00Z")
    # Only the two real "Tipo N" PDFs from EXAM_BLOCK — the noise block's
    # non-PDF, non-exact-category-header link is dropped entirely.
    assert len(docs) == 2
    assert all(d.download_url.endswith(".pdf") for d in docs)


def test_unrelated_blocks_produce_no_documents():
    html = "<html><body>" + _block("<p>Comunicado qualquer sem provas nem gabaritos.</p>") + "</body></html>"
    docs = _extract_documents_from_html(html, SOURCE, "2026-01-01T00:00:00Z")
    assert docs == []


def test_fetch_page_rejects_non_200(monkeypatch):
    import exam_discovery.fgv as fgv_module

    class _FakeResponse:
        status = 404
        headers = {"Content-Type": "text/html"}

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(fgv_module.urllib.request, "urlopen", lambda *a, **k: _FakeResponse())
    with pytest.raises(SourceUnsupportedError):
        fgv_module.fetch_page("https://conhecimento.fgv.br/concursos/doesnotexist")


def test_fetch_page_rejects_non_html_content_type(monkeypatch):
    import exam_discovery.fgv as fgv_module

    class _FakeResponse:
        status = 200
        headers = {"Content-Type": "application/pdf"}

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self, n):
            return b"%PDF-1.4"

    monkeypatch.setattr(fgv_module.urllib.request, "urlopen", lambda *a, **k: _FakeResponse())
    with pytest.raises(SourceUnsupportedError):
        fgv_module.fetch_page("https://conhecimento.fgv.br/concursos/pcmg24/04")


def test_provider_discover_only_reads_configured_sources(monkeypatch):
    import exam_discovery.fgv as fgv_module

    calls = []

    def _fake_fetch(url):
        calls.append(url)
        return f"<html><body>{EXAM_BLOCK}</body></html>"

    monkeypatch.setattr(fgv_module, "fetch_page", _fake_fetch)
    provider = FGVProvider()
    docs = provider.discover([SOURCE])
    assert calls == [SOURCE.url]
    assert len(docs) == 2


def test_provider_propagates_source_unsupported_without_crashing_caller(monkeypatch):
    import exam_discovery.fgv as fgv_module

    def _boom(url):
        raise SourceUnsupportedError(f"{url}: blocked")

    monkeypatch.setattr(fgv_module, "fetch_page", _boom)
    provider = FGVProvider()
    with pytest.raises(SourceUnsupportedError):
        provider.discover([SOURCE])
