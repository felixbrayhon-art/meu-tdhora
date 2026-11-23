// FSRS (Free Spaced Repetition Scheduler) — decide quando cada flashcard volta.
//
// Substitui o SM-2 que estava escrito à mão dentro do FlashcardView. A diferença que importa: o SM-2 guarda
// só um "fator de facilidade" e multiplica o intervalo por ele. O FSRS modela três coisas separadas —
//
//   Estabilidade (S): em quantos dias a memória daquela carta cai para 90%. Cresce a cada acerto.
//   Dificuldade (D): de 1 a 10, o quanto aquela carta é dura PARA ESTE ALUNO. Aprendida das respostas.
//   Retenção (R): a chance de lembrar agora, dada por quanto tempo passou e pela estabilidade.
//
// — e por isso erra menos em carta difícil (o SM-2 dava intervalos longos demais) e não desperdiça revisão
// em carta fácil.
//
// Os pesos abaixo são os padrões publicados do FSRS-5. Não são personalizados: personalizar exige rodar um
// otimizador sobre o histórico do aluno, o que não é feito aqui. Ainda assim, o padrão já acerta bem mais
// que o SM-2 de fator fixo.
//
// A mesma curva de esquecimento é usada pela nota do tópico (services/notaTopico.ts), de propósito: a
// carta e o assunto esquecem do mesmo jeito, só com estabilidades diferentes.

/** Como o aluno se saiu na carta. Mesmos nomes do FSRS. */
export type Nota = 1 | 2 | 3 | 4; // 1 errou, 2 difícil, 3 bom, 4 fácil

export interface EstadoCarta {
  /** Dias até a retenção cair a 90%. */
  estabilidade: number;
  /** 1 (fácil) a 10 (difícil), para este aluno. */
  dificuldade: number;
  /** Quantas revisões já aconteceram. */
  revisoes: number;
  /** Quando ela deve voltar (timestamp). */
  proximaRevisao: number;
  /** Intervalo em dias que foi dado na última vez. */
  intervalo: number;
}

// Pesos padrão do FSRS-5.
const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

/** Expoente da curva de esquecimento, e o fator que a faz passar por 90% em t = S. */
export const DECAIMENTO = -0.5;
export const FATOR = 19 / 81; // 0.9^(1/DECAIMENTO) - 1

const DIA = 24 * 60 * 60 * 1000;
const entre = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));

/**
 * Chance de lembrar depois de `dias` sem ver, com estabilidade `estabilidade`.
 * Em dias = estabilidade, dá 0,9 — é essa a definição de estabilidade.
 */
export const retencao = (dias: number, estabilidade: number): number => {
  if (estabilidade <= 0) return 0;
  return Math.pow(1 + (FATOR * Math.max(0, dias)) / estabilidade, DECAIMENTO);
};

/** Quantos dias até a retenção cair ao alvo (o inverso de `retencao`). */
export const diasAteRetencao = (estabilidade: number, alvo: number): number => {
  const r = entre(alvo, 0.5, 0.995);
  return (estabilidade / FATOR) * (Math.pow(r, 1 / DECAIMENTO) - 1);
};

const dificuldadeInicial = (nota: Nota) => entre(W[4] - Math.exp(W[5] * (nota - 1)) + 1, 1, 10);

const proximaDificuldade = (dificuldade: number, nota: Nota) => {
  const delta = -W[6] * (nota - 3);
  // Amortecimento: quem já está perto de 10 sobe pouco; quem está perto de 1 desce pouco.
  const movida = dificuldade + (delta * (10 - dificuldade)) / 9;
  // Volta devagar para a dificuldade de uma carta "fácil": sem isso, uma sequência ruim trava a carta no 10.
  return entre(W[7] * dificuldadeInicial(4) + (1 - W[7]) * movida, 1, 10);
};

const estabilidadeAcerto = (estabilidade: number, dificuldade: number, r: number, nota: Nota) => {
  const penalidadeDificil = nota === 2 ? W[15] : 1;
  const bonusFacil = nota === 4 ? W[16] : 1;
  const crescimento =
    Math.exp(W[8]) *
    (11 - dificuldade) *
    Math.pow(estabilidade, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    penalidadeDificil *
    bonusFacil;
  return estabilidade * (1 + crescimento);
};

const estabilidadeErro = (estabilidade: number, dificuldade: number, r: number) => {
  const nova = W[11] * Math.pow(dificuldade, -W[12]) * (Math.pow(estabilidade + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  // Errar nunca deixa a carta mais estável do que já era.
  return Math.min(nova, estabilidade);
};

/** Estado de uma carta que nunca foi revisada. */
export const primeiraRevisao = (nota: Nota, agora = Date.now(), retencaoAlvo = 0.9): EstadoCarta => {
  const estabilidade = Math.max(0.01, W[nota - 1]);
  const dificuldade = dificuldadeInicial(nota);
  return agendar({ estabilidade, dificuldade, revisoes: 1, proximaRevisao: agora, intervalo: 0 }, agora, retencaoAlvo, nota);
};

/** Aplica uma revisão a uma carta que já tem estado. `diasDesdeUltima` vem de quando ela foi vista. */
export const revisar = (
  estado: EstadoCarta,
  nota: Nota,
  diasDesdeUltima: number,
  agora = Date.now(),
  retencaoAlvo = 0.9,
): EstadoCarta => {
  const r = retencao(diasDesdeUltima, estado.estabilidade);
  const dificuldade = proximaDificuldade(estado.dificuldade, nota);
  const estabilidade =
    nota === 1 ? estabilidadeErro(estado.estabilidade, dificuldade, r) : estabilidadeAcerto(estado.estabilidade, dificuldade, r, nota);
  return agendar(
    { estabilidade: Math.max(0.01, estabilidade), dificuldade, revisoes: estado.revisoes + 1, proximaRevisao: agora, intervalo: 0 },
    agora,
    retencaoAlvo,
    nota,
  );
};

const agendar = (estado: EstadoCarta, agora: number, retencaoAlvo: number, nota: Nota): EstadoCarta => {
  // Errou: volta ainda hoje, em 10 minutos, antes de qualquer agendamento em dias.
  if (nota === 1) return { ...estado, intervalo: 0, proximaRevisao: agora + 10 * 60 * 1000 };
  const dias = Math.max(1, Math.round(diasAteRetencao(estado.estabilidade, retencaoAlvo)));
  // Um ano é teto suficiente: acima disso o número vira ficção.
  const intervalo = Math.min(dias, 365);
  return { ...estado, intervalo, proximaRevisao: agora + intervalo * DIA };
};

/** Converte o estado antigo (SM-2: intervalo + fator de facilidade) para o do FSRS, sem perder o histórico. */
export const doSM2 = (intervalo?: number, facilidade?: number, revisoes?: number): EstadoCarta | null => {
  if (!intervalo && !revisoes) return null;
  const dias = Math.max(0.5, intervalo || 1);
  // O fator de facilidade do SM-2 vai de 1,3 (difícil) a 2,5+ (fácil); a dificuldade do FSRS é o inverso.
  const f = entre(facilidade ?? 2.5, 1.3, 3);
  const dificuldade = entre(10 - ((f - 1.3) / 1.7) * 9, 1, 10);
  return { estabilidade: dias, dificuldade, revisoes: revisoes || 1, proximaRevisao: Date.now(), intervalo: dias };
};
