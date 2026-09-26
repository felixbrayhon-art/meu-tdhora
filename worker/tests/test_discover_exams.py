from __future__ import annotations

from exam_discovery import catalog
from exam_discovery.models import DiscoveredDocument
from scripts.discover_exams import build_pairs, run_discovery_and_download


def _fake_documents():
    return [
        DiscoveredDocument(
            source_url="https://x/page", download_url="https://x/tipo-1.pdf",
            discovered_at="2026-01-01T00:00:00Z", board="FGV", institution="PCMG",
            exam_name="Concurso PCMG 2024", role="Investigador de Polícia I", year=2024,
            test_type="1", document_type="exam", title="Tipo 1",
        ),
        DiscoveredDocument(
            source_url="https://x/page", download_url="https://x/gabarito-definitivo.pdf",
            discovered_at="2026-01-01T00:00:00Z", board="FGV", institution="PCMG",
            exam_name="Concurso PCMG 2024", role="Investigador de Polícia I", year=2024,
            test_type=None, document_type="answer_key_final", title="Gabarito Oficial Definitivo",
        ),
    ]


def _patch_discovery(monkeypatch, documents):
    import exam_discovery.registry as registry_module
    from exam_discovery.registry import DiscoveryOutcome

    monkeypatch.setattr(
        registry_module, "discover_all", lambda sources=None: DiscoveryOutcome(documents=documents, unsupported={})
    )


def _patch_download(monkeypatch):
    import scripts.discover_exams as discover_exams_module

    def _fake_download(doc, conn, cache_dir):
        catalog.set_downloaded(conn, doc.download_url, sha256=f"sha-{doc.download_url}", download_path=f"/tmp/{doc.title}.pdf")
        from exam_discovery.models import DownloadResult

        return DownloadResult(document=doc, path=f"/tmp/{doc.title}.pdf", sha256=f"sha-{doc.download_url}", size_bytes=1, already_cached=False)

    monkeypatch.setattr(discover_exams_module.download, "download_document", _fake_download)


def test_first_run_discovers_and_downloads_everything(tmp_path, monkeypatch):
    _patch_discovery(monkeypatch, _fake_documents())
    _patch_download(monkeypatch)

    conn = catalog.connect(tmp_path / "cat.db")
    result = run_discovery_and_download(conn, tmp_path / "cache")

    assert result["new_documents"] == 2
    assert result["downloaded_now"] == 2
    assert result["download_failures"] == []


def test_second_run_with_nothing_new_is_fully_idempotent(tmp_path, monkeypatch):
    _patch_discovery(monkeypatch, _fake_documents())
    _patch_download(monkeypatch)

    conn = catalog.connect(tmp_path / "cat.db")
    run_discovery_and_download(conn, tmp_path / "cache")

    # Second run: same documents rediscovered, but nothing NEW.
    result = run_discovery_and_download(conn, tmp_path / "cache")
    assert result["new_documents"] == 0
    assert result["downloaded_now"] == 0


def test_build_pairs_after_discovery_forms_a_ready_pair(tmp_path, monkeypatch):
    _patch_discovery(monkeypatch, _fake_documents())
    _patch_download(monkeypatch)

    conn = catalog.connect(tmp_path / "cat.db")
    run_discovery_and_download(conn, tmp_path / "cache")

    pairs = build_pairs(conn)
    assert len(pairs) == 1
    assert pairs[0].status == "ready"
    assert pairs[0].institution == "PCMG"
    assert pairs[0].test_type == "1"


def test_unsupported_source_is_reported_not_raised(tmp_path, monkeypatch):
    import exam_discovery.registry as registry_module
    from exam_discovery.registry import DiscoveryOutcome

    monkeypatch.setattr(
        registry_module, "discover_all",
        lambda sources=None: DiscoveryOutcome(documents=[], unsupported={"pcmg24-investigador": "HTTP 403"}),
    )
    conn = catalog.connect(tmp_path / "cat.db")
    result = run_discovery_and_download(conn, tmp_path / "cache")
    assert result["unsupported_sources"] == {"pcmg24-investigador": "HTTP 403"}
    assert result["new_documents"] == 0
