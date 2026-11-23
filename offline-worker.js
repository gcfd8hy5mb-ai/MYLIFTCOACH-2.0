'use strict';

const scope = self.registration.scope;
const shell = new URL('./index.html', scope).href;
const prefix = 'myliftcoach2-shell:' + scope + ':';
const cacheName = prefix + '43';
const artwork = [
 './assets/approved-vertical-marble-sharp.webp?v=11',
 './assets/hero-dumbbells-photo.jpg?v=7',
 './assets/image-coming-approved.webp'
];

self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const response = await fetch(shell, {cache:'reload'});
  if (!response.ok || response.redirected) throw Error('App shell unavailable');
  const html = await response.clone().text();
  // A worker waiting on an edge cache must not cache a mixed release.
  if (!html.includes('src="./app.js?v=43"')) throw Error('App shell version mismatch');
  const references = [...html.matchAll(/(?:src|href)="(\.\/[\w./-]+\.(?:js|css|webp|jpg|png|svg)(?:\?v=\d+)?)"/g)]
   .map(match => match[1]);
  const assets = [...new Set([...references, ...artwork].map(path => new URL(path, scope).href))];
  if (assets.some(url => !url.startsWith(scope))) throw Error('Out-of-scope app asset');
  const cache = await caches.open(cacheName);
  await cache.addAll(assets.map(url => new Request(url, {cache:'reload'})));
  await cache.put(shell, response);
 })());
});

self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)));
 })());
});

self.addEventListener('fetch', event => {
 const request = event.request;
 if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
 const url = new URL(request.url);
 if (request.mode === 'navigate') {
  if (url.href !== scope && url.href !== shell) return;
  event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match(shell)));
 } else if (['script','style','image'].includes(request.destination)) {
  event.respondWith((async () => (await (await caches.open(cacheName)).match(request)) || fetch(request))());
 }
});
