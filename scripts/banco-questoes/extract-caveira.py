"""Extrai questões objetivas comentadas (formato Projeto Caveira) de PDFs para JSON, sem IA.
Uso: python3 extract_caveira.py <pdf>... -> escreve ~/fontes-todahora/comentadas/<nome>.json e imprime um resumo.
Cada questão só é aceita se tiver enunciado, alternativas A-E (ou A-D), gabarito dentro das alternativas e comentário."""
import sys, re, json, os, logging
logging.disable(logging.CRITICAL)
import pypdf

OUT = os.path.expanduser('~/fontes-todahora/comentadas')
HDR = re.compile(r'^(PROJETO CAVEIRA.*|\s*\d{1,3}\s*)$')

def pdf_text(path):
    r = pypdf.PdfReader(path)
    pages = []
    for p in r.pages:
        t = p.extract_text() or ''
        lines = [l for l in t.split('\n') if not HDR.match(l.strip())]
        pages.append('\n'.join(lines))
    return '\n'.join(pages)

Q_SPLIT = re.compile(r'(?m)^\s*(\d{1,3})\s*[\.\-–)]\s+(?=\S)')
OPT = re.compile(r'(?m)^\s*\(?([A-E])\)\s+')

def clean(s):
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s*\n\s*', ' ', s)
    return s.strip()

def parse(text):
    qs, rej = [], 0
    # blocos terminam em "Gabarito: X"; o comentário vai até o próximo número de questão
    parts = re.split(r'(?m)^\s*Gabarito:\s*([A-E])\b.*$', text)
    # parts = [antes, letra, depois, letra, depois, ...]
    for i in range(1, len(parts) - 1, 2):
        before, letter, after = parts[i - 1], parts[i], parts[i + 1]
        starts = list(Q_SPLIT.finditer(before))
        if not starts:
            rej += 1; continue
        m = starts[-1]
        body = before[m.end():]
        num = int(m.group(1))
        om = list(OPT.finditer(body))
        letters = [o.group(1) for o in om]
        if letters[:4] != ['A', 'B', 'C', 'D'] or len(set(letters)) != len(letters):
            rej += 1; continue
        stem = clean(body[:om[0].start()])
        opts = []
        for k, o in enumerate(om):
            end = om[k + 1].start() if k + 1 < len(om) else len(body)
            opts.append(clean(body[o.end():end]))
        if letter not in letters or len(stem) < 25 or any(len(o) < 1 for o in opts):
            rej += 1; continue
        com = re.split(r'(?m)^\s*\d{1,3}\s*[\.\-–)]\s+(?=\S)', after, 1)[0]
        com = re.sub(r'(?i)^\s*COMENT[ÁA]RIO DO PROFESSOR:?\s*', '', com.strip())
        com = clean(com)
        qs.append({'n': num, 'enunciado': stem, 'alternativas': dict(zip(letters, opts)), 'gabarito': letter,
                   'comentario': com})
    return qs, rej

if __name__ == '__main__':
    for f in sys.argv[1:]:
        name = os.path.basename(f)
        try:
            qs, rej = parse(pdf_text(f))
        except Exception as e:
            print(f'ERRO\t{name}\t{e}'); continue
        json.dump({'arquivo': name, 'questoes': qs}, open(os.path.join(OUT, re.sub(r'[^\w\-. ]', '_', name) + '.json'), 'w'), ensure_ascii=False)
        print(f'{len(qs)}\trej={rej}\t{name}')
