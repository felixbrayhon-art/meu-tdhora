"""Extrai questões comentadas (formato Estratégia Concursos: lista de questões comentadas, 'Comentários:' com o gabarito) de PDFs
dentro de zips, lendo direto da memória (sem descompactar). Rodapé de cada página (professor, aula, curso, site, CPF e nome do
comprador) é removido ANTES de qualquer análise. Só vale questão com 5 alternativas, gabarito inequívoco e comentário.
Uso: python3 extract_estrategia.py <zip>...  -> ~/fontes-todahora/comentadas/est_*.json + resumo em stdout"""
import sys, re, json, os, io, zipfile, hashlib, logging
logging.disable(logging.CRITICAL)
import pypdf
OUT = os.path.expanduser('~/fontes-todahora/comentadas')
PII = re.compile(r'\b\d{11}\b|\d{3}\.\d{3}\.\d{3}-\d{2}|estrategiaconcursos|@[\w-]+\.', re.I)

def page_text(p):
    lines = (p.extract_text() or '').split('\n')
    for i, l in enumerate(lines):
        if 'estrategiaconcursos.com.br' in l.lower():          # bloco final: professor / aula / curso / site / CPF - nome
            lines = lines[:max(0, i - 3)]; break
    return '\n'.join(l for l in lines if not re.match(r'^\s*\d{11}\s*-', l))

def clean(s): return re.sub(r'\s+', ' ', s).strip()

def blocks(text):
    m = None
    for m in re.finditer(r'(?im)^\s*(?:lista de\s+)?quest[õo]es\s+comentadas[^\n]*$', text): pass   # último título: os primeiros são o sumário
    if not m: return []
    body = text[m.end():]
    out, pos, k = [], 0, 1
    starts = []
    while True:
        mm = re.compile(r'(?m)^\s*%d\s*[\.\)]\s+(?=\S)' % k).search(body, pos)
        if not mm: break
        starts.append((k, mm.start(), mm.end())); pos = mm.end(); k += 1
    for j, (n, s, e) in enumerate(starts):
        out.append((n, body[e:(starts[j + 1][1] if j + 1 < len(starts) else len(body))]))
    return out

GAB = [r'gabarito\s*[:\-–]?\s*(?:letra|alternativa)?\s*\(?([A-E])\b', r'alternativa\s+\(?([A-E])\)?\s+(?:é|esta|está)\s+(?:o\s+)?(?:gabarito|correta|a\s+correta)',
       r'(?:gabarito|resposta)\s+(?:da\s+quest[ãa]o\s+)?(?:é|:)\s*(?:a\s+)?(?:letra|alternativa)?\s*\(?([A-E])\b', r'letra\s+\(?([A-E])\)?\s*\.?\s*$']
def gabarito(com):
    found = set()
    for pat in GAB:
        for m in re.finditer(pat, com, re.I | re.M): found.add(m.group(1).upper())
    return found.pop() if len(found) == 1 else None

def parse(text):
    qs = []
    for n, b in blocks(text):
        om = list(re.finditer(r'(?m)^\s*\(?([A-E])\)\s+', b))
        letters = [o.group(1) for o in om]
        if letters[:5] != list('ABCDE'): continue
        cm = re.search(r'(?i)coment[áa]rios?\s*[:\-–]?', b[om[-1].end():])
        if not cm: continue
        c0 = om[-1].end() + cm.start()
        stem = clean(b[:om[0].start()]); tag = ''
        tm = re.match(r'^\(([^)]{3,90})\)\s*', stem)
        if tm: tag = tm.group(1); stem = stem[tm.end():]
        opts = [clean(b[o.end():(om[k + 1].start() if k + 1 < len(om) else c0)]) for k, o in enumerate(om)]
        com = clean(b[om[-1].end() + cm.end():])
        g = gabarito(com)
        if not g or len(stem) < 25 or len(com) < 25 or any(not o for o in opts[:5]): continue
        qs.append({'n': n, 'tag': tag, 'enunciado': stem, 'alternativas': dict(zip('ABCDE', opts[:5])), 'gabarito': g, 'comentario': com})
    return [q for q in qs if not PII.search(json.dumps(q, ensure_ascii=False))]

if __name__ == '__main__':
    tot = 0
    for zpath in sys.argv[1:]:
        z = zipfile.ZipFile(zpath)
        for info in z.infolist():
            if not info.filename.lower().endswith('.pdf'): continue
            parts = info.filename.replace('\\', '/').split('/')
            name = parts[-1]; folder = parts[-2] if len(parts) > 1 else ''
            try:
                rd = pypdf.PdfReader(io.BytesIO(z.read(info)))
                qs = parse('\n'.join(page_text(p) for p in rd.pages))
            except Exception as e:
                print(f'ERRO\t{name}\t{str(e)[:60]}', flush=True); continue
            if not qs: continue
            for q in qs: q['materia'] = folder
            arq = f'{folder} - {name}'
            fn = 'est_' + hashlib.md5(info.filename.encode()).hexdigest()[:8] + '_' + re.sub(r'[^\w\-. ]', '_', name)[-60:] + '.json'
            json.dump({'arquivo': arq, 'questoes': qs}, open(os.path.join(OUT, fn), 'w'), ensure_ascii=False)
            tot += len(qs); print(f'{len(qs)}\t{arq[:90]}', flush=True)
    print('TOTAL', tot, flush=True)
