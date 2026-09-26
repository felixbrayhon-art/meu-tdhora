from __future__ import annotations

from exam_discovery import catalog
from exam_discovery.models import DiscoveredDocument


def _doc(url="https://x.fgv.br/files/concursos/prova-tipo-1.pdf", **overrides) -> DiscoveredDocument:
    fields = dict(
        source_url=url,
        download_url=url,
        discovered_at="2026-01-01T00:00:00Z",
        board="FGV",
        institution="PCMG",
        exam_name="Concurso PCMG 2024",
        role="Investigador de Polícia I",
        year=2024,
        test_type="1",
        document_type="exam",
        title="Tipo 1",
    )
    fields.update(overrides)
    return DiscoveredDocument(**fields)


def test_upsert_new_document_inserts_and_returns_true(tmp_path):
    conn = catalog.connect(tmp_path / "cat.db")
    inserted = catalog.upsert_discovered(conn, _doc())
    assert inserted is True
    row = catalog.get_by_download_url(conn, _doc().download_url)
    assert row is not None
    assert row["status"] == "discovered"


def test_upsert_known_document_is_a_no_op_and_returns_false(tmp_path):
    conn = catalog.connect(tmp_path / "cat.db")
    catalog.upsert_discovered(conn, _doc())
    catalog.set_status(conn, _doc().download_url, "processed")

    inserted_again = catalog.upsert_discovered(conn, _doc())
    assert inserted_again is False

    # Re-discovering it must NEVER downgrade a document that already
    # progressed further (e.g. back to "discovered").
    row = catalog.get_by_download_url(conn, _doc().download_url)
    assert row["status"] == "processed"


def test_set_downloaded_records_sha256_and_path(tmp_path):
    conn = catalog.connect(tmp_path / "cat.db")
    catalog.upsert_discovered(conn, _doc())
    catalog.set_downloaded(conn, _doc().download_url, "abc123", "/tmp/x.pdf")
    row = catalog.get_by_download_url(conn, _doc().download_url)
    assert row["status"] == "downloaded"
    assert row["sha256"] == "abc123"
    assert row["download_path"] == "/tmp/x.pdf"


def test_get_by_sha256_finds_a_downloaded_document(tmp_path):
    conn = catalog.connect(tmp_path / "cat.db")
    catalog.upsert_discovered(conn, _doc())
    catalog.set_downloaded(conn, _doc().download_url, "shahash", "/tmp/x.pdf")
    row = catalog.get_by_sha256(conn, "shahash")
    assert row is not None
    assert row["source_url"] == _doc().download_url


def test_list_documents_filters_by_status(tmp_path):
    conn = catalog.connect(tmp_path / "cat.db")
    catalog.upsert_discovered(conn, _doc(url="https://x.fgv.br/a.pdf"))
    catalog.upsert_discovered(conn, _doc(url="https://x.fgv.br/b.pdf"))
    catalog.set_status(conn, "https://x.fgv.br/a.pdf", "needs_attention")

    discovered = catalog.list_documents(conn, status="discovered")
    attention = catalog.list_documents(conn, status="needs_attention")
    assert [r["source_url"] for r in discovered] == ["https://x.fgv.br/b.pdf"]
    assert [r["source_url"] for r in attention] == ["https://x.fgv.br/a.pdf"]
