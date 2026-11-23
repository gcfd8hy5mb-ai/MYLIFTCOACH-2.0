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
test('Diagnostics can generate and clear a 90-day audit and separate fictional history',()=>{
 const script=fs.readFileSync('review/workout-history-check.js','utf8');
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{dataset:{days:id.slice(-2)},addEventListener(_,fn){this.click=fn},replaceChildren(...rows){this.rows=rows}});
  return elements.get(id);
 };
 let audit;
 const document={getElementById:element,createElement:()=>({})};
 vm.runInNewContext(script,{document,window:{...window,MLC2_EXERCISE_CATALOG:catalog,MLC2Simulation:Sim,
  MLC2SimulationAudit:{...Audit,render:(_,report)=>{audit=report}},MLC2ProgressWeekly:Weekly}});
 element('simulation90').click({currentTarget:element('simulation90')});
 assert.equal(audit.status,'pass');
 assert.match(element('simulationStatus').textContent,/SIMULATED TEST DATA/);
 assert.equal(element('simulationHistory').rows.length,audit.summary.sessions);
 element('simulationClear').click();
 assert.equal(audit.status,'inactive');
 assert.equal(element('simulationHistory').rows.length,0);
});
