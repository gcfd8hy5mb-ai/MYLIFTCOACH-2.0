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
 let online=true,status=200;
 vm.runInNewContext(source,{
  URL,Request,Response,caches:{open:async()=>cache,keys:async()=>['unrelated-cache','myliftcoach2-shell:'+scope+':46','myliftcoach2-shell:'+scope+':47'],delete:async()=>true},
  self:{registration:{scope},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(event,fn)=>{listeners[event]=fn}},
  fetch:async()=>{if(!online)throw Error('offline');return new Response(html,{status})}
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
 assert.equal(await fetchThrough(scope+'?launch=home','navigate','document'),html);
 online=true;status=503;
 assert.equal(await fetchThrough(scope,'navigate','document'),html);
 assert.equal(await fetchThrough(scope+'app.js?v=48','cors','script'),'app.js');
 assert.equal(await fetchThrough(scope+'app.webmanifest?v=1','cors','manifest'),'app.webmanifest');
 assert.equal(fetchThrough(scope+'private','cors','','POST'),undefined);
 assert.equal(fetchThrough('https://cloud.example/rest','cors',''),undefined);
 assert.equal(fetchThrough(scope+'review/workout-history-check.html','navigate','document'),undefined);
});


test('worker stages the complete shell without taking control of an open app, and leave private data alone',async()=>{
 const listeners={},sequence=[],scope='https://test.example/MYLIFTCOACH-2.0/';
 const cache={addAll:async()=>sequence.push('assets'),put:async()=>sequence.push('shell'),match:async()=>null};
 const keys=['unrelated-cache','myliftcoach2-shell:'+scope+':46','myliftcoach2-shell:'+scope+':47'];
 const context={
  URL,Request,Response,
  caches:{open:async()=>cache,keys:async()=>keys,delete:async key=>{sequence.push('delete:'+key);return true}},
  self:{registration:{scope},addEventListener:(name,cb)=>listeners[name]=cb,
   skipWaiting:async()=>sequence.push('skipWaiting'),clients:{claim:async()=>sequence.push('claim')}},
  fetch:async()=>new Response(html)
 };
 vm.runInNewContext(source,context);
 let work;listeners.install({waitUntil:p=>work=p});await work;
 assert.deepEqual(sequence,['assets','shell']);
 listeners.activate({waitUntil:p=>work=p});await work;
 assert.ok(!sequence.includes('claim'));
 assert.ok(sequence.includes('delete:myliftcoach2-shell:'+scope+':46'));
 assert.ok(!sequence.includes('delete:unrelated-cache'));
 const privateRequest={method:'POST',url:scope+'rest/v1/workouts',destination:'',mode:'cors'};
 let intercepted=false;
 listeners.fetch({request:privateRequest,respondWith:()=>intercepted=true});
 assert.equal(intercepted,false);
});

test('update coordinator checks on foregrounding and never automatically reloads the page',async()=>{
 const coordinator=fs.readFileSync('offline-shell.js','utf8');
 assert.match(html,/offline-shell\.js\?v=4/);
 const events={},serviceEvents={};
 let updates=0,reloads=0,clock=0;
 const registration={update:async()=>{updates++}};
 const navigator={serviceWorker:{
  controller:{},addEventListener:(name,cb)=>serviceEvents[name]=cb,
  register:async()=>registration
 }};
 const document={hidden:false,addEventListener:(name,cb)=>events['document:'+name]=cb};
 const window={addEventListener:(name,cb)=>events['window:'+name]=cb};
 vm.runInNewContext(coordinator,{navigator,document,window,Date:{now:()=>clock},
  location:{reload:()=>reloads++}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(updates,1);
 serviceEvents.controllerchange?.();
 clock=16000;
 document.hidden=true;events['document:visibilitychange']();
 assert.equal(updates,1);
 document.hidden=false;events['document:visibilitychange']();
 assert.equal(updates,2);
 events['window:pageshow']();
 assert.equal(updates,2);
 clock=32000;events['window:pageshow']();
 assert.equal(updates,3);
 assert.equal(reloads,0);
});
