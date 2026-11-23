'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('offline-worker.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const scope='https://test.example/MYLIFTCOACH-2.0/';

test('public app assets can boot offline and account traffic bypasses the worker',async()=>{
 const listeners={},cached=new Map(),cache={
  addAll:async requests=>{
   for(const request of requests){
    const path=new URL(request.url).pathname.slice(new URL(scope).pathname.length);
    assert.ok(fs.existsSync(path),path);
    cached.set(request.url,path);
   }
  },
  put:async (url,response)=>cached.set(url,await response.text()),
  match:async request=>cached.get(request.url||request)
 };
 let online=true;
 vm.runInNewContext(source,{
  URL,Request,Response,caches:{open:async()=>cache},
  self:{registration:{scope},addEventListener:(event,fn)=>{listeners[event]=fn}},
  fetch:async()=>{if(!online)throw Error('offline');return new Response(html)}
 });
 let task;
 listeners.install({waitUntil:promise=>{task=promise}});
 await task;
 online=false;
 function fetchThrough(url,mode,destination,method='GET'){
  let response;
  listeners.fetch({request:{url,mode,destination,method},respondWith:promise=>{response=promise}});
  return response;
 }
 assert.equal(await fetchThrough(scope,'navigate','document'),html);
 assert.equal(await fetchThrough(scope+'app.js?v=42','cors','script'),'app.js');
 assert.equal(fetchThrough(scope+'private','cors','','POST'),undefined);
 assert.equal(fetchThrough('https://cloud.example/rest','cors',''),undefined);
 assert.equal(fetchThrough(scope+'review/workout-history-check.html','navigate','document'),undefined);
});
