from __future__ import annotations

import hashlib

import pytest

from exam_discovery import catalog, download
from exam_discovery.base import SourceUnsupportedError
from exam_discovery.models import DiscoveredDocument


def _doc(url: str, title: str = "Tipo 1") -> DiscoveredDocument:
    return DiscoveredDocument(
        source_url=url, download_url=url, discovered_at="2026-01-01T00:00:00Z",
        board="FGV", institution="PCMG", exam_name="Concurso PCMG 2024",
        role="Investigador de Polícia I", year=2024, test_type="1",
        document_type="exam", title=title,
    )


class _FakeResponse:
    def __init__(self, body: bytes, content_type: str = "application/pdf", status: int = 200):
        self._body = body
        self._pos = 0
        self.status = status
        self.headers = {"Content-Type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self, n=-1):
        if n < 0:
            chunk, self._pos = self._body[self._pos :], len(self._body)
            return chunk
        chunk = self._body[self._pos : self._pos + n]
        self._pos += len(chunk)
        return chunk


def _patch_urlopen(monkeypatch, body: bytes, **kwargs):
    monkeypatch.setattr(download.urllib.request, "urlopen", lambda *a, **k: _FakeResponse(body, **kwargs))


def test_download_computes_sha256_and_caches_file(tmp_path, monkeypatch):
    conn = catalog.connect(tmp_path / "cat.db")
    doc = _doc("https://x.fgv.br/prova.pdf")
    catalog.upsert_discovered(conn, doc)

    body = b"%PDF-1.4 fake content"
    _patch_urlopen(monkeypatch, body)

    result = download.download_document(doc, conn, cache_dir=tmp_path / "cache")
    assert result.sha256 == hashlib.sha256(body).hexdigest()
    assert result.already_cached is False

    from pathlib import Path

    assert Path(result.path).read_bytes() == body
    row = catalog.get_by_download_url(conn, doc.download_url)
    assert row["status"] == "downloaded"
    assert row["sha256"] == result.sha256


def test_second_download_of_same_url_is_cached_no_network_call(tmp_path, monkeypatch):
    conn = catalog.connect(tmp_path / "cat.db")
    doc = _doc("https://x.fgv.br/prova.pdf")
    catalog.upsert_discovered(conn, doc)

    calls = []

    def _tracked_urlopen(*a, **k):
        calls.append(1)
        return _FakeResponse(b"%PDF-1.4 content")

    monkeypatch.setattr(download.urllib.request, "urlopen", _tracked_urlopen)

    first = download.download_document(doc, conn, cache_dir=tmp_path / "cache")
    second = download.download_document(doc, conn, cache_dir=tmp_path / "cache")

    assert len(calls) == 1  # network only hit once
    assert first.already_cached is False
    assert second.already_cached is True
    assert first.sha256 == second.sha256


def test_two_urls_with_identical_bytes_share_one_cached_file(tmp_path, monkeypatch):
    conn = catalog.connect(tmp_path / "cat.db")
    doc_a = _doc("https://x.fgv.br/a.pdf", title="A")
    doc_b = _doc("https://x.fgv.br/b.pdf", title="B")
    catalog.upsert_discovered(conn, doc_a)
    catalog.upsert_discovered(conn, doc_b)

    body = b"%PDF-1.4 identical bytes"
    _patch_urlopen(monkeypatch, body)

    result_a = download.download_document(doc_a, conn, cache_dir=tmp_path / "cache")
    result_b = download.download_document(doc_b, conn, cache_dir=tmp_path / "cache")

    assert result_a.sha256 == result_b.sha256
    assert result_a.path == result_b.path  # same file on disk, not duplicated


def test_download_rejects_non_pdf_content_type(tmp_path, monkeypatch):
    conn = catalog.connect(tmp_path / "cat.db")
    doc = _doc("https://x.fgv.br/prova.html")
    catalog.upsert_discovered(conn, doc)
    _patch_urlopen(monkeypatch, b"<html>not a pdf</html>", content_type="text/html")

    with pytest.raises(SourceUnsupportedError):
        download.download_document(doc, conn, cache_dir=tmp_path / "cache")


def test_download_rejects_oversized_pdf(tmp_path, monkeypatch):
    conn = catalog.connect(tmp_path / "cat.db")
    doc = _doc("https://x.fgv.br/huge.pdf")
    catalog.upsert_discovered(conn, doc)

    monkeypatch.setattr(download, "_MAX_PDF_BYTES", 10)
    _patch_urlopen(monkeypatch, b"%PDF-1.4 this is way more than ten bytes")

    with pytest.raises(SourceUnsupportedError):
        download.download_document(doc, conn, cache_dir=tmp_path / "cache")
