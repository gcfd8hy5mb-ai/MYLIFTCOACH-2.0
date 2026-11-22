'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Coverage=require('../coach-catalog-coverage.js');
const window={};
const context=vm.createContext({window,console});
for(const file of ['exercise-catalog-344.js','coach-attributes.js','progress-migration.js','coach-migration.js']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
}
window.MLC2CoachCoverage=Coverage;
const library=window.MLC2_EXERCISE_CATALOG,reviewed=window.MLC2_COACH_ATTRIBUTES;
const Coach=window.MLC2Coach;
const exercise=id=>library.find(x=>x.id===id);
const session=(id,date,reps=10,weight=50)=>({
 id:'test-'+date,created:date,planId:'custom-test',title:'Test workout',
 sets:[{exerciseId:id,reps,weight},{exerciseId:id,reps,weight}]
});
test('all 344 exercises receive a safe classification and original 60 reviewed records stay immutable',()=>{
 assert.equal(library.length,344);
 const before=JSON.stringify(reviewed);
 const report=Coverage.report(library,reviewed);
 assert.equal(report.total,344);
 assert.equal(report.reviewed,60);
 assert.equal(report.classified,344);
 assert.equal(report.cardio,36);
 assert.equal(report.substitutionEligible,308);
 assert.equal(report.unclassified.length,0);
 assert.equal(JSON.stringify(reviewed),before);
});
test('Cardio excludes unsuitable strength recommendations even if someone logs weighted sets',()=>{
 const cardio=exercise('treadmill');
 assert.equal(Coverage.classify(cardio,reviewed).strength,false);
 assert.equal(Coach.suggestion(cardio.id,[session(cardio.id,'2026-11-01T00:00:00Z'),
 session(cardio.id,'2026-11-08T00:00:00Z')],library).status,'unsupported');
 assert.equal(Coach.substitutions(cardio.id,library).length,0);
});
test('unknown exercise cannot invent progression or substitutions',()=>{
 assert.equal(Coach.suggestion('nonexistent',[session('nonexistent','2026-11-01T00:00:00Z')],library).status,'insufficient');
 assert.equal(Coach.substitutions('nonexistent',library).length,0);
});
test('new catalog cable chest fly suggests a chest fly, never a squat or cardio exercise',()=>{
 const options=Coach.substitutions('cable-chest-fly',library);
 assert.ok(options.length>0);
 assert.ok(options.some(e=>e.id==='dumbbell-chest-fly'));
 assert.ok(options.every(e=>exercise(e.id)?.group==='Chest'));
 assert.ok(options.every(e=>e.pattern==='Chest Fly'));
});
test('single-leg seated hamstring curl substitutes only same target and movement family',()=>{
 const options=Coach.substitutions('single-leg-seated-curl',library);
 assert.ok(options.some(e=>e.id==='single-leg-lying-curl'));
 assert.ok(options.every(e=>exercise(e.id)?.muscle==='Hamstrings'));
 assert.ok(options.every(e=>e.pattern==='Knee Flexion'));
});
test('progression waits for two completed sessions with two working sets each',()=>{
 const id='barbell-bench-press';
 const one=Coach.suggestion(id,[session(id,'2026-11-01T00:00:00Z')],library);
 assert.equal(one.status,'insufficient');
 const two=Coach.suggestion(id,[session(id,'2026-11-01T00:00:00Z'),session(id,'2026-11-08T00:00:00Z')],library);
 assert.equal(two.status,'ready');
 assert.equal(two.action,'increase');
 assert.equal(two.weight,55);
});
test('no logged workouts returns insufficient, never fabricated training progress',()=>{
 assert.equal(Coach.suggestion('cable-chest-fly',[],library).status,'insufficient');
});
test('Coach classifies all reviewed entries without erasing their original movement pattern',()=>{
 for(const e of library.filter(e=>reviewed[e.id])){
  const after=Coverage.classify(e,reviewed);
  assert.equal(after.pattern,reviewed[e.id].pattern);
  assert.equal(after.reviewed,true);
 }
});
