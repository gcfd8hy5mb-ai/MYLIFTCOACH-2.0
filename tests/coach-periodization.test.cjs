'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const phase=require('../coach-periodization.js');
const calendar=require('../goal-program-calendar.js');
const catalog=[{id:'press',group:'Chest',sets:3},{id:'row',group:'Back',sets:4}];
const plan={id:'custom-shoulders',title:'My Custom Workout',ids:['press','row']};
const program={goal:'bulk',weeks:8,startDate:'2026-11-01'};
const progress=calendar.progress(program,'2026-11-26T14:00:00Z');
const sessions=[
 {id:'s1',planId:plan.id,created:'2026-11-15T18:00:00Z',sets:[
  {exerciseId:'press',weight:50,reps:10},{exerciseId:'press',weight:50,reps:10},
  {exerciseId:'row',weight:55,reps:10},{exerciseId:'row',weight:55,reps:10}]},
 {id:'s2',planId:plan.id,created:'2026-11-22T18:00:00Z',sets:[
  {exerciseId:'press',weight:50,reps:10},{exerciseId:'press',weight:50,reps:10},
  {exerciseId:'row',weight:55,reps:10},{exerciseId:'row',weight:55,reps:10}]}
];
const run=(override={})=>phase.propose({program,progress,plan,sessions,catalog,readiness:'Great',...override});
test('Build phase permits bounded extra set from two real sessions and great readiness',()=>{
 assert.equal(progress.phase,'Build');
 const result=run();
 assert.equal(result.status,'ready');
 assert.equal(result.setDelta,1);
 assert.equal(result.allowLoadIncrease,true);
 assert.deepEqual(result.recommendations.map(x=>x.sets),[4,5]);
});
test('Tired readiness suppresses increases and suggests lighter training or rest',()=>{
 const result=run({readiness:'Tired'});
 assert.equal(result.recovery,'rest-or-light');
 assert.equal(result.allowLoadIncrease,false);
 assert.equal(result.setDelta,-1);
 assert.deepEqual(result.recommendations.map(x=>x.sets),[2,3]);
});
test('No previous evidence means no automatic volume increase',()=>{
 const result=run({sessions:[]});
 assert.equal(result.setDelta,0);
 assert.equal(result.allowLoadIncrease,true);
 assert.equal(result.historySessions,0);
});
test('Consolidation suggests lighter volume and prevents increasing load',()=>{
 const p=calendar.progress(program,'2026-12-20T12:00:00Z');
 assert.equal(p.phase,'Consolidate');
 const result=run({progress:p});
 assert.equal(result.setDelta,-1);
 assert.equal(result.allowLoadIncrease,false);
});
test('Comparable decline suppresses increases, unrelated sessions cannot count as evidence',()=>{
 const decline=[sessions[0],{...sessions[1],sets:sessions[1].sets.map(s=>({...s,reps:7}))}];
 const result=run({sessions:decline});
 assert.equal(result.recovery,'hold-and-review');
 assert.equal(result.allowLoadIncrease,false);
 assert.equal(result.setDelta,0);
 const unrelated=run({sessions:sessions.map(s=>({...s,planId:'other'}))});
 assert.equal(unrelated.historySessions,0);
 assert.equal(unrelated.setDelta,0);
});
test('Custom routine and session objects are never changed by Coach',()=>{
 const before=JSON.stringify({plan,catalog,sessions});
 run();run({readiness:'Tired'});
 assert.equal(JSON.stringify({plan,catalog,sessions}),before);
});
test('Completed programs and invalid input never produce training recommendations',()=>{
 assert.equal(run({progress:calendar.progress(program,'2027-01-02T12:00:00Z')}).status,'unavailable');
 assert.equal(run({plan:{id:'empty',ids:[]}}).status,'unavailable');
});
test('Live Coach displays phase advice without overwriting logged weights or custom plans',()=>{
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.match(app,/function coachProgramAdvice\(plan\)/);
 assert.match(app,/MLC2Periodization\?\.propose/);
 assert.match(app,/phaseLabel/);
 assert.match(app,/!phase.allowLoadIncrease/);
 assert.match(app,/reason:'Program recovery guidance: hold the last completed working weight.'/);
 assert.match(html,/coach-periodization\.js\?v=1/);
 assert.match(html,/app\.js\?v=45/);
});
