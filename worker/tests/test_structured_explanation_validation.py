from __future__ import annotations

import json

from local_ai.structured_explanation import (
    INSUFFICIENT,
    SECTION_GROUPS,
    SECTIONS,
    build_app_explanation,
    build_structured_explanation_prompt,
    merge_processed_explanations,
    process_structured_explanation,
)
from local_ai.prompt_builder import QuestionInput


# --- fixtures -----------------------------------------------------------

def _sources_with_text(*texts: str) -> list[dict]:
    return [{"referencia": f"Fonte de teste {i}", "texto": t} for i, t in enumerate(texts, start=1)]


def _quote(source_id: str, quote: str) -> dict:
    return {"sourceId": source_id, "quote": quote}


def _valid_payload(**overrides) -> dict:
    """Every legal section gets one valid evidenceQuote against source S1
    ("Texto de teste da fonte um.") by default; practicalCase needs none.
    """
    payload = {
        key: {
            "text": f"Texto de teste para {key}, sem conteúdo real.",
            "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
        }
        for key in SECTIONS
    }
    payload["practicalCase"] = {"text": "Reformulação neutra dos fatos do enunciado.", "evidenceQuotes": []}
    for key, section in overrides.items():
        payload[key] = section
    return payload


def _default_sources() -> list[dict]:
    return _sources_with_text("Texto de teste da fonte um.")


def test_valid_payload_is_approved():
    raw = json.dumps(_valid_payload())
    result = process_structured_explanation(raw, _default_sources())
    assert result["status"] == "approved"
    assert result["downgrades"] == []
    assert result["errors"] == []


def test_invalid_json_is_rejected():
    result = process_structured_explanation("isso não é json {", _default_sources())
    assert result["status"] == "rejected"
    assert result["sections"] is None
    assert any("JSON inválido" in e for e in result["errors"])


def test_missing_topic_is_rejected():
    payload = _valid_payload()
    del payload["curiosities"]
    result = process_structured_explanation(json.dumps(payload), _default_sources())
    assert result["status"] == "rejected"
    assert any("Tópicos ausentes" in e for e in result["errors"])


def test_extra_topic_is_rejected():
    payload = _valid_payload()
    payload["somethingElse"] = {"text": "x", "evidenceQuotes": []}
    result = process_structured_explanation(json.dumps(payload), _default_sources())
    assert result["status"] == "rejected"
    assert any("Tópicos inesperados" in e for e in result["errors"])


def test_missing_text_field_is_rejected():
    payload = _valid_payload(legalBasis={"evidenceQuotes": []})
    result = process_structured_explanation(json.dumps(payload), _default_sources())
    assert result["status"] == "rejected"


def test_evidence_quotes_not_a_list_is_rejected():
    payload = _valid_payload(legalBasis={"text": "Alguma afirmação.", "evidenceQuotes": "S1"})
    result = process_structured_explanation(json.dumps(payload), _default_sources())
    assert result["status"] == "rejected"
    assert any("evidenceQuotes precisa ser uma lista" in e for e in result["errors"])


# --- A) sourcesUsed is derived from evidenceQuotes, never trusted from the
# model (the new contract no longer even accepts a "sourcesUsed" field —
# the model isn't asked for one, and extra keys other than text/
# evidenceQuotes are simply not read) --------------------------------------

def test_sources_used_is_derived_from_valid_quotes():
    # S1 keeps the default fixture's text so every OTHER (non-overridden)
    # section's default quote still validates; the real content under
    # test lives in S2.
    sources = _sources_with_text(
        "Texto de teste da fonte um.",
        "Solicitar, exigir, cobrar ou obter vantagem a pretexto de influir em ato.",
    )
    payload = _valid_payload(
        legalBasis={
            "text": "O art. 332 do Código Penal descreve a conduta.",
            "evidenceQuotes": [_quote("S2", "Solicitar, exigir, cobrar ou obter vantagem")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved"
    assert result["sections"]["legalBasis"]["sourcesUsed"] == ["S2"]


# --- B) duplicate sourceId collapses into a single sourcesUsed entry ------

def test_duplicate_source_id_yields_unique_sources_used():
    # S1's text keeps the default fixture's own sentence too, so the other
    # (non-overridden) sections' default quote still validates and this
    # test isolates the duplicate-sourceId behavior under legalBasis.
    sources = _sources_with_text("Texto de teste da fonte um. Primeira frase da fonte. Segunda frase da fonte.")
    payload = _valid_payload(
        legalBasis={
            "text": "Duas afirmações apoiadas na mesma fonte.",
            "evidenceQuotes": [
                _quote("S1", "Primeira frase da fonte"),
                _quote("S1", "Segunda frase da fonte"),
            ],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    section = result["sections"]["legalBasis"]
    assert section["sourcesUsed"] == ["S1"]
    assert len(section["evidenceQuotes"]) == 2  # both literal quotes are kept


# --- C) a fabricated (non-literal) evidenceQuote is a hard rejection, not
# a soft downgrade — evidenceQuotes stay 100% literal, no exceptions -------

def test_nonexistent_quote_triggers_rejection():
    sources = _sources_with_text(
        "Texto de teste da fonte um.",
        "Texto real da fonte, sem relação com a citação inventada.",
    )
    payload = _valid_payload(
        legalBasis={
            "text": "Uma afirmação jurídica qualquer.",
            "evidenceQuotes": [_quote("S2", "trecho que nunca existiu na fonte")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "rejected"
    assert result["sections"] is None
    assert any("legalBasis" in e for e in result["errors"])


# --- D) a legal section with no evidenceQuote at all is NOT a downgrade —
# the source is an anchor, not a requirement for every claim ---------------

def test_section_without_any_quote_keeps_its_text_and_stays_approved():
    sources = _default_sources()
    payload = _valid_payload(concept={"text": "Afirmação sem nenhuma citação.", "evidenceQuotes": []})
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved"
    assert result["sections"]["concept"]["text"] == "Afirmação sem nenhuma citação."
    assert result["downgrades"] == []


def test_quote_referencing_unknown_source_triggers_rejection():
    sources = _default_sources()
    payload = _valid_payload(
        classification={"text": "Alguma classificação.", "evidenceQuotes": [_quote("S9", "Texto de teste")]}
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "rejected"
    assert result["sections"] is None


# --- E) practicalCase never needs a quote and is never downgraded for
# lacking one -----------------------------------------------------------

def test_practical_case_needs_no_quote_and_is_never_downgraded():
    sources = _default_sources()
    payload = _valid_payload(
        practicalCase={"text": "Reformulação neutra e sem citações dos fatos do enunciado.", "evidenceQuotes": []}
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved"
    assert result["sections"]["practicalCase"]["text"] == "Reformulação neutra e sem citações dos fatos do enunciado."
    assert result["downgrades"] == []


# --- F) "conforme S2" and similar leaked-ID phrasings are sanitized,
# preserving the legal content ------------------------------------------

def test_leaked_id_phrase_is_sanitized_and_section_stays_approved():
    sources = _sources_with_text(
        "Texto de teste da fonte um.",
        "Solicitar, exigir, cobrar ou obter vantagem a pretexto de influir em ato.",
    )
    payload = _valid_payload(
        legalBasis={
            "text": "A conduta está tipificada no art. 332 do Código Penal, conforme S2.",
            "evidenceQuotes": [_quote("S2", "Solicitar, exigir, cobrar ou obter vantagem")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    section = result["sections"]["legalBasis"]
    assert result["status"] == "approved"
    assert "S2" not in section["text"]
    assert section["text"] == "A conduta está tipificada no art. 332 do Código Penal."
    assert section["sourcesUsed"] == ["S2"]  # the leak in `text` was cosmetic; the anchor itself is still valid


def test_parenthetical_id_leak_is_sanitized():
    sources = _default_sources()
    payload = _valid_payload(
        legalBasis={
            "text": "O tráfico de influência está previsto no Código Penal (S1).",
            "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    section = result["sections"]["legalBasis"]
    assert result["status"] == "approved"
    assert "S1" not in section["text"]


# --- G) S1/S2 must never survive into the final text, even when it can't
# be cleanly sanitized — the section is safe-downgraded instead ------------

def test_unsanitizable_leak_forces_safe_downgrade_not_rejection():
    sources = _default_sources()
    # No "conforme"/"fonte"/parentheses/comma pattern around it — the
    # sanitizer's targeted patterns won't touch this, so it must downgrade.
    payload = _valid_payload(
        legalBasis={
            "text": "Ver também S1 para mais detalhes sobre o dispositivo mencionado no meio da frase.",
            "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved_with_gaps"
    section = result["sections"]["legalBasis"]
    assert section["text"] == INSUFFICIENT
    assert "S1" not in section["text"]


def test_source_id_never_appears_in_any_final_text():
    import re

    sources = _sources_with_text(
        "Texto de teste da fonte um.",
        "Solicitar, exigir, cobrar ou obter vantagem a pretexto de influir em ato.",
    )
    payload = _valid_payload(
        legalBasis={
            "text": "A conduta está tipificada no Código Penal, conforme a S2.",
            "evidenceQuotes": [_quote("S2", "Solicitar, exigir, cobrar ou obter vantagem")],
        },
        traps={
            "text": "Uma pegadinha comum envolve confundir isso com outro crime (S1).",
            "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
        },
        dontConfuse={
            "text": "Ver também S1 no meio da frase, sem padrão reconhecido ao redor.",
            "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
        },
    )
    result = process_structured_explanation(json.dumps(payload), sources)

    leak = re.compile(r"(?<![A-Za-z0-9])S\d+(?![A-Za-z0-9])")
    for section in result["sections"].values():
        assert not leak.search(section["text"])
    # The sanitizable ones stayed approved; the unsanitizable one downgraded.
    assert result["sections"]["legalBasis"]["text"] != INSUFFICIENT
    assert result["sections"]["traps"]["text"] != INSUFFICIENT
    assert result["sections"]["dontConfuse"]["text"] == INSUFFICIENT


def test_normal_citation_is_not_flagged_as_leak():
    # "art. 5º" and similar real citations must never be confused with a
    # source-ID leak, and must never be sanitized away.
    sources = _sources_with_text(
        "Texto de teste da fonte um.",
        "O art. 5º, inciso VIII, da Constituição Federal ampara esse entendimento.",
    )
    payload = _valid_payload(
        legalBasis={
            "text": "O art. 5º, inciso VIII, da Constituição Federal ampara esse entendimento.",
            "evidenceQuotes": [_quote("S2", "O art. 5º, inciso VIII, da Constituição Federal ampara esse entendimento")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved"
    assert result["sections"]["legalBasis"]["text"] == payload["legalBasis"]["text"]


# --- H) a self-declared insufficiency section is untouched, and does not
# count as a safety-net downgrade -------------------------------------------

def test_model_declared_insufficiency_is_not_counted_as_a_downgrade():
    sources = _default_sources()
    payload = _valid_payload(curiosities={"text": INSUFFICIENT, "evidenceQuotes": []})
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved"
    assert result["downgrades"] == []
    assert result["sections"]["curiosities"]["text"] == INSUFFICIENT


def test_insufficiency_section_with_stray_quote_is_still_clean():
    # Even if the model attaches a (pointless) quote to an insufficiency
    # section, the contract wipes it — insufficiency always means empty.
    sources = _default_sources()
    payload = _valid_payload(
        curiosities={"text": INSUFFICIENT, "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")]}
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    section = result["sections"]["curiosities"]
    assert section["evidenceQuotes"] == []
    assert section["sourcesUsed"] == []


# --- J) approved_with_gaps status --------------------------------------
# The only remaining real downgrade trigger is a source-ID leak that can't
# be sanitized (a technical safety issue) — missing evidenceQuotes and
# model-declared per-topic insufficiency no longer downgrade the overall
# status (see structured_explanation.py's process_structured_explanation).

def test_status_is_approved_with_gaps_when_any_section_is_downgraded():
    sources = _default_sources()
    payload = _valid_payload(
        concept={
            "text": "Ver também S1 para mais detalhes sobre o dispositivo mencionado no meio da frase.",
            "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
        }
    )
    result = process_structured_explanation(json.dumps(payload), sources)
    assert result["status"] == "approved_with_gaps"
    assert len(result["downgrades"]) == 1


def test_status_is_approved_when_no_section_needed_downgrading():
    result = process_structured_explanation(json.dumps(_valid_payload()), _default_sources())
    assert result["status"] == "approved"


# --- K) rejected stays reserved for genuinely broken output ---------------

def test_rejected_is_reserved_for_broken_json_not_missing_evidence():
    sources = _default_sources()
    payload = _valid_payload(legalBasis={"text": "Sem nenhuma citação.", "evidenceQuotes": []})
    result = process_structured_explanation(json.dumps(payload), sources)
    # Missing evidence alone must never reject the whole explanation.
    assert result["status"] != "rejected"


def test_malformed_root_is_rejected():
    result = process_structured_explanation(json.dumps(["not", "an", "object"]), _default_sources())
    assert result["status"] == "rejected"


def test_section_not_an_object_is_rejected():
    payload = _valid_payload()
    payload["legalBasis"] = "just a string"
    result = process_structured_explanation(json.dumps(payload), _default_sources())
    assert result["status"] == "rejected"


# --- grouped generation: split one 10-section call into two smaller ones --

def _question() -> QuestionInput:
    return QuestionInput(
        statement="Enunciado de teste.",
        alternatives=[("A", "Alternativa A"), ("B", "Alternativa B")],
        correct_letter="A",
        subject="Direito Penal",
    )


def test_section_groups_cover_all_ten_topics_exactly_once():
    seen: list[str] = [key for group in SECTION_GROUPS for key in group]
    assert sorted(seen) == sorted(SECTIONS.keys())
    assert len(seen) == len(set(seen))  # no topic duplicated across groups


def test_prompt_for_a_group_only_requests_that_groups_keys():
    group = SECTION_GROUPS[0]
    prompt = build_structured_explanation_prompt(_question(), _default_sources(), section_keys=group)
    for key in group:
        assert key in prompt
    for key in SECTIONS:
        if key not in group:
            assert f'"{key}"' not in prompt  # not requested as a JSON key in this call


def test_processing_a_group_only_requires_that_groups_keys():
    group = SECTION_GROUPS[0]
    sources = _default_sources()
    payload = {
        key: {"text": f"Texto de {key}.", "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")]}
        for key in group
    }
    payload["practicalCase"] = {"text": "Reformulação dos fatos.", "evidenceQuotes": []}
    result = process_structured_explanation(json.dumps(payload), sources, section_keys=group)
    assert result["status"] == "approved"
    assert set(result["sections"].keys()) == set(group)


def test_merge_combines_two_approved_groups_into_one_approved_result():
    sources = _default_sources()
    group_a, group_b = SECTION_GROUPS

    def _payload_for(group):
        payload = {
            key: {"text": f"Texto de {key}.", "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")]}
            for key in group
        }
        if "practicalCase" in payload:
            payload["practicalCase"] = {"text": "Reformulação dos fatos.", "evidenceQuotes": []}
        return payload

    part_a = process_structured_explanation(json.dumps(_payload_for(group_a)), sources, section_keys=group_a)
    part_b = process_structured_explanation(json.dumps(_payload_for(group_b)), sources, section_keys=group_b)

    merged = merge_processed_explanations([part_a, part_b])
    assert merged["status"] == "approved"
    assert set(merged["sections"].keys()) == set(SECTIONS.keys())
    assert merged["downgrades"] == []


def test_merge_propagates_rejection_from_either_part():
    sources = _default_sources()
    group_a, group_b = SECTION_GROUPS
    part_a = process_structured_explanation("isso não é json {", sources, section_keys=group_a)
    part_b = process_structured_explanation(
        json.dumps(
            {key: {"text": f"Texto de {key}.", "evidenceQuotes": []} for key in group_b}
        ),
        sources,
        section_keys=group_b,
    )
    merged = merge_processed_explanations([part_a, part_b])
    assert merged["status"] == "rejected"
    assert merged["sections"] is None
    assert any("JSON inválido" in e for e in merged["errors"])


def test_merge_combines_downgrades_and_marks_approved_with_gaps():
    sources = _default_sources()
    group_a, group_b = SECTION_GROUPS

    payload_a = {
        key: {"text": f"Texto de {key}.", "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")]}
        for key in group_a
    }
    payload_a["practicalCase"] = {"text": "Reformulação dos fatos.", "evidenceQuotes": []}
    # Every section in group B has no quote (harmless now — see the "J"
    # tests above) EXCEPT "traps", which carries an unsanitizable source-ID
    # leak — the one remaining real downgrade trigger.
    payload_b = {key: {"text": f"Texto de {key}.", "evidenceQuotes": []} for key in group_b}
    payload_b["traps"] = {
        "text": "Ver também S1 para mais detalhes sobre o dispositivo mencionado no meio da frase.",
        "evidenceQuotes": [_quote("S1", "Texto de teste da fonte um")],
    }

    part_a = process_structured_explanation(json.dumps(payload_a), sources, section_keys=group_a)
    part_b = process_structured_explanation(json.dumps(payload_b), sources, section_keys=group_b)

    merged = merge_processed_explanations([part_a, part_b])
    assert merged["status"] == "approved_with_gaps"
    assert len(merged["downgrades"]) == 1
    assert merged["downgrades"][0]["section"] == "traps"
    assert merged["sections"]["traps"]["text"] == INSUFFICIENT
    # The other, quote-less group B sections kept their text — no longer
    # downgraded just for lacking a literal evidenceQuote.
    for key in group_b:
        if key != "traps":
            assert merged["sections"][key]["text"] == f"Texto de {key}."


# --- build_app_explanation: student-facing view -----------------------

def test_app_explanation_drops_insufficient_sections():
    sections = {
        "practicalCase": {"text": "Fatos reformulados.", "sourcesUsed": [], "evidenceQuotes": []},
        "concept": {"text": INSUFFICIENT, "sourcesUsed": [], "evidenceQuotes": []},
        "legalBasis": {"text": "Fundamento real.", "sourcesUsed": ["S1"], "evidenceQuotes": [_quote("S1", "x")]},
    }
    app = build_app_explanation(sections)
    assert app == {"practicalCase": "Fatos reformulados.", "legalBasis": "Fundamento real."}
    assert "concept" not in app


def test_app_explanation_never_contains_source_ids():
    import re

    sections = {
        key: {"text": f"Texto sem citação interna para {key}.", "sourcesUsed": [], "evidenceQuotes": []}
        for key in SECTIONS
    }
    app = build_app_explanation(sections)
    leak = re.compile(r"(?<![A-Za-z0-9])S\d+(?![A-Za-z0-9])")
    for text in app.values():
        assert not leak.search(text)


def test_app_explanation_is_empty_when_everything_is_insufficient():
    sections = {key: {"text": INSUFFICIENT, "sourcesUsed": [], "evidenceQuotes": []} for key in SECTIONS}
    assert build_app_explanation(sections) == {}
