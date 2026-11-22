'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const plans=[
 {id:'preset-a',title:'Preset A',kind:'Preset',ids:['machine-chest-press']},
 {id:'preset-b',title:'Preset B',kind:'Preset',ids:['seated-row']}
];
const custom={id:'custom-priority',title:'My Custom Plan',kind:'Custom',ids:['machine-chest-press']};
function storage(){
 const entries=new Map();
 return {getItem:k=>entries.has(k)?entries.get(k):null,
  setItem:(k,v)=>{entries.set(k,String(v))},
  removeItem:k=>{entries.delete(k)},has:k=>entries.has(k)};
}
function make(){
 const db=storage(),win={MLC2_EXERCISE_CATALOG:[{id:'machine-chest-press',name:'Press'},{id:'seated-row',name:'Row'}]};
 const ctx=vm.createContext({window:win,localStorage:db,console,Date,Math,confirm:()=>true,alert:()=>{}});
 vm.runInContext(read('custom-workouts.js'),ctx);
 vm.runInContext(read('weekly-workout-schedule.js'),ctx);
 // The weekly schedule UMD exports on globalThis in Node VM, while the
 // real browser uses the same object for globalThis and window.
 win.MLC2WeeklySchedule=ctx.MLC2WeeklySchedule;
 return {win,db};
}
function accountStore(db,owner){
 const map=k=>owner&&['mlc2-selected-workout-v1','mlc2-weekly-schedule-v1'].includes(k)?k+':user:'+owner:k;
 return {getItem:k=>{const raw=db.getItem(map(k));return owner&&k==='mlc2-selected-workout-v1'&&raw===''?null:raw},
  setItem:(k,v)=>db.setItem(map(k),v),removeItem:k=>db.removeItem(map(k))};
}
function chosen(win,db,owner=null,date=new Date('2026-11-23T12:00:00Z')){
 return win.MLC2WeeklySchedule.resolve({presets:plans,
  custom:win.MLC2Custom.allPlans(plans).filter(p=>p.id.startsWith('custom-')),
  storage:accountStore(db,owner),sessionsCompleted:0,date});
}
test('manually selected custom workout takes priority over scheduled presets and completed session count',()=>{
 const {win,db}=make();
 db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 const s=accountStore(db,null);
 win.MLC2WeeklySchedule.assign(s,1,'preset-b',[custom,...plans]);
 assert.equal(chosen(win,db).id,'preset-b');
 db.setItem('mlc2-selected-workout-v1',custom.id);
 assert.equal(chosen(win,db).id,custom.id);
 assert.equal(chosen(win,db).scheduleSource,'manual');
});
test('manual preset selection overrides scheduled custom workout until explicitly cleared',()=>{
 const {win,db}=make();
 db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 const s=accountStore(db,null);
 win.MLC2WeeklySchedule.assign(s,1,custom.id,[custom,...plans]);
 db.setItem('mlc2-selected-workout-v1','preset-a');
 assert.equal(chosen(win,db).id,'preset-a');
 win.MLC2WeeklySchedule.clearOverride(s);
 assert.equal(chosen(win,db).id,custom.id);
 assert.equal(chosen(win,db).scheduleSource,'weekly');
});
test('custom priority persists across manager re-init and selected workout is not altered by editing other plans',()=>{
 const {win,db}=make();db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 db.setItem('mlc2-selected-workout-v1',custom.id);
 assert.equal(win.MLC2Custom.currentPlan(plans,0).id,custom.id);
 const context=vm.createContext({window:win,localStorage:db,Date,Math});
 vm.runInContext(read('custom-workouts.js'),context);
 assert.equal(win.MLC2Custom.currentPlan(plans,0).id,custom.id);
});
test('deleting currently selected custom plan removes stale selection and keeps existing workout history intact',()=>{
 const {win,db}=make();
 db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 db.setItem('mlc2-selected-workout-v1',custom.id);
 db.setItem('mlc2-account-session-history-preservation-check','unchanged');
 const click={target:{closest:selector=>selector==='[data-custom-delete]'?{dataset:{customDelete:custom.id}}:null}};
 let rendered=0;
 assert.equal(win.MLC2Custom.handleClick(click,()=>rendered++),true);
 assert.equal(rendered,1);
 assert.equal(win.MLC2Custom.allPlans(plans).some(p=>p.id===custom.id),false);
 assert.equal(db.getItem('mlc2-selected-workout-v1'),null);
 assert.equal(db.getItem('mlc2-account-session-history-preservation-check'),'unchanged');
 assert.equal(chosen(win,db).id,'preset-a');
});
test('account scopes isolate a selected custom workout from guest and another signed-in user',()=>{
 const {win,db}=make(),a='account-a',b='account-b';
 win.MLC2Custom.setOwner(a);
 db.setItem('mlc2-custom-plans-v1:user:'+a,JSON.stringify([custom]));
 db.setItem('mlc2-selected-workout-v1:user:'+a,custom.id);
 assert.equal(chosen(win,db,a).id,custom.id);
 win.MLC2Custom.setOwner(b);
 assert.equal(chosen(win,db,b).id,'preset-a');
 win.MLC2Custom.setOwner(null);
 assert.equal(chosen(win,db).id,'preset-a');
});
test('Home refuses to open a workout that differs from the displayed preview',()=>{
 const app=read('app.js');
 const start=app.indexOf('function workoutPreviewKey(');
 const end=app.indexOf('function openWorkout(id)',start);
 const opened=[],notices=[];
 const planned={id:'same',title:'Workout',ids:['press']};
 const context={planned,opened,loadCurrentWorkouts(){},renderHome(){},renderWorkouts(){},
  notice:msg=>notices.push(msg),openWorkout:id=>opened.push(id)};
 vm.runInNewContext(app.slice(start,end)+`
  const button={dataset:{workoutPreview:workoutPreviewKey(planned)}};
  startPreviewWorkout(button,()=>({...planned,ids:['row']}));
  startPreviewWorkout(button,()=>planned);
 `,context);
 assert.equal(notices.length,1);
 assert.deepEqual(opened,['same']);
});

test('guest workout recovery copies missing routines without deleting guest source or signed-in plans',()=>{
 const {win,db}=make();
 const another={id:'custom-existing',title:'Account Plan',kind:'Custom',ids:['seated-row']};
 db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 db.setItem('mlc2-selected-workout-v1',custom.id);
 db.setItem('mlc2-custom-plans-v1:user:account-a',JSON.stringify([another]));
 win.MLC2Custom.setOwner('account-a');
 assert.equal(win.MLC2Custom.guestRecovery().available,1);
 const result=win.MLC2Custom.recoverGuest();
 assert.equal(result.added,1);
 const account=JSON.parse(db.getItem('mlc2-custom-plans-v1:user:account-a'));
 assert.deepEqual(account.map(p=>p.id).sort(),['custom-existing','custom-priority']);
 assert.equal(db.getItem('mlc2-selected-workout-v1:user:account-a'),custom.id);
 assert.equal(JSON.parse(db.getItem('mlc2-custom-plans-v1'))[0].id,custom.id);
 assert.equal(win.MLC2Custom.recoverGuest().added,0);
});
test('guest recovery refuses to replace conflicting account ID or corrupt account data',()=>{
 const {win,db}=make();
 const changed={...custom,title:'Different account routine'};
 db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 db.setItem('mlc2-custom-plans-v1:user:account-a',JSON.stringify([changed]));
 win.MLC2Custom.setOwner('account-a');
 assert.equal(win.MLC2Custom.guestRecovery().available,0);
 assert.equal(win.MLC2Custom.recoverGuest().added,0);
 assert.equal(win.MLC2Custom.allPlans([])[0].title,'Different account routine');
 db.setItem('mlc2-custom-plans-v1:user:account-a','broken');
 assert.throws(()=>win.MLC2Custom.recoverGuest());
 assert.equal(db.getItem('mlc2-custom-plans-v1:user:account-a'),'broken');
});
test('guest routines stay account-isolated until recovery is explicitly requested',()=>{
 const {win,db}=make();
 db.setItem('mlc2-custom-plans-v1',JSON.stringify([custom]));
 win.MLC2Custom.setOwner('account-b');
 assert.equal(win.MLC2Custom.allPlans(plans).some(p=>p.id===custom.id),false);
 assert.equal(win.MLC2Custom.guestRecovery().available,1);
 win.MLC2Custom.setOwner(null);
 assert.equal(win.MLC2Custom.allPlans(plans).some(p=>p.id===custom.id),true);
});
