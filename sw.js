// Golden Vision — service worker: guarda a interface no aparelho para abrir rápido e sem internet.
// Os dados NÃO passam por aqui: eles vão direto para a planilha (servidor Google).
const VERSAO = 'gv-v1';
const BASE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  const externo = url.origin !== location.origin;
  if (externo) {
    // bibliotecas e fontes: usa a cópia guardada, busca na rede só se não tiver
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
      return res;
    })));
    return;
  }
  // o próprio app: tenta a versão mais nova; sem internet, abre a guardada
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
