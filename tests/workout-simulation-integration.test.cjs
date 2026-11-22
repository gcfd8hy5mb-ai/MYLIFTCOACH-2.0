'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Sim=require('../workout-simulation.js');
const Audit=require('../workout-simulation-audit.js');
const Weekly=require('../progress-weekly-summary.js');
const catalog=['Chest','Back','Legs','Arms','Shoulders','Core'].map((group,i)=>({id:'sample-'+i,name:group+' Exercise',group,equipment:'Machine'}));
const plan={id:'sample-plan',title:'Sample',ids:catalog.slice(0,5).map(e=>e.id)};
const window={};vm.runInNewContext(fs.readFileSync('progress-migration.js','utf8'),{window,document:{}});
vm.runInNewContext(fs.readFileSync('coach-migration.js','utf8'),{window,document:{}});
test('30 and 90 day simulation reconcile exercise IDs, weighted volume, PR totals and Coach input',()=>{
 for(const days of [30,90]){
  const sessions=Sim.generate(catalog,plan,days,new Date('2026-11-22T14:00:00Z'));
  const result=Audit.audit(sessions,catalog,window.MLC2Progress,Weekly,window.MLC2Coach);
  assert.equal(result.status,'pass',JSON.stringify(result.checks));
  assert.equal(result.checks.length,7);
  assert.equal(result.summary.sessions,sessions.length);
  assert.equal(result.summary.sets,sessions.reduce((n,s)=>n+s.sets.length,0));
  assert.equal(result.summary.weightedSets,result.summary.sets);
 }
});
test('audit shows inconsistent catalog data rather than silently passing',()=>{
 const sessions=Sim.generate(catalog,plan,30,new Date('2026-11-22T14:00:00Z'));
 const broken=sessions.map((s,i)=>i? s:{...s,sets:[{exerciseId:'not-in-library',weight:50,reps:10},...s.sets]});
 const result=Audit.audit(broken,catalog,window.MLC2Progress,Weekly,window.MLC2Coach);
 assert.equal(result.status,'attention');
 assert.equal(result.checks.find(c=>c.title==='Exercise catalog mappings resolve').pass,false);
});
test('History uses simulation view only for 2.0 sessions and leaves original history separate',()=>{
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 const code=app.slice(app.indexOf('function renderHistory(){'),app.indexOf('function renderOriginalPlans(){'));
 assert.ok(code.includes('const original=originalSnapshot?.sessions||[]'));
 assert.ok(code.includes('const demo=viewedHistory()'));
 assert.ok(code.includes("'SIMULATED · TEST DATA':'SAVED 2.0 RECORDS'"));
 assert.ok(code.includes("history2SimulationNotice"));
 assert.ok(html.includes('id="history2SourceLabel"')&&html.includes('id="history2SimulationNotice"'));
 assert.ok(app.includes('renderHistory();if(page===\'coaching\')renderCoach();'));
});
test('the simulation audit is read-only, not a browser storage or cloud action',()=>{
 const source=fs.readFileSync('workout-simulation-audit.js','utf8');
 assert.doesNotMatch(source,/\b(localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|supabase|setItem|removeItem)\b/i);
 assert.ok(fs.readFileSync('index.html','utf8').includes('id="simulationAudit"'));
 assert.ok(fs.readFileSync('app.js','utf8').includes('window.MLC2SimulationAudit?.audit('));
 assert.equal(Audit.audit([],catalog,window.MLC2Progress,Weekly,window.MLC2Coach).status,'inactive');
});
