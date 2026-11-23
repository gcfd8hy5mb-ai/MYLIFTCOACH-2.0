'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Weekly=require('../weekly-workout-schedule.js');
const plan={id:'custom-mon',title:'Monday',ids:['press'],targets:{press:{sets:4,reps:9,weight:70,restSeconds:95}}};
const catalog=[{id:'press',name:'Machine press',group:'Chest'},{id:'row',name:'Row',group:'Back'}];
function device(){
 const map=new Map(),blocked={key:null};let backups=0;
 const storage={getItem:k=>map.has(k)?map.get(k):null,setItem(k,v){if(k===blocked.key)throw Error('Storage unavailable');map.set(k,String(v))},removeItem:k=>map.delete(k)};
 const window={MLC2WeeklySchedule:Weekly,MLC2_EXERCISE_CATALOG:catalog,MLC2ScheduleAuxSync:()=>backups++};
 vm.runInNewContext(read('custom-workouts.js'),{window,localStorage:storage,console});
 window.MLC2Custom.setOwner('accountA');
 const scope=k=>k+':user:accountA';
 return {map,blocked,storage,window,scope,get backups(){return backups}};
}
test('deleting scheduled custom plan leaves rest days, preserves other plans and no phantom fallback',()=>{
 const d=device(),other={id:'custom-other',title:'Other',ids:['row']};
 d.storage.setItem(d.scope('mlc2-custom-plans-v1'),JSON.stringify([plan,other]));
 d.storage.setItem(d.scope(Weekly.KEY),JSON.stringify({'0':'rest-day','1':plan.id,'2':other.id,'3':plan.id}));
 d.storage.setItem(d.scope('mlc2-selected-workout-v1'),plan.id);
 const result=d.window.MLC2Custom.deleteCustomPlan(plan.id);
 assert.equal(result.historyPreserved,true);
 assert.deepEqual(JSON.parse(JSON.stringify(result.restDays)),[1,3]);
 assert.deepEqual(JSON.parse(d.storage.getItem(d.scope(Weekly.KEY))),{'0':'rest-day','1':'rest-day','2':'custom-other','3':'rest-day'});
 assert.equal(d.storage.getItem(d.scope('mlc2-selected-workout-v1')),'');
 assert.equal(d.window.MLC2Custom.allPlans([]).length,1);
 assert.equal(d.window.MLC2Custom.allPlans([])[0].id,'custom-other');
 assert.equal(d.backups,1);
 const monday=new Date(2026,10,23,12);
 assert.equal(Weekly.resolve({storage:{getItem:k=>d.storage.getItem(d.scope(k))},custom:d.window.MLC2Custom.allPlans([]),date:monday}).scheduleSource,'rest');
});
test('delete rollback protects previous workout and schedule when storage fails',()=>{
 const d=device();
 const beforePlans=JSON.stringify([plan]),beforeSchedule=JSON.stringify({'1':plan.id});
 d.storage.setItem(d.scope('mlc2-custom-plans-v1'),beforePlans);
 d.storage.setItem(d.scope(Weekly.KEY),beforeSchedule);
 d.blocked.key=d.scope(Weekly.KEY);
 assert.throws(()=>d.window.MLC2Custom.deleteCustomPlan(plan.id),/Storage unavailable/);
 assert.equal(d.storage.getItem(d.scope('mlc2-custom-plans-v1')),beforePlans);
 assert.equal(d.storage.getItem(d.scope(Weekly.KEY)),beforeSchedule);
 assert.equal(d.backups,0);
});
test('malformed weekly schedule blocks destructive deletion rather than deleting routine',()=>{
 const d=device();
 d.storage.setItem(d.scope('mlc2-custom-plans-v1'),JSON.stringify([plan]));
 d.storage.setItem(d.scope(Weekly.KEY),'not JSON');
 assert.throws(()=>d.window.MLC2Custom.deleteCustomPlan(plan.id),/schedule needs review/);
 assert.equal(d.window.MLC2Custom.allPlans([]).length,1);
});
test('Coach goal defaults to schedule day count, respects explicit choice, and remains account scoped',()=>{
 const d=device();
 d.storage.setItem(d.scope(Weekly.KEY),JSON.stringify({'0':'rest-day','1':plan.id,'2':'rest-day','3':plan.id,'4':plan.id,'5':'rest-day','6':'rest-day'}));
 const ctx={window:d.window,localStorage:d.storage,console,Date};
 vm.runInNewContext(read('coach-readiness.js'),ctx);
 d.window.MLC2CoachReadiness.setOwner('accountA');
 assert.equal(d.window.MLC2CoachReadiness.weeklyGoal(),3);
 assert.equal(d.storage.getItem(d.scope('mlc2-weekly-goal-v1')),null,'inferred goal must never overwrite settings');
 d.storage.setItem(d.scope('mlc2-weekly-goal-v1'),'5');
 assert.equal(d.window.MLC2CoachReadiness.weeklyGoal(),5);
 d.window.MLC2CoachReadiness.setOwner('accountB');
 assert.equal(d.window.MLC2CoachReadiness.weeklyGoal(),4);
});
test('Coach suggested weights never auto-write custom target fields and rest day suppresses autonomous override',()=>{
 const app=read('app.js'),js=read('custom-workouts.js');
 assert.ok(app.includes("standard?.scheduleSource==='rest')return standard"));
 assert.ok(app.includes("const optional=activePlan.targets?.[id]||{}"));
 assert.ok(app.includes("if(betaView().mode!=='pro')"));
 assert.ok(app.includes("if(result?.status!=='ready'"));
 assert.ok(js.includes("targets:normalizeTargets(choice.targets,ids)"));
});

test('Home and workout logger use saved exercise targets rather than generic defaults',()=>{
 const app=read('app.js');
 assert.ok(app.includes('const plannedSets=plan.ids.reduce'));
 assert.ok(app.includes('const saved=upcoming?.targets?.[id]||{}'));
 assert.ok(app.includes("Number.isInteger(saved.sets)?saved.sets"));
 assert.ok(app.includes("Number.isInteger(saved.reps)?saved.reps"));
 assert.ok(app.includes('const optional=activePlan.targets?.[id]||{}'));
 assert.ok(app.includes("Number.isInteger(optional.restSeconds)"));
});
