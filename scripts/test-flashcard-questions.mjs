// Testa /api/flashcard-questions: em quantas questões a alternativa certa é a mais longa (o ideal é perto de 1/5).
//
//   node scripts/test-flashcard-questions.mjs                      (3 temas, 3 questões cada)
//   node scripts/test-flashcard-questions.mjs "tema A" "tema B"    (temas próprios)
//   BASE=https://xxxx.meu-tdhora.pages.dev node scripts/test-flashcard-questions.mjs
const BASE = process.env.BASE ?? 'https://meu-tdhora.pages.dev';
const COUNT = Number(process.env.COUNT ?? 3);
const topics = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'Direito Administrativo: atos administrativos',
      'Direito Administrativo: poderes administrativos',
      'Direito Administrativo: licitações',
    ];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchQuestions(topic) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${BASE}/api/flashcard-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ topic, count: COUNT }),
    });
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data) ? data : data.questions;
    if (Array.isArray(list) && list.length) return list;
    if (attempt < 4) await sleep(attempt * 15000); // 429 do provedor: espera e tenta de novo
    else return { error: data.detail ?? data.error ?? `HTTP ${res.status}` };
  }
}

function correctIndex(q) {
  const c = q.correctIndex ?? q.correct ?? q.correctAnswer;
  return typeof c === 'string' && /^[A-E]$/i.test(c) ? 'ABCDE'.indexOf(c.toUpperCase()) : c;
}

let longest = 0;
let total = 0;
const lines = [];
for (const topic of topics) {
  const label = topic.split(':').pop().trim();
  const list = await fetchQuestions(topic);
  if (!Array.isArray(list)) {
    lines.push(`${label}: ✗ ${list.error}`);
    continue;
  }
  let n = 0;
  for (const q of list) {
    const lens = (q.options ?? q.alternativas ?? []).map((o) => String(o).length);
    if (lens.length && lens[correctIndex(q)] === Math.max(...lens)) n++;
  }
  longest += n;
  total += list.length;
  lines.push(`${label}: ${n}/${list.length}`);
}
console.log(`${lines.join(' | ')}\nTOTAL: certa mais longa em ${longest} de ${total} (antes da correção: 7 de 9)`);
