from __future__ import annotations

from exam_discovery.extraction import (
    CE_ALTERNATIVES,
    RE_ANSWER_KEY_SECTION,
    RE_ANSWER_ROW,
    RE_ITEM_NUMBER_PREFIX,
    RE_NUMBER_ROW,
    RE_TERMINAL_PUNCTUATION,
    _fill_answers_from_block,
    _item_assertion_text,
    _split_statement_and_alternatives,
    _strip_page_furniture,
    _strip_trailing_zero_padding,
    _truncate_trailing_heading,
    build_extracted_items,
    extract_answer_key,
)
from exam_discovery.models import ExtractedQuestion


def test_split_statement_and_alternatives_basic():
    block = (
        "Assinale a alternativa correta.\n"
        "(A) primeira opção.\n"
        "(B) segunda opção.\n"
        "(C) terceira opção.\n"
        "(D) quarta opção.\n"
        "(E) quinta opção."
    )
    statement, alts = _split_statement_and_alternatives(block)
    assert statement == "Assinale a alternativa correta."
    assert alts == {
        "A": "primeira opção.",
        "B": "segunda opção.",
        "C": "terceira opção.",
        "D": "quarta opção.",
        "E": "quinta opção.",
    }


def test_split_statement_with_no_alternatives_returns_empty_dict():
    statement, alts = _split_statement_and_alternatives("Texto sem alternativas nenhuma.")
    assert statement == "Texto sem alternativas nenhuma."
    assert alts == {}


def test_strip_page_furniture_removes_leading_all_caps_header():
    text = "POLÍCIA CIVIL DO ESTADO DE MINAS GERAIS – PCMG\nEnunciado real da questão."
    assert _strip_page_furniture(text) == "Enunciado real da questão."


def test_strip_page_furniture_removes_trailing_footer():
    text = "Enunciado real.\n(A) alt.\nTIPO BRANCA – PÁGINA 9"
    result = _strip_page_furniture(text)
    assert "PÁGINA" not in result
    assert result.endswith("(A) alt.")


def test_strip_page_furniture_leaves_ordinary_text_untouched():
    text = "Uma questão qualquer.\n(A) certo.\n(B) errado."
    assert _strip_page_furniture(text) == text


def test_truncate_trailing_heading_drops_bled_in_section_title():
    raw = "\nTrabalhei muito, economizei bastante, fiquei rico. INVESTIGADOR DE POLÍCIA I"
    assert _truncate_trailing_heading(raw).strip() == "Trabalhei muito, economizei bastante, fiquei rico."


def test_truncate_trailing_heading_leaves_multiline_answer_intact():
    raw = "\nAs medidas propostas – redução de impostos, demissão de\nfuncionários, não foram bem recebidas."
    assert _truncate_trailing_heading(raw) == raw  # single terminal punctuation, nothing trailing


def test_truncate_trailing_heading_no_period_returns_unchanged():
    raw = "\ntexto sem pontuação final qualquer"
    assert _truncate_trailing_heading(raw) == raw


def test_number_row_and_answer_row_regexes():
    assert RE_NUMBER_ROW.match("1 2 3 4 5 6 7 8 9 10")
    assert not RE_NUMBER_ROW.match("Investigador de Polícia I")
    assert RE_ANSWER_ROW.match("E B B D C C A B E B")
    assert RE_ANSWER_ROW.match("E B B D * C A B E B")  # '*' marks an annulled question
    assert not RE_ANSWER_ROW.match("Prova Tipo 1")


# --- regression: a second real exam (DPE-PE / Defensor Público) surfaced
# two layout differences from the PCMG exam this module was first built
# against — both fixed, both locked down here.

def test_answer_key_section_header_matches_regardless_of_case():
    # PCMG uses "Prova Tipo 1"; DPE-PE uses "PROVA TIPO 1" (all caps).
    assert RE_ANSWER_KEY_SECTION.search("Investigador de Polícia I – Prova Tipo 1")
    assert RE_ANSWER_KEY_SECTION.search("DEFENSOR PÚBLICO - PROVA TIPO 1")


def test_truncate_trailing_heading_drops_a_long_page_footer_with_url_and_watermark():
    # DPE-PE's last question on a page picked up a footer + credits URL +
    # tracking watermark — well past the old 80-char cap that only
    # existed to handle a short bled-in section title.
    raw = (
        "\nNão há óbice à identidade entre a base de cálculo de taxa e de "
        "imposto, desde que excluído o elemento de identidade.\n"
        "TIPO BRANCA – PÁGINA 2\nwww.pciconcursos.com.br\n"
        "pcimarkpci MjgwNDozZTYwOjA0ODY6NDMwMDo5MGFmOjVjZmY6MDU1\n"
        "DEFENSORIA PÚBLICA DO ESTADO DE PERNAMBUCO"
    )
    result = _truncate_trailing_heading(raw)
    assert result.strip().endswith("excluído o elemento de identidade.")
    assert "pciconcursos" not in result
    assert "pcimarkpci" not in result


def test_truncate_trailing_heading_drops_watermark_even_without_url():
    raw = "\nResposta correta é a opção B.\npcimarkpci abc123def456ghi789jkl012"
    result = _truncate_trailing_heading(raw)
    assert result.strip() == "Resposta correta é a opção B."


def test_extracted_question_to_dict_shape():
    q = ExtractedQuestion(
        question_number=1, subject="Direito Penal", statement="Enunciado.",
        alternatives=[{"letter": "A", "text": "x"}], official_answer="A",
        official_answer_text="x", annulled=False, status="valid", warnings=[],
    )
    d = q.to_dict()
    assert d["questionNumber"] == 1
    assert d["officialAnswer"] == "A"
    assert d["annulled"] is False
    assert d["status"] == "valid"


# --- Cebraspe Certo/Errado items ----------------------------------------
# Verified against a real PF/2025 exam (Cargo 16, Conhecimentos
# Específicos, Bloco III) and its real definitive gabarito — see
# extraction.py's module docstring for the full accuracy report.

def test_item_number_prefix_splits_inline_numbered_items():
    text = (
        "\nJulgue os itens subsequentes.\n"
        "97 Uma empresa que realiza a compra de um terreno no valor\n"
        "de R$ 120.000 à vista.\n"
        "98 O plano de contas é um dos livros contábeis obrigatórios."
    )
    pieces = RE_ITEM_NUMBER_PREFIX.split(text)
    numbers = [int(pieces[i]) for i in range(1, len(pieces), 2)]
    assert numbers == [97, 98]


def test_item_number_prefix_ignores_monetary_values():
    # "120.000" must never be mistaken for a new item: no newline
    # immediately precedes it, and even where a value DOES start a
    # wrapped line, it's never followed by whitespace + an uppercase
    # letter the way a real item start is.
    text = "\n97 Uma empresa vale R$\n120.000 à vista, com recursos bancários."
    pieces = RE_ITEM_NUMBER_PREFIX.split(text)
    numbers = [int(pieces[i]) for i in range(1, len(pieces), 2)]
    assert numbers == [97]


def test_item_assertion_text_stops_at_first_terminal_punctuation():
    raw = (
        "Uma empresa que realiza a compra de um terreno no valor de R$ 120.000 "
        "à vista, com recursos bancários, deve lançar esse valor a débito na "
        "conta bancos e a crédito na conta terrenos, pois está saindo dinheiro "
        "e entrando um bem.\nCEBRASPE – PF –Edital: 2025\nPECÍFICOS – BLOCO III --"
    )
    result = _item_assertion_text(raw)
    assert result.rstrip().endswith("entrando um bem.")
    assert "CEBRASPE" not in result


def test_item_assertion_text_excludes_bleeding_shared_instruction():
    # A real observed case: the item's own sentence ends cleanly, but a
    # NEW shared "julgue os itens..." instruction for the NEXT group of
    # items bleeds into the same captured block (page-transition/table
    # noise sits between them) — only the item's own first sentence
    # belongs to it.
    raw = (
        "O lucro apurado no exercício é de R$ 3.500.\n"
        "Julgue os itens a seguir, no que se refere a balancete de "
        "verificação contábil, balanço patrimonial e demonstração de "
        "resultado do exercício."
    )
    result = _item_assertion_text(raw)
    assert result.strip() == "O lucro apurado no exercício é de R$ 3.500."


def test_ce_alternatives_constant():
    assert CE_ALTERNATIVES == ("C", "E")


# --- extract_answer_key: X marker, row labels, zero-padding, no-header fallback

def test_strip_trailing_zero_padding_removes_only_trailing_zeros():
    assert _strip_trailing_zero_padding("117 118 119 120 0 0 0 0") == "117 118 119 120"
    assert _strip_trailing_zero_padding("1 2 3") == "1 2 3"
    assert _strip_trailing_zero_padding("0 0 0") == ""


def test_strip_trailing_zero_padding_never_touches_a_real_answer_row():
    # "E" is a real answer letter, never confused with padding.
    assert _strip_trailing_zero_padding("E E E E 0 0 0") == "E E E E"


def test_fill_answers_handles_row_labels_and_x_marker():
    block = "Item 97 98 99 100\nGabarito E C X E\n"
    answers: dict[int, str | None] = {}
    _fill_answers_from_block(block, answers)
    assert answers == {97: "E", 98: "C", 99: None, 100: "E"}


def test_fill_answers_survives_zero_padded_trailing_row():
    # The exact real-world shape that used to silently drop item 117
    # (an annulled item, "X") entirely — see extraction.py's history.
    block = (
        "Item 117 118 119 120 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"
        "Gabarito X E C E 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"
    )
    answers: dict[int, str | None] = {}
    _fill_answers_from_block(block, answers)
    assert answers == {117: None, 118: "E", 119: "C", 120: "E"}


def test_extract_answer_key_falls_back_to_none_key_when_no_section_header(tmp_path):
    # A real Cebraspe gabarito PDF (PC/PE, PF) never says "Prova Tipo N"
    # or "N - Turno" anywhere — there's only ever one canonical version.
    import pdfplumber

    class _FakePage:
        def extract_text(self):
            return "Questão 1 2 3\nGabarito C E C\n"

    class _FakePdf:
        pages = [_FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    import exam_discovery.extraction as extraction_module

    original_open = pdfplumber.open
    extraction_module.pdfplumber.open = lambda path: _FakePdf()
    try:
        result = extract_answer_key("irrelevant-path.pdf")
    finally:
        extraction_module.pdfplumber.open = original_open

    assert list(result.keys()) == [None]
    assert result[None] == {1: "C", 2: "E", 3: "C"}


def test_build_extracted_items_end_to_end(monkeypatch):
    import exam_discovery.extraction as extraction_module

    raw_items = {
        97: "Uma empresa que realiza a compra de um terreno é responsável pela apuração.",
        98: "O plano de contas é um dos livros contábeis obrigatórios previstos em lei.",
        99: "Item sem entrada correspondente no gabarito oficial publicado.",
    }
    monkeypatch.setattr(extraction_module, "extract_item_text", lambda path: raw_items)
    monkeypatch.setattr(
        extraction_module,
        "extract_answer_key",
        lambda path: {None: {97: "C", 98: None}},  # 98 annulled, 99 absent
    )

    items = extraction_module.build_extracted_items("exam.pdf", "key.pdf", test_type=None)

    assert [item.question_number for item in items] == [97, 98, 99]

    valid = items[0]
    assert valid.official_answer == "C"
    assert valid.official_answer_text == "Certo"
    assert valid.annulled is False
    assert valid.status == "valid"
    assert valid.alternatives == [{"letter": "C", "text": "Certo"}, {"letter": "E", "text": "Errado"}]

    annulled = items[1]
    assert annulled.official_answer is None
    assert annulled.annulled is True
    assert annulled.status == "valid"  # annulled-but-found is not itself a warning

    missing = items[2]
    assert missing.status == "needs_attention"
    assert "item não encontrado no gabarito oficial" in missing.warnings
