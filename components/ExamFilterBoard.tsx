import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Folder, Search } from './icons';
import {
  ExamFacet,
  ExamFilter,
  ExamRow,
  emptyExamFilter,
  filterExamRows,
  loadExamRows,
  parKey,
  parSplit,
} from '../services/questionBankService';

// Filtro de questões em três colunas (categorias | opções | filtros ativos e total), com vários itens por categoria.
// Estilo próprio (classes efb-*) com variáveis de cor e modo escuro via `html.dark`, para não depender dos remapeamentos globais de cor do index.css.

interface Props {
  loading: boolean;
  error: string | null;
  onGenerate: (filter: ExamFilter, count: number, label: string) => void;
}

interface Option { value: string; count: number; children?: Option[] }

const FACETS: { id: ExamFacet; label: string; title: string }[] = [
  { id: 'subjects', label: 'Matéria e assunto', title: 'Matérias e assuntos' },
  { id: 'boards', label: 'Banca', title: 'Bancas' },
  { id: 'orgs', label: 'Órgão e cargo', title: 'Órgãos e cargos' },
  { id: 'years', label: 'Ano', title: 'Anos' },
  { id: 'areas', label: 'Área (Carreira)', title: 'Áreas' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmt = (n: number) => n.toLocaleString('pt-BR');
const byName = (a: Option, b: Option) => a.value.localeCompare(b.value, 'pt-BR');

const tally = (rows: ExamRow[], pick: (r: ExamRow) => string | number | null): Map<string, number> => {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const v = pick(r);
    if (v === null || v === undefined || String(v).trim() === '') return;
    m.set(String(v), (m.get(String(v)) ?? 0) + 1);
  });
  return m;
};
const flat = (m: Map<string, number>, desc = false): Option[] =>
  [...m.entries()].map(([value, count]) => ({ value, count })).sort(desc ? (a, b) => Number(b.value) - Number(a.value) : byName);
const tree = (rows: ExamRow[], parent: (r: ExamRow) => string | null, child: (r: ExamRow) => string | null): Option[] => {
  const pais = new Map<string, ExamRow[]>();
  rows.forEach((r) => { const p = parent(r); if (p && p.trim()) pais.set(p, [...(pais.get(p) ?? []), r]); });
  return [...pais.entries()].map(([value, lista]) => ({ value, count: lista.length, children: flat(tally(lista, child)) })).sort(byName);
};

const ExamFilterBoard: React.FC<Props> = ({ loading, error, onGenerate }) => {
  const [rows, setRows] = useState<ExamRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExamFilter>(emptyExamFilter());
  const [facet, setFacet] = useState<ExamFacet>('subjects');
  const [find, setFind] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [count, setCount] = useState(10);

  useEffect(() => {
    let vivo = true;
    loadExamRows().then((r) => { if (vivo) setRows(r); }).catch((e) => { if (vivo) setLoadError(e?.message || 'Não foi possível carregar o banco de questões.'); });
    return () => { vivo = false; };
  }, []);

  // Opções de cada categoria, contadas com os filtros das OUTRAS categorias aplicados (a própria categoria não esconde suas opções).
  const options = useMemo<Record<ExamFacet, Option[]>>(() => {
    if (!rows) return { subjects: [], boards: [], orgs: [], years: [], areas: [] };
    return {
      subjects: tree(filterExamRows(rows, filter, 'subjects'), (r) => r.import_subject, (r) => r.subject_raw),
      boards: flat(tally(filterExamRows(rows, filter, 'boards'), (r) => r.exam_board)),
      orgs: tree(filterExamRows(rows, filter, 'orgs'), (r) => r.organization, (r) => r.position),
      years: flat(tally(filterExamRows(rows, filter, 'years'), (r) => r.exam_year), true),
      areas: flat(tally(filterExamRows(rows, filter, 'areas'), (r) => r.area)),
    };
  }, [rows, filter]);

  const total = useMemo(() => (rows ? filterExamRows(rows, filter).length : 0), [rows, filter]);
  const baseTotal = rows?.length ?? 0;
  const max = Math.min(100, Math.max(1, total));
  useEffect(() => { if (total > 0 && count > total) setCount(total); }, [total]);

  const update = (patch: Partial<ExamFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const without = (list: string[], v: string) => list.filter((x) => x !== v);
  const toggle = (list: string[], v: string) => (list.includes(v) ? without(list, v) : [...list, v]);

  const treeKeys = (f: 'subjects' | 'orgs') => (f === 'subjects' ? { pais: 'subjects', filhos: 'topics' } as const : { pais: 'orgs', filhos: 'positions' } as const);
  const toggleParent = (f: 'subjects' | 'orgs', pai: string) => {
    const { pais, filhos } = treeKeys(f);
    const marcado = filter[pais].includes(pai);
    update({
      [pais]: marcado ? without(filter[pais], pai) : [...filter[pais], pai],
      [filhos]: filter[filhos].filter((k) => parSplit(k)[0] !== pai),
    } as Partial<ExamFilter>);
  };
  const toggleChild = (f: 'subjects' | 'orgs', pai: string, filho: string) => {
    const { pais, filhos } = treeKeys(f);
    const key = parKey(pai, filho);
    const novos = toggle(filter[filhos], key);
    const restam = novos.some((k) => parSplit(k)[0] === pai);
    update({
      [filhos]: novos,
      [pais]: restam ? (filter[pais].includes(pai) ? filter[pais] : [...filter[pais], pai]) : without(filter[pais], pai),
    } as Partial<ExamFilter>);
  };
  const toggleFlat = (f: 'boards' | 'years' | 'areas', v: string) => update({ [f]: toggle(filter[f], v) } as Partial<ExamFilter>);

  const badge = (f: ExamFacet) => {
    if (f === 'subjects') return filter.subjects.filter((s) => !filter.topics.some((k) => parSplit(k)[0] === s)).length + filter.topics.length;
    if (f === 'orgs') return filter.orgs.filter((s) => !filter.positions.some((k) => parSplit(k)[0] === s)).length + filter.positions.length;
    return filter[f].length;
  };

  // Etiquetas dos filtros ativos, agrupadas por categoria.
  const active = useMemo(() => {
    const grupos: { titulo: string; itens: { rotulo: string; remover: () => void }[] }[] = [];
    const arvore = (titulo: string, f: 'subjects' | 'orgs') => {
      const { pais, filhos } = treeKeys(f);
      const itens: { rotulo: string; remover: () => void }[] = [];
      filter[pais].forEach((pai) => {
        const filhosDele = filter[filhos].filter((k) => parSplit(k)[0] === pai);
        if (filhosDele.length) filhosDele.forEach((k) => itens.push({ rotulo: parSplit(k)[1], remover: () => toggleChild(f, pai, parSplit(k)[1]) }));
        else itens.push({ rotulo: pai, remover: () => toggleParent(f, pai) });
      });
      if (itens.length) grupos.push({ titulo, itens });
    };
    arvore('Matéria e assunto', 'subjects');
    ([['boards', 'Banca'], ['years', 'Ano'], ['areas', 'Área']] as const).forEach(([f, titulo]) => {
      if (filter[f].length) grupos.push({ titulo, itens: filter[f].map((v) => ({ rotulo: v, remover: () => toggleFlat(f, v) })) });
    });
    arvore('Órgão e cargo', 'orgs');
    return grupos;
  }, [filter]);
  const nActive = active.reduce((n, g) => n + g.itens.length, 0);

  const q = norm(find.trim());
  const lista = options[facet].filter((o) => !q || norm(o.value).includes(q) || (o.children ?? []).some((c) => norm(c.value).includes(q)));
  const isTree = facet === 'subjects' || facet === 'orgs';
  const facetInfo = FACETS.find((f) => f.id === facet)!;

  const generate = () => {
    const resumo = active.map((g) => g.itens.map((i) => i.rotulo).join(', ')).join(' · ');
    onGenerate(filter, Math.min(count, max), resumo || 'Todas as questões do banco');
  };

  if (loadError) return <div className="efb-erro">{loadError}</div>;
  if (!rows) return <p className="efb-vazio">Carregando o banco de questões...</p>;
  if (rows.length === 0) return <p className="efb-vazio">Ainda não há provas oficiais aprovadas no nosso banco.</p>;

  return (
    <div className="efb">
      <style>{CSS}</style>
      <p className="efb-kicker">Concurso · Filtrar questões</p>
      <div className="efb-titulo" role="heading" aria-level={2}>Monte seu caderno de questões</div>
      {error && <div className="efb-erro">{error}</div>}

      <div className="efb-grid">
        <nav className="efb-painel efb-facetas" aria-label="Categorias do filtro">
          {FACETS.map((f) => (
            <button key={f.id} type="button" className={`efb-faceta${facet === f.id ? ' on' : ''}`} onClick={() => { setFacet(f.id); setFind(''); }}>
              <span>{f.label}</span>
              {badge(f.id) > 0 && <span className="efb-badge">{badge(f.id)}</span>}
            </button>
          ))}
        </nav>

        <section className="efb-painel">
          <div className="efb-head"><div className="efb-ht" role="heading" aria-level={3}>{facetInfo.title}</div><small>{lista.length} {lista.length === 1 ? 'opção' : 'opções'}</small></div>
          <div className="efb-busca">
            <Search size={16} aria-hidden="true" />
            <input type="text" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Pesquisar por nome" aria-label="Pesquisar por nome" />
          </div>
          <div className="efb-lista">
            {lista.length === 0 && <p className="efb-vazio">Nada encontrado com “{find}”.</p>}
            {lista.map((o) => {
              const f = facet as 'subjects' | 'orgs';
              const filhosVisiveis = (o.children ?? []).filter((c) => !q || norm(c.value).includes(q) || norm(o.value).includes(q));
              const aberto = isTree && (open[`${facet}:${o.value}`] || (q.length > 0 && filhosVisiveis.length > 0 && !norm(o.value).includes(q)));
              const marcado = isTree ? filter[treeKeys(f).pais].includes(o.value) : filter[facet as 'boards' | 'years' | 'areas'].includes(o.value);
              return (
                <React.Fragment key={o.value}>
                  <div className="efb-linha">
                    {isTree ? (
                      <button type="button" className={`efb-seta${aberto ? ' on' : ''}`} onClick={() => setOpen((s) => ({ ...s, [`${facet}:${o.value}`]: !s[`${facet}:${o.value}`] }))} aria-expanded={aberto} aria-label={`Mostrar itens de ${o.value}`}>
                        <ChevronRight size={14} />
                      </button>
                    ) : <span className="efb-seta ph" />}
                    <label>
                      <input type="checkbox" checked={marcado} onChange={() => (isTree ? toggleParent(f, o.value) : toggleFlat(facet as 'boards' | 'years' | 'areas', o.value))} />
                      {isTree && <Folder size={16} className="efb-pasta" aria-hidden="true" />}
                      <span className="efb-t">{o.value}</span>
                    </label>
                    <span className="efb-n">{fmt(o.count)}</span>
                  </div>
                  {aberto && filhosVisiveis.map((c) => (
                    <div className="efb-linha sub" key={c.value}>
                      <label>
                        <input type="checkbox" checked={filter[treeKeys(f).filhos].includes(parKey(o.value, c.value))} onChange={() => toggleChild(f, o.value, c.value)} />
                        <span className="efb-t">{c.value}</span>
                      </label>
                      <span className="efb-n">{fmt(c.count)}</span>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </section>

        <section className="efb-painel">
          <div className="efb-head"><div className="efb-ht" role="heading" aria-level={3}>Filtros ativos: {nActive}</div><button type="button" className="efb-link" onClick={() => setFilter(emptyExamFilter())} disabled={nActive === 0}>Limpar</button></div>
          <div className="efb-ativos">
            {active.length === 0 && <p className="efb-vazio">Nenhum filtro ainda. Escolha matéria, banca, órgão, ano ou área na lista ao lado.</p>}
            {active.map((g) => (
              <div key={g.titulo}>
                <div className="efb-gt">{g.titulo}</div>
                <div className="efb-tags">
                  {g.itens.map((i) => (
                    <button type="button" key={i.rotulo} className="efb-tag" onClick={i.remover} aria-label={`Remover ${i.rotulo}`}>{i.rotulo}<span aria-hidden="true">×</span></button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="efb-total">
            <div className="efb-num"><b>{fmt(total)}</b><span>{total === 1 ? 'questão encontrada' : 'questões encontradas'}</span></div>
            <div className="efb-barra" aria-hidden="true"><i style={{ width: `${total === 0 ? 0 : Math.max(2, Math.round((total / Math.max(1, baseTotal)) * 100))}%` }} /></div>
          </div>
        </section>
      </div>

      <div className="efb-rodape">
        <div className="efb-campo">
          <label htmlFor="efb-qtd">Quantidade de questões</label>
          <div className="efb-qtd">
            <input id="efb-qtd" type="range" min={1} max={max} value={Math.min(count, max)} disabled={total === 0} onChange={(e) => setCount(Number(e.target.value))} />
            <strong>{Math.min(count, max)}</strong>
          </div>
        </div>
        <button type="button" className="efb-gerar" onClick={generate} disabled={loading || total === 0}>
          {loading ? 'Buscando...' : total === 0 ? 'Sem questões com esses filtros' : 'Gerar questões'}
        </button>
      </div>
    </div>
  );
};

const CSS = `
.efb{--c-bg:#F4EBDD;--c-pat:#4A352A;--c-card:#FBF7F0;--c-sand:#E8DDCC;--c-ink:#4A352A;--c-ink2:#725442;--c-terra:#C96C4A;--c-on:#FFFFFF;--c-olive:#446B4E;--c-gold:#D8A53A;--c-line:rgba(74,53,42,.16);--c-chip:#F0E3D0;--c-field:#F4EBDD;background:var(--c-bg);color:var(--c-ink);text-align:left;font-size:14px;line-height:1.45;font-family:'Manrope',system-ui,sans-serif;position:relative;overflow:hidden;border-radius:26px;padding:22px;isolation:isolate;container-type:inline-size}
.efb::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--c-pat);opacity:.015;-webkit-mask:url(/padrao-fundo.png) 0 0/420px auto repeat;mask:url(/padrao-fundo.png) 0 0/420px auto repeat}
.efb-kicker{margin:0;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--c-ink2)}
.efb-titulo{font-family:'Righteous','Trebuchet MS',sans-serif;font-weight:400;font-size:28px;margin:2px 0 16px;text-wrap:balance;color:var(--c-ink)}
html.dark .efb{--c-bg:#241A14;--c-pat:#F1E6D6;--c-card:#2E221B;--c-sand:#3A2C23;--c-ink:#F1E6D6;--c-ink2:#C9B49E;--c-terra:#E07F5C;--c-on:#2A1710;--c-olive:#8FB596;--c-gold:#E4B955;--c-line:rgba(241,230,214,.16);--c-chip:#40312A;--c-field:#241A14}
.efb *{box-sizing:border-box}
.efb button,.efb input{font:inherit;color:inherit}
.efb-grid{display:grid;grid-template-columns:190px minmax(0,1.3fr) minmax(0,1fr);gap:14px;align-items:start}
.efb-painel{background:var(--c-card);border:1px solid var(--c-line);border-radius:18px;overflow:hidden;min-width:0}
.efb-facetas{display:flex;flex-direction:column;padding:8px;gap:2px}
.efb-faceta{display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:0;border-radius:12px;padding:10px 12px;text-align:left;font-weight:600;color:var(--c-ink2);cursor:pointer}
.efb-faceta:hover{background:var(--c-chip)}
.efb-faceta.on{background:var(--c-terra);color:var(--c-on)}
.efb-badge{font-size:11px;font-weight:700;border-radius:999px;padding:1px 7px;background:var(--c-olive);color:#fff;min-width:20px;text-align:center}
.efb-faceta.on .efb-badge{background:rgba(255,255,255,.28)}
.efb-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--c-line);background:var(--c-sand)}
.efb-ht{font-size:14px;font-weight:700}
.efb-head small{color:var(--c-ink2);font-weight:600}
.efb-busca{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--c-line);color:var(--c-ink2)}
.efb-busca input{flex:1;min-width:0;border:0;background:transparent;outline:0;padding:4px 0;color:var(--c-ink)}
.efb-busca input::placeholder{color:var(--c-ink2);opacity:.8}
.efb-lista{max-height:max(340px,calc(100dvh - 430px));overflow:auto;padding:6px}
.efb-linha{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px}
.efb-linha:hover{background:var(--c-chip)}
.efb-linha.sub{margin-left:30px}
.efb-linha label{flex:1;display:flex;align-items:center;gap:9px;cursor:pointer;min-width:0}
.efb-linha input[type=checkbox]{accent-color:var(--c-terra);width:16px;height:16px;margin:0;flex:none}
.efb-t{overflow-wrap:anywhere}
.efb-n{margin-left:auto;color:var(--c-ink2);font-size:12px;font-variant-numeric:tabular-nums;flex:none}
.efb-pasta{flex:none;color:var(--c-gold)}
.efb-seta{flex:none;width:22px;height:22px;display:grid;place-items:center;border:0;background:none;border-radius:6px;color:var(--c-ink2);cursor:pointer;transition:transform .15s}
.efb-seta.on{transform:rotate(90deg)}
.efb-seta.ph{visibility:hidden;cursor:default}
.efb-vazio{padding:20px 16px;color:var(--c-ink2);text-align:center;margin:0}
.efb-erro{background:#FBEAE4;color:#8A2F1A;border-radius:14px;padding:12px 14px;font-weight:700;margin-bottom:12px}
html.dark .efb-erro{background:#4A2A20;color:#F3C2B2}
.efb-ativos{padding:12px 14px;min-height:150px;max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.efb-gt{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-ink2)}
.efb-tags{display:flex;flex-wrap:wrap;gap:6px}
.efb-tag{display:inline-flex;align-items:center;gap:6px;background:var(--c-terra);color:var(--c-on);border:0;border-radius:999px;padding:5px 6px 5px 11px;font-weight:600;font-size:13px;cursor:pointer;max-width:100%;text-align:left}
.efb-link{background:none;border:0;padding:0;color:var(--c-olive);font-weight:700;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.efb-link:disabled{opacity:.4;cursor:default}
.efb-total{border-top:1px solid var(--c-line);padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--c-sand)}
.efb-num{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.efb-num b{font-family:'Righteous','Trebuchet MS',sans-serif;font-size:40px;line-height:1;font-weight:400;font-variant-numeric:tabular-nums}
.efb-num span{color:var(--c-ink2);font-weight:600}
.efb-barra{height:6px;border-radius:3px;background:var(--c-line);overflow:hidden}
.efb-barra i{display:block;height:100%;background:var(--c-olive);border-radius:3px;transition:width .25s}
.efb-rodape{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;background:var(--c-card);border:1px solid var(--c-line);border-radius:18px;padding:14px;margin-top:14px}
.efb-campo{display:flex;flex-direction:column;gap:6px;min-width:0}
.efb-campo label{font-size:12px;font-weight:600;color:var(--c-ink2)}
.efb-qtd{display:flex;align-items:center;gap:10px;font-weight:600}
.efb-qtd input{flex:1;min-width:0;accent-color:var(--c-terra)}
.efb-qtd strong{min-width:28px;text-align:right;font-variant-numeric:tabular-nums}
.efb-gerar{background:var(--c-terra);color:var(--c-on);border:0;border-radius:14px;padding:12px 22px;font-weight:700;cursor:pointer;white-space:nowrap}
.efb-gerar:hover:not(:disabled){filter:brightness(1.07)}
.efb-gerar:disabled{opacity:.45;cursor:not-allowed}
.efb :focus-visible{outline:2px solid var(--c-ink);outline-offset:2px}
@container (max-width:900px){
  .efb-grid{grid-template-columns:minmax(0,1fr)}
  .efb-facetas{flex-direction:row;overflow-x:auto}
  .efb-faceta{flex:none;white-space:nowrap}
  .efb-lista{max-height:340px}
  .efb-rodape{grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){.efb-barra i,.efb-seta{transition:none}}
`;

export default ExamFilterBoard;
