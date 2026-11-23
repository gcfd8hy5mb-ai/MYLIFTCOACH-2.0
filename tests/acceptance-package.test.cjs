'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {stage}=require('../review/pages/stage.cjs');
const source=path.resolve(__dirname,'..');
const production='https://kirlpjflaoriiusfamsk.supabase.co';
function fixture(t){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mlc2-acceptance-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 return path.join(temp,'site');
}
test('offline acceptance package excludes production connections, review data and tools',t=>{
 const dir=fixture(t);
 assert.equal(stage(source,dir).mode,'offline');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(app,/kirlpjflaoriiusfamsk\.supabase\.co/);
 assert.doesNotMatch(app,/sb_publishable_/);
 assert.match(fs.readFileSync(path.join(dir,'offline-worker.js'),'utf8'),/acceptance-[a-f0-9]{12}/);
 assert.equal(fs.existsSync(path.join(dir,'assets','approved-vertical-marble-sharp.webp')),true);
 for(const name of ['tests','review','package.json','.github','.git','preview']){
  assert.equal(fs.existsSync(path.join(dir,name)),false,name);
 }
 const originals=JSON.parse(fs.readFileSync(path.join(source,'app.webmanifest'),'utf8'));
 const staged=JSON.parse(fs.readFileSync(path.join(dir,'app.webmanifest'),'utf8'));
 assert.deepEqual(staged,originals);
});
test('acceptance packaging fails closed when production or incomplete configuration is supplied',t=>{
 const dir=fixture(t);
 assert.throws(()=>stage(source,dir,{backend:production,key:'sb_publishable_fixture'}),/independent/);
 assert.throws(()=>stage(source,dir,{backend:'https://abcdefghijklmnopqrst.supabase.co'}),/both/);
 assert.throws(()=>stage(source,dir,{backend:'https://abcdefghijklmnopqrst.supabase.co',key:'sb_secret_fixture'}),/publishable/);
 assert.equal(fs.existsSync(dir),false);
});
test('isolated cloud build permits only the configured test project',t=>{
 const dir=fixture(t);
 const backend='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_fixture';
 assert.equal(stage(source,dir,{backend,key}).mode,'isolated-test');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert.ok(html.includes('connect-src '+backend+'"'));
 const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
 assert.ok(app.includes(backend));
 assert.ok(!app.includes(production));
});
test('the staged service worker can cache and reopen the exact isolated root shell',async t=>{
 const dir=fixture(t);
 stage(source,dir);
 const vm=require('node:vm'),listeners={},entries=new Map();
 const origin='https://example-acceptance.github.io/';
 const worker=fs.readFileSync(path.join(dir,'offline-worker.js'),'utf8');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const cache={
  addAll:async requests=>{
   for(const request of requests){
    const file=path.join(dir,new URL(request.url).pathname);
    assert.ok(fs.statSync(file).isFile(),file);
    entries.set(request.url,fs.readFileSync(file));
   }
  },
  put:async (key,response)=>entries.set(key,await response.text()),
  match:async key=>entries.get(key.url||key)
 };
 let online=true;
 vm.runInNewContext(worker,{URL,Request,Response,caches:{open:async()=>cache},
  self:{registration:{scope:origin},addEventListener:(event,handler)=>listeners[event]=handler},
  fetch:async()=>{if(!online)throw Error('offline');return new Response(html)}});
 let installed;
 listeners.install({waitUntil:promise=>installed=promise});
 await installed;
 online=false;
 let result;
 listeners.fetch({request:{method:'GET',url:origin,mode:'navigate'},respondWith:promise=>result=promise});
 assert.match(await result,/connect-src 'none'/);
 assert.ok(entries.has(origin+'assets/approved-vertical-marble-sharp.webp?v=11'));
});
