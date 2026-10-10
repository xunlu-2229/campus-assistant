/* service-worker.js —— PWA 离线缓存
 * 缓存策略：
 *  - 应用外壳（HTML/CSS/JS/图标）：stale-while-revalidate，离线可用
 *  - CDN 资源（Chart.js/XLSX）：优先缓存，失败走网络
 *  - 其他请求：优先网络，失败回退缓存
 */
var CACHE_VERSION = 'gcsa-v4.6-20261010-install';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/chart.js',
  './js/storage.js',
  './js/theme.js',
  './js/schedule.js',
  './js/campus.js',
  './js/tools.js',
  './js/labdata.js',
  './js/calc/unit.js',
  './js/calc/resistor.js',
  './js/calc/rcrl.js',
  './js/calc/resonance.js',
  './js/calc/signal.js',
  './js/calc/code.js',
  './js/calc/components.js',
  './js/quick.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];
var CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// 安装：预缓存应用外壳 + CDN
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // 应用外壳必须成功缓存；CDN 失败不阻塞安装
      var shellPromises = APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () { console.warn('[SW] 缓存失败:', url); });
      });
      var cdnPromises = CDN_URLS.map(function (url) {
        return cache.add(url).catch(function () { console.warn('[SW] CDN缓存失败:', url); });
      });
      return Promise.all(shellPromises.concat(cdnPromises));
    }).then(function () {
      return self.skipWaiting(); // 立即激活新版本
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_VERSION; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// 请求拦截
self.addEventListener('fetch', function (e) {
  var req = e.request;
  // 只处理 GET
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // 同源资源：stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE_VERSION).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var fetchPromise = fetch(req).then(function (res) {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(function () { return cached; });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // CDN 资源：缓存优先（首次安装时已缓存，离线也能用）
  if (CDN_URLS.indexOf(req.url) >= 0) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          if (res && res.status === 200) {
            caches.open(CACHE_VERSION).then(function (c) { c.put(req, res.clone()); });
          }
          return res;
        }).catch(function () { return cached; });
      })
    );
    return;
  }

  // 其他跨域请求：网络优先，失败回退缓存
  e.respondWith(
    fetch(req).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || new Response('离线状态，该资源不可用', { status: 503 });
      });
    })
  );
});
