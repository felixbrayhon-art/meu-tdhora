"""Une assuntos (subject_raw) escritos de jeito diferente na mesma matéria, no Supabase (public.questoes).
Regra conservadora: mesmo assunto = mesma chave depois de tirar acento/maiúscula/pontuação, normalizar a lei (n. 8.429-92 = nº 8.429/1992) e tirar
um parêntese final que só repete a matéria. O nome que fica é o mais usado. Guarda cópia dos valores antigos antes de mexer.
Uso: python3 unir_assuntos.py            (só mostra)      python3 unir_assuntos.py --aplicar"""
import json, os, re, sys, unicodedata, urllib.request, urllib.parse, collections
U = 'https://tslcjsvetgqgsgqpyruf.supabase.co'; KEY = open(os.path.expanduser('~/fontes-todahora/.supabase-key')).read().strip()
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'User-Agent': 'curl/8.7.1'}
def api(path, method='GET', body=None, prefer=None):
    h = dict(H, **({'Prefer': prefer} if prefer else {}))
    r = urllib.request.Request(f'{U}/rest/v1/{path}', data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    out = urllib.request.urlopen(r, timeout=120).read(); return json.loads(out) if out else None
def ascii_(t): return unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
def chave(assunto, materia):
    t = ascii_(assunto).lower()
    m = ascii_(materia).lower()
    t = re.sub(r'\(\s*' + re.escape(m) + r'\s*\)\s*$', '', t)                                     # "(Direito Administrativo)" no fim
    def lei(mm):
        ano = mm.group(2); ano = ano if len(ano) == 4 else ('20' + ano if int(ano) <= 30 else '19' + ano)
        return f"lei {mm.group(1).replace('.', '')}/{ano}"
    t = re.sub(r'lei(?:\s+complementar|\s+estadual)?\s*(?:n[o.°]*\s*)?([\d.]+)\s*[-/]\s*(\d{2,4})', lei, t)  # lei n. 8.429-92 / lei no 8.429/1992 -> lei 8429/1992
    t = re.sub(r'[^a-z0-9/]+', ' ', t).strip()
    return t
# Regras escritas à mão: (matéria, nome que fica ou None = o mais usado, regex sobre o assunto sem acento/minúsculo). Só repetidos claros.
REGRAS = [
  ('Direito Administrativo', 'Improbidade Administrativa (Lei nº 8.429/1992)', r'8\.?429'),
  ('Direito Administrativo', 'Licitações (Lei nº 14.133/2021)', r'^licitac.*14\.?133'),
  ('Direito Administrativo', 'Lei Anticorrupção (Lei nº 12.846/2013)', r'anticorrup|12\.?846'),
  ('Direito Administrativo', 'Processo Administrativo Federal (Lei nº 9.784/1999)', r'^processo administrativo federal'),
  ('Direito Administrativo', 'Bens Públicos', r'^bens publicos'),
  ('Direito Administrativo', 'Intervenção do Estado na Propriedade', r'^intervencao do estado na propriedade'),
  ('Direito Administrativo', 'Controle da Administração Pública', r'^controle da administracao( publica)?$'),
  ('Direito Constitucional', 'Do Poder Judiciário (arts. 92 a 126 da CF/1988)', r'poder judiciario'),
  ('Direito Constitucional', 'Do Poder Legislativo (arts. 44 a 75 da CF/1988)', r'poder legislativo'),
  ('Direito Constitucional', 'Do Poder Executivo (arts. 76 a 91 da CF/1988)', r'poder executivo'),
  ('Direito Constitucional', 'Processo Legislativo (arts. 59 a 69 da CF/1988)', r'^processo legislativo'),
  ('Direito Constitucional', 'Da Organização do Estado (arts. 18 a 43 da CF/1988)', r'^(da )?organizacao do estado'),
  ('Direito Constitucional', 'Finanças Públicas (arts. 163 a 169 da CF/1988)', r'^financas publicas'),
  ('Direito Constitucional', 'Direitos Políticos (arts. 14 a 16 da CF/1988)', r'^direitos politicos'),
  ('Direito Constitucional', 'Da Ordem Econômica e Financeira (arts. 170 a 192 da CF/1988)', r'ordem economica'),
  ('Direito Constitucional', 'Seguridade Social (arts. 194 a 204 da CF/1988)', r'^seguridade social'),
  ('Direito Constitucional', 'Teoria do Direito Constitucional', r'^teoria (geral )?do direito constitucional'),
  ('Direito Penal', None, r'funcionario publico contra a administracao'),
  ('Direito Penal', 'Princípios de Direito Penal', r'^principios (de|do) direito penal'),
]

if __name__ == '__main__':
    linhas = []; off = 0
    while True:
        b = api(f'questoes?select=id,import_subject,subject_raw&subject_raw=not.is.null&limit=1000&offset={off}'); linhas += b
        if len(b) < 1000: break
        off += 1000
    cont = collections.Counter((r['import_subject'], r['subject_raw']) for r in linhas)
    grupos = collections.defaultdict(list)
    for (mat, ass), n in cont.items(): grupos[(mat, chave(ass, mat or ''))].append((ass, n))
    mapa = {}   # (matéria, antigo) -> novo
    for (mat, k), vs in grupos.items():
        if len(vs) > 1:
            novo = sorted(vs, key=lambda x: (-x[1], len(x[0])))[0][0]
            for ass, n in vs:
                if ass != novo: mapa[(mat, ass)] = (novo, n)
    for mat, canon, rx in REGRAS:
        achados = [(a, n) for (m, a), n in cont.items() if m == mat and re.search(rx, ascii_(a).lower())]
        if len(achados) > 1 or (canon and achados and achados[0][0] != canon):
            novo = canon or sorted(achados, key=lambda x: (-x[1], len(x[0])))[0][0]
            for a, n in achados:
                if a != novo: mapa[(mat, a)] = (novo, n)
    print(f'{len(cont)} assuntos distintos → {len(cont) - len(mapa)} depois de unir ({len(mapa)} nomes repetidos, {sum(n for _, n in mapa.values())} questões afetadas)')
    for (mat, ass), (novo, n) in sorted(mapa.items(), key=lambda x: -x[1][1])[:30]: print(f'  [{mat}] {n:3d}×  "{ass[:62]}"  →  "{novo[:62]}"')
    if '--aplicar' in sys.argv:
        backup = [r for r in linhas if (r['import_subject'], r['subject_raw']) in mapa]
        json.dump(backup, open(os.path.expanduser('~/fontes-todahora/banco-reais/backup-assuntos-antes-de-unir.json'), 'w'), ensure_ascii=False)
        print('backup:', len(backup), 'questões')
        feito = 0
        for (mat, ass), (novo, n) in mapa.items():
            q = f"questoes?import_subject=eq.{urllib.parse.quote(mat)}&subject_raw=eq.{urllib.parse.quote(ass)}"
            api(q, 'PATCH', {'subject_raw': novo}, 'return=minimal'); feito += n
        print('questões atualizadas:', feito)
