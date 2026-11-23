#!/usr/bin/env node
// Teste do guarda-cache do service worker (public/sw.js).
//   npm run test:sw
//
// O que ele protege: quando um arquivo ainda não subiu, o servidor devolve a própria index.html com status
// 200 (regra de SPA). Se o service worker guardar esse HTML no lugar do .js, a tela que depende daquele
// pedaço quebra em toda visita — e como /assets/ é servido do cache primeiro, não adianta recarregar.
//
// Aconteceu em 23/11/2026: sete arquivos ficaram guardados como HTML e o app abria em "OPS! O SISTEMA
// PAROU DE RESPIRAR / Cannot read properties of undefined (reading 'default')".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fonte = fs.readFileSync(path.join(raiz, 'public', 'sw.js'), 'utf8')
  .replace('__PRECACHE__', '[]')
  .replace('__RESTO__', '[]')
  .replace('__BUILD__', 'teste');

// O arquivo é um service worker: roda só o pedaço que interessa, sem os listeners.
const corpo = fonte.slice(fonte.indexOf('function respostaCoerente'), fonte.indexOf('async function redeDepoisCache'));
const respostaCoerente = new Function(`${corpo}; return respostaCoerente;`)();

const resposta = (tipo, ok = true) => ({ ok, headers: { get: () => tipo } });

const casos = [
  ['js de verdade', '/assets/App-abc.js', resposta('application/javascript'), true],
  ['js como text/javascript', '/assets/App-abc.js', resposta('text/javascript; charset=utf-8'), true],
  ['js que veio como HTML (o bug)', '/assets/App-abc.js', resposta('text/html; charset=utf-8'), false],
  ['css de verdade', '/assets/estilo-abc.css', resposta('text/css'), true],
  ['css que veio como HTML', '/assets/estilo-abc.css', resposta('text/html'), false],
  ['fonte continua passando', '/assets/Gilroy.woff2', resposta('font/woff2'), true],
  ['página é HTML mesmo', '/', resposta('text/html'), true],
  ['resposta de erro nunca entra', '/assets/App-abc.js', resposta('application/javascript', false), false],
  ['resposta ausente nunca entra', '/assets/App-abc.js', null, false],
];

let falhas = 0;
for (const [nome, url, res, esperado] of casos) {
  const saiu = !!respostaCoerente(url, res);
  if (saiu !== esperado) { falhas += 1; console.error(`✗ ${nome}: esperado ${esperado}, saiu ${saiu}`); }
  else console.log(`ok   ${nome}`);
}

if (falhas) { console.error(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
