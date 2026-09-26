from __future__ import annotations

from parsers import direto_ao_ponto
from lib.validation import validate_question_structure

# Fixtures below are REAL text extracted with pdfplumber from
# worker/pdfs/direito-penal/direito-penal-2026.pdf (pages 310-313 and
# 394-395), captured verbatim during the structural audit that drove this
# parser's redesign — not hand-typed approximations. A few explanations are
# truncated for fixture size, but never rewritten; where a scenario has no
# real counterpart anywhere in the 31-question document (confirmed by
# exhaustive audit), a small synthetic snippet is used and clearly labeled
# as such in the test name/docstring.


def _lines_from_pages(pages: list[str]) -> list[tuple[str, int]]:
    """Builds the same (text, page_no) stream `direto_ao_ponto.parse()`
    would produce from a real PDF, running the module's own `_denoise` on
    each page (with no header/footer calibration — see
    `_lines_from_pages_with_chrome_stripping` for that), so tests exercise
    the real boundary-detection/state-machine logic without needing a PDF
    file. Page numbers here are 1-based within THIS fixture, not the real
    PDF's page numbers.
    """
    all_lines: list[tuple[str, int]] = []
    for index, page_text in enumerate(pages):
        all_lines.extend(direto_ao_ponto._denoise(page_text.split("\n"), index + 1))
    return all_lines


def _lines_from_pages_with_chrome_stripping(pages: list[str], total_pages: int | None = None) -> list[tuple[str, int]]:
    """Same as `_lines_from_pages`, but also runs the real two-pass
    header/footer self-calibration `parse()` uses (`_detect_repeating_chrome`
    then `_denoise` with the detected header/footer) — for tests that need
    to verify chrome actually gets stripped, not just that the state
    machine tolerates it being present. `total_pages` defaults to the
    number of fixture pages, but the real footer text captured from the
    audited PDF says "N/564" (the real document's total) — pass 564
    explicitly when reusing that real footer text in a smaller fixture.
    """
    raw_pages = [(index + 1, page_text.split("\n")) for index, page_text in enumerate(pages)]
    all_raw_lines = [line for _, lines in raw_pages for line in lines]
    header, footer_prefix = direto_ao_ponto._detect_repeating_chrome(
        all_raw_lines, num_pages=len(pages), footer_total_pages=total_pages
    )
    all_lines: list[tuple[str, int]] = []
    for page_no, lines in raw_pages:
        all_lines.extend(direto_ao_ponto._denoise(lines, page_no, header=header, footer_prefix=footer_prefix))
    return all_lines


# --- Real fixture: Q1 (page 310-311) ---------------------------------
# Metadata split across THREE lines: year/banca/órgão precede "Questão"
# itself (lookback line), cargo follows on its own line, then the ID.
# Alternatives B, C and E all have their letter badge on a line of its
# own, displaced from the paragraph it belongs to (the real layout bug
# this whole redesign exists to detect safely) — this question is
# expected to be EXCLUDED, not reconstructed.
Q1_PAGE_310 = """7. Direito Penal
Furto de bens que comprometam o funcionamento da Administração Pública ou de
estabelecimentos (públicos ou privas) que prestam serviços públicos essenciais
Qualificadora incluída pela Lei nº 15.181/2025.
Nessa hipótese de furto qualificado, a pena cominada é reclusão de 2 a 8 anos, e multa, se:
A subtração comprometer o funcionamento de serviços públicos (hospitais, escolas,
transporte, segurança etc.);
Obs1: Ainda é possível a oferta, pelo Ministério Público, de acordo de não persecução penal
(ANPP), pois a pena mínima cominada não ultrapassa 4 anos e o crime não envolvem violência
ou grave ameaça à pessoa, desde que presentes os demais requisitos do artigo 28-A, do CPP.
Obs2: A inovação legislativa em tela representa uma resposta estatal firme aos crimes que
afetam diretamente a infraestrutura pública e a vida cotidiana
2018 Com. Exam. (MP MS) Ministério Público do Estado de Mato Grosso do Sul
Questão
Promotor de Justiça
551768658
Assinale a alternativa correta
É crime de extorsão mediante sequestro a conduta denominada de "sequestro-
A) relâmpago" (ocorre quando os agentes abordam a vítima, restringem sua liberdade e com
ela se deslocam e a caixas eletrônicos, com intuito de fazer saques em dinheiro).
Advogado que é contratado para defender os interesses do seu cliente em processo
judicial, recebendo previamente seus honorários, porém descumpre as disposições
B)
contratuais, deixando de adotar as providências decorrentes da obrigação pactuada,
pratica o crime de apropriação indébita
Comete crime de concussão o funcionário público que se utiliza de violência ou grave
C)
ameaça para obter vantagem indevida
Funcionário público estadual com intuito de obter vantagem patrimonial para si, utilizando-
D) se de papel-moeda grosseiramente falsificado para efetuar pagamento de compras de
elevado valor em lojas comerciais, comete crime assimilado ao de moeda falsa.
Direto ao Ponto: Promotorias 310/564"""

Q1_PAGE_311 = """7. Direito Penal
Na hipótese de uma pessoa, com dezoito anos, juntamente com um amigo menor de
dezoito anos, com comunhão de esforços e unidade de desígnios, subtrair do avô da
E)
primeira, com sessenta e um anos de idade, a quantia de R$ 1.200,00, aquela praticará o
crime de furto qualificado.
Solução
Na hipótese de uma pessoa, com dezoito anos, juntamente com um amigo
menor de dezoito anos, com comunhão de esforços e unidade de desígnios,
Gabarito: E)
subtrair do avô da primeira, com sessenta e um anos de idade, a quantia de R$
1.200,00, aquela praticará o crime de furto qualificado.
A questão trata dos tipos penais de extorsão mediante sequestro, apropriação indébita,
estelionato, extorsão e furto qualificado.
(inimputável), nos termos da jurisprudência do STF (HC 110.425 - ES).
Art. 155 - Subtrair, para si ou para outrem, coisa alheia móvel:
pela Lei nº 13.654/2018, buscando punir de forma mais rígida crimes como a explosão de caixas
Direto ao Ponto: Promotorias 311/564"""

# --- Real fixture: Q2 (page 312-313) ----------------------------------
# Metadata fully merged onto the "Questão ..." line itself. Statement
# crosses the page break, with header/footer sitting right in the middle
# of the enumerated I/II/III list. All 5 alternatives are clean
# (letter+text together) — this question is expected to parse perfectly.
Q2_PAGE_312 = """7. Direito Penal
A pena para essa modalidade de furto é de reclusão de 4 a 10 anos e multa.
De 1/3 ao dobro, se o crime for praticado contra idoso ou vulnerável. Não há uma definição
específica para "vulnerável" na lei.
Questão 2023 Com. Exam (MP SP) Ministério Público do Estado de São Paulo Promotor de Justiça
4000830131
Tendo em vista a legislação que visa punir e combater os delitos praticados por meio de
invasão de dispositivos informáticos, considere as seguintes afirmações:
I. No crime de invasão de dispositivo informático, previsto no artigo 154-A do Código Penal,
se prevê a forma qualificada quando da invasão resultar a obtenção de comunicações
eletrônicas privadas;
Direto ao Ponto: Promotorias 312/564"""

Q2_PAGE_313 = """7. Direito Penal
II. São formas qualificadas do crime de divulgação de cena de estupro, de sexo e de
pornografia, previsto no artigo 218-C do Código Penal a circunstância de a divulgação se dar
por meio de comunicação de massa ou com o fim de obter vantagem patrimonial da vítima;
III. Para a caracterização do denominado furto eletrônico ou informático, previsto no artigo
155, parágrafo 4º-B do Código Penal, é irrelevante se o dispositivo estava ou não conectado à
rede de computadores.
Com relação às assertivas, é correto afirmar que
A) todas são verdadeiras.
B) apenas II e III são verdadeiras.
C) apenas I e III são verdadeiras.
D) apenas I e II são verdadeiras.
E) nenhuma das afirmativas é verdadeira.
Solução
Gabarito: C) apenas I e III são verdadeiras.
A questão envolve o conhecimento de alterações promovidas no Código Penal, em especial
pela Lei nº 12.737/2012, pela Lei nº 13.718/2018 e pela Lei nº 14.155/2021.
Direto ao Ponto: Promotorias 313/564"""

# --- Real fixture: Certo/Errado (page 394-395) ------------------------
# Metadata split across lines again (lookback + "Questão" + cargo + ID).
# Solução/explanation crosses the page break, with header/footer injected
# mid-sentence, and the explanation cites years from legislation
# ("Lei nº 12.015, de 2009") that must never be mistaken for exam_year.
CE_PAGE_394 = """7. Direito Penal
Se a vítima não tem capacidade de resistência ou discernimento devido a enfermidade,
deficiência mental, ou qualquer outro motivo, configura-se estupro de vulnerável (art. 217-A,
§ 1º, CP).
2016 Com. Exam. (MP SC) Ministério Público do Estado de Santa Catarina
Questão
Promotor de Justiça
370507829
Segundo o Código Penal, para caracterizar o crime de violência sexual mediante fraude,
previsto em seu art. 215, o sujeito passivo pode ser tanto o homem quanto a mulher; não se
exige que a vítima seja honesta, sob o ponto de vista da moral sexual, muito menos se admite
questionamento sobre a sua idade.
A) Certo.
B) Errado.
Solução
Gabarito: B) Errado.
ERRADA.
O delito de violação sexual mediante fraude, catalogado no art. 215 do Código Penal, pode
apresentar como sujeito passivo tanto o homem como a mulher. Antes da alteração promovida
pela Lei nº 12.015/09, esse delito era punido de forma mais severa se o sujeito passivo fosse
virgem na posse sexual e menor de 18 anos e maior de 14 anos de idade, situação inexistente
atualmente. Contudo, se a vítima for menor de 14 anos de idade o delito será o de estupro
Direto ao Ponto: Promotorias 394/564"""

CE_PAGE_395 = """7. Direito Penal
de vulnerável previsto no art. 217-A do Código Penal, motivo pelo qual a idade é
fundamental para a subsunção no tipo penal do art. 215 do Código Penal.
Art. 215 do CP. Ter conjunção carnal ou praticar outro ato libidinoso com alguém, mediante
fraude ou outro meio que impeça ou dificulte a livre manifestação de vontade da vítima:
(Redação dada pela Lei nº 12.015, de 2009)
Direto ao Ponto: Promotorias 395/564"""


# 1/6. Real A-E question, metadata merged on one line, crossing pages,
# header/footer mid-statement, years cited in the explanation.
def test_real_a_to_e_question_clean():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([Q2_PAGE_312, Q2_PAGE_313]))
    assert len(questions) == 1
    q = questions[0]
    assert q.warnings == []
    assert q.source == "direto_ao_ponto"
    assert q.external_id == "4000830131"
    assert q.exam_year == 2023
    assert q.exam_board == "Com. Exam (MP SP)"
    assert q.organization == "Ministério Público do Estado de São Paulo"
    assert q.position == "Promotor de Justiça"
    assert len(q.alternatives) == 5
    assert q.correct_letter == "C"
    assert q.question_type == "multipla_escolha"
    assert "Tendo em vista a legislação" in q.statement
    assert "III." in q.statement  # statement genuinely crossed the page break


# 2. Real Certo/Errado question, metadata split across lines (lookback).
def test_real_certo_errado_question():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([CE_PAGE_394, CE_PAGE_395]))
    assert len(questions) == 1
    q = questions[0]
    assert len(q.alternatives) == 2
    assert q.question_type == "certo_errado"
    assert q.correct_letter == "B"
    assert [a.letter for a in q.alternatives] == ["A", "B"]


# 3. Metadata fully merged onto a single "Questão ..." line.
def test_metadata_merged_in_single_line():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([Q2_PAGE_312, Q2_PAGE_313]))
    q = questions[0]
    assert q.exam_year == 2023
    assert q.exam_board == "Com. Exam (MP SP)"
    assert q.organization == "Ministério Público do Estado de São Paulo"
    assert q.position == "Promotor de Justiça"


# 4. Metadata broken across several lines, year/banca/órgão BEFORE
# "Questão" itself (the lookback case), cargo on its own separate line.
def test_metadata_split_across_lines_with_lookback():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([CE_PAGE_394, CE_PAGE_395]))
    q = questions[0]
    assert q.exam_year == 2016
    assert q.exam_board == "Com. Exam. (MP SC)"
    assert q.organization == "Ministério Público do Estado de Santa Catarina"
    assert q.position == "Promotor de Justiça"


# 5. externalId recognized on its own separate line (both fixtures use
# this shape — Q2 has it right after the merged metadata line).
def test_id_on_separate_line():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([Q2_PAGE_312, Q2_PAGE_313]))
    assert questions[0].external_id == "4000830131"
    _, questions2 = direto_ao_ponto.parse_lines(_lines_from_pages([CE_PAGE_394, CE_PAGE_395]))
    assert questions2[0].external_id == "370507829"


# 6. Question whose own statement genuinely spans two pages.
def test_question_spanning_pages():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([Q2_PAGE_312, Q2_PAGE_313]))
    q = questions[0]
    assert "invasão de dispositivos informáticos" in q.statement  # page 312
    assert "furto eletrônico ou informático" in q.statement  # page 313
    assert q.source_page == 1  # first page of this fixture (see _lines_from_pages numbering)


# 7. Solução/Gabarito/explanation genuinely spans two pages.
def test_solution_spanning_pages():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([CE_PAGE_394, CE_PAGE_395]))
    q = questions[0]
    assert q.correct_letter == "B"
    assert "delito será o de estupro" in q.explanation  # page 394 tail
    assert "de vulnerável previsto no art. 217-A" in q.explanation  # page 395 continuation


# 8. Header/footer chrome injected in the MIDDLE of the question must not
# leak into statement or explanation, once the real two-pass calibration
# `parse()` uses has enough repeats to trust the pattern (a single 2-page
# fixture is below that threshold on purpose — see the module docstring on
# `_detect_repeating_chrome` — so a 3rd real-chrome filler page is added
# here just to cross it).
CHROME_FILLER_PAGE = """7. Direito Penal
Texto de preenchimento apenas para calibrar o cabeçalho/rodapé repetido, sem conteúdo real.
Direto ao Ponto: Promotorias 396/564"""


def test_header_footer_stripped_mid_question():
    all_lines = _lines_from_pages_with_chrome_stripping(
        [CE_PAGE_394, CE_PAGE_395, CHROME_FILLER_PAGE], total_pages=564
    )
    _, questions = direto_ao_ponto.parse_lines(all_lines)
    q = questions[0]
    assert "Direto ao Ponto: Promotorias" not in q.explanation
    assert "7. Direito Penal" not in q.explanation
    assert "394/564" not in q.explanation
    assert "delito será o de estupro" in q.explanation
    assert "de vulnerável previsto no art. 217-A" in q.explanation

    all_lines2 = _lines_from_pages_with_chrome_stripping(
        [Q2_PAGE_312, Q2_PAGE_313, CHROME_FILLER_PAGE], total_pages=564
    )
    _, questions2 = direto_ao_ponto.parse_lines(all_lines2)
    assert "Direto ao Ponto: Promotorias" not in questions2[0].statement
    assert "7. Direito Penal" not in questions2[0].statement
    assert "7. Direito Penal" not in questions2[0].statement


# 9. Letters formatted like "A)"/"B)" inside the explanation must never be
# read as new alternatives — synthetic (no real question in this document
# happens to phrase its explanation this way), isolating the invariant.
def test_letters_inside_explanation_are_not_new_alternatives():
    page = """Questão
2023 CESPE (CEBRASPE)
Ministério Público do Estado do Espírito Santo
Promotor de Justiça
4000900001
Enunciado de teste, sem conteúdo real.
A) Primeira alternativa de teste.
B) Segunda alternativa de teste.
Solução
Gabarito: A) Primeira alternativa de teste.
Comentário: no gabarito comentado, o professor explica que A) é a exigência básica e que
B) seria a hipótese contrária, mas isso é só texto de comentário, não uma nova alternativa."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    assert len(questions) == 1
    q = questions[0]
    assert len(q.alternatives) == 2
    assert q.correct_letter == "A"
    assert "no gabarito comentado" in q.explanation


# 10. Years cited inside the explanation (legislation years) must never be
# read back as exam_year — real fixture: "Lei nº 12.015, de 2009".
def test_years_inside_explanation_are_not_exam_year():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([CE_PAGE_394, CE_PAGE_395]))
    q = questions[0]
    assert q.exam_year == 2016  # from the real preamble, not 2009 from the legislation citation
    assert "2009" in q.explanation


# 11. A long digit run appearing inside the explanation (process/law
# reference style) must never be mistaken for externalId — externalId is
# only ever recognized in the question's opening region. Synthetic
# addition (the real document has no bare 6+ digit line anywhere outside
# the 31 genuine preamble IDs, confirmed by exhaustive audit), built on
# top of otherwise-real content.
def test_process_like_numbers_inside_explanation_are_not_id():
    page = """Questão
2023 CESPE (CEBRASPE)
Ministério Público do Estado do Espírito Santo
Promotor de Justiça
4000900002
Enunciado de teste, sem conteúdo real.
A) Certo.
B) Errado.
Solução
Gabarito: A) Certo.
Conforme o processo nº 1234567 do TJES, entendimento consolidado, sem conteúdo real."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    assert len(questions) == 1
    assert questions[0].external_id == "4000900002"
    assert "1234567" in questions[0].explanation


# 12. Two real, disjoint questions back to back — verifies no content
# leaks between them regardless of which document positions they came
# from originally.
def test_two_real_questions_do_not_mix_content():
    _, questions = direto_ao_ponto.parse_lines(
        _lines_from_pages([Q2_PAGE_312, Q2_PAGE_313, CE_PAGE_394, CE_PAGE_395])
    )
    assert len(questions) == 2
    q1, q2 = questions
    assert q1.external_id == "4000830131"
    assert q2.external_id == "370507829"
    assert "violência sexual mediante fraude" not in q1.statement
    assert "violência sexual mediante fraude" not in q1.explanation
    assert "invasão de dispositivos informáticos" not in q2.statement
    assert "invasão de dispositivos informáticos" not in q2.explanation
    assert q1.correct_letter == "C"
    assert q2.correct_letter == "B"


# 13. Gabarito pointing at a letter that was never extracted as an
# alternative — synthetic invariant check.
def test_gabarito_incompatible_with_alternatives_is_flagged():
    page = """Questão
2023 CESPE (CEBRASPE)
Ministério Público do Estado do Espírito Santo
Promotor de Justiça
4000900003
Enunciado de teste, sem conteúdo real.
A) Certo.
B) Errado.
Solução
Gabarito: C) inexistente
Comentário de teste sem conteúdo real."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    q = questions[0]
    assert q.correct_letter == "C"
    assert any("não corresponde a nenhuma alternativa" in w for w in q.warnings)


# 14. Real question from before 2021 — must be excluded, never "corrected"
# to a different year.
def test_real_question_before_2021_is_excluded():
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([CE_PAGE_394, CE_PAGE_395]))
    q = questions[0]
    assert q.exam_year == 2016
    assert any("intervalo permitido" in w for w in q.warnings)


# --- Safety net around the real layout defect this redesign targets ----


def test_bare_alternative_marker_excludes_whole_question():
    # Real fixture: Q1 has badges for B, C and E displaced onto their own
    # line, mid-paragraph — this must never be silently reconstructed.
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([Q1_PAGE_310, Q1_PAGE_311]))
    assert len(questions) == 1
    q = questions[0]
    assert any("badge deslocado" in w for w in q.warnings)


def test_duplicate_alternative_letters_are_parsed_faithfully_and_caught_by_validation():
    page = """Questão
2023 CESPE (CEBRASPE)
Órgão de teste
Cargo de teste
4000900004
Enunciado de teste com alternativas duplicadas, sem conteúdo real.
A) Primeira tentativa da alternativa A.
A) Segunda linha rotulada como A por engano.
Solução
Gabarito: A) Primeira tentativa da alternativa A.
Explicação de teste sem conteúdo real."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    q = questions[0]
    assert [a.letter for a in q.alternatives] == ["A", "A"]
    errors = validate_question_structure(q.to_dict())
    assert any("repetidas" in e for e in errors)


def test_missing_solucao_marker_is_flagged():
    page = """Questão
2023 CESPE (CEBRASPE)
Órgão de teste
Cargo de teste
4000900005
Enunciado de teste sem marcador de solução, sem conteúdo real.
A) Alternativa A.
B) Alternativa B.
Gabarito: A) Alternativa A.
Explicação de teste sem conteúdo real."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    q = questions[0]
    assert any("Solução" in w for w in q.warnings)


def test_missing_gabarito_line_is_flagged():
    page = """Questão
2023 CESPE (CEBRASPE)
Órgão de teste
Cargo de teste
4000900006
Enunciado de teste sem gabarito, sem conteúdo real.
A) Alternativa A.
B) Alternativa B.
Solução
Explicação de teste que deveria ter um gabarito antes."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    q = questions[0]
    assert q.correct_letter is None
    assert any("Gabarito" in w for w in q.warnings)


def test_gabarito_without_parenthesis_is_supported():
    # Real variant confirmed in the document: "Gabarito: C" with no ")".
    page = """Questão
2023 CESPE (CEBRASPE)
Órgão de teste
Cargo de teste
4000900007
Enunciado de teste, sem conteúdo real.
A) Alternativa A.
B) Alternativa B.
C) Alternativa C.
Solução
Gabarito: C
Explicação de teste sem conteúdo real."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    q = questions[0]
    assert q.correct_letter == "C"


def test_gabarito_definitivo_da_banca_is_never_confused_with_gabarito():
    # Real edge case (page 499 of the audited PDF): a differently-labeled
    # line that must never be picked up by the Gabarito regex.
    page = """Questão
2022 CESPE (CEBRASPE)
Órgão de teste
Cargo de teste
4000900008
Enunciado de teste, sem conteúdo real.
A) Alternativa A.
B) Alternativa B.
C) Alternativa C.
Solução
Gabarito: C) alternativa C
Gabarito definitivo da banca: Letra E
Análise do professor, sem conteúdo real."""
    _, questions = direto_ao_ponto.parse_lines(_lines_from_pages([page]))
    q = questions[0]
    assert q.correct_letter == "C"
    assert "Gabarito definitivo da banca: Letra E" in q.explanation
