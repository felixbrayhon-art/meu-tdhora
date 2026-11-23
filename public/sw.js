/* ToDaHORA - modo offline. O build injeta abaixo a lista de arquivos do app e a versao. */
const VERSION = '__BUILD__';
const APP = 'tdh-app-' + VERSION;
const DADOS = 'tdh-dados';
const PRECACHE = __PRECACHE__;
const RESTO = __RESTO__;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP);
    // Um arquivo que falhe não impede a instalação.
    await Promise.all(['/', ...PRECACHE].map(async (url) => {
      try {
        const res = await fetch(url);
        if (respostaCoerente(url, res)) await cache.put(url, res);
      } catch (e) { /* um arquivo que falhe não impede a instalação */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n.startsWith('tdh-app-') && n !== APP).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// O resto do app (telas e bibliotecas pesadas) é guardado em segundo plano, um arquivo por vez,
// a partir de cada abertura de página: não segura a instalação nem disputa a rede com o uso.
let enchendo = null;
function guardaResto() {
  if (enchendo) return enchendo;
  enchendo = (async () => {
    const cache = await caches.open(APP);
    for (const url of RESTO) {
      if (await cache.match(url)) continue;
      try {
        const res = await fetch(url);
        if (respostaCoerente(url, res)) await cache.put(url, res);
      } catch (e) { break; }
    }
  })().finally(() => { enchendo = null; });
  return enchendo;
}

// Um pedido de arquivo que ainda não subiu volta como a própria index.html, com status 200 (é a regra de
// SPA: o que não existe cai na página). Guardar isso no lugar do .js envenena o cache — e como /assets/ é
// servido do cache primeiro ("nome com hash nunca muda"), o estrago fica para sempre: a tela que precisa
// daquele pedaço quebra com "Cannot read properties of undefined (reading 'default')" em toda visita.
// Foi o que aconteceu em 23/11/2026, numa publicação: 7 arquivos ficaram guardados como HTML.
function respostaCoerente(url, res) {
  if (!res || !res.ok) return false;
  const tipo = res.headers.get('content-type') || '';
  if (/\.js$/i.test(url)) return tipo.includes('javascript') || tipo.includes('ecmascript');
  if (/\.css$/i.test(url)) return tipo.includes('css');
  return true;
}

async function redeDepoisCache(request, nomeCache, fallbackUrl) {
  const cache = await caches.open(nomeCache);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl))) || Response.error();
  }
}

async function cacheDepoisRede(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const hit = await cache.match(request);
  // Confere o que já está guardado: cache envenenado por uma publicação anterior se cura sozinho na
  // primeira visita, sem o aluno precisar limpar nada.
  if (hit) {
    if (respostaCoerente(request.url, hit)) return hit;
    await cache.delete(request);
  }
  const res = await fetch(request);
  if (respostaCoerente(request.url, res)) cache.put(request, res.clone());
  return res;
}

async function atualizaEmSegundoPlano(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardada = await cache.match(request);
  const hit = guardada && respostaCoerente(request.url, guardada) ? guardada : null;
  const rede = fetch(request).then((res) => { if (respostaCoerente(request.url, res)) cache.put(request, res.clone()); return res; }).catch(() => null);
  return hit || (await rede) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || request.headers.has('range')) return;
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(redeDepoisCache(request, APP, '/'));
    event.waitUntil(new Promise((r) => setTimeout(r, 4000)).then(guardaResto));
  } else if (url.pathname.startsWith('/assets/')) {
    // Nomes com hash: nunca mudam, então o cache vale para sempre.
    event.respondWith(cacheDepoisRede(request, APP));
  } else if (url.pathname.startsWith('/vademecum/')) {
    event.respondWith(atualizaEmSegundoPlano(request, DADOS));
  } else {
    event.respondWith(atualizaEmSegundoPlano(request, APP));
  }
});
