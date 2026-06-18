const CACHE_NAME = 'stock-optimizer-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './pwa-192x192.png',
  './pwa-512x512.png'
];

// 安裝 Service Worker 並快取基本靜態資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and content');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 啟用 Service Worker 並清理舊快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截 Fetch 請求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 對於外部 API 行情請求 (TWSE, Yahoo Finance, CORS 代理)，一律採用 Network Only/Network First，不進行長時間快取，確保報價最新
  if (
    url.hostname.includes('mis.twse.com.tw') ||
    url.hostname.includes('yahoo.com') ||
    url.hostname.includes('corsproxy.io') ||
    url.hostname.includes('allorigins.win')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // 如果網路斷線，返回離線錯誤
        return new Response(
          JSON.stringify({ error: true, message: '網路已中斷，無法取得即時行情。' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 2. 對於其他靜態資源，採用 Cache First, Network Fallback 策略
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // 確保響應有效才快取
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // 只快取 http/https 協議的資源
          if (event.request.url.startsWith('http')) {
            cache.put(event.request, responseToCache);
          }
        });

        return networkResponse;
      });
    }).catch(() => {
      // 離線回退
      if (event.request.headers.get('accept').includes('text/html')) {
        return caches.match('./index.html');
      }
    })
  );
});
