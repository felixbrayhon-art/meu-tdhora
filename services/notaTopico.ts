// Nota de 0 a 100 por tópico — o quanto o aluno domina aquele assunto AGORA.
//
// Substitui o `heat` por matéria, que era movido por números chutados (+10 ao revisar, -5 ao errar, +1 a
// cada 2 minutos de estudo) e nunca caía sozinho. A nota aqui tem duas partes:
//
//   1. O que o desempenho diz. Cada atividade concluída entra como um evento com acerto de 0 a 1. Questões
//      e discursivas pesam mais: são as que mais se parecem com a prova.
//   2. O que o tempo tira. A nota mostrada cai a cada dia sem estudar, pela mesma curva de esquecimento dos
//      flashcards (services/fsrs.ts). O que muda de tópico para tópico é a ESTABILIDADE: quanto mais o
//      aluno domina, mais devagar cai; quanto mais difícil ou mais cobrado o assunto, mais rápido.
//
// A data da próxima revisão sai daí: é o dia em que a nota cruza o alvo do tópico. Indo bem, isso demora;
// errando, cai rápido e a revisão é antecipada. Não há escada fixa de 1/7/30 dias.

import { diasAteRetencao, retencao } from './fsrs';

export type TipoAtividade = 'questoes' | 'discursiva' | 'flashcards' | 'revisao' | 'mapa';

/**
 * Peso de cada atividade na nota. Questões e discursivas valem o triplo de um flashcard: resolver questão
 * de banca é a atividade que mais se aproxima da prova, e lembrar uma carta é o degrau mais fácil.
 *
 * `discursiva` e `mapa` ainda não têm tela no app — ficam aqui prontas, e passam a contar sozinhas no dia
 * em que alguém chamar `registrar` com elas.
 */
export const PESOS: Record<TipoAtividade, number> = {
  questoes: 3,
  discursiva: 3,
  flashcards: 1,
  revisao: 1,
  mapa: 1,
};

export interface NotaTopico {
  /** Chave do tópico: "Matéria::Assunto". */
  id: string;
  materia: string;
  assunto: string;
  /** A nota no instante da última atividade, 0 a 100. A nota de hoje sai de `notaHoje`. */
  base: number;
  /** Quando a base foi medida. */
  medidaEm: number;
  /** Dias até a lembrança daquele assunto cair a 90%. Cresce com acerto, encolhe com erro. */
  estabilidade: number;
  /** 1 (fácil) a 10 (difícil) PARA ESTE ALUNO, aprendida dos resultados. */
  dificuldade: number;
  /** 0 a 1: o quanto o assunto é cobrado em prova. 0,5 = sem informação. */
  incidencia: number;
  /** Soma dos pesos já acumulados: diz o quanto a nota já é confiável. */
  evidencia: number;
  /** Quando ele deve voltar a ser revisado (timestamp). */
  proximaRevisao: number;
}

export interface Evento {
  materia: string;
  assunto: string;
  tipo: TipoAtividade;
  /** 0 a 1. Em questões, a taxa de acerto; em revisão, 1 ou 0. */
  acerto: number;
  /** Quantos itens a atividade teve (questões, cartas…). Uma amostra maior move mais a nota. */
  itens?: number;
  quando?: number;
}

const DIA = 24 * 60 * 60 * 1000;
const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const chaveTopico = (materia: string, assunto: string) => `${materia.trim()}::${assunto.trim()}`;

/** Estabilidade inicial, em dias: um assunto recém-estudado é lembrado por poucos dias. */
const ESTABILIDADE_INICIAL = 2;

/**
 * Quanto um evento puxa a nota. Depende do peso da atividade e do tamanho da amostra: acertar 20 questões
 * diz muito mais que acertar 1. Nunca chega a 1 — uma única sessão não apaga todo o histórico.
 */
const forca = (tipo: TipoAtividade, itens: number) => {
  const amostra = Math.min(itens, 30);
  const massa = PESOS[tipo] * amostra;
  return entre(massa / (massa + 12), 0.05, 0.75);
};

/**
 * Teto da estabilidade de um tópico, em dias. Um flashcard pode ir para um ano sem problema, mas um assunto
 * inteiro de edital, não: quem estuda para prova precisa reencontrar o assunto algumas vezes por semestre,
 * mesmo dominando. Sem esse teto, quatro sessões boas mandavam a revisão para daqui a 3 meses e meio.
 */
const TETO_ESTABILIDADE = 120;

/** Abaixo disto o resultado conta como "não foi bem" e a estabilidade encolhe em vez de crescer. */
const LIMIAR_BOM = 0.6;

/**
 * A estabilidade cresce quando o aluno acerta e encolhe quando erra. Três freios, como o enunciado pede:
 * assunto difícil ganha menos, assunto muito cobrado ganha menos (precisa voltar mais vezes), e o ganho
 * encolhe conforme a estabilidade já é alta — senão o intervalo dobra para sempre e some do horizonte.
 */
const novaEstabilidade = (atual: number, acerto: number, dificuldade: number, incidencia: number, peso: number) => {
  if (acerto < LIMIAR_BOM) {
    // Vai para baixo, mas não para zero: ficar preso em "revise amanhã" todo dia não ensina ninguém.
    const queda = 0.3 + 0.6 * (acerto / LIMIAR_BOM);
    return Math.max(1, atual * entre(queda, 0.3, 0.9));
  }
  const qualidade = (acerto - LIMIAR_BOM) / (1 - LIMIAR_BOM); // 0 a 1
  const facilidade = (11 - dificuldade) / 10; // 1 = fácil, 0,1 = difícil
  const cobranca = 1 - 0.35 * incidencia; // muito cobrado = esquece mais rápido, cresce menos
  const freio = 1 / (1 + atual / 45); // retornos decrescentes
  const ganho = 1 + 1.6 * qualidade * facilidade * cobranca * freio * Math.min(1, peso / 3);
  return Math.min(TETO_ESTABILIDADE, atual * ganho);
};

/** A dificuldade aprende com o resultado, do mesmo jeito que o FSRS aprende a da carta. */
const novaDificuldade = (atual: number, acerto: number) => {
  const alvo = 10 - acerto * 9; // acertou tudo → 1; errou tudo → 10
  return entre(atual + (alvo - atual) * 0.3, 1, 10);
};

/**
 * Alvo de retenção do tópico: o ponto em que a revisão é marcada. Assunto difícil ou muito cobrado tem alvo
 * mais alto, ou seja, volta antes — é o aluno não poder se dar ao luxo de esquecer.
 */
const retencaoAlvo = (dificuldade: number, incidencia: number) =>
  entre(0.78 + 0.07 * ((dificuldade - 1) / 9) + 0.07 * incidencia, 0.78, 0.93);

export const topicoNovo = (materia: string, assunto: string, agora = Date.now()): NotaTopico => ({
  id: chaveTopico(materia, assunto),
  materia,
  assunto,
  base: 50,
  medidaEm: agora,
  estabilidade: ESTABILIDADE_INICIAL,
  dificuldade: 5,
  incidencia: 0.5,
  evidencia: 0,
  proximaRevisao: agora + DIA,
});

/** A nota de hoje: a base medida, corroída pelos dias sem estudar. */
export const notaHoje = (topico: NotaTopico, agora = Date.now()): number => {
  const dias = Math.max(0, (agora - topico.medidaEm) / DIA);
  return Math.round(topico.base * retencao(dias, topico.estabilidade));
};

/** Quantos dias faltam para a revisão (negativo = atrasada). */
export const diasParaRevisao = (topico: NotaTopico, agora = Date.now()): number =>
  Math.round((topico.proximaRevisao - agora) / DIA);

export const estaVencido = (topico: NotaTopico, agora = Date.now()): boolean => topico.proximaRevisao <= agora;

/** Aplica uma atividade concluída e devolve o tópico atualizado. */
export const registrar = (anterior: NotaTopico | undefined, evento: Evento): NotaTopico => {
  const agora = evento.quando ?? Date.now();
  const topico = anterior ?? topicoNovo(evento.materia, evento.assunto, agora);
  const acerto = entre(evento.acerto, 0, 1);
  const itens = Math.max(1, evento.itens ?? 1);
  const peso = PESOS[evento.tipo];

  // A nota parte de onde ela REALMENTE está hoje, não da base antiga: senão um tópico abandonado há meses
  // voltaria do nada ao que era antes.
  const partida = anterior ? notaHoje(topico, agora) : topico.base;
  const alvo = acerto * 100;
  const base = entre(partida + (alvo - partida) * forca(evento.tipo, itens), 0, 100);

  const dificuldade = novaDificuldade(topico.dificuldade, acerto);
  const estabilidade = novaEstabilidade(topico.estabilidade, acerto, dificuldade, topico.incidencia, peso);
  const dias = Math.max(1, Math.round(diasAteRetencao(estabilidade, retencaoAlvo(dificuldade, topico.incidencia))));

  return {
    ...topico,
    base,
    medidaEm: agora,
    dificuldade,
    estabilidade,
    evidencia: topico.evidencia + peso * Math.min(itens, 30),
    proximaRevisao: agora + dias * DIA,
  };
};

/** Marca o quanto o assunto é cobrado (0 a 1). Vale para a velocidade da queda e para o alvo da revisão. */
export const definirIncidencia = (topico: NotaTopico, incidencia: number): NotaTopico => ({
  ...topico,
  incidencia: entre(incidencia, 0, 1),
});

/** A nota da matéria é a média das notas dos seus tópicos, pesada pela evidência de cada um. */
export const notaDaMateria = (topicos: NotaTopico[], materia: string, agora = Date.now()): number | null => {
  const dela = topicos.filter((t) => t.materia === materia);
  if (!dela.length) return null;
  let soma = 0;
  let pesos = 0;
  dela.forEach((t) => {
    // Tópico sem nenhuma atividade ainda pesa pouco, mas não zero: ele existe e não foi estudado.
    const p = 1 + Math.min(t.evidencia, 60);
    soma += notaHoje(t, agora) * p;
    pesos += p;
  });
  return Math.round(soma / pesos);
};

/** Fila do dia: o que já venceu, pior nota primeiro. */
export const filaDeRevisao = (topicos: NotaTopico[], agora = Date.now()): NotaTopico[] =>
  topicos.filter((t) => estaVencido(t, agora)).sort((a, b) => notaHoje(a, agora) - notaHoje(b, agora));

/** Como mostrar a nota na tela. */
export const faixaDaNota = (nota: number): { rotulo: string; cor: string } => {
  if (nota >= 80) return { rotulo: 'Dominado', cor: '#2f7d4f' };
  if (nota >= 60) return { rotulo: 'Firme', cor: '#7a9c3e' };
  if (nota >= 40) return { rotulo: 'Oscilando', cor: '#d9772b' };
  if (nota >= 20) return { rotulo: 'Frágil', cor: '#c2410c' };
  return { rotulo: 'Esquecido', cor: '#9b2c2c' };
};
