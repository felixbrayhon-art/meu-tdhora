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

  const asNumber = q.replace(/[^\d]/g, '');
  if (asNumber && q.replace(/\s/g, '') === asNumber) {
    return articles.filter(a => a.numero === Number(asNumber));
  }

  return articles.filter(a => a.texto.toLowerCase().includes(q));
};
