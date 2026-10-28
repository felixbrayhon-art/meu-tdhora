// Testes do motor de tinta (geometria pura): npm run test:ink
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { recognizeShape, erasePartial, eraseWhole, strokesInLasso, hitStroke, translateStroke, shapeFromDrag, pointsToFlat } = require('../services/ink/geometry.ts');

let falhas = 0;
const ok = (nome, fn) => { try { fn(); console.log('ok  ', nome); } catch (e) { falhas++; console.log('FALHOU', nome, '\n  ', e.message); } };
const jitter = (v, k = 1.2) => v + Math.sin(v * 12.9898) * k;
const stroke = (pts, extra = {}) => ({ id: 'a', kind: 'pen', color: '#000', width: 2, opacity: 1, points: pointsToFlat(pts), ...extra });
const linha = (x0, y0, x1, y1, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }));

ok('linha torta à mão vira linha reta', () => {
  const r = recognizeShape(linha(10, 10, 200, 60).map((p) => ({ x: jitter(p.x), y: jitter(p.y) })));
  assert.equal(r?.type, 'line'); assert.equal(r.points.length, 2);
});
ok('círculo à mão vira elipse/círculo', () => {
  const pts = Array.from({ length: 70 }, (_, i) => { const a = (i / 68) * Math.PI * 2; return { x: 100 + 60 * Math.cos(a) + Math.sin(i) * 1.5, y: 100 + 60 * Math.sin(a) + Math.cos(i) * 1.5 }; });
  assert.equal(recognizeShape(pts)?.type, 'ellipse');
});
ok('retângulo à mão vira polígono de 5 pontos alinhado', () => {
  const pts = [...linha(20, 20, 220, 20, 20), ...linha(220, 20, 220, 120, 12), ...linha(220, 120, 20, 120, 20), ...linha(20, 120, 22, 22, 12)].map((p) => ({ x: jitter(p.x, 1), y: jitter(p.y, 1) }));
  const r = recognizeShape(pts);
  assert.equal(r?.type, 'polygon'); assert.equal(r.points.length, 5);
});
ok('triângulo à mão vira polígono de 4 pontos', () => {
  const pts = [...linha(100, 20, 200, 160, 25), ...linha(200, 160, 20, 160, 30), ...linha(20, 160, 100, 22, 25)];
  const r = recognizeShape(pts);
  assert.equal(r?.type, 'polygon'); assert.equal(r.points.length, 4);
});
ok('reta com gancho no fim vira seta', () => {
  const corpo = linha(10, 100, 220, 100, 50);
  const gancho = linha(220, 100, 205, 88, 4);
  assert.equal(recognizeShape([...corpo, ...gancho])?.type, 'arrow');
});
ok('rabisco não vira forma', () => {
  const pts = Array.from({ length: 60 }, (_, i) => ({ x: i * 4, y: 50 + Math.sin(i / 3) * 40 }));
  assert.equal(recognizeShape(pts), null);
});
ok('hitStroke respeita o raio', () => {
  const s = stroke(linha(0, 0, 100, 0));
  assert.equal(hitStroke(s, 50, 3, 4), true); assert.equal(hitStroke(s, 50, 30, 4), false);
});
ok('eraseWhole devolve só os traços tocados', () => {
  const a = { ...stroke(linha(0, 0, 100, 0)), id: 'a' }, b = { ...stroke(linha(0, 50, 100, 50)), id: 'b' };
  assert.deepEqual(eraseWhole([a, b], 50, 2, 5), ['a']);
});
ok('erasePartial corta no meio e deixa dois pedaços', () => {
  let n = 0;
  const s = stroke(linha(0, 0, 100, 0, 50));
  const r = erasePartial(s, 50, 0, 6, () => `n${n++}`);
  assert.equal(r.length, 2);
  assert.ok(r[0].points.length >= 6 && r[1].points.length >= 6);
  const maxX0 = Math.max(...r[0].points.filter((_, i) => i % 3 === 0));
  const minX1 = Math.min(...r[1].points.filter((_, i) => i % 3 === 0));
  assert.ok(maxX0 < 50 && minX1 > 50);
});
ok('erasePartial fora do traço não muda nada (null)', () => {
  assert.equal(erasePartial(stroke(linha(0, 0, 100, 0)), 50, 60, 5), null);
});
ok('laço seleciona só o que está dentro', () => {
  const dentro = { ...stroke(linha(20, 20, 60, 20)), id: 'in' }, fora = { ...stroke(linha(300, 300, 340, 300)), id: 'out' };
  const laco = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  assert.deepEqual(strokesInLasso([dentro, fora], laco), ['in']);
});
ok('translateStroke move só x e y, mantém a pressão', () => {
  const t = translateStroke(stroke([{ x: 1, y: 2 }, { x: 3, y: 4 }]), 10, 20);
  assert.deepEqual(t.points, [11, 22, 0.5, 13, 24, 0.5]);
});
ok('shapeFromDrag: retângulo tem 5 pontos e fecha', () => {
  const p = shapeFromDrag('rect', { x: 0, y: 0 }, { x: 10, y: 20 });
  assert.equal(p.length, 5); assert.deepEqual(p[0], p[4]);
});

if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
