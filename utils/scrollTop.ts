/** Rola o contêiner principal do app (marcado com data-main-scroll) de volta ao topo.
 *  Usado ao trocar de passo/subtela dentro da mesma view, onde o efeito de troca de view do App não dispara. */
export const scrollMainToTop = (): void => {
  try {
    const el = document.querySelector<HTMLElement>('[data-main-scroll]');
    if (el) el.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  } catch {
    /* ambiente sem DOM */
  }
};
