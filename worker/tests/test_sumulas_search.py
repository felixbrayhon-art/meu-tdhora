from __future__ import annotations

import json

from legal_base.sumulas_search import search_sumulas

FAKE_SUMULAS_STJ = {
    "_meta": {"tribunal": "STJ", "gerado_em": "2026-01-01"},
    "sumulas": {
        "582": {
            "numero": 582,
            "enunciado": (
                "Consuma-se o crime de roubo com a inversão da posse do bem mediante emprego de "
                "violência ou grave ameaça, ainda que por breve tempo e em seguida à perseguição "
                "imediata ao agente e recuperação da coisa."
            ),
            "status": "ativa",
            "area": "DIREITO PENAL",
            "tema": "ROUBO",
            "orgao": "TERCEIRA SEÇÃO",
            "data": "14/06/2017",
            "url": "https://scon.stj.jus.br/fake/582",
        },
        "999": {
            "numero": 999,
            "enunciado": "Súmula cancelada de teste, não deve aparecer em nenhuma busca.",
            "status": "cancelada",
            "area": "DIREITO CIVIL",
            "tema": "TESTE",
            "orgao": "PRIMEIRA SEÇÃO",
            "data": "01/01/2000",
            "url": "https://scon.stj.jus.br/fake/999",
        },
    },
}


def _write_fake_data_dir(tmp_path):
    (tmp_path / "sumulas_stj.json").write_text(json.dumps(FAKE_SUMULAS_STJ, ensure_ascii=False), encoding="utf-8")
    return tmp_path


def test_finds_relevant_sumula_by_keyword_overlap(tmp_path):
    data_dir = _write_fake_data_dir(tmp_path)
    results = search_sumulas(
        "roubo consumado inversão da posse recuperação da coisa", tribunal="STJ", data_dir=data_dir
    )
    assert results
    assert results[0]["referencia"] == "Súmula 582 do STJ"
    assert results[0]["tipo"] == "Súmula"


def test_cancelled_sumula_is_never_returned(tmp_path):
    data_dir = _write_fake_data_dir(tmp_path)
    results = search_sumulas("súmula cancelada de teste", tribunal="STJ", data_dir=data_dir)
    assert results == []


def test_weak_overlap_below_threshold_returns_nothing(tmp_path):
    data_dir = _write_fake_data_dir(tmp_path)
    results = search_sumulas("assunto totalmente não relacionado ao roubo", tribunal="STJ", data_dir=data_dir)
    assert results == []


def test_missing_data_dir_returns_empty_list_not_error(tmp_path):
    results = search_sumulas("qualquer coisa", tribunal="STJ", data_dir=tmp_path / "nao-existe")
    assert results == []
