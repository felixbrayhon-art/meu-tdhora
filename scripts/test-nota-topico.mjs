#!/usr/bin/env node
// Testes do FSRS (services/fsrs.ts) e da nota do tópico (services/notaTopico.ts).
//   npm run test:nota
//
// Não testa números exatos: testa as PROMESSAS feitas ao aluno — indo bem a revisão se afasta, errando ela
// é antecipada, a nota cai sozinha com o tempo, cai mais rápido no assunto difícil ou muito cobrado, e
// questão pesa mais que flashcard.
import { createRequire } from 'node:module';

// Mesmo arranjo de scripts/test-fontes-consenso.mjs: transpila o .ts na hora, sem build.
const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText, filename);
};
const { primeiraRevisao, revisar, retencao, diasAteRetencao, doSM2 } = require('../services/fsrs.ts');
const { registrar, notaHoje, topicoNovo, definirIncidencia, diasParaRevisao, notaDaMateria, filaDeRevisao, PESOS } = require('../services/notaTopico.ts');

const DIA = 24 * 60 * 60 * 1000;
let falhas = 0;
const ok = (nome, condicao, detalhe = '') => {
  if (condicao) console.log(`ok   ${nome}`);
  else { falhas += 1; console.error(`✗ ${nome}${detalhe ? `\n     ${detalhe}` : ''}`); }
};

console.log('--- FSRS ---');
{
  const r0 = retencao(0, 10);
  const rS = retencao(10, 10);
  ok('retenção começa em 100%', Math.abs(r0 - 1) < 1e-9, `deu ${r0}`);
  ok('em t = estabilidade, a retenção é 90%', Math.abs(rS - 0.9) < 1e-6, `deu ${rS}`);
  ok('retenção só cai com o tempo', retencao(30, 10) < retencao(20, 10) && retencao(20, 10) < rS);

  const d = diasAteRetencao(10, 0.9);
  ok('dias até 90% devolve a própria estabilidade', Math.abs(d - 10) < 1e-6, `deu ${d}`);
  ok('querer lembrar mais (95%) encurta o intervalo', diasAteRetencao(10, 0.95) < d);
}
{
  const facil = primeiraRevisao(4);
  const dificil = primeiraRevisao(1);
  ok('primeira revisão "fácil" dá intervalo maior que "errou"', facil.intervalo > dificil.intervalo);
  ok('errar manda a carta para daqui a minutos, não dias', dificil.intervalo === 0 && dificil.proximaRevisao - Date.now() < DIA);
  ok('"fácil" nasce menos difícil que "errou"', facil.dificuldade < dificil.dificuldade);
}
{
  // Acertando sempre, o intervalo tem que crescer de verdade.
  let c = primeiraRevisao(3);
  const intervalos = [c.intervalo];
  for (let i = 0; i < 5; i++) { c = revisar(c, 3, c.intervalo); intervalos.push(c.intervalo); }
  const cresceu = intervalos.every((v, i) => i === 0 || v >= intervalos[i - 1]);
  ok('acertando sempre, o intervalo só cresce', cresceu, intervalos.join(' → '));
  ok('depois de 6 acertos o intervalo já passa de um mês', c.intervalo > 30, `deu ${c.intervalo} dias`);

  const erro = revisar(c, 1, c.intervalo);
  ok('errar derruba a estabilidade', erro.estabilidade < c.estabilidade);
  ok('errar aumenta a dificuldade da carta', erro.dificuldade > c.dificuldade);
}
{
  const convertida = doSM2(6, 2.5, 3);
  ok('carta antiga do SM-2 é convertida sem perder o histórico', convertida !== null && convertida.estabilidade === 6 && convertida.revisoes === 3);
  const dura = doSM2(2, 1.3, 5);
  const leve = doSM2(2, 2.8, 5);
  ok('fator de facilidade baixo vira dificuldade alta', dura.dificuldade > leve.dificuldade);
  ok('carta nunca revisada não vira nada', doSM2(undefined, undefined, undefined) === null);
}

console.log('\n--- Nota do tópico ---');
{
  ok('questão e discursiva pesam o triplo do flashcard', PESOS.questoes === 3 && PESOS.discursiva === 3 && PESOS.flashcards === 1);
}
{
  const agora = Date.now();
  const t = registrar(undefined, { materia: 'Penal', assunto: 'Dolo', tipo: 'questoes', acerto: 1, itens: 10, quando: agora });
  ok('acertar tudo leva a nota para cima', notaHoje(t, agora) > 50, `nota ${notaHoje(t, agora)}`);

  const ruim = registrar(undefined, { materia: 'Penal', assunto: 'Culpa', tipo: 'questoes', acerto: 0, itens: 10, quando: agora });
  ok('errar tudo leva a nota para baixo', notaHoje(ruim, agora) < 50, `nota ${notaHoje(ruim, agora)}`);
}
{
  const agora = Date.now();
  // Mesmo resultado, uma vez por questões e outra por flashcards: questões têm que mover mais.
  const porQuestoes = registrar(undefined, { materia: 'M', assunto: 'A', tipo: 'questoes', acerto: 1, itens: 10, quando: agora });
  const porCartas = registrar(undefined, { materia: 'M', assunto: 'A', tipo: 'flashcards', acerto: 1, itens: 10, quando: agora });
  ok('questões movem a nota mais que flashcards', notaHoje(porQuestoes, agora) > notaHoje(porCartas, agora),
    `questões ${notaHoje(porQuestoes, agora)} x cartas ${notaHoje(porCartas, agora)}`);

  const poucas = registrar(undefined, { materia: 'M', assunto: 'B', tipo: 'questoes', acerto: 1, itens: 1, quando: agora });
  const muitas = registrar(undefined, { materia: 'M', assunto: 'B', tipo: 'questoes', acerto: 1, itens: 20, quando: agora });
  ok('20 questões movem mais que 1', notaHoje(muitas, agora) > notaHoje(poucas, agora));
}
{
  const agora = Date.now();
  const t = registrar(undefined, { materia: 'M', assunto: 'A', tipo: 'questoes', acerto: 1, itens: 10, quando: agora });
  const hoje = notaHoje(t, agora);
  const daquiUmaSemana = notaHoje(t, agora + 7 * DIA);
  const daquiUmMes = notaHoje(t, agora + 30 * DIA);
  ok('a nota cai sozinha com os dias', daquiUmaSemana < hoje && daquiUmMes < daquiUmaSemana,
    `hoje ${hoje} → 7d ${daquiUmaSemana} → 30d ${daquiUmMes}`);
  ok('a queda é gradual, não um tombo', daquiUmaSemana > hoje * 0.3);
}
{
  const agora = Date.now();
  // Mesmo histórico, um assunto muito cobrado e outro não.
  const base = { materia: 'M', assunto: 'A', tipo: 'questoes', acerto: 0.9, itens: 10, quando: agora };
  const comum = registrar(definirIncidencia(topicoNovo('M', 'A', agora), 0), base);
  const cobrado = registrar(definirIncidencia(topicoNovo('M', 'A', agora), 1), base);
  const d = 20 * DIA;
  ok('assunto muito cobrado esquece mais rápido', notaHoje(cobrado, agora + d) < notaHoje(comum, agora + d),
    `cobrado ${notaHoje(cobrado, agora + d)} x comum ${notaHoje(comum, agora + d)}`);
  ok('assunto muito cobrado volta antes para revisão', diasParaRevisao(cobrado, agora) < diasParaRevisao(comum, agora),
    `cobrado ${diasParaRevisao(cobrado, agora)}d x comum ${diasParaRevisao(comum, agora)}d`);
}
{
  const agora = Date.now();
  // Indo bem, a revisão tem que ir ficando mais longe a cada vez.
  let t;
  let quando = agora;
  // O intervalo CONCEDIDO em cada revisão (não o que falta para vencer, que é zero no dia do vencimento).
  const prazos = [];
  for (let i = 0; i < 4; i++) {
    t = registrar(t, { materia: 'M', assunto: 'A', tipo: 'questoes', acerto: 0.95, itens: 10, quando });
    prazos.push(diasParaRevisao(t, quando));
    quando = t.proximaRevisao;
  }
  ok('quem vai bem é revisado cada vez mais longe', prazos.every((v, i) => i === 0 || v >= prazos[i - 1]), prazos.join('d → ') + 'd');

  const ultimoBom = prazos[prazos.length - 1];
  const depoisDeErrar = registrar(t, { materia: 'M', assunto: 'A', tipo: 'questoes', acerto: 0.1, itens: 10, quando });
  const depoisDoErro = diasParaRevisao(depoisDeErrar, quando);
  ok('errar muito antecipa a próxima revisão', depoisDoErro < ultimoBom,
    `vinha de ${ultimoBom}d, caiu para ${depoisDoErro}d`);
  ok('errar muito derruba a nota', notaHoje(depoisDeErrar, quando) < notaHoje(t, quando));
}
{
  const agora = Date.now();
  // Um tópico abandonado há meses não pode "ressuscitar" na nota antiga ao receber uma atividade fraca.
  const antigo = registrar(undefined, { materia: 'M', assunto: 'A', tipo: 'questoes', acerto: 1, itens: 20, quando: agora - 120 * DIA });
  const esquecido = notaHoje(antigo, agora);
  const depois = registrar(antigo, { materia: 'M', assunto: 'A', tipo: 'flashcards', acerto: 0.6, itens: 3, quando: agora });
  ok('tópico esquecido não volta de uma vez à nota antiga', notaHoje(depois, agora) < 90,
    `esquecido ${esquecido} → depois de 3 cartas ${notaHoje(depois, agora)}`);
  ok('mas uma atividade boa levanta um pouco', notaHoje(depois, agora) > esquecido);
}
{
  const agora = Date.now();
  const bom = registrar(undefined, { materia: 'Penal', assunto: 'A', tipo: 'questoes', acerto: 1, itens: 20, quando: agora });
  const ruim = registrar(undefined, { materia: 'Penal', assunto: 'B', tipo: 'questoes', acerto: 0, itens: 20, quando: agora });
  const media = notaDaMateria([bom, ruim], 'Penal', agora);
  ok('a nota da matéria fica entre as dos seus tópicos', media > notaHoje(ruim, agora) && media < notaHoje(bom, agora),
    `${notaHoje(ruim, agora)} < ${media} < ${notaHoje(bom, agora)}`);
  ok('matéria sem tópico nenhum não inventa nota', notaDaMateria([bom], 'Outra', agora) === null);
}
{
  const agora = Date.now();
  const vencido = registrar(undefined, { materia: 'M', assunto: 'Vencido', tipo: 'questoes', acerto: 0.2, itens: 10, quando: agora - 60 * DIA });
  const emDia = registrar(undefined, { materia: 'M', assunto: 'Em dia', tipo: 'questoes', acerto: 1, itens: 20, quando: agora });
  const fila = filaDeRevisao([emDia, vencido], agora);
  ok('a fila traz só o que venceu', fila.length === 1 && fila[0].assunto === 'Vencido', fila.map((t) => t.assunto).join(', '));
}

if (falhas) { console.error(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
