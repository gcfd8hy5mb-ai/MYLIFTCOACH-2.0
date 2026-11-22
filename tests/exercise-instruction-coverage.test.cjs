'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');
function source(){const window={};const ctx=vm.createContext({window,console});for(const file of ['exercise-catalog-344.js','exercise-instruction-coverage.js'])vm.runInContext(read(file),ctx,{filename:file});return window.MLC2_EXERCISE_CATALOG}
test('all 344 exercises provide how-to instructions, equipment, tips and mistakes',()=>{
 const catalog=source();
 assert.equal(catalog.length,344);
 for(const e of catalog){assert.ok(e.how?.trim(),e.id+' how');assert.ok(e.equipment?.trim(),e.id+' equipment');assert.ok(e.tips?.length,e.id+' tips');assert.ok(e.mistakes?.length,e.id+' mistakes')}
});
test('legacy exercise instructions use full canonical text without changing IDs or imagery',()=>{
 const catalog=source();
 const byId=new Map(catalog.map(e=>[e.id,e]));
 for(const [legacyId,canonicalId] of Object.entries({'chest-press':'machine-chest-press','triceps-push':'triceps-pushdown','leg-curl':'seated-leg-curl'})){
  const legacy=byId.get(legacyId),master=byId.get(canonicalId);
  assert.equal(legacy.how,master.how);
  assert.equal(legacy.equipment,master.equipment);
  assert.deepEqual(Array.from(legacy.tips),Array.from(master.tips));
  assert.deepEqual(Array.from(legacy.mistakes),Array.from(master.mistakes));
  assert.equal(legacy.id,legacyId);
 }
});
test('instructions load before app and guide and Start Workout retains dark teal style',()=>{
 const html=read('index.html');
 const load=html.indexOf('exercise-instruction-coverage.js');
 assert.ok(load>html.indexOf('exercise-catalog-344.js'));
 assert.ok(load<html.indexOf('app.js?v=15'));
 const css=read('workouts-tabs-n.css');
 assert.ok(css.includes('#workouts .workouts-n-today{')&&css.includes('background:#04252d;color:#f7e9d0;'));
 assert.ok(css.includes('#workouts .workouts-n-actions .button-primary{background:#04252d!important;background-image:none!important;'));
 assert.doesNotMatch(css,/#workouts \.workouts-n-actions \.button-primary\{background:linear-gradient\(#ffebba,#d7ae70\)/);
});

test('all exercise detail guides use the same instruction, muscles, equipment, tips and mistakes sections',()=>{
 const guide=read('active-exercise-guide.js');
 assert.ok(guide.includes("addHowTo(panel,e)"));
 assert.ok(guide.includes("addParagraph(panel,'Muscles Worked',"));
 assert.ok(guide.includes("addParagraph(panel,'Equipment',"));
 assert.ok(guide.includes("addList(panel,'Technique Tips',"));
 assert.ok(guide.includes("addList(panel,'Common Mistakes',"));
 assert.ok(guide.includes('const sentences=source.match('));
 assert.match(guide,/never invent missing steps/i);
});

test('duplicate-name exercises share the richer existing instructions while retaining their IDs',()=>{
 const catalog=source();
 const groups=new Map();
 for(const e of catalog){const key=e.name.trim().toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}
 let normalizedGroups=0;
 for(const items of groups.values()){
  if(items.length<2)continue;
  normalizedGroups++;
  for(const e of items.slice(1)){
   assert.equal(e.how,items[0].how);
   assert.equal(e.equipment,items[0].equipment);
   assert.deepEqual(Array.from(e.tips),Array.from(items[0].tips));
   assert.deepEqual(Array.from(e.mistakes),Array.from(items[0].mistakes));
  }
 }
 assert.equal(normalizedGroups,19);
});
