"""Copia public.questoes_comentadas do D1 (Cloudflare) para o Supabase (tabela questoes_comentadas). Repetível: mesmo hash = ignorado."""
import json, os, subprocess, urllib.request, urllib.error, time
URL = 'https://tslcjsvetgqgsgqpyruf.supabase.co'
KEY = open(os.path.expanduser('~/fontes-todahora/.supabase-key')).read().strip()
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates,return=minimal', 'User-Agent': 'curl/8.7.1'}
def d1(sql):
    out = subprocess.run(['npx', 'wrangler@4', 'd1', 'execute', 'todahora-fontes', '--remote', '--json', '--command', sql], capture_output=True, text=True, cwd=os.path.expanduser('~'), timeout=300).stdout
    return json.loads(out[out.index('['):])[0]['results']
def post(rows):
    for a in range(4):
        try:
            urllib.request.urlopen(urllib.request.Request(f'{URL}/rest/v1/questoes_comentadas?on_conflict=hash', data=json.dumps(rows).encode(), headers=H, method='POST'), timeout=120).read(); return
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and a < 3: time.sleep(5 * (a + 1)); continue
            raise SystemExit(f'HTTP {e.code}: {e.read()[:200]!r}')
def count():
    r = urllib.request.Request(f'{URL}/rest/v1/questoes_comentadas?select=id', headers=dict(H, Prefer='count=exact', Range='0-0'))
    return urllib.request.urlopen(r, timeout=60).headers.get('Content-Range', '?').split('/')[-1]
if __name__ == '__main__':
    total = d1('SELECT COUNT(*) AS n FROM questoes_comentadas')[0]['n']; print('no D1:', total, '| no Supabase antes:', count())
    for off in range(0, total, 300):
        rows = d1(f'SELECT hash, fonte, disciplina, materia, assunto, enunciado, alternativas, gabarito, comentario FROM questoes_comentadas ORDER BY id LIMIT 300 OFFSET {off}')
        post([{**r, 'alternativas': json.loads(r['alternativas']), **{k: (v.replace('\x00', '') if isinstance(v, str) else v) for k, v in r.items() if k != 'alternativas'}} for r in rows])
        print(f'  {min(off + 300, total)}/{total}', flush=True)
    print('no Supabase depois:', count())
