from __future__ import annotations

from legal_base.evidence_coverage import (
    assess_evidence_coverage,
    claim_supported_by,
    extract_enumerated_affirmatives,
    split_claims,
)


def _source(referencia: str, texto: str) -> dict:
    return {"referencia": referencia, "texto": texto}


# --- extract_enumerated_affirmatives -------------------------------------

def test_extracts_roman_numeral_affirmatives():
    statement = (
        "Avalie as afirmativas a seguir.\n"
        "I. Primeira afirmativa de teste.\n"
        "II. Segunda afirmativa de teste.\n"
        "III. Terceira afirmativa, com final diferente. Está correto o que se afirma em"
    )
    result = extract_enumerated_affirmatives(statement)
    assert list(result.keys()) == ["I", "II", "III"]
    assert result["I"] == "Primeira afirmativa de teste."
    assert "Terceira afirmativa" in result["III"]


def test_single_roman_numeral_is_not_treated_as_enumeration():
    # A lone "I." shouldn't be mistaken for a real enumeration — needs >=2.
    statement = "Sobre o assunto, o item I. do dispositivo trata de algo."
    assert extract_enumerated_affirmatives(statement) == {}


# --- split_claims ----------------------------------------------------------

def test_split_claims_on_commas():
    claims = split_claims("roubo consumado, com a incidência da causa de aumento de pena.")
    assert claims == ["roubo consumado", "com a incidência da causa de aumento de pena"]


def test_split_claims_merges_short_trailing_fragments():
    # A trailing fragment with fewer than 2 significant tokens (here "ok"
    # is under tokenize_query's min length and drops out entirely) must
    # not become its own spurious claim — gets merged back.
    claims = split_claims("furto qualificado, ok.")
    assert claims == ["furto qualificado, ok"]


def test_split_claims_single_clause_stays_one_claim():
    assert split_claims("tráfico de influência.") == ["tráfico de influência"]


# --- claim_supported_by -----------------------------------------------------

def test_claim_supported_by_exact_terms():
    assert claim_supported_by(
        "prisão preventiva garantia da ordem pública",
        "A prisão preventiva poderá ser decretada como garantia da ordem pública.",
    )


def test_claim_not_supported_by_unrelated_text():
    assert not claim_supported_by(
        "roubo consumado inversão da posse",
        "Compete privativamente ao Presidente da República nomear Ministros de Estado.",
    )


def test_claim_supported_tolerates_inflection_via_prefix_match():
    # "produzir" vs. the source's "produzi-lo" — same tolerant prefix match
    # used across the rest of worker/legal_base/.
    assert claim_supported_by(
        "assumiu o risco de produzir o resultado",
        "doloso, quando o agente quis o resultado ou assumiu o risco de produzi-lo",
    )


# --- assess_evidence_coverage: single-claim (atomic) case -------------------

def test_single_claim_complete_when_any_source_selected():
    # Atomic claim (no enumeration, no comma-split) trusts the selector's
    # own confidence gating rather than re-deriving lexical overlap — a
    # claim like "tráfico de influência" (a doctrinal name) legitimately
    # has zero literal overlap with the statute's own operative text.
    coverage = assess_evidence_coverage(
        statement="Enunciado qualquer sem numeração.",
        correct_text="tráfico de influência.",
        sources=[_source("Código Penal, art. 332", "Solicitar, exigir, cobrar ou obter vantagem...")],
    )
    assert coverage["status"] == "complete"
    assert coverage["missing"] == []


def test_single_claim_insufficient_when_no_sources():
    coverage = assess_evidence_coverage(
        statement="Enunciado qualquer.",
        correct_text="tráfico de influência.",
        sources=[],
    )
    assert coverage["status"] == "insufficient"
    assert coverage["missing"]


# --- assess_evidence_coverage: multi-part (comma-split) case ---------------

def test_compound_claim_partial_when_only_one_part_supported():
    coverage = assess_evidence_coverage(
        statement="Enunciado qualquer.",
        correct_text="roubo consumado, com a incidência da causa de aumento de pena atrelada ao emprego de arma branca.",
        sources=[
            _source(
                "Súmula 582 do STJ",
                "Consuma-se o crime de roubo com a inversão da posse do bem mediante emprego de violência "
                "ou grave ameaça, ainda que por breve tempo e em seguida à perseguição imediata ao agente "
                "e recuperação da coisa.",
            ),
            # Only the narrow inciso text, NOT the full article — not
            # enough on its own to cover the "causa de aumento de pena"
            # vocabulary (that lives in the § 2º intro line, not here).
            _source(
                "Código Penal, art. 157, § 2º, VII",
                "se a violência ou grave ameaça é exercida com emprego de arma branca",
            ),
        ],
    )
    assert coverage["status"] == "partial"
    assert coverage["supported"] == ["trecho 1"]  # "roubo consumado", via the súmula
    assert coverage["missing"] == ["trecho 2"]  # majorante wording still unsupported


def test_compound_claim_complete_when_both_parts_supported():
    coverage = assess_evidence_coverage(
        statement="Enunciado qualquer.",
        correct_text="roubo consumado, com a incidência da causa de aumento de pena atrelada ao emprego de arma branca.",
        sources=[
            _source(
                "Súmula 582 do STJ",
                "Consuma-se o crime de roubo com a inversão da posse do bem mediante emprego de violência "
                "ou grave ameaça, ainda que por breve tempo e em seguida à perseguição imediata ao agente "
                "e recuperação da coisa.",
            ),
            _source(
                "Código Penal, art. 157 — artigo completo",
                "A pena aumenta-se de 1/3 (um terço) até metade: se a violência ou grave ameaça é exercida "
                "com emprego de arma branca",
            ),
        ],
    )
    assert coverage["status"] == "complete"


# --- assess_evidence_coverage: enumerated I/II/III case ---------------------

def test_enumerated_affirmatives_partial_when_one_item_unsupported():
    statement = (
        "Avalie as afirmativas.\n"
        "I. Primeira afirmativa sobre prova ilícita.\n"
        "II. Segunda afirmativa sobre desentranhamento.\n"
        "III. Terceira afirmativa sobre inutilização da prova precluída. Está correto o que se afirma em"
    )
    coverage = assess_evidence_coverage(
        statement=statement,
        correct_text="I, II e III.",
        sources=[
            _source("CPP, art. 155", "Primeira afirmativa sobre prova ilícita, tratada no artigo."),
            _source("CPP, art. 157", "Segunda afirmativa sobre desentranhamento, tratada no artigo."),
        ],
    )
    assert coverage["status"] == "partial"
    assert coverage["missing"] == ["III"]
    assert coverage["supported"] == ["I", "II"]


def test_enumerated_affirmatives_only_checks_referenced_items():
    # The alternative only claims "I e III" — item II is irrelevant to
    # this particular alternative and must not be required.
    statement = (
        "Avalie as afirmativas.\n"
        "I. Primeira afirmativa sobre prova ilícita.\n"
        "II. Segunda afirmativa totalmente sem fonte disponível.\n"
        "III. Terceira afirmativa sobre inutilização da prova precluída. Está correto o que se afirma em"
    )
    coverage = assess_evidence_coverage(
        statement=statement,
        correct_text="I e III, apenas.",
        sources=[
            _source("CPP, art. 155", "Primeira afirmativa sobre prova ilícita, tratada no artigo."),
            _source("CPP, art. 157, § 3º", "Terceira afirmativa sobre inutilização da prova precluída."),
        ],
    )
    assert coverage["status"] == "complete"
    assert coverage["claims"] == ["I", "III"]
