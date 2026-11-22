'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const a=app.indexOf('function nextPlan(){'),b=app.indexOf('function wireWorkoutPreviewImages(root){',a);
assert.ok(a>=0&&b>a,'Next-plan resolver must remain connected to Home');
const snippet=app.slice(a,b);
const preset={id:'preset',title:'Preset',ids:['press']},generated={id:'coach-auto-day-1',title:'Coach Program',ids:['press','row']};
function run({source='default',pro=true,program=true,candidate=generated}={}){
 const env={plans:[preset],demoSessions:[],verifiedOwnerId:'owner-1',localStorage:{},
  planStorage:()=>({}),coachAutonomousDraft:null,betaView:()=>({mode:pro?'pro':'free'}),
  coachAutonomousPlan:()=>candidate,
  window:{MLC2Custom:{allPlans:()=>[],currentPlan:()=>preset},
   MLC2WeeklySchedule:{resolve:()=>({...preset,scheduleSource:source})},
   MLC2GoalProgram:{read:()=>program?{goal:'bulk',weeks:8,startDate:'2026-11-22'}:null,progress:()=>({status:'active'})},
   MLC2ProgramSource:{read:()=>({mode:'generated'})}}
 };
 vm.createContext(env);vm.runInContext(snippet,env);
 return {plan:vm.runInContext('nextPlan()',env),selected:env.coachAutonomousDraft};
}
test('Explicit custom manual selection is never overridden by Coach program',()=>{
 assert.equal(run({source:'manual'}).plan.scheduleSource,'manual');
});
test('A weekday schedule retains priority over an enrolled Coach program',()=>{
 assert.equal(run({source:'weekly'}).plan.scheduleSource,'weekly');
});
test('Enrolled program drives Home Today when no higher-priority selection exists',()=>{
 const x=run();
 assert.equal(x.plan.id,generated.id);
 assert.equal(x.plan.scheduleSource,'program');
 assert.equal(x.selected.id,generated.id,'Home start can resolve generated session');
});
test('Free mode and missing programs keep the existing selected workout',()=>{
 assert.equal(run({pro:false}).plan.id,'preset');
 assert.equal(run({program:false}).plan.id,'preset');
 assert.equal(run({candidate:null}).plan.id,'preset');
});
test('Home is refreshed when goal or program is started or restarted',()=>{
 assert.match(app,/renderCalorieGoal\(\);renderHome\(\);renderWorkouts\(\)/);
 assert.match(app,/if\(standard\?\.scheduleSource==='manual'\|\|standard\?\.scheduleSource==='weekly'\)return standard/);
});
