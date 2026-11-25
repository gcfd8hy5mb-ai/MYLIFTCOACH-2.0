'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function openWorkoutForOwner(id,preview=null,resumeId=null){');
const end=app.indexOf(' const draftAPI=window.MLC2SessionDraft;',start);
assert.ok(start>=0&&end>start,'Workout handoff source must remain available');
const source=app.slice(start,end)+'\n}';
const cached={id:'coach-auto-day-1',title:'Old cached',ids:['old']};
const updated={id:'coach-auto-day-1',title:'Updated Coach',ids:['new']};
function open({mode='pro',plans=[],suggestion=updated,id='coach-auto-day-1'}={}){
 const notices=[],ctx={
  id,plans,activePlan:null,verifiedOwnerId:'owner-a',coachAutonomousDraft:cached,
  betaView:()=>({mode}),coachAutonomousPlan:()=>suggestion,notice:m=>notices.push(m),
  window:{MLC2Custom:{allPlans:()=>plans}},
  $:()=>({classList:{remove:()=>{}}})
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 vm.runInContext('openWorkoutForOwner(id)',ctx);
 return {ctx,notices};
}
test('Free mode cannot open a stale previously generated Pro Coach workout',()=>{
 const x=open({mode:'free'});
 assert.equal(x.ctx.coachAutonomousDraft,cached);
 assert.match(x.notices.at(-1),/no longer available/);
});
test('Pro mode gets current Coach prescription instead of older cached exercise IDs',()=>{
 const x=open();
 assert.equal(x.ctx.coachAutonomousDraft,updated);
 assert.notEqual(x.ctx.coachAutonomousDraft,cached);
});
test('Coach plan changing to another day does not accept stale earlier ID',()=>{
 const x=open({suggestion:{...updated,id:'coach-auto-day-2'}});
 assert.match(x.notices.at(-1),/no longer available/);
});
test('User chosen custom routine remains valid when Pro is disabled',()=>{
 const custom={id:'custom-selected',title:'Personal program',ids:['press']};
 const x=open({mode:'free',plans:[custom],id:'custom-selected'});
 assert.equal(x.notices.length,0);
});
test('Account changes explicitly invalidate stale cached Coach proposals',()=>{
 assert.match(app,/function switchWorkoutOwner\(owner\)\{\s*coachAutonomousDraft=null/);
});
