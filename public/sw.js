/* ToDaHORA - modo offline. O build injeta abaixo a lista de arquivos do app e a versao. */
const VERSION = '__BUILD__';
const APP = 'tdh-app-' + VERSION;
const DADOS = 'tdh-dados';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP);
    // Um arquivo que falhe não impede a instalação.
    await Promise.all(['/', ...PRECACHE].map((url) => cache.add(url).catch(() => {})));
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
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function atualizaEmSegundoPlano(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const hit = await cache.match(request);
  const rede = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
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
  } else if (url.pathname.startsWith('/assets/')) {
    // Nomes com hash: nunca mudam, então o cache vale para sempre.
    event.respondWith(cacheDepoisRede(request, APP));
  } else if (url.pathname.startsWith('/vademecum/')) {
    event.respondWith(atualizaEmSegundoPlano(request, DADOS));
  } else {
    event.respondWith(atualizaEmSegundoPlano(request, APP));
  }
});
