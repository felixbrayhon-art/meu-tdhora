"""Extrai questões do formato "Estratégia 2024" (cabeçalho 'Questão 2022 | id' ou '(BANCA/ÓRGÃO – Cargo/Ano)', alternativas A)–E), marca 'Solução',
'Gabarito: D)' e a explicação) de PDFs dentro de zips, lendo da memória. Pega múltipla escolha e Certo/Errado. Guarda o caminho do Drive.
Uso: python3 extract_solucao.py <zip>...  -> ~/fontes-todahora/comentadas/sol_*.json"""
import sys, re, json, os, io, zipfile, hashlib, logging
logging.disable(logging.CRITICAL)
import pypdf
OUT = os.path.expanduser('~/fontes-todahora/comentadas')
PII = re.compile(r'\b\d{11}\b|\d{3}\.\d{3}\.\d{3}-\d{2}|estrategiaconcursos|@[\w-]+\.[a-z]', re.I)
BANCAS = r'CESPE|CEBRASPE|FGV|FCC|VUNESP|IDECAN|AOCP|IBFC|CESGRANRIO|FUNDATEC|QUADRIX|IADES|FUNCAB|CONSULPLAN|UFPR|FEPESE|FUMARC|IBADE|NUCEPE|OBJETIVA|FAURGS|FADESP|UNIVERSA|ACAFE|UNIVAG|MARINHA|FUNRIO|UEPA|SELECON|IAUPE|INSTITUTO|DPE|DPU|MPE|TJ|TRF|STJ|STF'
HEADER = re.compile(r'(?m)^(?:Quest[ãa]o\s+(?:\d{4}\s*\|\s*)?\d+\s*$|(\d{1,3})\s*ª\s*quest[ãa]o\s*$|\((?=[^)\n]*(?:\b(?:19|20)\d{2}\b|\b(?:%s)\b))[^)\n]{3,150}\))' % BANCAS)
NOISE = re.compile(r'(?m)^\s*\d+\.\s+.{3,80}\s\d+/\d+\s*$|^\s*\d+\.\s+[^\n]{3,80}$(?=\n\d+\.\s+[^\n]{3,80}\s\d+/\d+)')

def clean(s): return re.sub(r'\s+', ' ', s).strip()

def page_text(p):
    lines = (p.extract_text() or '').split('\n')
    for i, l in enumerate(lines):
        if 'estrategiaconcursos.com.br' in l.lower(): lines = lines[:max(0, i - 3)]; break
    return '\n'.join(l for l in lines if not re.match(r'^\s*\d{11}\s*-', l))

def parse(text):
    text = NOISE.sub('', text)
    heads = [(m.start(), m.end(), m.group(0)) for m in HEADER.finditer(text)]
    sols = [(m.start(), m.end()) for m in re.finditer(r'(?im)^\s*Solu[çc][ãa]o\s*$', text)]
    out = []
    for si, (s0, s1) in enumerate(sols):
        prev_sol = sols[si - 1][1] if si else 0
        cand = [h for h in heads if prev_sol <= h[0] < s0]
        if not cand: continue
        h = cand[-1]; block = text[h[1]:s0]; tag = ''
        if h[2].startswith('('):
            tag = h[2].strip('() \n')
            stem_tail = ''
        om = list(re.finditer(r'(?m)^\s*([A-E])\)\s*', block))
        letters = [o.group(1) for o in om]
        # as alternativas A..E em sequência (a última sequência completa do bloco)
        k = max((i for i in range(len(letters) - 4) if letters[i:i + 5] == list('ABCDE')), default=None)
        nxt = [x for x in heads if x[0] > s1]; end = nxt[0][0] if nxt else len(text)
        after = text[s1:end][:6000]
        gm = re.match(r'\s*Gabarito:\s*([^\n]*)\n?', after)
        if not gm: continue
        gline = gm.group(1).strip(); comment = clean(after[gm.end():])
        if k is not None:
            o5 = om[k:k + 5]; stem = clean(block[:o5[0].start()]); alts = {}
            for j, o in enumerate(o5): alts[o.group(1)] = clean(block[o.end():(o5[j + 1].start() if j < 4 else len(block))])
            lm = re.match(r'\(?([A-E])\)?', gline)
            if not lm: continue
            q = {'tipo': 'multipla_escolha', 'enunciado': stem, 'alternativas': alts, 'gabarito': lm.group(1)}
        else:
            stem = clean(block)
            cm = re.match(r'(?i)\(?(certo|errado|c|e)\b', gline)
            if not cm: continue
            q = {'tipo': 'certo_errado', 'enunciado': stem, 'alternativas': {}, 'gabarito': 'C' if cm.group(1).lower() in ('certo', 'c') else 'E'}
        if len(q['enunciado']) < 25 or len(comment) < 25: continue
        ym = re.match(r'Quest[ãa]o\s+((?:19|20)\d{2})\s*\|', h[2].strip())
        q['tag'] = tag; q['ano_cab'] = int(ym.group(1)) if ym else None; q['comentario'] = comment[:4500]
        out.append(q)
    return [q for q in out if not PII.search(json.dumps(q, ensure_ascii=False))]

if __name__ == '__main__':
    tot = 0
    for zpath in sys.argv[1:]:
        z = zipfile.ZipFile(zpath)
        for info in z.infolist():
            if not info.filename.lower().endswith('.pdf'): continue
            name = info.filename.replace('\\', '/')
            try:
                rd = pypdf.PdfReader(io.BytesIO(z.read(info)))
                qs = parse('\n'.join(page_text(p) for p in rd.pages))
            except Exception as e:
                print(f'ERRO\t{name[-60:]}\t{str(e)[:50]}', flush=True); continue
            if not qs: continue
            for i, q in enumerate(qs, 1): q['n'] = i; q['caminho'] = name
            fn = 'sol_' + hashlib.md5(name.encode()).hexdigest()[:8] + '_' + re.sub(r'[^\w\-. ]', '_', name.split('/')[-1])[-60:] + '.json'
            json.dump({'arquivo': name.split('/')[-1], 'caminho': name, 'questoes': qs}, open(os.path.join(OUT, fn), 'w'), ensure_ascii=False)
            tot += len(qs); print(f'{len(qs)}\t{name[-90:]}', flush=True)
    print('TOTAL', tot, flush=True)
