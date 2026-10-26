import { LeiFederal, VadeMecumArticle } from '../types';

// Catálogo de leis federais vigentes (ctresb/leis, convertido por scripts/build-vademecum-leis.mjs). Os arquivos ficam em /vademecum/leis
// e entram no site na hora de publicar (scripts/deploy.sh); o índice só é baixado quando o aluno abre o catálogo.
const BASE = '/vademecum/leis';

let indexPromise: Promise<LeiFederal[]> | null = null;
export const loadLeisIndex = (): Promise<LeiFederal[]> => {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/indice.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Catálogo indisponível');
        return res.json() as Promise<LeiFederal[]>;
      })
      .catch((error) => { indexPromise = null; throw error; });
  }
  return indexPromise;
};

const blocos = new Map<string, Promise<Record<string, VadeMecumArticle[]>>>();
export const getLeiArticles = async (lei: LeiFederal): Promise<VadeMecumArticle[]> => {
  if (!blocos.has(lei.bloco)) {
    blocos.set(
      lei.bloco,
      fetch(`${BASE}/blocos/${lei.bloco}.json`)
        .then((res) => {
          if (!res.ok) throw new Error(`Não foi possível carregar ${lei.id}`);
          return res.json();
        })
        .catch((error) => { blocos.delete(lei.bloco); throw error; }),
    );
  }
  const bloco = await blocos.get(lei.bloco)!;
  const articles = bloco[lei.id];
  if (!articles) throw new Error(`Norma ${lei.id} não encontrada`);
  return articles;
};

const milhar = (numero: string) => numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);
export const tituloLei = (lei: LeiFederal) => `${lei.tipo} nº ${milhar(lei.numero)}${lei.data ? ` de ${dataBr(lei.data)}` : ''}`;
export const siglaLei = (lei: LeiFederal) => `${lei.tipo === 'Lei' ? 'Lei' : lei.tipo === 'Lei Complementar' ? 'LC' : lei.tipo === 'Decreto-Lei' ? 'DL' : lei.tipo === 'Emenda Constitucional' ? 'EC' : lei.tipo} ${milhar(lei.numero)}`;
export const fonteLei = (lei: LeiFederal) => `https://normas.leg.br/?urn=urn:lex:br:federal:${lei.tipo === 'Lei' ? 'lei' : lei.tipo === 'Lei Complementar' ? 'lei.complementar' : lei.tipo === 'Decreto-Lei' ? 'decreto.lei' : lei.tipo === 'Emenda Constitucional' ? 'emenda.constitucional' : 'lei.delegada'}:${lei.data};${lei.numero}`;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const TIPO_APELIDO: Record<string, string[]> = {
  'Lei': ['lei', 'l'], 'Lei Complementar': ['lc', 'lei complementar', 'complementar'], 'Decreto-Lei': ['dl', 'decreto-lei', 'decreto lei', 'decreto'],
  'Emenda Constitucional': ['ec', 'emenda', 'emenda constitucional'], 'Lei Delegada': ['ld', 'lei delegada', 'delegada'],
};

/** Busca no catálogo por número ("8742", "lei 8.742", "lc 101", "8742/1993"), por ano ou por palavras da ementa. */
export const searchLeis = (index: LeiFederal[], query: string, limit = 40): LeiFederal[] => {
  const q = norm(query).trim();
  if (!q) return index.slice(0, limit);
  const porNumero = q.match(/^(?:([a-z\- ]+?)\s*)?(?:n[ºo°.]?\s*)?(\d[\d.]*)(?:\s*[\/,-]\s*(\d{4}))?$/);
  if (porNumero) {
    const [, prefixo, num, ano] = porNumero;
    const numero = num.replace(/\./g, '');
    const prefixoNorm = (prefixo ?? '').trim();
    const achados = index.filter((l) => l.numero === numero
      && (!prefixoNorm || (TIPO_APELIDO[l.tipo] ?? []).some((a) => a === prefixoNorm))
      && (!ano || l.data.startsWith(ano)));
    if (achados.length || prefixoNorm || ano) return achados.slice(0, limit);
    // Só um número que não é número de norma: pode ser um ano ("1988").
    if (/^\d{4}$/.test(numero)) return index.filter((l) => l.data.startsWith(numero)).slice(0, limit);
  }
  const palavras = q.split(/\s+/).filter((p) => p.length > 1);
  if (!palavras.length) return [];
  return index.filter((l) => { const alvo = norm(`${l.tipo} ${l.ementa}`); return palavras.every((p) => alvo.includes(p)); }).slice(0, limit);
};
