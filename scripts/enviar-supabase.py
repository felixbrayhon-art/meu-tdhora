"""Envia pacotes (montar_banco_reais.py) ao Supabase: tabela public.questoes. Repetível: a questão com o mesmo id é ATUALIZADA no lugar (nada é apagado).
A chave secreta vem de ~/fontes-todahora/.supabase-key e nunca é impressa.
Uso: python3 scripts/enviar-supabase.py pacote-policial.json [pacote-juridica.json ...]"""
import json, os, re, sys, time, urllib.request, urllib.error
URL = 'https://tslcjsvetgqgsgqpyruf.supabase.co'
KEY = open(os.path.expanduser('~/fontes-todahora/.supabase-key')).read().strip()
HDR = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal', 'User-Agent': 'curl/8.7.1'}

def limpa(v):
    # PDFs às vezes trazem o caractere nulo (\u0000), que o Postgres recusa em texto
    if isinstance(v, str): return v.replace('\x00', '')
    if isinstance(v, list): return [limpa(x) for x in v]
    if isinstance(v, dict): return {k: limpa(x) for k, x in v.items()}
    return v

def area_de(q):
    # mesma regra do supabase/areas.sql: pasta do Drive (Estratégia) ou cargo (Gran Cursos); FC Concursos e o resto = Concursos gerais
    pos = q.get('position') or ''
    if pos in ('Jurídica', 'Policial'): return pos
    if q.get('source') == 'gran_cursos':
        for rx, a in ((r'advogado|juiz|procurador|residente jur|^jur[ií]dica', 'Jurídica'), (r'investigador|agente da autoridade|policial', 'Policial'),
                      (r'judici[aá]rio', 'Tribunais'), (r'auditor|fiscal', 'Fiscal'), (r'administrativ|assistente|analista de gest', 'Administrativa')):
            if re.search(rx, pos, re.I): return a
    return 'Concursos gerais'

def row(q):
    doc_id = re.sub(r'[^A-Za-z0-9_-]', '_', f"{q['source']}_{q['externalId']}")[:1400]
    return {'id': doc_id, 'source': q['source'], 'external_id': q['externalId'], 'import_subject': q.get('importSubject'), 'subject_raw': q.get('subjectRaw'),
            'topic_raw': q.get('topicRaw'), 'question_type': q.get('questionType', 'multipla_escolha'), 'statement': q['statement'], 'alternatives': q['alternatives'],
            'correct_letter': q['correctLetter'], 'explanation': q.get('explanation') or '', 'content_hash': q['contentHash'], 'exam_board': q.get('examBoard'),
            'organization': q.get('organization'), 'position': q.get('position'), 'area': area_de(q), 'exam_year': q.get('examYear')}

def post(batch):
    for attempt in range(4):
        req = urllib.request.Request(f'{URL}/rest/v1/questoes?on_conflict=id', data=json.dumps(batch).encode(), headers=HDR, method='POST')
        try:
            urllib.request.urlopen(req, timeout=120).read(); return
        except urllib.error.HTTPError as e:
            msg = e.read()[:200].decode('utf8', 'replace')
            if e.code in (429, 500, 502, 503, 504) and attempt < 3: time.sleep(5 * (attempt + 1)); continue
            if e.code == 409 and len(batch) > 1:
                for r in batch: post([r])
                return
            if e.code == 409: print('  pulada (enunciado igual a outra questão):', batch[0]['id'][:40]); return
            raise SystemExit(f'HTTP {e.code}: {msg}')

def count():
    req = urllib.request.Request(f'{URL}/rest/v1/questoes?select=id', headers=dict(HDR, Prefer='count=exact', Range='0-0'))
    return urllib.request.urlopen(req, timeout=60).headers.get('Content-Range', '?').split('/')[-1]

if __name__ == '__main__':
    base = os.path.expanduser('~/fontes-todahora/banco-reais/')
    print('antes:', count(), 'questões no banco')
    seen = set()
    for name in sys.argv[1:]:
        qs = json.load(open(name if os.path.isabs(name) else base + name))['questions']
        rows = []
        for q in qs:
            r = limpa(row(q))
            if r['content_hash'] in seen: continue
            seen.add(r['content_hash']); rows.append(r)
        for i in range(0, len(rows), 200):
            post(rows[i:i + 200]); print(f'  {name}: {min(i + 200, len(rows))}/{len(rows)}', flush=True)
    print('depois:', count(), 'questões no banco')
