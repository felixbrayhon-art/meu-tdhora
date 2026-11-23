// Transforma o conteúdo programático colado pelo aluno na lista de assuntos da matéria.
//
// Por que existe: no cadastro, o texto colado era guardado como `content` e os `topics` nasciam vazios — eles
// só apareciam depois, por uma extração de IA feita dentro de "Meu Edital", uma matéria por vez. Quem
// terminava o cadastro via "MODO EDITAL ATIVO" e, nas ferramentas, um seletor de assunto vazio: o edital
// parecia pronto e não servia para nada. Aqui os assuntos saem do próprio texto, na hora, sem IA.
//
// A IA continua valendo: em "Meu Edital" ela remapeia a matéria e substitui o que saiu daqui, que é um
// ponto de partida — não a palavra final.

/** Numeração e marcadores de início de linha: "1.", "1.2 -", "a)", "•", "-", "I –". */
const MARCADOR = /^\s*(?:[-–—•*]|\(?\d+(?:\.\d+)*\)?[.)-]?|[a-z]\)|[ivxlcdm]+[.)])\s+/i;

const limpar = (bruto: string) => bruto
  .replace(MARCADOR, '')
  .replace(/\s+/g, ' ')
  .replace(/[;,.]+$/, '')
  .trim();

/**
 * Um assunto por linha; quando o conteúdo vem num parágrafo só, o ponto-e-vírgula separa — é como edital
 * costuma listar. A vírgula NÃO separa: ela aparece dentro do próprio nome do assunto ("Crimes contra a
 * vida, a honra e o patrimônio").
 */
export const topicosDoConteudo = (conteudo: string): string[] => {
  const texto = (conteudo || '').trim();
  if (!texto) return [];

  let partes = texto.split('\n');
  // Parágrafo único e comprido: tenta o ponto-e-vírgula antes de desistir.
  if (partes.filter((p) => p.trim()).length === 1 && texto.includes(';')) partes = texto.split(';');

  const vistos = new Set<string>();
  const assuntos: string[] = [];
  partes.forEach((parte) => {
    const assunto = limpar(parte);
    // Fragmento de 2 letras não é assunto; acima de 120 caracteres já é frase, não item de lista.
    if (assunto.length < 3 || assunto.length > 120) return;
    const chave = assunto.toLowerCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    assuntos.push(assunto);
  });

  // Mais de 80 itens quase sempre é texto corrido picado errado; melhor deixar a IA mapear em "Meu Edital".
  return assuntos.length > 80 ? [] : assuntos;
};
