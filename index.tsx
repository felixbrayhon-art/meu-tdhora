
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Quando uma versão nova do app é publicada, os arquivos de código antigos deixam de existir no
// servidor. Uma aba que ficou aberta ainda aponta para eles, então a próxima tela que ela tentar
// abrir falha — foi o que fez a IA "parar de funcionar" sem erro nenhum no servidor. Aqui a aba
// se recarrega sozinha uma única vez; a trava no sessionStorage evita ficar recarregando em loop
// caso a falha seja outra (sem internet, por exemplo).
const RECARGA_VERSAO = 'todahora:recarga-versao';
const INTERVALO_MINIMO_MS = 60_000;
window.addEventListener('vite:preloadError', (evento) => {
  evento.preventDefault();
  const agora = Date.now();
  try {
    // Só recarrega se a última recarga foi há mais de um minuto. Se o arquivo continuar
    // falhando (internet caída, e não versão nova), a aba para em vez de recarregar sem fim.
    if (agora - Number(sessionStorage.getItem(RECARGA_VERSAO) || 0) < INTERVALO_MINIMO_MS) return;
    sessionStorage.setItem(RECARGA_VERSAO, String(agora));
  } catch { /* navegador sem sessionStorage: segue e recarrega */ }
  window.location.reload();
});

// Modo offline + pedido para o aparelho não apagar os cadernos (o Safari limpa dados de sites pouco usados).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
try { void navigator.storage?.persist?.(); } catch { /* sem suporte */ }
