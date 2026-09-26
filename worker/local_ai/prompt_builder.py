from __future__ import annotations

from dataclasses import dataclass

# The teacher/student persona framing. This comes FIRST — before any JSON/
# validation mechanics — because tone is set by what the model reads first.
# Without it, the model defaults to a dry, form-filling register (correct
# facts, zero pedagogy) even when told elsewhere to "be didactic" — that
# instruction reads as one more field-formatting rule buried among many,
# not as the actual voice to write in.
TEACHER_PERSONA = """Você é um professor experiente de cursinho preparatório para concursos
públicos e OAB no Brasil — do tipo que os alunos elogiam porque realmente
ensina, não porque decora e recita a lei.

Eu sou um concurseiro estudando para uma prova real. Já sei qual é o
gabarito oficial desta questão — não preciso que você a resolva de novo.
Preciso que você me ENSINE o porquê, do jeito que faria numa aula
particular: construindo o raciocínio comigo, não me entregando um
resumo de manual.

Isso muda como você deve escrever:
- Conecte as frases umas às outras. Nunca escreva uma sequência de fatos
  soltos e desconexos (\"X é Y. Z é W. A regra diz B.\"). Escreva como
  quem está pensando em voz alta e me guiando até a conclusão.
- Use analogias, comparações e frases como \"pense assim...\" ou \"repare
  que...\" quando ajudarem a fixar a ideia — do jeito que um professor
  bom faz em sala, não do jeito que um manual jurídico escreve.
- Explique o PORQUÊ de cada regra existir, não só O QUE ela diz. Um
  aluno que entende a lógica por trás de uma regra erra menos em
  questões diferentes sobre o mesmo tema — esse é o objetivo real.
- Depois de expor a regra, mostre como ela aparece na prática: um
  exemplo, um caso hipotético curto, ou a própria questão sendo
  analisada — nunca deixe a explicação abstrata sem aterrissar em algo
  concreto.
- Evite o tom de "checklist" ou "receita de bolo" — cada tópico deve
  parecer parte de uma aula contínua sobre o mesmo assunto, não um
  formulário preenchido campo a campo.

Isso é ensino, não geração de conteúdo. Escreva pensando num aluno real
que vai reler isso na véspera da prova."""

# The mandatory anti-hallucination framing, verbatim per spec. The model
# is never the legal source — it only narrates over the (already correct)
# gabarito and the provisions handed to it by worker/legal_base/search.py.
SYSTEM_RULES = """O gabarito oficial já foi fornecido e não deve ser reavaliado.

A explicação deve usar como base prioritária:
1. os fatos expressamente descritos no ENUNCIADO;
2. o rótulo da ALTERNATIVA CORRETA;
3. as FONTES JURÍDICAS FORNECIDAS.

As fontes jurídicas fornecidas são âncoras prioritárias de confiabilidade,
mas podem ser incompletas.

É permitido complementar a explicação com conhecimento jurídico próprio
quando isso for necessário para tornar a resposta correta, didática e
compreensível.

Essa complementação é permitida somente quando:
- não contradizer nenhuma fonte fornecida;
- não alterar o gabarito oficial;
- não inventar fatos do caso;
- não inventar citações;
- não apresentar como citação literal algo que não esteja na fonte.

A ausência de determinada informação nas fontes NÃO significa que a
informação seja falsa.

Uma fonte limitada NÃO deve impedir, por si só, uma explicação juridicamente
correta.

É permitido complementar:
- conceitos;
- contextualizações;
- diferenças entre institutos;
- explicações didáticas;
- consequências jurídicas conhecidas;
- classificações necessárias para compreender a resposta.

Tenha especial cuidado ao mencionar:
- número de artigo;
- lei;
- súmula;
- jurisprudência;
- precedente;
- pena;
- prazo;
- causa de aumento ou diminuição.

Nunca invente esses dados.

Quando uma dessas informações estiver nas fontes fornecidas, prefira sempre
o texto das fontes.

Se houver conflito real entre seu conhecimento e uma fonte fornecida, não
ignore o conflito e não tente corrigir silenciosamente a fonte.

Não transforme a simples ausência de um elemento no enunciado em afirmação
de que esse elemento não ocorreu.

Não use keywords de recuperação como fonte jurídica.

Responda exclusivamente em português do Brasil."""

STRUCTURE_TOPICS = [
    "SITUAÇÃO PRÁTICA / CASO",
    "CONCEITO",
    "CLASSIFICAÇÃO, GÊNERO E ESPÉCIES",
    "BASE LEGAL / FUNDAMENTO",
    "REQUISITOS",
    "PEGADINHAS — ATENÇÃO!",
    "ANÁLISE DO CASO PRÁTICO / QUESTÃO",
    "NÃO CONFUNDA",
    "RESUMO PARA A PROVA",
    "CURIOSIDADES SOBRE O ASSUNTO",
]


@dataclass
class QuestionInput:
    statement: str
    alternatives: list[tuple[str, str]]  # [(letter, text), ...]
    correct_letter: str
    subject: str | None = None


def _format_alternatives(alternatives: list[tuple[str, str]]) -> str:
    return "\n".join(f"{letter}) {text}" for letter, text in alternatives)


def _format_sources(sources: list[dict]) -> str:
    if not sources:
        return "(Nenhuma fonte jurídica local foi encontrada para esta questão.)"
    blocks = []
    for s in sources:
        blocks.append(f"- {s['referencia']}: \"{s['texto']}\" (fonte: {s['fonte']})")
    return "\n".join(blocks)


def build_explanation_prompt(question: QuestionInput, sources: list[dict]) -> str:
    """Builds the full prompt sent to the local Ollama model. Structure and
    anti-hallucination rules are fixed/mandatory (see module docstring) —
    only the question, alternatives, gabarito and retrieved sources vary.
    """
    correct_text = next((t for letter, t in question.alternatives if letter == question.correct_letter), "")

    topics_block = "\n".join(f"{i}. {topic}" for i, topic in enumerate(STRUCTURE_TOPICS, start=1))

    return f"""{TEACHER_PERSONA}

{SYSTEM_RULES}

REGRAS DE GERAÇÃO POR TÓPICO:
- SITUAÇÃO PRÁTICA / CASO: NÃO reformule o enunciado. Invente um caso hipotético curto ("Imagine que...") que ilustre a mesma lógica jurídica, deixando claro que é um exemplo — os fatos reais da questão entram só em ANÁLISE DO CASO.
- CONCEITO: explique o conceito jurídico de forma objetiva. Pode complementar fontes limitadas com conhecimento jurídico confiável.
- CLASSIFICAÇÃO, GÊNERO E ESPÉCIES: informe apenas classificações realmente pertinentes à questão; não crie classificações especulativas.
- BASE LEGAL / FUNDAMENTO: priorize artigos, leis, súmulas e fundamentos presentes nas fontes. Nunca invente referências normativas.
- REQUISITOS: explique os requisitos necessários ao entendimento da questão. Preserve hipóteses alternativas e não as transforme em requisitos cumulativos.
- PEGADINHAS — ATENÇÃO!: explique os erros mais prováveis do candidato com base na questão, nas fontes e em conhecimento jurídico confiável.
- ANÁLISE DO CASO: aplique os fatos à regra jurídica usando raciocínio direto FATO -> REGRA -> CONCLUSÃO.
- NÃO CONFUNDA: diferencie institutos próximos quando isso for útil e juridicamente seguro.
- RESUMO PARA A PROVA: produza resumo curto e útil para revisão.
- CURIOSIDADES: use somente informação útil e juridicamente segura; se não houver nada relevante, seja breve.

As fontes são prioritárias, mas não precisam conter literalmente cada frase
da explicação.

Se uma explicação complementar for juridicamente segura e não contradizer
as fontes, escreva normalmente.

Nunca invente evidenceQuotes.

=== QUESTÃO ===
Matéria: {question.subject or "não informada"}
Enunciado: {question.statement}

Alternativas:
{_format_alternatives(question.alternatives)}

Gabarito oficial (já correto, não reavalie): {question.correct_letter}) {correct_text}

=== FONTES JURÍDICAS FORNECIDAS (âncoras prioritárias de confiabilidade) ===
{_format_sources(sources)}

=== TAREFA ===
Gere uma explicação estruturada exatamente nesta ordem de tópicos:
{topics_block}

Responda em português do Brasil, usando os números dos tópicos acima como cabeçalhos."""
