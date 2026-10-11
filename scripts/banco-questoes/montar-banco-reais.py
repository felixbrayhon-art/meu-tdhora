"""Monta o pacote de rascunhos do banco de questões REAIS (Firestore question_drafts, via worker/scripts/push_drafts.py).
Só entra questão de prova de banca (rótulo '(BANCA/ANO/...)', ou cabeçalho 'Questão ANO | id'). O que o professor fez (rótulo 'Inédita'/'Simulado',
sem rótulo) fica de fora: continua só na busca da IA. Organização, como no Drive: Área (position) -> Matéria (importSubject, nome padronizado) ->
Assunto (subjectRaw = título da aula). Nada é publicado aqui: o admin aprova no app.
Uso: python3 montar_banco_reais.py  -> ~/fontes-todahora/banco-reais/{pacote.json, relatorio.txt}"""
import json, glob, os, re, hashlib, collections, unicodedata, zipfile
from datetime import datetime, timezone
DIR = os.path.expanduser('~/fontes-todahora/comentadas'); BRUTO = os.path.expanduser('~/fontes-todahora/comentadas-bruto'); OUT = os.path.expanduser('~/fontes-todahora/banco-reais'); os.makedirs(OUT, exist_ok=True)
BANCAS = {'CESPE': 'CEBRASPE', 'CEBRASPE': 'CEBRASPE', 'FGV': 'FGV', 'FCC': 'FCC', 'VUNESP': 'VUNESP', 'IDECAN': 'IDECAN', 'AOCP': 'AOCP', 'IBFC': 'IBFC', 'CESGRANRIO': 'CESGRANRIO',
          'FUNDATEC': 'FUNDATEC', 'QUADRIX': 'QUADRIX', 'IADES': 'IADES', 'FUNCAB': 'FUNCAB', 'CONSULPLAN': 'CONSULPLAN', 'UFPR': 'UFPR', 'FEPESE': 'FEPESE', 'FUMARC': 'FUMARC',
          'IBADE': 'IBADE', 'NUCEPE': 'NUCEPE', 'OBJETIVA': 'OBJETIVA', 'FAURGS': 'FAURGS', 'FADESP': 'FADESP', 'UNIVERSA': 'UNIVERSA', 'ACAFE': 'ACAFE', 'UNIVAG': 'UNIVAG',
          'MARINHA': 'MARINHA', 'FUNRIO': 'FUNRIO', 'UEPA': 'UEPA', 'UPENET': 'UPENET', 'SELECON': 'SELECON', 'IAUPE': 'IAUPE', 'INSTITUTO AOCP': 'AOCP'}
PROF = re.compile(r'in[ée]dit|simulad|professor|autoral|adapta', re.I)
MATERIAS = {'penal': 'Direito Penal', 'constitucional': 'Direito Constitucional', 'administrativo': 'Direito Administrativo', 'processual penal': 'Direito Processual Penal',
            'processual civil': 'Direito Processual Civil', 'civil': 'Direito Civil', 'trabalho': 'Direito do Trabalho', 'processual trabalho': 'Direito Processual do Trabalho',
            'direitos humanos': 'Direitos Humanos', 'direitos difusos e coletivos': 'Direitos Difusos e Coletivos', 'rlm': 'Raciocínio Lógico', 'informática': 'Informática',
            'português + redação oficial': 'Língua Portuguesa', 'português': 'Língua Portuguesa', 'criminologia': 'Criminologia', 'ciminologia': 'Criminologia', 'tributário': 'Direito Tributário',
            'empresarial': 'Direito Empresarial', 'previdenciário': 'Direito Previdenciário', 'leg penal especial': 'Legislação Penal Especial', 'legislação penal extravagante': 'Legislação Penal Especial'}

def banca_ano(tag):
    if not tag or PROF.search(tag): return None
    parts = [p.strip() for p in re.split(r'\s*[/–—]\s*|\s+-\s+', tag) if p.strip()]
    m = re.search(r'\b(19|20)\d{2}\b', tag); ano = int(m.group(0)) if m else None
    banca = next((BANCAS[p.upper().replace('.', '')] for p in parts if BANCAS.get(p.upper().replace('.', ''))), None)
    if not banca and ano and parts and len(parts[0]) <= 28 and not re.search(r'quest|simul|exerc|prova', parts[0], re.I): banca = parts[0].upper() if len(parts[0]) <= 10 else parts[0]
    if ano and not (1995 <= ano <= 2026): return None      # ex.: '(CF/1988)' não é ano de prova
    if not banca or not (ano or banca in BANCAS.values()): return None
    resto = [p for p in parts if not re.fullmatch(r'(19|20)\d{2}', p) and BANCAS.get(p.upper().replace('.', '')) is None and p != banca and p.upper() != str(banca).upper()]
    return banca, ano, resto

def aula_titulo(nome):
    t = re.sub(r'\.pdf$', '', nome, flags=re.I)
    t = re.sub(r'^(aula\s+(simplificada|extra)\s+\d+|aula\s+\d+|\d+)\s*[\.\-–:]\s*', '', t, flags=re.I)
    return re.sub(r'\s+', ' ', t.replace('_', ':')).strip(' .') or nome

def organiza(caminho, area_padrao):
    segs = [s for s in caminho.replace('\\', '/').split('/') if s]
    area = re.sub(r'^[ÁA]REA\s+', '', segs[0], flags=re.I).title() if segs and re.match(r'^[ÁA]REA\s', segs[0], re.I) else area_padrao
    disc = segs[-2] if len(segs) >= 2 else ''
    return area, MATERIAS.get(disc.strip().lower(), disc.strip()), aula_titulo(segs[-1])

def draft(q, source, ext, banca, ano, orgao, cargo, area, materia, assunto, carreira):
    ce = q['tipo'] == 'certo_errado'
    alts = ([{'letter': 'A', 'text': 'Certo', 'isCorrect': q['gabarito'] == 'C', 'position': 0}, {'letter': 'B', 'text': 'Errado', 'isCorrect': q['gabarito'] == 'E', 'position': 1}] if ce else
            [{'letter': l, 'text': t, 'isCorrect': l == q['gabarito'], 'position': i} for i, (l, t) in enumerate(q['alternativas'].items())])
    h = hashlib.sha256(re.sub(r'\s+', ' ', unicodedata.normalize('NFKD', q['enunciado']).encode('ascii', 'ignore').decode()).strip().lower().encode()).hexdigest()
    return {'source': source, 'externalId': ext, 'number': q.get('n', 0), 'questionType': 'certo_errado' if ce else 'multipla_escolha', 'subjectRaw': assunto, 'topicRaw': carreira,
            'statement': q['enunciado'], 'alternatives': alts, 'correctLetter': ('A' if q['gabarito'] == 'C' else 'B') if ce else q['gabarito'], 'explanation': q['comentario'], 'sourcePage': 0,
            'contentHash': h, 'status': 'pending_review', 'warnings': [], 'examYear': ano, 'examBoard': banca, 'organization': orgao, 'position': area, 'importSubject': materia}

if __name__ == '__main__':
    # caminho completo dos est_*.json: o nome do arquivo guarda md5(caminho no zip)
    hashpath = {}
    for z in glob.glob(os.path.expanduser('~/Downloads/ÁREA POLICIAL-*.zip')):
        try:
            for i in zipfile.ZipFile(z).infolist(): hashpath[hashlib.md5(i.filename.encode()).hexdigest()[:8]] = i.filename
        except Exception: pass
    items = []   # (questão, caminho, área padrão, fonte)
    for f in sorted(glob.glob(f'{DIR}/est_*.json')):
        cam = hashpath.get(os.path.basename(f)[4:12])
        if not cam: continue
        for q, raw in zip(json.load(open(f))['questoes'], json.load(open(f.replace(DIR, BRUTO)))['questoes']): q.setdefault('tipo', 'multipla_escolha'); q['_id_orig'] = raw['enunciado']; items.append((q, cam, 'Policial'))
    for f in sorted(glob.glob(f'{DIR}/sol_*.json')):
        d = json.load(open(f))
        for q, raw in zip(d['questoes'], json.load(open(f.replace(DIR, BRUTO)))['questoes']): q['_id_orig'] = raw['enunciado']; items.append((q, d['caminho'], 'Jurídica'))
    drafts, seen = [], set(); stats = collections.Counter(); porarea = collections.Counter(); bancas = collections.Counter(); anos = collections.Counter(); tree = collections.defaultdict(lambda: collections.Counter())
    for q, cam, area_pad in items:
        if q['tipo'] == 'multipla_escolha' and list(q['alternativas']) != list('ABCDE'): stats['descartada: alternativas'] += 1; continue
        r = banca_ano(q.get('tag', ''))
        if r: banca, ano, resto = r
        elif q.get('ano_cab'): banca, ano, resto = None, q['ano_cab'], []
        else: stats['professor/sem rótulo (só busca da IA)'] += 1; continue
        key = hashlib.md5(q.get('_id_orig', q['enunciado']).encode()).hexdigest()
        if key in seen: stats['repetida'] += 1; continue
        seen.add(key)
        area, materia, assunto = organiza(cam, area_pad); carreira = (cam.replace('\\', '/').split('/')[1] if cam.upper().startswith('ÁREA') and cam.count('/') >= 3 else cam.split('/')[0])
        drafts.append(draft(q, 'estrategia_concursos', key[:16], banca, ano, resto[0] if resto else None, ' / '.join(resto[1:3]) or None, area, materia, assunto, carreira))
        stats['de banca → banco de reais'] += 1; stats['  Certo/Errado' if q['tipo'] == 'certo_errado' else '  múltipla escolha'] += 1
        porarea[area] += 1; bancas[banca or '(banca não informada)'] += 1; anos[ano] += 1; tree[(area, materia)][assunto] += 1
    meta = {'title': 'Estratégia Concursos — questões de provas por área/matéria/assunto', 'ownerName': None, 'ownerEmail': None, 'generatedAt': datetime.now(timezone.utc).isoformat(), 'bloco': None}
    json.dump({'meta': meta, 'questions': drafts}, open(f'{OUT}/pacote.json', 'w'), ensure_ascii=False)
    rel = [f'{k}: {v}' for k, v in stats.items()] + ['', 'POR ÁREA: ' + ', '.join(f'{a} {n}' for a, n in porarea.most_common()), '', 'POR MATÉRIA (área › matéria: questões, assuntos):']
    rel += [f'  {a} › {m}: {sum(c.values())} questões, {len(c)} assuntos' for (a, m), c in sorted(tree.items(), key=lambda x: -sum(x[1].values()))[:40]]
    rel += ['', 'por banca: ' + ', '.join(f'{b} {n}' for b, n in bancas.most_common(12)), 'por ano: ' + ', '.join(f'{a} {n}' for a, n in sorted((k, v) for k, v in anos.items() if k))]
    open(f'{OUT}/relatorio.txt', 'w').write('\n'.join(rel)); print('\n'.join(rel))
