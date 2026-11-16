'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {build}=require('../imports/build-exercise-catalog.cjs');
test('original exercise library extensions safely extract as pure validated metadata',()=>{
 const {entries,counts}=build();
 assert.equal(counts.length,5);
 assert.ok(entries.length>=250&&entries.length<=400);
 assert.equal(new Set(entries.map(x=>x.id)).size,entries.length);
 assert.ok(entries.some(x=>x.id==='incline-machine-chest-press'));
 assert.ok(entries.some(x=>x.id==='barbell-bench-press'));
 assert.ok(entries.some(x=>x.id==='plate-loaded-incline-press'));
 const pendulum=entries.find(x=>x.id==='pendulum-squat-wide');
 assert.equal(pendulum.equipment,'Machine');
 assert.match(pendulum.how,/wider stance/);
 assert.ok(entries.every(x=>x.id&&x.name&&x.muscle&&x.how));
});
test('legacy DOM installers and styles are not loaded into 2.0 approved design',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.equal(html.includes('imports/source'),false);
 assert.equal(html.includes('liftova-library.js'),false);
});

test('generated original library includes base and five expansions with stable unique IDs',()=>{
 const vm=require('node:vm');
 const source=fs.readFileSync(path.join(__dirname,'../imports/original-exercises.generated.js'),'utf8');
 const context=vm.createContext({});
 vm.runInContext(source,context,{timeout:2500});
 const catalog=context.MLC2ExerciseCatalog;
 assert.equal(catalog.items.length,341);
 assert.equal(catalog.counts.length,6);
 assert.equal(catalog.counts[0].sourceRows,60);
 assert.equal(new Set(catalog.items.map(x=>x.id)).size,341);
 for(const id of ['machine-chest-press','pec-deck','incline-machine-chest-press','barbell-bench-press','pendulum-squat-wide','plate-loaded-incline-press']){
  assert.ok(catalog.items.some(x=>x.id===id),'Missing original exercise '+id);
 }
 assert.equal(catalog.items.find(x=>x.id==='pendulum-squat-wide').equipment,'Machine');
 assert.ok(catalog.items.every(e=>e.name&&e.group&&e.equipment&&e.how));
 assert.doesNotMatch(source,/localStorage\.|document\.|fetch\(/);
});
test('2.0 starts catalog before app without loading legacy source and preserves original save namespace',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 assert.ok(html.includes('imports/original-exercises.generated.js'));
 assert.ok(html.indexOf('imports/original-exercises.generated.js')<html.indexOf('src="./app.js'));
 assert.ok(app.includes('window.MLC2ExerciseCatalog?.items'));
 assert.ok(app.includes("const exercises=[...starterExercises]"));
 for(const old of ['workoutHistoryV52','customWorkoutsV5','dailyTrackingV1']){
  assert.equal(app.includes("localStorage.setItem('"+old+"'"),false);
 }
});

test('original four-day preset program matches original source exactly and all IDs exist',()=>{
 const vm=require('node:vm');
 const catalogSource=fs.readFileSync(path.join(__dirname,'../imports/original-exercises.generated.js'),'utf8');
 const programSource=fs.readFileSync(path.join(__dirname,'../imports/original-programs.js'),'utf8');
 const ctx=vm.createContext({});
 vm.runInContext(catalogSource,ctx,{timeout:2500});
 vm.runInContext(programSource,ctx,{timeout:1500});
 const ids=new Set(ctx.MLC2ExerciseCatalog.items.map(x=>x.id));
 const plans=JSON.parse(JSON.stringify(ctx.MLC2OriginalPrograms.plans));
 assert.deepEqual(plans.map(x=>x.id),['original-day1','original-day2','original-day3','original-day4']);
 assert.deepEqual(plans.map(x=>x.title),[
  'Day 1 — Chest & Triceps','Day 2 — Back & Biceps','Day 3 — Legs','Day 4 — Shoulders & Arms'
 ]);
 assert.deepEqual(plans.map(x=>x.ids),[
  ['machine-chest-press','pec-deck','triceps-pushdown'],
  ['lat-pulldown','seated-row','preacher-curl'],
  ['leg-press','leg-extension','seated-leg-curl','calf-raise'],
  ['shoulder-press','lateral-raise','biceps-curl','triceps-extension']
 ]);
 assert.ok(plans.every(x=>x.ids.every(id=>ids.has(id))));
 assert.doesNotMatch(programSource,/localStorage\.|document\.|fetch\(/);
});
test('original program catalog loads before rebuilt app and without old storage code',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 assert.ok(html.indexOf('src="./imports/original-programs.js')>=0);
 assert.ok(html.indexOf('src="./imports/original-programs.js')<html.indexOf('src="./app.js'));
 assert.ok(app.includes('const allPlans=()=>[...plans,...originalPrograms,...customPlans]'));
 assert.ok(app.includes('Original 4-day split'));
});
