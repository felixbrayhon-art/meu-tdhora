from __future__ import annotations

import json
import re

from .prompt_builder import QuestionInput, SYSTEM_RULES, TEACHER_PERSONA


INSUFFICIENT = "Fonte fornecida insuficiente para afirmar com segurança."

# Internal source IDs (S1, S2, ...) exist only to link an `evidenceQuotes`
# entry back to the evidence list — they must never appear inside the
# student-facing `text`. Word-boundary-anchored so it only catches the
# literal ID token (never a real citation like "art. 5º" or a coincidental
# "s1" inside some other word).
RE_SOURCE_ID_LEAK = re.compile(r"(?<![A-Za-z0-9])S\d+(?![A-Za-z0-9])")

# Deterministic, best-effort removal of the common ways a leaked ID shows
# up in prose. Applied BEFORE the RE_SOURCE_ID_LEAK re-check in
# process_structured_explanation: if a leak survives this, the section is
# safe-downgraded rather than shipped with a mangled sentence or a visible
# internal ID.
_LEAK_REMOVAL_PATTERNS = [
    re.compile(r"\s*\(\s*S\d+\s*\)", re.IGNORECASE),  # "(S1)"
    re.compile(r",?\s*conforme\s+(?:a\s+)?S\d+\b", re.IGNORECASE),  # "conforme S1" / "conforme a S2"
    re.compile(r",?\s*fonte\s+S\d+\b", re.IGNORECASE),  # "fonte S3"
    re.compile(r",\s*S\d+\b"),  # ", S2"
]

SECTIONS = {
    "practicalCase": "SITUAÇÃO PRÁTICA / CASO",
    "concept": "CONCEITO",
    "classification": "CLASSIFICAÇÃO, GÊNERO E ESPÉCIES",
    "legalBasis": "BASE LEGAL / FUNDAMENTO",
    "requirements": "REQUISITOS",
    "traps": "PEGADINHAS — ATENÇÃO!",
    "caseAnalysis": "ANÁLISE DO CASO PRÁTICO / QUESTÃO",
    "dontConfuse": "NÃO CONFUNDA",
    "examSummary": "RESUMO PARA A PROVA",
    "curiosities": "CURIOSIDADES SOBRE O ASSUNTO",
}

# A single 10-section call routinely took 150-320s locally, and some
# generations exceeded the 600s Ollama timeout outright (observed on Q45).
# Splitting the same request into two independent, stateless calls — each
# asking for only half the topics — halves the OUTPUT each call has to
# produce (the actual bottleneck for local decode, not prompt size), which
# cuts per-call latency and timeout risk, at the cost of repeating the
# sources/rules block (cheap prefill) in both calls. Each group is
# generated and validated independently, then combined by
# merge_processed_explanations.
SECTION_GROUPS: tuple[tuple[str, ...], ...] = (
    ("practicalCase", "concept", "classification", "legalBasis", "requirements"),
    ("traps", "caseAnalysis", "dontConfuse", "examSummary", "curiosities"),
)
assert set().union(*SECTION_GROUPS) == set(SECTIONS), "SECTION_GROUPS must cover exactly all SECTIONS"


DEEP_EXPLANATION_RULES = """
ESTILO OBRIGATÓRIO — MÉTODO VR APROFUNDADO:

A explicação deve ter profundidade de uma boa aula de preparação para
concurso/OAB, e não a brevidade de um comentário de gabarito.

O objetivo é fazer o aluno entender:
1. o instituto jurídico;
2. por que a regra existe;
3. qual é sua base normativa;
4. como a banca construiu a questão;
5. por que a alternativa correta está correta;
6. por que as demais alternativas estão erradas;
7. quais confusões e pegadinhas podem aparecer novamente em prova.

PROFUNDIDADE:

- Não resuma artificialmente um assunto que exige desenvolvimento.
- Desenvolva o raciocínio passo a passo.
- Explique termos técnicos em linguagem clara.
- Sempre que houver uma sequência legal, enumere-a na ordem correta.
- Sempre que houver requisitos, elementos, fases, espécies ou exceções,
  organize-os de forma didática.
- Quando for útil, use exemplos hipotéticos curtos para tornar o conceito
  concreto, sem inventar fatos da questão.
- Evite repetições entre tópicos: cada seção deve acrescentar conhecimento.

EXTENSÃO:

- A extensão deve ser proporcional à complexidade do tópico.
- Não existe limite geral de 2 a 4 frases.
- Tópicos simples podem ser curtos.
- Tópicos centrais, especialmente concept, legalBasis, traps,
  caseAnalysis e dontConfuse, devem ser desenvolvidos quando necessário.
- Para uma questão jurídica de conteúdo relevante, a explicação completa
  (soma dos 10 tópicos) deve ficar na faixa de 700 a 1.200 palavras — isso
  é um ALVO típico, não um teto. Uma explicação de ~400 palavras no total
  para um tema relevante é rasa demais e não atinge o padrão deste método,
  mesmo que cada frase individualmente esteja correta.
- Como referência de piso (não regra rígida — ajuste à complexidade real
  do tema): concept e legalBasis tendem a precisar de pelo menos 3-5
  frases cada; traps, caseAnalysis e dontConfuse tendem a precisar de
  bem mais, já que caseAnalysis cobre cada alternativa individualmente.
- Qualidade e utilidade didática são mais importantes que concisão, mas
  concisão nunca deve virar desculpa para superficialidade.

ANÁLISE DAS ALTERNATIVAS:

Em questões objetivas com alternativas, caseAnalysis deve, sempre que
possível, analisar TODAS as alternativas individualmente.

Use raciocínio semelhante a:

A) INCORRETA — explique exatamente qual palavra, premissa, requisito,
prazo, competência, conceito ou consequência torna a alternativa errada.

B) CORRETA — explique por que corresponde à regra jurídica e ao gabarito.

Não diga apenas "está errada" ou "está correta".
Mostre a razão jurídica.

Se a alternativa estiver quase toda correta e possuir apenas um detalhe
errado, identifique exatamente esse detalhe. Isso é especialmente
importante para estudar pegadinhas de banca.

BASE LEGAL:

Quando houver suporte seguro, informe:
- diploma legal;
- artigo;
- inciso;
- parágrafo;
- regra jurídica relevante.

Depois de citar a base normativa, EXPLIQUE seu significado.
Não transforme legalBasis em uma lista seca de artigos.

Se a fonte disponível não permitir afirmar com segurança o número exato
de artigo, inciso, súmula, precedente, prazo, pena ou data, NÃO invente
essa precisão. Explique a regra jurídica sem fabricar referência.

Uma referência normativa exata é melhor que uma referência aproximada,
mas uma explicação correta sem número de artigo é melhor que um artigo
inventado.

PEGADINHAS:

traps deve explicar a lógica da armadilha da banca.

Sempre que possível:
- mostre qual resposta parece intuitiva;
- explique por que ela seduz o candidato;
- mostre qual palavra muda o sentido jurídico;
- contraste a regra correta com o erro;
- indique como reconhecer a mesma armadilha em outra questão.

NÃO CONFUNDA:

dontConfuse deve comparar institutos próximos ou conceitos que costumam
ser trocados em prova.

Pode usar:
- lista comparativa;
- mini quadro;
- tabela Markdown curta;

desde que a comparação seja juridicamente segura e realmente útil.

RESUMO PARA A PROVA:

examSummary deve funcionar como material de revisão rápida.

Priorize:
- regra central;
- sequência relevante;
- exceções importantes;
- palavras-chave;
- ponto exato da pegadinha;
- mnemônico somente quando ele realmente ajudar e não distorcer a regra.

CURIOSIDADES:

curiosities não é espaço para preencher texto.

Inclua apenas informação realmente útil, como:
- origem ou alteração legislativa;
- contexto do instituto;
- consequência prática;
- conexão segura com jurisprudência;
- mudança normativa relevante.

Nunca invente jurisprudência, número de processo, súmula, tema repetitivo,
data, artigo ou alteração legislativa apenas para enriquecer a resposta.

EVIDÊNCIAS:

evidenceQuotes continuam sendo exclusivamente trechos literais das fontes.

Uma evidenceQuote só deve ser vinculada ao tópico quando sustentar
diretamente alguma afirmação material daquele tópico.

Uma fonte apenas relacionada ao mesmo assunto NÃO deve ser usada como
evidenceQuote.

Conhecimento jurídico complementar seguro pode aparecer no texto sem
evidenceQuote, conforme as regras gerais já definidas.

O fato de evidenceQuotes estar vazio NÃO obriga a tornar a explicação
rasa.

PRINCÍPIO FINAL:

Explique como um professor que quer que o aluno acerte uma questão
parecida no futuro, e não apenas como alguém justificando o gabarito
desta questão.
"""


_TOPIC_RULES = {
    "practicalCase": """practicalCase:
- NÃO reformule nem resuma o enunciado da questão — isso é raso e não ensina nada, é só reescrever o que o aluno já leu;
- em vez disso, invente um caso hipotético curto e concreto, no estilo "Imagine que..." ou "Pense em...", que ilustre a MESMA lógica jurídica que a questão cobra, antes de qualquer explicação técnica (mesma técnica pedagógica da Aula Guiada do app: história/exemplo primeiro, conceito técnico depois);
- deixe claro que é um exemplo ilustrativo — nunca apresente esse cenário inventado como se fossem os fatos reais da questão; os fatos reais só entram em caseAnalysis;
- o exemplo pode ter personagens, nomes e situação diferentes da questão, desde que a lógica jurídica por trás seja a mesma;
- o exemplo deve ser juridicamente coerente — não invente uma regra errada dentro dele só para a história funcionar;
- 2 a 5 frases, tom narrativo — a técnica formal vem depois, em concept;
- não precisa de evidenceQuotes (é um exemplo inventado, não uma citação de fonte).""",

    "concept": """concept:
- explique o conceito jurídico central de forma objetiva;
- use as fontes como base prioritária;
- se a fonte for limitada, pode complementar com conhecimento jurídico confiável;
- não invente dispositivo legal ou entendimento jurisprudencial.""",

    "classification": """classification:
- informe apenas a classificação juridicamente pertinente;
- evite classificações especulativas ou desnecessárias;
- conhecimento jurídico complementar é permitido quando não contradiz as fontes.""",

    "legalBasis": """legalBasis:
- priorize artigo, lei, súmula ou fundamento presente nas fontes fornecidas;
- nunca invente número de artigo, lei, súmula, precedente ou referência normativa;
- se a fonte trouxer o fundamento, use-o com precisão;
- quando houver um trecho literal relevante (o caput de um artigo, um rol de incisos), transcreva-o em blockquote Markdown (`> "..."`) e DEPOIS explique o que ele significa — não deixe a citação sem explicação em seguida.""",

    "requirements": """requirements:
- explique os requisitos relevantes para a questão;
- não transforme hipóteses alternativas em requisitos cumulativos;
- se a fonte disser "A ou B", não escreva que A e B são ambos necessários;
- preserve alternativas legais relevantes;
- é permitido complementar a explicação quando a fonte for limitada, desde que não haja contradição.""",

    "traps": """traps:
- explique as pegadinhas relevantes da questão em 2 a 3 frases;
- pode usar conhecimento jurídico complementar confiável;
- não crie exceções, prazos, penas ou dispositivos inexistentes.""",

    "caseAnalysis": """caseAnalysis:
- analise CADA alternativa/item individualmente, sempre que houver alternativas — não resuma "as erradas estão erradas" em bloco;
- para cada uma, no formato "**A) INCORRETA** — <qual palavra, requisito, prazo ou premissa exata torna a alternativa errada, com a regra correta>" ou "**B) CORRETA** — <por que corresponde à regra jurídica e ao gabarito>";
- se uma alternativa está quase toda certa e erra só um detalhe, aponte exatamente esse detalhe — é o que mais cai em prova;
- prefira a estrutura FATO -> REGRA -> CONCLUSÃO dentro de cada alternativa;
- não afirme que um fato não ocorreu apenas porque não foi mencionado;
- pode complementar a ligação jurídica entre fato e regra quando a fonte for limitada.""",

    "dontConfuse": """dontConfuse:
- diferencie institutos próximos quando isso ajudar o aluno;
- a distinção pode usar conhecimento jurídico complementar confiável;
- não invente requisitos, artigos ou consequências.""",

    "examSummary": """examSummary:
- faça resumo curto, claro e útil para prova;
- não generalize uma regra específica além do necessário.""",

    "curiosities": """curiosities:
- escreva somente informação complementar útil e juridicamente segura;
- se não houver curiosidade realmente relevante, seja breve;
- nunca invente dado jurídico para preencher este campo.""",
}


def _correct_text(question: QuestionInput) -> str:
    return next(
        (
            text
            for letter, text in question.alternatives
            if letter == question.correct_letter
        ),
        "",
    )


def _format_alternatives(question: QuestionInput) -> str:
    return "\n".join(
        f"{letter}) {text}"
        for letter, text in question.alternatives
    )


def _format_sources(sources: list[dict]) -> str:
    if not sources:
        return "(Nenhuma fonte jurídica selecionada.)"

    blocks: list[str] = []

    for index, source in enumerate(sources, start=1):
        source_id = f"S{index}"

        blocks.append(
            "\n".join(
                [
                    f"[{source_id}]",
                    f"Referência: {source.get('referencia', '')}",
                    f"Texto jurídico: {source.get('texto', '')}",
                    f"Fonte: {source.get('fonte', '')}",
                    f"URL oficial: {source.get('url_oficial', '')}",
                ]
            )
        )

    return "\n\n".join(blocks)


def build_structured_explanation_prompt(
    question: QuestionInput,
    sources: list[dict],
    section_keys: list[str] | tuple[str, ...] | None = None,
) -> str:
    """`section_keys` restricts the prompt to a subset of SECTIONS (see
    SECTION_GROUPS) — used to split one 10-section generation into two
    smaller, faster calls. Defaults to all 10 keys when omitted, so
    existing single-call callers are unaffected.
    """
    keys = list(section_keys) if section_keys is not None else list(SECTIONS.keys())
    correct_text = _correct_text(question)

    template = {
        key: {
            "text": "<explicação aprofundada, didática e proporcional à complexidade do tópico>",
            "evidenceQuotes": [
                {"sourceId": "S1", "quote": "<trecho literal da fonte S1, se aplicável>"}
            ],
        }
        for key in keys
    }
    if "practicalCase" in template:
        template["practicalCase"]["evidenceQuotes"] = []

    topic_rules = "\n\n".join(_TOPIC_RULES[key] for key in keys)

    return f"""{TEACHER_PERSONA}\n\n{SYSTEM_RULES}\n\n{DEEP_EXPLANATION_RULES}\n
=== QUESTÃO OFICIAL ===

Matéria:
{question.subject or "não informada"}

Enunciado:
{question.statement}

Alternativas:
{_format_alternatives(question)}

GABARITO OFICIAL DEFINITIVO:
{question.correct_letter}) {correct_text}

O gabarito acima é um dado de entrada.
NÃO resolva novamente a questão.
NÃO escolha outra alternativa.
Sua única tarefa é explicar o gabarito oficial.

=== FONTES JURÍDICAS AUTORIZADAS ===

{_format_sources(sources)}

=== REGRAS OBRIGATÓRIAS ===

Responda SOMENTE com JSON válido — a resposta inteira, de abertura a
fechamento, deve ser um único objeto JSON.

Não envolva essa resposta JSON em blocos ```json ou qualquer outro bloco
de código. Não escreva introdução. Não escreva conclusão fora do JSON.

Essa regra é sobre o INVÓLUCRO da resposta, não sobre o conteúdo de
"text". DENTRO de cada campo "text" (que é sempre uma string), USE
Markdown livremente para tornar a explicação mais didática:
- **negrito** em termos jurídicos-chave, artigos e institutos centrais;
- listas numeradas para sequências, etapas ou requisitos (ex.: as fases
  de um procedimento, em ordem);
- listas com marcadores para comparações ou enumerações;
- blockquote (`>`) ao transcrever um trecho literal de lei/súmula que
  você tenha certeza do teor — nunca invente o texto dentro do blockquote;
- uma tabela Markdown curta em qualquer tópico sempre que uma comparação
  lado a lado ajudar mais que um parágrafo (ver também a regra específica
  abaixo para o tópico de diferenciação entre institutos).

Uma explicação só de texto corrido, sem nenhuma ênfase ou estrutura, é
exatamente o padrão raso que este Método VR aprofundado substitui.

Use exatamente estas {len(keys)} chaves:

{", ".join(keys)}

Cada tópico deve conter EXATAMENTE estes dois campos:

"text": string com explicação didática e aprofundada. A extensão deve
ser proporcional ao conteúdo. Não repita desnecessariamente o enunciado
e não duplique explicações entre tópicos, mas desenvolva o raciocínio
jurídico sempre que isso ajudar o aluno a compreender e revisar o tema.
"evidenceQuotes": lista de {{"sourceId": "S1", "quote": "trecho literal da fonte S1"}}

NÃO inclua um campo "sourcesUsed". Esse campo não existe mais neste
formato — o sistema calcula sozinho, a partir de evidenceQuotes válidas,
quais fontes foram usadas. Incluí-lo não tem nenhum efeito; omita-o.

Os únicos IDs de fonte permitidos são:
S1, S2, S3 etc., conforme as fontes apresentadas acima.

evidenceQuotes são âncoras literais das fontes, não uma exigência para cada
frase da explicação.

Quando uma afirmação estiver diretamente sustentada por uma das fontes,
inclua em evidenceQuotes um trecho LITERAL copiado exatamente dessa fonte.

Se uma parte da explicação for conhecimento jurídico complementar e não
existir trecho literal correspondente nas fontes fornecidas, mantenha a
explicação e deixe evidenceQuotes vazio para essa parte.

NUNCA invente evidenceQuotes.

Se evidenceQuotes for preenchido:
- sourceId deve existir;
- quote deve existir literalmente na fonte correspondente;
- não parafraseie dentro de quote.

Uma evidenceQuote falsa ou não literal é erro de validação.

REGRAS POR TÓPICO:

{topic_rules}

REGRA DE INSUFICIÊNCIA:

A insuficiência da fonte, sozinha, NÃO obriga a apagar uma explicação
juridicamente correta.

Use:

"{INSUFFICIENT}"

somente quando realmente não for possível produzir conteúdo juridicamente
seguro para aquele tópico.

Quando a explicação puder ser complementada de forma segura com conhecimento
jurídico, escreva a explicação normalmente e deixe evidenceQuotes vazio se
não houver citação literal correspondente.

Os identificadores S1, S2, S3 etc. devem aparecer SOMENTE dentro do campo
"sourceId" de evidenceQuotes.
Nunca escreva "S1", "S2", "S3" ou outro identificador interno dentro do
campo "text". No texto destinado ao aluno, cite apenas a referência
jurídica normal, como "art. 332 do Código Penal".

As keywords usadas pelo buscador NÃO são fontes jurídicas.

Seja didático e objetivo, mas não superficial. Respostas completas e
bem organizadas são preferíveis a respostas artificialmente curtas
quando o tema exigir aprofundamento.

=== FORMATO JSON OBRIGATÓRIO ===

{json.dumps(template, ensure_ascii=False, indent=2)}
"""


def _strip_json_fence(raw: str) -> str:
    text = raw.strip()

    if text.startswith("```json") and text.endswith("```"):
        return text[len("```json"):-3].strip()

    if text.startswith("```") and text.endswith("```"):
        return text[3:-3].strip()

    return text


def _normalize_whitespace(text: str) -> str:
    return " ".join(text.split())


def _sanitize_source_id_leaks(text: str) -> str:
    """Deterministic, regex-only cleanup of common leaked-ID phrasings
    ("conforme S1", "(S1)", ", S2", "fonte S3", ...). Never touches legal
    content — only removes the ID mention (and its immediate connecting
    punctuation/word). Callers must re-check RE_SOURCE_ID_LEAK afterwards;
    this function makes no guarantee the result is clean.
    """
    cleaned = text
    for pattern in _LEAK_REMOVAL_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    cleaned = re.sub(r"\s+([.,;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    return cleaned


def _quote_is_valid(item: object, sources: list[dict], allowed_source_ids: set[str]) -> bool:
    """A literal, auditable anchor check — never a semantic judgment.
    Returning True only proves the quoted string exists verbatim
    (whitespace aside) in the cited source's own text; it says nothing
    about whether the surrounding claim correctly interprets that text.
    """
    if not isinstance(item, dict) or set(item.keys()) != {"sourceId", "quote"}:
        return False

    source_id = item.get("sourceId")
    quote = item.get("quote")

    if source_id not in allowed_source_ids:
        return False
    if not isinstance(quote, str) or not quote.strip():
        return False

    source_index = int(str(source_id)[1:]) - 1
    if not (0 <= source_index < len(sources)):
        return False

    source_text = sources[source_index].get("texto", "") or ""
    return _normalize_whitespace(quote) in _normalize_whitespace(source_text)


def _dedupe_preserve_order(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in seq:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def process_structured_explanation(
    raw: str,
    sources: list[dict],
    section_keys: list[str] | tuple[str, ...] | None = None,
) -> dict:
    """`section_keys` restricts validation to a subset of SECTIONS (see
    SECTION_GROUPS) — pass the same keys used to build the prompt when
    processing a partial (grouped) generation. Defaults to all 10 keys.

    The model is asked ONLY for {"text", "evidenceQuotes"} per section —
    `sourcesUsed` is never requested and never trusted from the model; it
    is always DERIVED here from evidenceQuotes that pass literal
    verification against the cited source's own text. This removes the
    model's most common (and most harmless) failure mode observed in
    practice: writing a well-grounded sentence but forgetting to also
    declare it in a separate sourcesUsed list.

    Returns:
      {
        "status": "approved" | "approved_with_gaps" | "rejected",
        "sections": {key: {"text", "sourcesUsed", "evidenceQuotes"}} | None,
        "downgrades": [{"section": key, "reason": str}],
        "errors": [str],  # populated only when status == "rejected"
      }

    "approved_with_gaps" means the explanation is safe to show, but the
    model itself declared genuine uncertainty for one or more sections
    (the literal insufficiency sentence) — never merely the absence of a
    local evidenceQuote. A section with deep, correct complementary legal
    knowledge and zero evidenceQuotes is "approved", not "approved_with_gaps":
    the source set is an anchor for evidenceQuotes/gabarito, not a ceiling
    on what the explanation is allowed to teach.

    A missing evidenceQuote does NOT erase otherwise valid explanatory text,
    and does NOT downgrade the status on its own.

    "rejected" is reserved for failures that make the response unsafe or
    impossible to process, including invalid JSON, broken structure or a
    supplied evidenceQuote that is not literal / references an invalid
    source.
    """
    cleaned = _strip_json_fence(raw)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        return {"status": "rejected", "sections": None, "downgrades": [], "errors": [f"JSON inválido: {exc}"]}

    if not isinstance(data, dict):
        return {
            "status": "rejected",
            "sections": None,
            "downgrades": [],
            "errors": ["A raiz da resposta precisa ser um objeto JSON."],
        }

    keys_order = list(section_keys) if section_keys is not None else list(SECTIONS.keys())
    expected_keys = set(keys_order)
    actual_keys = set(data.keys())
    missing = expected_keys - actual_keys
    extra = actual_keys - expected_keys

    errors: list[str] = []
    if missing:
        errors.append("Tópicos ausentes: " + ", ".join(sorted(missing)))
    if extra:
        errors.append("Tópicos inesperados: " + ", ".join(sorted(extra)))
    if errors:
        return {"status": "rejected", "sections": None, "downgrades": [], "errors": errors}

    allowed_source_ids = {f"S{i}" for i in range(1, len(sources) + 1)}

    processed: dict = {}
    downgrades: list[dict] = []

    for key in keys_order:
        section = data[key]

        if not isinstance(section, dict):
            return {
                "status": "rejected",
                "sections": None,
                "downgrades": [],
                "errors": [f"{key}: precisa ser um objeto JSON."],
            }

        text = section.get("text")
        if not isinstance(text, str) or not text.strip():
            return {
                "status": "rejected",
                "sections": None,
                "downgrades": [],
                "errors": [f"{key}: text precisa ser uma string não vazia."],
            }
        text = text.strip()

        quotes_raw = section.get("evidenceQuotes", [])
        if not isinstance(quotes_raw, list):
            return {
                "status": "rejected",
                "sections": None,
                "downgrades": [],
                "errors": [f"{key}: evidenceQuotes precisa ser uma lista."],
            }

        valid_quotes = [q for q in quotes_raw if _quote_is_valid(q, sources, allowed_source_ids)]

        # Se o modelo forneceu evidenceQuote, TODAS precisam ser válidas.
        # Citação inventada / sourceId inexistente é erro bloqueante.
        if quotes_raw and len(valid_quotes) != len(quotes_raw):
            return {
                "status": "rejected",
                "sections": None,
                "downgrades": [],
                "errors": [
                    f"{key}: existe evidenceQuote inválida, não literal ou com sourceId inexistente."
                ],
            }

        derived_sources_used = _dedupe_preserve_order(
            [q["sourceId"] for q in valid_quotes]
        )

        is_insufficient = text == INSUFFICIENT
        downgraded = False
        downgrade_reason: str | None = None

        if key == "practicalCase":
            final_text, final_quotes, final_sources_used = (
                text,
                valid_quotes,
                derived_sources_used,
            )

        elif is_insufficient:
            # O modelo se recusou a afirmar algo com segurança para ESTE
            # tópico isolado — build_app_explanation já descarta esse
            # tópico da visão do aluno, então o resto da explicação segue
            # completa e não fica "com lacunas" aos olhos de quem lê.
            # Não é mais tratado como downgrade do status geral.
            final_text, final_quotes, final_sources_used = (
                INSUFFICIENT,
                [],
                [],
            )

        else:
            # Fonte = âncora, não prisão da explicação. A ausência de
            # evidenceQuote literal não apaga o texto e não rebaixa o
            # status — conhecimento jurídico complementar sem citação local
            # é esperado e desejável (ver DEEP_EXPLANATION_RULES), não um
            # sinal de qualidade inferior. O único gatilho real de "gaps"
            # que sobra é um vazamento de ID de fonte não sanitizável
            # (abaixo) — um problema técnico real, não de conteúdo.
            final_text, final_quotes, final_sources_used = (
                text,
                valid_quotes,
                derived_sources_used,
            )

        # ID-leak sanitization applies regardless of section/downgrade
        # state above — a leak in an otherwise-safe sentence is still a
        # leak, and practicalCase is not exempt either.
        if RE_SOURCE_ID_LEAK.search(final_text):
            sanitized = _sanitize_source_id_leaks(final_text)
            if sanitized and not RE_SOURCE_ID_LEAK.search(sanitized):
                final_text = sanitized
            elif not downgraded:
                final_text, final_quotes, final_sources_used = INSUFFICIENT, [], []
                downgraded = True
                downgrade_reason = (
                    "identificador interno de fonte vazado no texto e não removível com "
                    "segurança — seção substituída pela frase de insuficiência"
                )

        if downgraded:
            downgrades.append({"section": key, "reason": downgrade_reason})

        processed[key] = {
            "text": final_text,
            "sourcesUsed": final_sources_used,
            "evidenceQuotes": final_quotes,
        }

    status = "approved_with_gaps" if downgrades else "approved"
    return {"status": status, "sections": processed, "downgrades": downgrades, "errors": []}


def merge_processed_explanations(parts: list[dict]) -> dict:
    """Combines multiple process_structured_explanation results — each
    covering a different, non-overlapping group of SECTIONS (see
    SECTION_GROUPS) — into one final result covering all 10 topics.

    Any rejected part rejects the whole explanation (its errors are
    collected from every rejected part). Otherwise, sections and
    downgrades from every part are combined, and the merged status is
    "approved_with_gaps" if any part had a downgrade, "approved"
    otherwise.
    """
    rejected_parts = [p for p in parts if p["status"] == "rejected"]
    if rejected_parts:
        errors = [e for p in rejected_parts for e in p["errors"]]
        return {"status": "rejected", "sections": None, "downgrades": [], "errors": errors}

    sections: dict = {}
    downgrades: list[dict] = []
    for part in parts:
        sections.update(part["sections"])
        downgrades.extend(part["downgrades"])

    missing = set(SECTIONS.keys()) - set(sections.keys())
    if missing:
        return {
            "status": "rejected",
            "sections": None,
            "downgrades": [],
            "errors": [f"Tópicos ausentes após combinar blocos: {', '.join(sorted(missing))}"],
        }

    status = "approved_with_gaps" if downgrades else "approved"
    return {"status": status, "sections": sections, "downgrades": downgrades, "errors": []}


def build_app_explanation(sections: dict) -> dict:
    """Student-facing view of a processed `sections` dict (from
    process_structured_explanation / merge_processed_explanations):
    just {key: text}, and only for topics that actually have content — a
    topic whose text is exactly the insufficiency sentence is dropped
    entirely, so the frontend only has to render what's there. `text`
    already can never contain "S1"/"S2" (RE_SOURCE_ID_LEAK is enforced
    before a section is ever finalized), so this never needs to sanitize
    anything itself — it's a pure filter.
    """
    return {key: section["text"] for key, section in sections.items() if section["text"] != INSUFFICIENT}
