// Removes the course's name from the commented text: "Caveiras, a questão…" becomes "A questão…", "Fala, Caveiras! Para…"
// becomes "Para…", "…as opções, caveiras. Alternativa" becomes "…as opções. Alternativa".
const up = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const semCaveira = (text) => {
  if (!/caveira/i.test(text)) return text;
  let t = text
    .replace(/\b(?:fala|salve|olá|oi|e aí|bora|vamos lá),?\s*caveiras?\s*[!,.]\s*/gi, (m) => (/^vamos lá/i.test(m) ? 'Vamos lá! ' : ''))
    .replace(/\b(?:(?:d[oae]|n[oa]|pel[oa]|em)\s+)?(?:projeto|equipe|time|turma|família)\s+caveira\b/gi, '')
    .replace(/,?\s*\bcaveiras?\b(?=\s*[!.?:;])/gi, '')
    .replace(/,\s*caveiras?\s*,/gi, ' ')
    .replace(/(^|[.!?:]\s+)caveiras?,\s*(\S)/gi, (_, pre, ch) => pre + ch.toUpperCase())
    .replace(/,?\s*\bcaveiras?\b,?/gi, (m) => (m.trim().startsWith(',') && m.trim().endsWith(',') ? ',' : ''));
  t = t.replace(/\s+([,.!?:;])/g, '$1').replace(/([!?.])\s*[,.]/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
  return up(t);
};
