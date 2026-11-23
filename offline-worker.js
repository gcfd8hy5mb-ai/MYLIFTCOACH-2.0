'use strict';

const scope = self.registration.scope;
const shell = new URL('./index.html', scope).href;
const prefix = 'myliftcoach2-shell:' + scope + ':';
const cacheName = prefix + '69';
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
  if (!html.includes('src="./app.js?v=49"') || !html.includes('src="./offline-shell.js?v=4"') || !html.includes('src="./sync/aux-data.js?v=5"')) throw Error('App shell version mismatch');
  const references = [...html.matchAll(/(?:src|href)="(\.\/[\w./-]+\.(?:js|css|webp|jpg|png|svg|webmanifest)(?:\?v=\d+)?)"/g)]
   .map(match => match[1]);
  const assets = [...new Set([...references, ...artwork].map(path => new URL(path, scope).href))];
  if (assets.some(url => !url.startsWith(scope))) throw Error('Out-of-scope app asset');
  const cache = await caches.open(cacheName);
  await cache.addAll(assets.map(url => new Request(url, {cache:'reload'})));
  await cache.put(shell, response);
  // Let existing app windows close naturally before replacing their worker.
 })());
});

self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)));
 })());
});

async function networkWithFallback(request, cacheKey){
 try{
  const response=await fetch(request,{cache:'no-store'});
  if(response.status<500)return response;
  return (await (await caches.open(cacheName)).match(cacheKey))||response;
 }catch(error){
  const cached=await (await caches.open(cacheName)).match(cacheKey);
  if(cached)return cached;
  throw error;
 }
}

self.addEventListener('fetch', event => {
 const request = event.request;
 if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
 const url = new URL(request.url);
 if (request.mode === 'navigate') {
  if (url.pathname !== new URL(scope).pathname && url.pathname !== new URL(shell).pathname) return;
  event.respondWith(networkWithFallback(request,shell));
 } else if (['script','style','image','manifest'].includes(request.destination)) {
  // Prefer current versioned JS/CSS on connection, retain offline copies.
  // Images remain cache-first; no account API requests are intercepted.
  if (['script','style','manifest'].includes(request.destination)) {
   event.respondWith(networkWithFallback(request,request));
  } else {
   event.respondWith((async () => (await (await caches.open(cacheName)).match(request)) || fetch(request))());
  }
 }
});
