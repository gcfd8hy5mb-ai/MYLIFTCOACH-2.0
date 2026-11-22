'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function load(){
 const window={};
 const context=vm.createContext({window,console});
 for(const path of ['exercise-catalog-344.js','exercise-instruction-coverage.js','exercise-instruction-depth.js'])vm.runInContext(read(path),context,{filename:path});
 return window;
}
test('all 92 short descriptions now have detailed exercise-specific directions',()=>{
 const window=load();assert.equal(window.MLC2_EXERCISE_DEPTH_READY,true);
 const catalog=window.MLC2_EXERCISE_CATALOG;
 assert.equal(catalog.length,344);
 assert.equal(new Set(catalog.map(e=>e.id)).size,344);
 for(const e of catalog){
  assert.ok(e.how.trim().length>=70,e.id+' short instructions');
  assert.ok(e.tips?.length,e.id+' tips missing');
  assert.ok(e.mistakes?.length,e.id+' mistakes missing');
  assert.ok(e.equipment?.trim(),e.id+' equipment missing');
 }
 const depth=read('exercise-instruction-depth.js');
 assert.ok(depth.includes('revisions.length!==92'));
 assert.equal((depth.match(/\bsetup,move,finish,tip,mistake\b/g)||[]).length,1);
});
test('legacy and canonical duplicate-name exercises have identical instructions',()=>{
 const {MLC2_EXERCISE_CATALOG:catalog}=load();
 const groups=new Map();
 for(const e of catalog){
  const key=e.name.trim().toLowerCase();
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(e);
 }
 let duplicates=0;
 for(const group of groups.values()){
  if(group.length<2)continue;
  duplicates++;
  for(const e of group.slice(1)){
   assert.equal(e.how,group[0].how,e.id);
   assert.equal(e.equipment,group[0].equipment,e.id);
   assert.deepEqual(Array.from(e.tips),Array.from(group[0].tips),e.id);
   assert.deepEqual(Array.from(e.mistakes),Array.from(group[0].mistakes),e.id);
  }
 }
 assert.equal(duplicates,19);
});
test("detailed descriptions load before app and do not change image mapping files",()=>{
 const h=read('index.html');
 for(const f of ['exercise-catalog-344.js','exercise-instruction-coverage.js','exercise-instruction-depth.js','app.js?v=15','active-exercise-guide.js']){
  assert.ok(h.includes(f),f);
 }
 assert.ok(h.indexOf('exercise-instruction-coverage.js')<h.indexOf('exercise-instruction-depth.js'));
 assert.ok(h.indexOf('exercise-instruction-depth.js')<h.indexOf('app.js?v=15'));
 const code=read('exercise-instruction-depth.js');
 assert.ok(!/\b(localStorage|sessionStorage|indexedDB|fetch|supabase|setItem|removeItem)\b/.test(code));
});
