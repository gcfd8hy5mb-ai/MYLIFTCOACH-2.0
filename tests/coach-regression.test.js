/* Run: node tests/coach-regression.test.js
 * Pure deterministic Coach checks, no network, accounts, or DOM.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const browser={window:{}};
browser.window.window=browser.window;
vm.createContext(browser);
for(const file of ['exercise-catalog-344.js','coach-attributes.js','progress-migration.js','coach-migration.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),browser,{filename:file});
}
const api=browser.window.MLC2Coach,catalog=browser.window.MLC2_EXERCISE_CATALOG;
assert.equal(catalog.length,344);
const sets=(date,rows,id='cable-fly')=>({
 id:'demo-'+date,created:date,planId:'custom-1',title:'Upper',
 sets:rows.map(([weight,reps])=>({exerciseId:id,weight,reps}))
});
const older=sets('2026-11-10T10:00:00Z',[[25,7],[25,7]]);
const newest=sets('2026-11-18T10:00:00Z',[[25,10],[25,10]]);
const top=api.suggestion('cable-fly',[older,newest],catalog);
assert.equal(top.action,'increase','date ordering must select latest qualifying workout');
assert.equal(top.weight,27.5,'isolation increments use 2.5 lb');
assert.equal(api.suggestion('cable-fly',[newest],catalog).status,'insufficient');
const lightWarmups=[sets('2026-11-09T10:00:00Z',[[10,12],[25,10],[25,10]]),
 sets('2026-11-18T10:00:00Z',[[10,12],[25,10],[25,10]])];
assert.equal(api.suggestion('cable-fly',lightWarmups,catalog).weight,27.5);
const failures=[sets('2026-11-10T10:00:00Z',[[25,5],[25,5]]),
 sets('2026-11-18T10:00:00Z',[[25,5],[25,5]])];
assert.equal(api.suggestion('cable-fly',failures,catalog).action,'reduce');
assert.equal(api.suggestion('cable-fly',failures,catalog).weight,22.5);
const plan=api.nextWorkoutSummary({id:'custom-1',title:'Upper',ids:['cable-fly','pec-deck']},
 [older,newest],catalog);
assert.equal(plan.planId,'custom-1');
assert.equal(plan.exercises.length,2);
assert.equal(plan.completedForPlan,2);
assert.equal(plan.exercises[0].status,'ready');
assert.ok(api.substitutions('cable-fly',catalog).some(x=>x.id==='pec-deck'));
assert.equal(api.substitutions('unrecognized-movement',catalog).length,0);
vm.runInContext(fs.readFileSync(path.join(root,'coach-readiness.js'),'utf8'),browser,{filename:'coach-readiness.js'});
const readiness=browser.window.MLC2CoachReadiness;
const goalEntries=new Map();
const goalStorage={getItem:key=>goalEntries.has(key)?goalEntries.get(key):null,
 setItem:(key,value)=>goalEntries.set(key,value)};
assert.equal(readiness.weeklyGoal(goalStorage),4,'default training target');
assert.equal(readiness.saveWeeklyGoal(5,goalStorage),true);
assert.equal(readiness.weeklyGoal(goalStorage),5);
assert.equal(readiness.saveWeeklyGoal(9,goalStorage),false);
assert.equal(readiness.weekSummary([newest],new Date('2026-11-18T12:00:00Z'),5).target,5);
console.log('MYLIFTCOACH Coach regression: PASS');
