import { VadeMecumArticle } from '../types';

const cache = new Map<string, Promise<VadeMecumArticle[]>>();

export const getVadeMecumArticles = (lawId: string): Promise<VadeMecumArticle[]> => {
  if (!cache.has(lawId)) {
    cache.set(
      lawId,
      fetch(`/vademecum/${lawId}.json`).then(res => {
        if (!res.ok) throw new Error(`Não foi possível carregar ${lawId}`);
        return res.json();
      })
    );
  }
  return cache.get(lawId)!;
};

export const searchVadeMecumArticles = (articles: VadeMecumArticle[], query: string): VadeMecumArticle[] => {
  const q = query.trim().toLowerCase();
  if (!q) return articles;

  // A bare number ("121") matches that article and any of its lettered
  // amendments ("121-A", "121-B", ...); a fuller query ("121-a") matches exactly.
  const asNumber = q.replace(/[^\d]/g, '');
  if (asNumber && q.replace(/[\s-]/gi, '').toLowerCase() === asNumber) {
    return articles.filter(a => a.numero === asNumber || a.numero.startsWith(`${asNumber}-`));
  }
  const asNumeroExato = q.replace(/\s/g, '').toUpperCase();
  if (/^\d+(-[A-Z])+$/.test(asNumeroExato)) {
    return articles.filter(a => a.numero === asNumeroExato);
  }

  return articles.filter(a => a.texto.toLowerCase().includes(q));
};
