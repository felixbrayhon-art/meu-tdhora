#!/usr/bin/env node
// Testes do separador de assuntos do edital (utils/editalTopicos.ts).
//   npm run test:edital
//
// O que ele precisa acertar: o conteúdo programático vem colado de PDF e chega em formatos bem diferentes —
// uma linha por assunto, numerado, com marcadores, ou um parágrafo só separado por ponto-e-vírgula. E
// precisa NÃO quebrar na vírgula, que aparece dentro do nome do assunto.
import { topicosDoConteudo } from '../utils/editalTopicos.ts';

const casos = [
  ['uma por linha', 'Crimes contra a vida\nLegítima defesa\nCulpabilidade',
    ['Crimes contra a vida', 'Legítima defesa', 'Culpabilidade']],
  ['numerado', '1. Princípios constitucionais\n2. Direitos fundamentais\n2.1 Direitos sociais',
    ['Princípios constitucionais', 'Direitos fundamentais', 'Direitos sociais']],
  ['marcadores', '• Atos administrativos\n- Licitação\n– Contratos',
    ['Atos administrativos', 'Licitação', 'Contratos']],
  ['alíneas', 'a) Sujeito ativo\nb) Sujeito passivo\nc) Objeto jurídico',
    ['Sujeito ativo', 'Sujeito passivo', 'Objeto jurídico']],
  ['parágrafo com ponto-e-vírgula', 'Noções de informática; Sistemas operacionais; Redes de computadores',
    ['Noções de informática', 'Sistemas operacionais', 'Redes de computadores']],
  ['a vírgula não separa', 'Crimes contra a vida, a honra e o patrimônio',
    ['Crimes contra a vida, a honra e o patrimônio']],
  ['repetidos somem', 'Crase\nCrase\nCRASE\nRegência', ['Crase', 'Regência']],
  ['vazio', '   ', []],
  ['texto corrido não vira assunto',
    'O candidato deverá demonstrar conhecimento aprofundado sobre a teoria geral do processo penal brasileiro e suas implicações práticas no cotidiano forense.', []],
];

let falhas = 0;
for (const [nome, entrada, esperado] of casos) {
  const saida = topicosDoConteudo(entrada);
  const ok = JSON.stringify(saida) === JSON.stringify(esperado);
  if (!ok) {
    falhas += 1;
    console.error(`✗ ${nome}\n  esperado: ${JSON.stringify(esperado)}\n  saiu:     ${JSON.stringify(saida)}`);
  } else {
    console.log(`ok   ${nome}`);
  }
}

// Lista gigante é texto corrido picado errado: melhor nenhum assunto do que 300 fragmentos.
const gigante = topicosDoConteudo(Array.from({ length: 90 }, (_, i) => `Assunto ${i}`).join('\n'));
if (gigante.length !== 0) { falhas += 1; console.error(`✗ lista gigante devolveu ${gigante.length} itens`); }
else console.log('ok   lista gigante é descartada');

if (falhas) { console.error(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
