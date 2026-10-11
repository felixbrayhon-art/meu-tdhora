"""Corrige os JSON de questões extraídos de PDF (rodar uma vez; o original fica em comentadas-bruto/):
1) ligaturas: o PDF desenha "fi"/"fl"/"ff" como um símbolo só, que a extração devolveu como caractere vazio (\\x00). Cada palavra com \\x00 é refeita
   testando fi, fl, ff, ffi, ffl e ficando com a que existe no vocabulário do próprio banco (palavras inteiras de outras questões); sem match -> "fi".
2) comentário: corta onde começa a próxima aula ("Para ouvir ao áudio…", "Para assistir ao vídeo…").
Uso: python3 limpar_json.py [--aplicar]   (sem --aplicar só mostra o que mudaria)"""
import json, glob, os, re, sys, collections, itertools
DIR = os.path.expanduser('~/fontes-todahora/comentadas')
WORD = re.compile(r'[A-Za-zÀ-ÿ]+')
TOKEN = re.compile(r'[A-Za-zÀ-ÿ\x00]*\x00[A-Za-zÀ-ÿ\x00]*')
LIG = ['fi', 'fl', 'ff', 'ffi', 'ffl']
CORTE = re.compile(r'\s*Para\s+(?:ouvir|assistir)\b.*$', re.S | re.I)
FIM_TITULO = re.compile(r'(?<=[.!?:;)”"])\s+[^.!?:;]{3,90}$')   # título da seção seguinte, sem pontuação, grudado no fim

def textos(q):
    yield 'enunciado', q['enunciado']
    for k, v in q.get('alternativas', {}).items(): yield ('alt', k), v
    yield 'comentario', q['comentario']

files = sorted(glob.glob(f'{DIR}/*.json'))
data = {f: json.load(open(f)) for f in files}
vocab = collections.Counter()
for d in data.values():
    for q in d['questoes']:
        for _, t in textos(q):
            if '\x00' not in t:
                for w in WORD.findall(t): vocab[w.lower()] += 1
for d in data.values():              # palavras com \x00 também contribuem só pelas partes sem ele? não: evita viciar o vocabulário
    pass

cache, stats, nao_resolvidas = {}, collections.Counter(), collections.Counter()
def refaz(tok):
    if tok in cache: return cache[tok]
    n = tok.count('\x00'); best, best_n = None, 0
    for combo in itertools.product(LIG, repeat=min(n, 3)) if n <= 3 else []:
        cand = tok
        for c in combo: cand = cand.replace('\x00', c, 1)
        f = vocab.get(cand.lower(), 0)
        if f > best_n: best, best_n = cand, f
    if best: stats['ligatura resolvida pelo vocabulário'] += 1; cache[tok] = best
    else:
        # sem palavra conhecida: marcador de lista (NUL no começo, sozinho ou antes de maiúscula/fim) some; antes de 'u' era "fl"; o resto era "fi"
        out = []
        for i, ch in enumerate(tok):
            if ch != '\x00': out.append(ch); continue
            left = tok[i - 1] if i else ''; right = tok[i + 1] if i + 1 < len(tok) else ''
            if right.islower(): out.append('fl' if right == 'u' else 'fi')
            else: out.append(' ' if left.isalpha() and right.isupper() else '')
        cache[tok] = ''.join(out); stats['sem match (regra pelo contexto)'] += 1; nao_resolvidas[tok.replace('\x00', '·') + ' → ' + cache[tok]] += 1
    return cache[tok]

AVISO_LDI = re.compile(r'\s*Para\s+(?:ouvir|assistir)\b[^.]{0,120}?\bLDI\.?', re.I)   # linha de aviso do curso caída no meio do texto

def conserta(t, aviso=True):
    if '\x00' in t: t = TOKEN.sub(lambda m: refaz(m.group(0)), t)
    t = t.replace('\x00', '')
    return AVISO_LDI.sub('', t) if aviso else t

total = tocadas = 0
for f, d in data.items():
    for q in d['questoes']:
        total += 1; antes = json.dumps(q, ensure_ascii=False)
        q['enunciado'] = conserta(q['enunciado'])
        q['alternativas'] = {k: conserta(v) for k, v in q.get('alternativas', {}).items()}
        c = conserta(q['comentario'], aviso=False); c2 = CORTE.sub('', c).strip()
        if c2 != c:
            stats['comentário cortado (resto de outra aula)'] += 1
            c3 = FIM_TITULO.sub('', c2).strip()
            if c3 != c2 and len(c3) >= 25: c2 = c3; stats['  e removido o título da seção seguinte'] += 1
        q['comentario'] = AVISO_LDI.sub('', c2 if len(c2) >= 25 else c).strip()
        if json.dumps(q, ensure_ascii=False) != antes: tocadas += 1
print(f'{total} questões, {tocadas} alteradas'); [print(f'  {v:6d}  {k}') for k, v in stats.items()]
print('palavras sem match mais comuns:', ', '.join(f'{k}×{v}' for k, v in nao_resolvidas.most_common(12)))
if '--aplicar' in sys.argv:
    for f, d in data.items(): json.dump(d, open(f, 'w'), ensure_ascii=False)
    print('aplicado.')
