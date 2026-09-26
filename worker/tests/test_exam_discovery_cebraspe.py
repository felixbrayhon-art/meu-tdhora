from __future__ import annotations

from exam_discovery.base import SourceUnsupportedError
from exam_discovery.cebraspe import CebraspeProvider, _classify_gabarito_entry, _role_for_cargo
from exam_discovery.models import ExamSourceConfig

SOURCE = ExamSourceConfig(
    board="Cebraspe",
    institution="PF",
    exam_name="Concurso PF 2025",
    url="https://apis.cebraspe.org.br/cebraspe/eventos/PF_25",
    year=2025,
)

# A trimmed-down but structurally real shape (field names/values match
# the actual apis.cebraspe.org.br/cebraspe/eventos/<slug> response —
# verified against real PF_25 and PC_PE_23 API responses in this
# session) — not a guess at the schema.
SAMPLE_EVENTO = {
    "eventoURL": "PF_25",
    "eventoNomeCompleto": "PF 25",
    "eventoAno": 2025,
    "eventoCargos": [
        {"idArea": "16", "area": "Cargo 16: Agente de Polícia Federal"},
        {"idArea": "01", "area": "Cargo 1: Delegado de Polícia Federal"},
    ],
    "arquivosGabarito": [
        {
            "nomeArquivo": "CDC24D454696C9FE260E6C50FE758707F322649AEE24B6FB664FDDA10E307BCF.pdf",
            "descricaoArquivo": "GABARITO DEFINITIVO – CONHECIMENTOS ESPECÍFICOS – CARGO 16",
            "dataArquivoObj": "2025-08-20T10:10:00",
        },
        {
            "nomeArquivo": "106_PF_016_01.pdf",
            "descricaoArquivo": "PROVA OBJETIVA – CONHECIMENTOS ESPECÍFICOS – CARGO 16",
            "dataArquivoObj": "2025-08-01T19:00:00",
        },
        {
            "nomeArquivo": "PROVA DISCURSIVA – CARGO 16.pdf",
            "descricaoArquivo": "PROVA DISCURSIVA – CARGO 16",
            "dataArquivoObj": "2025-07-29T19:00:00",
        },
        {
            "nomeArquivo": "0CDC7006.pdf",
            "descricaoArquivo": "PADRÃO DEFINITIVO DE RESPOSTA – PROVA DISCURSIVA – CARGO 16",
            "dataArquivoObj": "2025-08-20T15:00:00",
        },
        # The PC/PE-shaped bundle: exam text + preliminary key + inline
        # per-alternative justifications all in ONE file — deliberately
        # NOT importable by this pipeline yet (see extraction.py's
        # module docstring) and must never be discovered as a clean
        # "exam" or "answer_key_preliminary" document.
        {
            "nomeArquivo": "MATRIZ_COM_JUSTIFICATIVA.PDF",
            "descricaoArquivo": "PROVA OBJETIVA (P1) E GABARITO PRELIMINAR COM JUSTIFICATIVAS - CARGO 1",
            "dataArquivoObj": "2024-02-27T19:00:00",
        },
        {
            "nomeArquivo": "SUPERSEDED.PDF",
            "descricaoArquivo": "PROVA OBJETIVA (P1) E GABARITO PRELIMINAR COM JUSTIFICATIVAS - CARGO 2 - SEM EFEITO",
            "dataArquivoObj": "2024-03-05T19:00:00",
        },
    ],
}


def test_classify_definitive_gabarito():
    assert _classify_gabarito_entry("GABARITO DEFINITIVO – CONHECIMENTOS ESPECÍFICOS – CARGO 16") == "answer_key_final"


def test_classify_preliminary_gabarito():
    assert _classify_gabarito_entry("Gabarito Oficial Preliminar da Prova Objetiva") == "answer_key_preliminary"


def test_classify_plain_exam():
    assert _classify_gabarito_entry("PROVA OBJETIVA – CONHECIMENTOS ESPECÍFICOS – CARGO 16") == "exam"


def test_classify_excludes_com_justificativa_bundle_even_though_it_mentions_gabarito_and_preliminar():
    # This is the real, previously-found bug: a bundle description
    # contains "gabarito" AND "preliminar" too, and must NOT be
    # classified as a clean standalone answer_key_preliminary.
    result = _classify_gabarito_entry(
        "PROVA OBJETIVA (P1) E GABARITO PRELIMINAR COM JUSTIFICATIVAS - CARGO 1"
    )
    assert result is None


def test_classify_excludes_superseded_document():
    assert _classify_gabarito_entry("PROVA OBJETIVA ... SEM EFEITO") is None


def test_classify_excludes_discursive_documents():
    assert _classify_gabarito_entry("PROVA DISCURSIVA – CARGO 16") is None
    assert _classify_gabarito_entry("PADRÃO DEFINITIVO DE RESPOSTA – PROVA DISCURSIVA – CARGO 16") is None


def test_role_for_cargo_matches_by_id_area():
    cargos = [{"idArea": "16", "area": "Cargo 16: Agente de Polícia Federal"}]
    assert _role_for_cargo(cargos, "16") == "Cargo 16: Agente de Polícia Federal"


def test_role_for_cargo_returns_none_when_not_found():
    cargos = [{"idArea": "16", "area": "Cargo 16: Agente de Polícia Federal"}]
    assert _role_for_cargo(cargos, "99") is None


def test_provider_discovers_only_clean_exam_and_final_key(monkeypatch):
    import exam_discovery.cebraspe as cebraspe_module

    monkeypatch.setattr(cebraspe_module, "fetch_evento_json", lambda url: SAMPLE_EVENTO)

    provider = CebraspeProvider()
    docs = provider.discover([SOURCE])

    by_type = {d.document_type for d in docs}
    assert by_type == {"exam", "answer_key_final"}
    assert len(docs) == 2  # discursiva, justificativa-bundle and "sem efeito" all excluded


def test_provider_builds_correct_cdn_download_url(monkeypatch):
    import exam_discovery.cebraspe as cebraspe_module

    monkeypatch.setattr(cebraspe_module, "fetch_evento_json", lambda url: SAMPLE_EVENTO)

    provider = CebraspeProvider()
    docs = provider.discover([SOURCE])
    exam_doc = next(d for d in docs if d.document_type == "exam")
    assert exam_doc.download_url == "https://cdn.cebraspe.org.br/concursos/PF_25/arquivos/106_PF_016_01.pdf"


def test_provider_resolves_role_from_description(monkeypatch):
    import exam_discovery.cebraspe as cebraspe_module

    monkeypatch.setattr(cebraspe_module, "fetch_evento_json", lambda url: SAMPLE_EVENTO)

    provider = CebraspeProvider()
    docs = provider.discover([SOURCE])
    exam_doc = next(d for d in docs if d.document_type == "exam")
    assert exam_doc.role == "Cargo 16: Agente de Polícia Federal"
    assert exam_doc.year == 2025


def test_provider_uses_evento_ano_over_source_config_year(monkeypatch):
    import exam_discovery.cebraspe as cebraspe_module

    evento = dict(SAMPLE_EVENTO, eventoAno=1999)
    monkeypatch.setattr(cebraspe_module, "fetch_evento_json", lambda url: evento)

    provider = CebraspeProvider()
    docs = provider.discover([SOURCE])
    assert all(d.year == 1999 for d in docs)  # API's own eventoAno wins over the registry's year hint


def test_provider_raises_source_unsupported_on_non_json_response(monkeypatch):
    import exam_discovery.cebraspe as cebraspe_module

    class _FakeResponse:
        status = 200
        headers = {"Content-Type": "text/html"}

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self, n):
            return b"<html></html>"

    monkeypatch.setattr(cebraspe_module.urllib.request, "urlopen", lambda *a, **k: _FakeResponse())
    provider = CebraspeProvider()
    import pytest

    with pytest.raises(SourceUnsupportedError):
        provider.discover([SOURCE])


def test_provider_only_reads_configured_cebraspe_sources(monkeypatch):
    import exam_discovery.cebraspe as cebraspe_module

    calls = []

    def _fake_fetch(url):
        calls.append(url)
        return SAMPLE_EVENTO

    monkeypatch.setattr(cebraspe_module, "fetch_evento_json", _fake_fetch)

    other_board_source = ExamSourceConfig(
        board="FGV", institution="X", exam_name="Y", url="https://conhecimento.fgv.br/concursos/x"
    )
    provider = CebraspeProvider()
    provider.discover([SOURCE, other_board_source])
    assert calls == [SOURCE.url]  # never touched the FGV-board source
