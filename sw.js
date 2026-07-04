const SHELL_CACHE = 'shell-v3';
const DATA_CACHE = 'data-v2';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-maskable.svg',
  'js/app.js', 'js/dates.js', 'js/srs.js', 'js/diff.js', 'js/pack.js',
  'js/store.js', 'js/data.js', 'js/speech.js', 'js/icons.js',
  'js/plan.js', 'js/prompt.js', 'js/quiz.js', 'js/profile-options.js',
  'js/views/today.js', 'js/views/vocab.js', 'js/views/practice.js',
  'js/views/review.js', 'js/views/progress.js', 'js/views/listening.js',
  'js/views/settings.js', 'js/views/onboarding.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => ![SHELL_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.includes('/data/')) {
    // data: network-first, cache lại để offline vẫn học được gói đã mở
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request)),
    );
  } else {
    // shell: cache-first
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
