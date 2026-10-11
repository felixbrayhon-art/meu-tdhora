"""Extrai questões do PDF 'Exportar PDF' do FC Concursos (bloco: '· FC #id', Matéria, Assunto, enunciado, a)-e), Gabarito, comentário).
Uso: python3 extract_fc.py <pdf>... -> ~/fontes-todahora/comentadas/<nome>.json"""
import sys, re, json, os, logging
logging.disable(logging.CRITICAL)
import pypdf
OUT = os.path.expanduser('~/fontes-todahora/comentadas')

def clean(s):
    return re.sub(r'\s+', ' ', s).strip()

def parse(text):
    qs, rej = [], 0
    blocks = re.split(r'(?m)^\s*\d{1,4}\s*·\s*FC\s*#(\d+)\s*$', text)
    for i in range(1, len(blocks) - 1, 2):
        fc, b = blocks[i], blocks[i + 1]
        mm = re.search(r'Matéria:\s*(.+)', b); aa = re.search(r'Assunto:\s*(.+)', b)
        g = re.search(r'(?m)^\s*Gabarito:\s*([A-Ea-e])\b', b)
        if not (mm and g):
            rej += 1; continue
        head = b[(aa or mm).end():g.start()]
        om = list(re.finditer(r'(?m)^\s*([a-e])\)\s+', head))
        letters = [o.group(1).upper() for o in om]
        if letters[:4] != ['A', 'B', 'C', 'D']:
            rej += 1; continue
        stem = clean(head[:om[0].start()])
        opts = [clean(head[o.end():(om[k + 1].start() if k + 1 < len(om) else len(head))]) for k, o in enumerate(om)]
        com = b[g.end():]
        com = re.sub(r'(?is)^\s*COMENT[ÁA]RIO DO PROFESSOR\s*', '', com.strip())
        com = re.sub(r'(?is)\bFC\s*Concursos.*$', '', com)  # rodapé com dados pessoais
        gab = g.group(1).upper()
        if gab not in letters or len(stem) < 20:
            rej += 1; continue
        qs.append({'fc': fc, 'materia': clean(mm.group(1)), 'assunto': clean(aa.group(1)) if aa else '', 'enunciado': stem,
                   'alternativas': dict(zip(letters, opts)), 'gabarito': gab, 'comentario': clean(com)})
    return qs, rej

if __name__ == '__main__':
    for f in sys.argv[1:]:
        name = os.path.basename(f)
        try:
            r = pypdf.PdfReader(f)
            qs, rej = parse('\n'.join((p.extract_text() or '') for p in r.pages))
        except Exception as e:
            print(f'ERRO\t{name}\t{e}', flush=True); continue
        json.dump({'arquivo': name, 'questoes': qs}, open(os.path.join(OUT, 'fc_' + re.sub(r'[^\w\-. ]', '_', name)[-100:] + '.json'), 'w'), ensure_ascii=False)
        print(f'{len(qs)}\trej={rej}\t{name}', flush=True)
