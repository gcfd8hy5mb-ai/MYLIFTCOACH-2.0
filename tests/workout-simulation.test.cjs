'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Sim=require('../workout-simulation.js');
const catalog=['Chest','Back','Legs','Arms','Shoulders','Core'].map((group,i)=>({id:'exercise-'+i,name:group+' movement',group}));
const plan={id:'custom-sample',title:'Sample Custom Workout',ids:catalog.slice(0,5).map(e=>e.id)};
const now=new Date('2026-11-22T14:00:00.000Z');
test('30- and 90-day simulated histories are deterministic, dated, complete and visibly marked',()=>{
 for(const days of [30,90]){
  const a=Sim.generate(catalog,plan,days,now);
  const b=Sim.generate(catalog,plan,days,now);
  assert.deepEqual(a,b);
  assert.ok(a.length>=days/3);
  assert.ok(a.every(s=>s.simulated===true&&s.id.startsWith('simulation-')));
  assert.ok(a.every(s=>s.sets.length>=9&&s.sets.every(t=>t.weight>0&&t.reps>=8&&t.reps<=11)));
  assert.ok(a.every(s=>Date.parse(s.created)<=now.getTime()&&Date.parse(s.created)>=now.getTime()-days*86400000));
  assert.ok(a.some(s=>s.planId===plan.id));
 }
});
test('Simulation is a separate memory-only view; clearing restores unchanged saved sessions',()=>{
 Sim.clear();
 const real=[{id:'real-1',created:'2026-11-21T12:00:00Z',sets:[{exerciseId:'exercise-1',weight:25,reps:10}]}];
 const original=JSON.stringify(real);
 assert.equal(Sim.view(real),real);
 Sim.start(catalog,plan,30,now);
 assert.ok(Sim.active());
 assert.ok(Sim.view(real).every(s=>s.simulated));
 assert.equal(JSON.stringify(real),original);
 Sim.clear();
 assert.equal(Sim.active(),false);
 assert.equal(Sim.view(real),real);
 assert.equal(JSON.stringify(real),original);
});
test('Simulation module never invokes account storage, sync or network and rejects invalid ranges',()=>{
 const source=fs.readFileSync('workout-simulation.js','utf8');
 assert.doesNotMatch(source,/\b(localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|supabase|setItem|removeItem)\b/i);
 assert.throws(()=>Sim.generate(catalog,plan,100,now),/Unsupported/);
 assert.throws(()=>Sim.generate([],plan,30,now),/three catalog/);
});
test('Combined app uses real history; diagnostics have no access to workout persistence or sync',()=>{
 const app=fs.readFileSync('app.js','utf8');
 const main=fs.readFileSync('index.html','utf8');
 const diagnostics=fs.readFileSync('review/workout-history-check.html','utf8');
 const script=fs.readFileSync('review/workout-history-check.js','utf8');
 assert.match(app,/const demo=demoSessions/);
 assert.doesNotMatch(main,/workout-simulation\.js/);
 assert.doesNotMatch(diagnostics,/app\.js|supabase|account-workout-store/);
 assert.doesNotMatch(script,/Storage|indexedDB|fetch|supabase/);
 assert.match(diagnostics,/connect-src 'none'/);
 assert.match(script,/SIMULATED TEST DATA/);
 assert.match(script,/simulation\.clear\(\)/);
});
