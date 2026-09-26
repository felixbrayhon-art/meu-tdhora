from __future__ import annotations

from legal_base.db import connect, reset_db
from legal_base.evidence_enrichment import (
    enrich_articles_when_coverage_incomplete,
    enrich_referenced_articles,
    enrich_with_full_articles,
)
from legal_base.importer import build_legal_base
from legal_base.sources import LegalSource

FAKE_TEXT = """Art. 5 - Todos são iguais perante a lei. (Redação dada pela Lei nº 1, de 1988)

VIII - ninguém será privado de direitos por motivo de crença religiosa, salvo se as invocar para eximir-se de obrigação legal a todos imposta e recusar-se a cumprir prestação alternativa, fixada em lei;

Art. 15 - É vedada a cassação de direitos políticos. (Redação dada pela Lei nº 1, de 1988)

IV - recusa de cumprir obrigação a todos imposta ou prestação alternativa, nos termos do art. 5º, VIII;

Art. 157 - Subtrair coisa alheia móvel, mediante grave ameaça.

§ 1º - Na mesma pena incorre quem logo depois de subtraída a coisa emprega violência.

§ 2º - A pena aumenta-se de um terço até metade se ocorrer alguma das seguintes circunstâncias:

VII - se a violência ou grave ameaça é exercida com emprego de arma branca;

§ 3º - Preclusa a decisão de desentranhamento, a prova será inutilizada por decisão judicial.
"""

FAKE_SOURCE = LegalSource(
    key="fake",
    diploma="Diploma de Teste",
    tipo="Decreto-Lei",
    numero="0000/0000",
    fonte="Diploma de Teste (Decreto-Lei nº 0000/0000)",
    url_oficial="https://www.planalto.gov.br/fake-teste.htm",
    raw_file="__unused__.txt",
)


def _build_fake_db(tmp_path, monkeypatch):
    db_path = tmp_path / "legal_test.db"
    monkeypatch.setattr("legal_base.importer.read_raw_text", lambda source: FAKE_TEXT)
    reset_db(db_path)
    conn = connect(db_path)
    build_legal_base(conn, sources=[FAKE_SOURCE])
    conn.close()
    return db_path


def _evidence(diploma, artigo, referencia, texto, **extra):
    return {
        "diploma": diploma,
        "artigo": artigo,
        "paragrafo": None,
        "inciso": None,
        "alinea": None,
        "referencia": referencia,
        "texto": texto,
        **extra,
    }


# --- enrich_with_full_articles: sub-division -> full article ---------------

def test_enrich_with_full_articles_widens_an_inciso_selection(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch)
    selected = [
        _evidence(
            "Diploma de Teste", "5", "Diploma de Teste, art. 5, inciso VIII",
            "ninguém será privado de direitos por motivo de crença religiosa...",
            inciso="VIII",
        )
    ]
    enriched = enrich_with_full_articles(selected, db_path=db_path)
    assert len(enriched) == 2
    assert enriched[0] is selected[0]  # original fine-grained row preserved
    full = enriched[1]
    assert full["is_article_context"] is True
    assert "Todos são iguais perante a lei" in full["texto"]
    assert "VIII" in full["texto"]


def test_enrich_with_full_articles_leaves_caput_only_selection_untouched(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch)
    selected = [_evidence("Diploma de Teste", "157", "Diploma de Teste, art. 157", "Subtrair coisa alheia móvel.")]
    enriched = enrich_with_full_articles(selected, db_path=db_path)
    # No paragrafo/inciso/alinea on the selected row -> nothing to widen.
    assert enriched == selected


# --- enrich_referenced_articles: follow explicit internal references -------

def test_enrich_referenced_articles_follows_explicit_citation(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch)
    selected = [
        _evidence(
            "Diploma de Teste", "15", "Diploma de Teste, art. 15, inciso IV",
            "recusa de cumprir obrigação a todos imposta ou prestação alternativa, nos termos do art. 5º, VIII;",
            inciso="IV",
        )
    ]
    enriched = enrich_referenced_articles(selected, db_path=db_path)
    assert len(enriched) == 2
    referenced = enriched[1]
    assert referenced["artigo"] == "5"
    assert referenced["origin"] == "internal_reference_context"
    assert "Todos são iguais perante a lei" in referenced["texto"]


def test_enrich_referenced_articles_does_not_duplicate_already_selected_article(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch)
    selected = [
        _evidence("Diploma de Teste", "15", "Diploma de Teste, art. 15", "recusa... nos termos do art. 5º, VIII;"),
        _evidence("Diploma de Teste", "5", "Diploma de Teste, art. 5", "Todos são iguais perante a lei."),
    ]
    enriched = enrich_referenced_articles(selected, db_path=db_path)
    assert len(enriched) == 2  # nothing new added — art. 5 was already there


# --- enrich_articles_when_coverage_incomplete -------------------------------

def test_coverage_gated_enrichment_pulls_sibling_paragraph(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch)
    # Only the caput (and a sibling inciso) were selected — § 3º was never
    # directly matched by any query, but it's needed for a missing claim.
    selected = [
        _evidence("Diploma de Teste", "157", "Diploma de Teste, art. 157", "Subtrair coisa alheia móvel."),
    ]
    enriched = enrich_articles_when_coverage_incomplete(selected, coverage_status="partial", db_path=db_path)
    assert len(enriched) == 2
    full = enriched[1]
    assert "Preclusa a decisão de desentranhamento" in full["texto"]  # § 3º text now present


def test_coverage_gated_enrichment_is_a_noop_when_already_complete(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch)
    selected = [_evidence("Diploma de Teste", "157", "Diploma de Teste, art. 157", "Subtrair coisa alheia móvel.")]
    enriched = enrich_articles_when_coverage_incomplete(selected, coverage_status="complete", db_path=db_path)
    assert enriched == selected  # no extra work when nothing is missing
