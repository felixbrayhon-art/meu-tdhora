from __future__ import annotations

from legal_base.db import connect, reset_db
from legal_base.evidence_compaction import (
    compact_evidence_for_generation,
    compact_sources,
    enforce_total_budget,
)
from legal_base.importer import build_legal_base
from legal_base.sources import LegalSource

# CF art. 5º-shaped fixture: a long article with many incisos, only one of
# which is actually relevant to the test query — mirrors the real Q38
# shape (78 incisos, one relevant) closely enough to exercise the same
# selection logic without needing the real 13k-char article in every test.
FAKE_CF_TEXT = """Art. 5 - Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:

I - homens e mulheres são iguais em direitos e obrigações, nos termos desta Constituição;

VIII - ninguém será privado de direitos por motivo de crença religiosa ou de convicção filosófica ou política, salvo se as invocar para eximir-se de obrigação legal a todos imposta e recusar-se a cumprir prestação alternativa, fixada em lei;

XII - é inviolável o sigilo da correspondência e das comunicações telegráficas, de dados e das comunicações telefônicas, salvo, no último caso, por ordem judicial;

XXXV - a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito;

LX - a lei só poderá restringir a publicidade dos atos processuais quando a defesa da intimidade ou o interesse social o exigirem;
"""

# CPP art. 157-shaped fixture: caput + 5 parágrafos, only caput and § 3º
# are relevant to the test query (mirrors real Q52's need).
FAKE_CPP_TEXT = """Art. 157 - São inadmissíveis, devendo ser desentranhadas do processo, as provas ilícitas, assim entendidas as obtidas em violação a normas constitucionais ou legais.

§ 1º São também inadmissíveis as provas derivadas das ilícitas, salvo quando não evidenciado o nexo de causalidade entre umas e outras.

§ 2º Considera-se fonte independente aquela que por si só, seguindo os trâmites típicos e de praxe, seria capaz de conduzir ao fato objeto da prova.

§ 3º Preclusa a decisão de desentranhamento da prova declarada inadmissível, esta será inutilizada por decisão judicial, facultado às partes acompanhar o incidente.

§ 4º O juiz que conhecer do conteúdo da prova declarada inadmissível não poderá proferir a sentença ou acórdão.
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


def _build_fake_db(tmp_path, monkeypatch, text: str):
    db_path = tmp_path / "legal_test.db"
    monkeypatch.setattr("legal_base.importer.read_raw_text", lambda source: text)
    reset_db(db_path)
    conn = connect(db_path)
    build_legal_base(conn, sources=[FAKE_SOURCE])
    conn.close()
    return db_path


def _full_article_source(diploma, artigo, referencia, texto, confidence="MEDIUM"):
    return {
        "diploma": diploma,
        "tipo": "Decreto-Lei",
        "numero": "0000/0000",
        "artigo": artigo,
        "paragrafo": None,
        "inciso": None,
        "alinea": None,
        "texto": texto,
        "referencia": referencia,
        "fonte": "Diploma de Teste",
        "url_oficial": "https://www.planalto.gov.br/fake-teste.htm",
        "confidence": confidence,
        "is_article_context": True,
        "origin": "local_article_context",
        "selection_reason": "contexto completo de artigo já selecionado",
    }


# --- A) CF-shaped: known-relevant inciso -> full article is not sent -------

def test_known_relevant_inciso_replaces_full_article(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CF_TEXT)
    from legal_base.search import get_article_text

    full_text = get_article_text("Diploma de Teste", "5", db_path=db_path)
    source = _full_article_source("Diploma de Teste", "5", "Diploma de Teste, art. 5 — artigo completo", full_text)

    statement = "Jonas se sentiu desconfortável pois a atividade era contrária à sua convicção política."
    correct_text = "estará em harmonia com a juridicidade caso cumpra prestação alternativa fixada em lei."

    # This fixture's full article (909 chars) is smaller than the real CF
    # art. 5º (13.5k chars) — force the trimming path with a small budget
    # so the test exercises unit-selection itself, not just the "already
    # small enough, skip compaction" branch.
    compacted = compact_sources(statement, correct_text, [source], max_chars_per_source=400, db_path=db_path)
    assert len(compacted) == 1
    result = compacted[0]

    assert result["compacted_length"] < result["original_length"]
    assert "VIII" in result["texto"]
    assert result["inciso"] == "VIII"
    # None of the other, unrelated incisos leaked in.
    for unrelated in ["sigilo da correspondência", "Poder Judiciário lesão", "publicidade dos atos"]:
        assert unrelated not in result["texto"]


# --- B) CPP-shaped: § 3º preserved exactly when it's what's needed --------

def test_specific_paragraph_preserved_when_needed(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CPP_TEXT)
    from legal_base.search import get_article_text

    full_text = get_article_text("Diploma de Teste", "157", db_path=db_path)
    source = _full_article_source("Diploma de Teste", "157", "Diploma de Teste, art. 157 — artigo completo", full_text)

    statement = (
        "Preclusa a decisão de desentranhamento da prova declarada inadmissível, esta será inutilizada "
        "por decisão judicial, facultado às partes acompanhar o incidente."
    )
    correct_text = "correto."

    # Force the trimming path even though this fixture's full text is
    # naturally short, to prove the unit-selection logic itself narrows to
    # § 3º — not just that it happens to skip compaction when already small.
    compacted = compact_sources(statement, correct_text, [source], max_chars_per_source=250, db_path=db_path)
    result = compacted[0]
    assert "§ 3º" in result["texto"]
    assert "Preclusa a decisão de desentranhamento" in result["texto"]
    assert result["paragrafo"] == "3"
    # The exact § 3º wording must survive byte-for-byte, not be paraphrased.
    assert (
        "esta será inutilizada por decisão judicial, facultado às partes acompanhar o incidente" in result["texto"]
    )


# --- C) never cut a unit mid-text -------------------------------------------

def test_never_truncates_a_unit_mid_text(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CF_TEXT)
    from legal_base.search import get_article_text

    full_text = get_article_text("Diploma de Teste", "5", db_path=db_path)
    source = _full_article_source("Diploma de Teste", "5", "Diploma de Teste, art. 5 — artigo completo", full_text)

    statement = "convicção política crença religiosa obrigação legal"
    correct_text = "prestação alternativa fixada em lei"

    # Absurdly small budget — inciso VIII's own text alone exceeds it, but
    # it must still be sent WHOLE, never cut mid-sentence.
    compacted = compact_sources(statement, correct_text, [source], max_chars_per_source=10, db_path=db_path)
    result = compacted[0]
    assert result["texto"].rstrip().endswith("fixada em lei;")
    assert result["compacted_length"] > 10  # the single unit legitimately exceeds the nominal budget


# --- D) provenance is preserved through compaction --------------------------

def test_provenance_fields_survive_compaction(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CF_TEXT)
    from legal_base.search import get_article_text

    full_text = get_article_text("Diploma de Teste", "5", db_path=db_path)
    source = _full_article_source("Diploma de Teste", "5", "Diploma de Teste, art. 5 — artigo completo", full_text)
    source["url_oficial"] = "https://www.planalto.gov.br/fake-teste.htm"
    source["origin"] = "local_article_context"

    compacted = compact_sources(
        "convicção política crença religiosa obrigação legal",
        "prestação alternativa fixada em lei",
        [source],
        max_chars_per_source=2000,
        db_path=db_path,
    )
    result = compacted[0]
    assert result["diploma"] == "Diploma de Teste"
    assert result["artigo"] == "5"
    assert result["url_oficial"] == "https://www.planalto.gov.br/fake-teste.htm"
    assert result["origin"] == "local_article_context"
    assert result["confidence"] == "MEDIUM"
    assert "original_length" in result and "compacted_length" in result and "compaction_reason" in result


def test_small_sources_are_left_untouched(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CPP_TEXT)
    source = _full_article_source("Diploma de Teste", "157", "Diploma de Teste, art. 157", "Texto curto de teste.")
    compacted = compact_sources("qualquer coisa", "qualquer coisa", [source], max_chars_per_source=2000, db_path=db_path)
    assert compacted[0]["texto"] == "Texto curto de teste."
    assert compacted[0]["compaction_reason"] == "já dentro do limite por fonte — sem alteração"


# --- enforce_total_budget ----------------------------------------------------

def test_enforce_total_budget_drops_lowest_confidence_first():
    sources = [
        {"referencia": "A", "texto": "x" * 3000, "compacted_length": 3000, "confidence": "LOW"},
        {"referencia": "B", "texto": "y" * 3000, "compacted_length": 3000, "confidence": "HIGH"},
        {"referencia": "C", "texto": "z" * 3000, "compacted_length": 3000, "confidence": "MEDIUM"},
    ]
    trimmed = enforce_total_budget(sources, max_total_chars=6000)
    kept_refs = {s["referencia"] for s in trimmed}
    assert kept_refs == {"B", "C"}  # LOW dropped first to fit under budget


def test_enforce_total_budget_always_keeps_at_least_one_source():
    sources = [{"referencia": "A", "texto": "x" * 9000, "compacted_length": 9000, "confidence": "HIGH"}]
    trimmed = enforce_total_budget(sources, max_total_chars=6000)
    assert len(trimmed) == 1  # never returns an empty list


# --- H) coverage=complete can never become "generate without fundamento" ---

def test_compaction_never_degrades_coverage_below_complete(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CF_TEXT)
    from legal_base.search import get_article_text

    full_text = get_article_text("Diploma de Teste", "5", db_path=db_path)
    source = _full_article_source("Diploma de Teste", "5", "Diploma de Teste, art. 5 — artigo completo", full_text)

    statement = "convicção política crença religiosa obrigação legal"
    correct_text = "prestação alternativa fixada em lei"
    coverage = {"status": "complete", "claims": ["trecho 1"], "supported": ["trecho 1"], "missing": [],
                "claim_sources": {"trecho 1": [source["referencia"]]}, "sources": [source["referencia"]]}

    final_sources, final_coverage, metrics = compact_evidence_for_generation(
        statement, correct_text, [source], coverage, max_chars_per_source=2000, db_path=db_path
    )
    assert final_coverage["status"] == "complete"
    assert metrics["restored"] is False


def test_compaction_is_skipped_when_input_coverage_is_not_complete(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CF_TEXT)
    source = _full_article_source("Diploma de Teste", "5", "Diploma de Teste, art. 5", "x" * 5000)
    coverage = {"status": "partial", "claims": [], "supported": [], "missing": ["algo"], "claim_sources": {}, "sources": []}

    final_sources, final_coverage, metrics = compact_evidence_for_generation(
        "qualquer coisa", "qualquer coisa", [source], coverage, db_path=db_path
    )
    # Untouched — compaction never runs on evidence that wasn't already
    # "complete"; that's the caller's job to gate before even getting here.
    assert final_sources == [source]
    assert final_coverage is coverage


# --- H/I) Q45 provenance regression guard ------------------------------
#
# Real production data (verified against worker/data/legal/legal.db on
# 2026-09-24): CP art. 157's "arma branca" clause is § 2º, inciso VII
# ("se a violência ou grave ameaça é exercida com emprego de arma
# branca") — NOT § 1º (which is about violence used right after the
# taking, to keep the stolen item or evade arrest, and has no incisos at
# all). "Consumação com posse breve" is a separate legal source (Súmula
# 582/STJ), never part of art. 157's own text. A structured-explanation
# run on Q45 previously produced a citation reading "art. 157, § 1º,
# inciso VII" — factually wrong, since § 1º has no inciso VII. These
# tests lock down the underlying data these claims must be built from, so
# a future regression in the legal base (not in this module, which is
# off-limits to change here) would be caught before it reaches a prompt.

FAKE_CP157_TEXT = """Art. 157 - Subtrair coisa móvel alheia, para si ou para outrem, mediante grave ameaça ou violência a pessoa, ou depois de havê-la, por qualquer meio, reduzido à impossibilidade de resistência:

§ 1º Na mesma pena incorre quem, logo depois de subtraída a coisa, emprega violência contra pessoa ou grave ameaça, a fim de assegurar a impunidade do crime ou a detenção da coisa para si ou para terceiro.

§ 2º A pena aumenta-se de 1/3 (um terço) até metade:

I - se há o concurso de duas ou mais pessoas;

VII - se a violência ou grave ameaça é exercida com emprego de arma branca;

X - se a subtração for de arma de fogo.

§ 4º Se a violência ou grave ameaça é cometida por integrante de organização criminosa ultraviolenta, grupo paramilitar ou milícia privada, aplica-se em triplo a pena prevista no caput deste artigo.
"""

SUMULA_582_TEXT = (
    "Consuma-se o crime de roubo com a inversão da posse do bem mediante emprego de "
    "violência ou grave ameaça, ainda que por breve tempo e em seguida à perseguição "
    "imediata ao agente e recuperação da coisa roubada, sendo prescindível a posse "
    "mansa e pacífica ou desvigiada."
)


def test_q45_arma_branca_is_attributed_to_paragrafo_2_inciso_vii(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CP157_TEXT)
    from legal_base.search import get_article_units

    units = get_article_units("Diploma de Teste", "157", db_path=db_path)
    arma_branca_units = [u for u in units if "arma branca" in u["texto"]]

    assert len(arma_branca_units) == 1
    unit = arma_branca_units[0]
    assert unit["paragrafo"] == "2"
    assert unit["inciso"] == "VII"
    # Not § 1º — § 1º has no incisos in the real article, and never
    # mentions "arma branca".
    paragrafo_1_units = [u for u in units if u["paragrafo"] == "1"]
    assert all("arma branca" not in u["texto"] for u in paragrafo_1_units)


def test_q45_sumula_582_stays_a_distinct_source_from_article_157(tmp_path, monkeypatch):
    db_path = _build_fake_db(tmp_path, monkeypatch, FAKE_CP157_TEXT)

    arma_branca_source = _full_article_source(
        "Diploma de Teste", "157", "Diploma de Teste, art. 157, § 2º, inciso VII",
        "se a violência ou grave ameaça é exercida com emprego de arma branca;",
        confidence="HIGH",
    )
    arma_branca_source["paragrafo"] = "2"
    arma_branca_source["inciso"] = "VII"

    sumula_source = {
        "diploma": "STJ",
        "tipo": "Súmula",
        "numero": "582",
        "artigo": None,
        "paragrafo": None,
        "inciso": None,
        "alinea": None,
        "texto": SUMULA_582_TEXT,
        "referencia": "Súmula 582 do STJ",
        "fonte": "STJ",
        "url_oficial": "https://www.stj.jus.br/fake-sumula-582.htm",
        "confidence": "MEDIUM",
        "origin": "sumula",
        "selection_reason": "consumação do roubo com posse breve",
    }

    statement = "consumação do roubo mediante emprego de arma branca, com posse breve e perseguição imediata"
    correct_text = "consuma-se o roubo ainda que a posse seja breve, desde que haja perseguição imediata"

    compacted = compact_sources(statement, correct_text, [arma_branca_source, sumula_source], db_path=db_path)

    assert len(compacted) == 2
    arma_branca_result, sumula_result = compacted

    # The § 2º/VII source keeps its own identity — never merged with or
    # relabeled as § 1º.
    assert arma_branca_result["paragrafo"] == "2"
    assert arma_branca_result["inciso"] == "VII"
    assert "arma branca" in arma_branca_result["texto"]

    # The súmula stays a separate, untouched source — its consumação
    # holding never gets attributed to article 157's own paragrafo/inciso
    # fields.
    assert sumula_result["diploma"] == "STJ"
    assert sumula_result["paragrafo"] is None
    assert sumula_result["texto"] == SUMULA_582_TEXT
    assert "posse breve" not in arma_branca_result["texto"]
