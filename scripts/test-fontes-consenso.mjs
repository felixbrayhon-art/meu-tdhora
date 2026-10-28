// Testes do filtro de consenso entre fontes (functions/_lib/consenso.ts). Sem rede: só transpila o módulo.
//   node scripts/test-fontes-consenso.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText, filename);
};
const { analyze, clusterOf, escolherTrechos, montarPool, extractAnchors, descrever, logOdds, sigmoid } = require('../functions/_lib/consenso.ts');

const ok = (name, fn) => { fn(); console.log('ok  ', name); };
const near = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

ok('Condorcet: com p=0,8, 1 fonte 80%, 2 fontes 94%, 3 fontes 98,5%', () => {
  const r = logOdds(0.8);
  near(sigmoid(r), 0.8); near(sigmoid(2 * r), 0.941); near(sigmoid(3 * r), 0.985);
});

ok('clusterOf: arquivos "curso-NNN-aula-…" são as aulas (um voto), não um autor por arquivo', () => {
  assert.equal(clusterOf('Informática · curso-223975-aula-01-7ec9-completo'), clusterOf('Direito Administrativo · AULA 00'));
  assert.equal(clusterOf('Português · curso-223971-aula-00-feb2-completo'), clusterOf('Informática · curso-223975-aula-04-5cc5-completo'));
});

ok('clusterOf: todas as leis federais são UM voto ("Lei Federal"), à parte das aulas e dos resumos', () => {
  const a = clusterOf('Legislação Federal · Lei Federal - Lei nº 8.213 de 24/07/1991 (lei)');
  const b = clusterOf('Legislação Federal · Lei Federal - Código Civil (lei)');
  assert.equal(a, b);
  assert.equal(a, 'lei federal');
  assert.notEqual(a, clusterOf('Direito Penal · Concurseiro Fora da Caixa - Direito Penal (resumo)'));
});

ok('clusterOf: aulas do mesmo curso são UM voto; autor diferente é outro', () => {
  assert.equal(clusterOf('Direito Administrativo · AULA 00'), clusterOf('Direito Administrativo · AULA 09'));
  assert.notEqual(clusterOf('Direito Administrativo · AULA 00'), clusterOf('Direito Administrativo · Concurseiro Fora da Caixa - Direito Administrativo (resumo)'));
  assert.equal(clusterOf('Direito Penal · Concurseiro Fora da Caixa - Direito Penal (resumo)'), clusterOf('Direito Constitucional · Concurseiro Fora da Caixa - Direito Constitucional (resumo)'));
});

ok('extractAnchors: artigos (com letra), súmulas e súmulas vinculantes', () => {
  const k = extractAnchors('O art. 312 do CPP e o art. 5º-A; veja a Súmula 473 do STF e a Súmula Vinculante 13.').map((a) => a.chave).sort();
  assert.deepEqual(k, ['art:5A', 'art:cpp:312', 'sumula:473', 'sumulav:13']);
});

ok('duas fontes independentes concordando → ALTO e pontos confirmados', () => {
  const a = analyze([
    { doc: 'Direito Administrativo · AULA 00', text: 'A autotutela está na Súmula 473 do STF e no art. 53 da Lei 9.784.', score: 5 },
    { doc: 'Direito Administrativo · Concurseiro Fora da Caixa - Direito Administrativo (resumo)', text: 'Autotutela: Súmulas 346 e 473 do STF; art. 53 da Lei 9.784/99.', score: 4 },
  ]);
  assert.equal(a.fontesIndependentes, 2);
  assert.equal(a.nivel, 'ALTO');
  assert.deepEqual(a.confirmados.map((p) => p.rotulo).sort(), ['Súmula 473', 'art. 53 da Lei 9784']);
  assert.ok(a.confirmados.every((p) => p.confianca > 0.93));
  assert.deepEqual(a.unicos.map((p) => p.rotulo), ['Súmula 346']);
  near(a.unicos[0].confianca, 0.8);
});

ok('mesmo autor repetido NÃO soma votos (correlação)', () => {
  const a = analyze([
    { doc: 'Direito Penal · AULA 01', text: 'Crime formal: art. 158 do CP.', score: 3 },
    { doc: 'Direito Penal · AULA 02', text: 'Extorsão é crime formal (art. 158) segundo a Súmula 96 do STJ.', score: 3 },
  ]);
  assert.equal(a.fontesIndependentes, 1);
  assert.equal(a.confirmados.length, 0);
  near(a.unicos.find((p) => p.rotulo === 'art. 158').confianca, 0.8);
  assert.equal(a.nivel, 'MEDIO');
});

ok('divergência de prazo para o mesmo artigo → ponto sai do consenso e o nível cai', () => {
  const a = analyze([
    { doc: 'Direito Penal · AULA 01', text: 'No art. 312, o prazo de 10 dias vale para a revisão.', score: 3 },
    { doc: 'Direito Penal · Concurseiro Fora da Caixa - Direito Penal (resumo)', text: 'Segundo o art. 312, o prazo é de 15 dias.', score: 3 },
  ]);
  assert.equal(a.divergencias.length, 1);
  assert.equal(a.divergencias[0].rotulo, 'art. 312');
  assert.deepEqual(a.divergencias[0].valores, ['10 dias', '15 dias']);
  assert.equal(a.confirmados.length, 0);
  assert.equal(a.nivel, 'BAIXO');
  assert.match(descrever(a), /FONTES DIVERGEM em: art\. 312/);
});

ok('prazos iguais em fontes diferentes NÃO são divergência', () => {
  const a = analyze([
    { doc: 'Direito Penal · AULA 01', text: 'O art. 312 trata da prisão; prazo de 10 dias.', score: 3 },
    { doc: 'Direito Penal · Concurseiro Fora da Caixa - Direito Penal (resumo)', text: 'Art. 312: prazo de 10 (dez) dias.', score: 3 },
  ]);
  assert.equal(a.divergencias.length, 0);
  assert.equal(a.confirmados.length, 1);
});

ok('sem nada verificável → confiança só pelo nº de fontes, com desconto', () => {
  const um = analyze([{ doc: 'X · AULA 1', text: 'Conceito de ato administrativo.', score: 1 }]);
  assert.equal(um.nivel, 'BAIXO'); assert.ok(um.confianca < 0.7);
  const dois = analyze([{ doc: 'X · AULA 1', text: 'Conceito de ato.', score: 1 }, { doc: 'X · Resumo Autor B - Y', text: 'Ato administrativo é...', score: 1 }]);
  assert.equal(dois.nivel, 'MEDIO'); assert.ok(dois.confianca > um.confianca);
});

ok('sem trechos → BAIXO e confiança 0', () => {
  const a = analyze([]);
  assert.equal(a.nivel, 'BAIXO'); assert.equal(a.confianca, 0);
});

ok('escolherTrechos: um por fonte independente antes de repetir', () => {
  const t = [
    { doc: 'D · AULA 00', text: 'a', score: 9 }, { doc: 'D · AULA 01', text: 'b', score: 8 }, { doc: 'D · AULA 02', text: 'c', score: 7 },
    { doc: 'D · Autor B - resumo', text: 'd', score: 1 },
  ];
  const e = escolherTrechos(t, 2).map((x) => x.text);
  assert.deepEqual(e, ['a', 'd']);
  assert.equal(escolherTrechos(t, 4).length, 4);
});

ok('montarPool: garante os melhores de cada fonte mesmo quando uma domina o ranking', () => {
  const dominante = Array.from({ length: 10 }, (_, i) => ({ doc: `D · AULA ${i}`, text: `a${i}`, score: 100 - i }));
  const outra = [{ doc: 'D · Autor B - resumo', text: 'b', score: 1 }];
  const pool = montarPool([...dominante, ...outra], 5);
  assert.equal(pool.length, 5);
  assert.ok(pool.some((t) => t.text === 'b'), 'a segunda fonte entra no pool');
});

ok('mesmo número de artigo em LEIS diferentes não vira consenso falso', () => {
  const a = analyze([
    { doc: 'D · AULA 00', text: 'Veja o art. 37 da CF sobre os princípios.', score: 3 },
    { doc: 'D · Autor B - resumo', text: 'O art. 37 da Lei 8.429 trata do ressarcimento.', score: 3 },
  ]);
  assert.equal(a.confirmados.length, 0);
  assert.deepEqual(a.unicos.map((p) => p.rotulo).sort(), ['art. 37 da CF', 'art. 37 da Lei 8429']);
});

ok('mesma lei citada por fontes independentes → consenso', () => {
  const a = analyze([
    { doc: 'D · AULA 00', text: 'O art. 37 da CF traz o princípio da eficiência.', score: 3 },
    { doc: 'D · Autor B - resumo', text: 'Princípios no art. 37 da Constituição Federal.', score: 3 },
  ]);
  assert.deepEqual(a.confirmados.map((p) => p.rotulo), ['art. 37 da CF']);
});

console.log('\ntodos os testes passaram');
