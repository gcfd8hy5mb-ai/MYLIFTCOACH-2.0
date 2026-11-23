'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {productionUrl,rollbackCommit}=require('./package.cjs');
const dir=process.env.MLC2_REPLACEMENT_PACKAGE;
if(!dir)throw Error('Set MLC2_REPLACEMENT_PACKAGE to the generated package directory');
const read=(tree,file)=>fs.readFileSync(path.join(dir,tree,file),'utf8');
test('generated root package keeps the production auth project and does not publish a second app',()=>{
 const html=read('replacement','index.html');
 assert.match(html,/connect-src https:\/\/kirlpjflaoriiusfamsk\.supabase\.co/);
 assert.match(html,/href=".\/manifest\.json\?v=2"/);
 assert.match(read('replacement','offline-shell.js'),/register\('\.\/sw\.js'/);
 assert.match(read('replacement','app.js'),/const BACKEND='https:\/\/kirlpjflaoriiusfamsk\.supabase\.co'/);
 for(const file of ['myliftcoach2','review','tests','app.webmanifest','offline-worker.js']){
  assert.equal(fs.existsSync(path.join(dir,'replacement',file)),false);
 }
 const staged=JSON.parse(read('replacement','manifest.json'));
 const legacy=JSON.parse(read('rollback','manifest.json'));
 for(const key of ['id','scope','start_url'])assert.equal(new URL(staged[key],productionUrl).href,new URL(legacy[key],productionUrl).href);
 assert.equal(staged.display,'standalone');
});
test('production worker caches the root shell and the old installed launch query reopens offline',async()=>{
 const listener={},cached=new Map();
 const worker=read('replacement','sw.js'),html=read('replacement','index.html');
 const cache={addAll:async requests=>{
  for(const request of requests){
   const url=new URL(request.url);
   assert.ok(url.href.startsWith(productionUrl));
   const asset=path.join(dir,'replacement',url.pathname.slice('/workout-tracker/'.length));
   assert.ok(fs.statSync(asset).isFile(),asset);
   cached.set(request.url,fs.readFileSync(asset));
  }
 },put:async(key,response)=>cached.set(key,await response.text()),match:async key=>cached.get(key.url||key)};
 let online=true;
 const context={URL,Response,Request,
  caches:{open:async()=>cache,keys:async()=>['unrelated-site-cache','myliftcoach-home-v23-goal-program'],delete:async()=>{throw Error('unrelated cache must remain')}},
  self:{registration:{scope:productionUrl},addEventListener:(kind,callback)=>listener[kind]=callback},
  fetch:async()=>{if(!online)throw Error('offline');return new Response(html)}};
 assert.throws(()=>vm.runInNewContext(worker,{...context,self:{registration:{scope:'https://gcfd8hy5mb-ai.github.io/'}}}),/Unexpected production worker scope/);
 vm.runInNewContext(worker,context);
 let task;
 listener.install({waitUntil:p=>task=p});await task;
 listener.activate({waitUntil:p=>task=p});await task;
 online=false;
 let result;
 const intercept=(url,method='GET')=>{
  result=undefined;
  listener.fetch({request:{url,method,mode:'navigate'},respondWith:p=>result=p});
  return result;
 };
 assert.equal(await intercept(productionUrl+'?app=myliftcoach'),html);
 assert.equal(intercept('https://gcfd8hy5mb-ai.github.io/other-project/'),undefined);
 assert.equal(intercept(productionUrl,'POST'),undefined);
 assert.ok(cached.has(productionUrl+'manifest.json?v=2'));
});
test('exact archive validates and safe rollback only replaces the unsafe worker',()=>{
 const original=JSON.parse(fs.readFileSync(path.join(dir,'CHECKSUMS.json'),'utf8'));
 assert.equal(original.originalCommit,rollbackCommit);
 const zip=path.join(dir,original.originalArchive);
 execFileSync('unzip',['-tq',zip]);
 for(const file of ['index.html','manifest.json','persistence/account-sync.js','cloud-backup.js']){
  assert.equal(read('rollback',file),execFileSync('unzip',['-p',zip,file],{encoding:'utf8'}));
 }
 const fresh=read('rollback','sw.js');
 assert.doesNotThrow(()=>new vm.Script(fresh));
 assert.doesNotMatch(fresh,/skipWaiting|clients.claim|client.navigate|caches.delete/);
 assert.match(fresh,/self.registration.scope/);
});
test('safe rollback worker reopens the installed query offline without reading another app cache',async()=>{
 const cached=new Map(),listeners={};
 const cache={addAll:async files=>{for(const key of files)cached.set(new URL(key.url,productionUrl).href,'original');},
  add:async()=>{},match:async key=>cached.get(key.url||key)};
 vm.runInNewContext(read('rollback','sw.js'),{
  URL,Request:class{constructor(url){this.url=url}},
  caches:{open:async name=>{assert.equal(name,'myliftcoach-home-v23-goal-program:scoped-rollback');return cache}},
  self:{registration:{scope:productionUrl},addEventListener:(kind,callback)=>listeners[kind]=callback},
  fetch:async()=>{throw Error('offline')},
 });
 let install;
 listeners.install({waitUntil:task=>install=task});await install;
 let response;
 listeners.fetch({request:{url:productionUrl+'?app=myliftcoach',method:'GET',mode:'navigate'},respondWith:p=>response=p});
 assert.equal(await response,'original');
});
