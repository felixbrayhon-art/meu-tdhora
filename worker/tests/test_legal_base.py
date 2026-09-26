from __future__ import annotations

from legal_base.db import connect, reset_db
from legal_base.importer import build_legal_base
from legal_base.models import LegalProvisionRecord
from legal_base.planalto_parser import parse_planalto_text
from legal_base.search import get_article_text, search_legal_sources
from legal_base.sources import LegalSource

# Small, synthetic-but-format-faithful excerpts — real planalto.gov.br
# formatting quirks (non-breaking spaces, "Art. Nº -" vs "Art. N.", inline
# legislative-history annotations, marginal rubrics) reproduced deliberately
# so these tests exercise the actual parsing rules, not a simplified mock.
FAKE_CODE_TEXT = """Art. 1\xa0-\xa0Não há crime sem lei anterior que o defina. (Redação dada pela Lei nº 7.209, de 1984)

Art. 18 - Diz-se o crime: (Redação dada pela Lei nº 7.209, de 1984)

Crime doloso (Incluído pela Lei nº 7.209, de 1984)

I - doloso, quando o agente quis o resultado ou assumiu o risco de produzi-lo;(Incluído pela Lei nº 7.209, de 1984)

Crime culposo

II - culposo, quando o agente deu causa ao resultado por imprudência, negligência ou imperícia.

Parágrafo único - Salvo os casos expressos em lei, ninguém pode ser punido por fato previsto como crime, senão quando o pratica dolosamente.

Art. 121-A.\xa0Crime de perseguição, para fins de teste.
"""

FAKE_SOURCE = LegalSource(
    key="fake",
    diploma="Código de Teste",
    tipo="Decreto-Lei",
    numero="0000/0000",
    fonte="Código de Teste (Decreto-Lei nº 0000/0000)",
    url_oficial="https://www.planalto.gov.br/fake-teste.htm",
    raw_file="__unused__.txt",
)


def _build_fake_db(tmp_path, monkeypatch):
    db_path = tmp_path / "legal_test.db"
    monkeypatch.setattr("legal_base.importer.read_raw_text", lambda source: FAKE_CODE_TEXT)
    reset_db(db_path)
    conn = connect(db_path)
    counts = build_legal_base(conn, sources=[FAKE_SOURCE])
    conn.close()
    return db_path, counts


# --- 1. importação das normas ------------------------------------------------

def test_import_populates_expected_provision_count(tmp_path, monkeypatch):
    db_path, counts = _build_fake_db(tmp_path, monkeypatch)
    assert counts == {"Código de Teste": 6}  # art1 caput, art18 caput+I+II+§único, art121-A caput

    conn = connect(db_path)
    total = conn.execute("SELECT COUNT(*) FROM provisions").fetchone()[0]
    assert total == 6
    conn.close()


def test_import_is_idempotent_after_reset(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    # Rebuilding (reset + import again) must not accumulate duplicate rows.
    monkeypatch.setattr("legal_base.importer.read_raw_text", lambda source: FAKE_CODE_TEXT)
    reset_db(db_path)
    conn = connect(db_path)
    build_legal_base(conn, sources=[FAKE_SOURCE])
    total = conn.execute("SELECT COUNT(*) FROM provisions").fetchone()[0]
    conn.close()
    assert total == 6


# --- 2. separação de artigos --------------------------------------------------

def test_parser_separates_articles_and_sub_units():
    provisions = parse_planalto_text(FAKE_CODE_TEXT)
    art18 = [p for p in provisions if p.artigo == "18"]
    assert len(art18) == 4
    assert art18[0] == art18[0]  # caput
    assert art18[0].inciso is None and art18[0].paragrafo is None
    assert art18[0].texto == "Diz-se o crime:"

    incisos = [p for p in art18 if p.inciso]
    assert [p.inciso for p in incisos] == ["I", "II"]
    assert "assumiu o risco de produzi-lo" in incisos[0].texto
    # the marginal rubric "Crime doloso"/"Crime culposo" must never leak in
    assert "Crime doloso" not in incisos[0].texto
    assert "Crime culposo" not in incisos[1].texto

    paragrafo = next(p for p in art18 if p.paragrafo)
    assert paragrafo.paragrafo == "único"
    assert paragrafo.inciso is None


def test_parser_handles_hyphenated_inserted_article_number():
    provisions = parse_planalto_text(FAKE_CODE_TEXT)
    art121a = [p for p in provisions if p.artigo == "121-A"]
    assert len(art121a) == 1
    assert art121a[0].texto == "Crime de perseguição, para fins de teste."


def test_each_article_individually_retrievable(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    full = get_article_text("Código de Teste", "18", db_path=db_path)
    assert full is not None
    assert "Diz-se o crime:" in full
    assert "I - doloso" in full
    assert "II - culposo" in full
    assert "Parágrafo único." in full

    missing = get_article_text("Código de Teste", "999", db_path=db_path)
    assert missing is None


# --- 3. busca exata ------------------------------------------------------------

def test_exact_phrase_search_finds_verbatim_match(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    results = search_legal_sources(
        "não há crime sem lei anterior que o defina", limit=3, db_path=db_path
    )
    assert results, "esperava pelo menos um resultado"
    assert results[0]["artigo"] == "1"
    assert results[0]["match_type"] == "exact"


# --- 4. busca aproximada por termos --------------------------------------------

def test_keyword_fallback_finds_inflected_terms(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    # "produzir" never appears verbatim in the source text (which has
    # "produzi-lo") — this must still surface art. 18, I via the keyword/
    # prefix fallback tier, proving the mechanism isn't just exact-substring.
    results = search_legal_sources(
        "o agente assumiu o risco de produzir o resultado", limit=3, db_path=db_path
    )
    assert results
    top = results[0]
    assert top["artigo"] == "18"
    assert top["inciso"] == "I"
    assert top["match_type"] == "keyword"


# --- 5. filtros por diploma ------------------------------------------------------

def test_subject_filter_restricts_to_diploma(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    matching = search_legal_sources("crime", subject="Código de Teste", limit=5, db_path=db_path)
    assert matching
    assert all(r["diploma"] == "Código de Teste" for r in matching)

    non_matching = search_legal_sources("crime", subject="Código Inexistente", limit=5, db_path=db_path)
    assert non_matching == []


# --- 6. resultado sem correspondência --------------------------------------------

def test_no_match_returns_empty_list_not_error(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    results = search_legal_sources("xablauzinho inexistente panqueca quimica", limit=5, db_path=db_path)
    assert results == []


# --- 7. preservação da URL da fonte ----------------------------------------------

def test_source_url_and_metadata_preserved(tmp_path, monkeypatch):
    db_path, _ = _build_fake_db(tmp_path, monkeypatch)
    results = search_legal_sources("crime", limit=1, db_path=db_path)
    assert results
    r = results[0]
    assert r["url_oficial"] == FAKE_SOURCE.url_oficial
    assert r["fonte"] == FAKE_SOURCE.fonte
    assert r["data_de_coleta"]  # non-empty ISO date string


def test_record_referencia_formatting():
    record = LegalProvisionRecord(
        diploma="Código Penal", tipo="Decreto-Lei", numero="2.848/1940",
        artigo="18", paragrafo=None, inciso="I", alinea=None,
        texto="...", fonte="...", url_oficial="...", data_de_coleta="2026-01-01",
    )
    assert record.referencia() == "Código Penal, art. 18, inciso I"
