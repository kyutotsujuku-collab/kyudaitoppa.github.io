/* 九大突破塾 学習ページ：オフライン用 Service Worker
   ・ページ本体（HTML）は「まず通信、だめなら保存分」＝更新はすぐ反映
   ・画像などは「保存分をすぐ表示しつつ裏で更新」
   ・保存するのは実際に開いたものだけ */
const CACHE = 'kts-v1';
self.addEventListener('install', e => {
  // 入口ページ（このフォルダの index）だけ先に保存しておく
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request('./', { cache: 'no-cache' }))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('kts-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
async function put(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const c = await caches.open(CACHE);
    await c.put(req, res.clone());
  }
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => put(req, r));
      if (!cached) return net;
      e.waitUntil(net.catch(() => {}));
      const timeout = new Promise(r => setTimeout(() => r(null), 4000));
      try { return (await Promise.race([net, timeout])) || cached; }
      catch (_) { return cached; }
    })());
  } else {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      const net = fetch(req).then(r => put(req, r));
      if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
      return net;
    })());
  }
});
