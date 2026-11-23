'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Aux=require('../sync/aux-data.js');
const Cloud=require('../sync/auxiliary-cloud.js');
const Journal=require('../sync/sync-journal.js');
const Schedule=require('../weekly-workout-schedule.js');
const owner='account-demo';
let sequence=0;
const Sync={create:o=>Journal.create({...o,makeId:()=>('00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'))})};
function device(){
 const rows=new Map();
 const store={getItem:key=>rows.has(key)?rows.get(key):null,
  setItem:(key,value)=>rows.set(key,String(value)),
  removeItem:key=>rows.delete(key)};
 const win={MLC2_EXERCISE_CATALOG:[{id:'chest',name:'Press',group:'Chest'},
  {id:'lat',name:'Pulldown',group:'Back'}]};
 vm.runInNewContext(read('custom-workouts.js'),{window:win,localStorage:store,console});
 win.MLC2Custom.setOwner(owner);
 const scopedSchedule={getItem:k=>store.getItem(k+':user:'+owner),
  setItem:(k,v)=>store.setItem(k+':user:'+owner,v),
  removeItem:k=>store.removeItem(k+':user:'+owner)};
 return {rows,store,custom:win.MLC2Custom,schedule:scopedSchedule};
}
function cloudDb(){
 const rows=new Map(),receipts=new Map();
 return {rows,async read(type,id,user){return rows.get(user+':'+type+':'+id)||null},
  async commit(op,user){
   if(receipts.has(op.opId))return receipts.get(op.opId);
   const key=user+':'+op.type+':'+op.id,previous=rows.get(key);
   if((previous?.revision||0)!==op.baseRevision)throw Object.assign(Error('Conflict'),{status:409});
   const revision=(previous?.revision||0)+1;
   rows.set(key,{owner:user,type:op.type,id:op.id,revision,deleted:false,payload:op.payload});
   const ack={owner:user,opId:op.opId,revision};receipts.set(op.opId,ack);return ack;
  }};
}
const engine=(device,cloud,online=()=>true)=>Cloud.create({owner,storage:device.store,aux:Aux,Sync,
 transport:cloud,verify:async()=>({userId:owner}),active:()=>owner,online});
const key='mlc2-custom-plans-v1:user:'+owner;
const plan={id:'custom-upper',title:'Upper Custom',ids:['chest','lat'],
 targets:{chest:{sets:4,reps:8,weight:85,restSeconds:75},lat:{reps:12}}};
test('custom exercise targets and weekly assignment backup together; restore safely to second device',async()=>{
 const phone=device(),laptop=device(),cloud=cloudDb();
 phone.store.setItem(key,JSON.stringify([plan]));
 Schedule.assign(phone.schedule,1,plan.id,[plan]);
 Schedule.assign(phone.schedule,3,plan.id,[plan]);
 const first=await engine(phone,cloud).backup();
 assert.equal(first.uploaded,2);
 const review=await engine(laptop,cloud).previewRecovery();
 assert.deepEqual(review.missing,['Custom workouts','Weekly workout schedule']);
 assert.equal(laptop.custom.allPlans([]).length,0,'read-only cloud inspection cannot mutate local data');
 const restored=await engine(laptop,cloud).restore({confirmRestore:async()=>true});
 assert.deepEqual(restored.restored,['Custom workouts','Weekly workout schedule']);
 const onLaptop=laptop.custom.allPlans([])[0];
 assert.equal(onLaptop.id,plan.id);
 assert.deepEqual(JSON.parse(JSON.stringify(onLaptop.targets)),plan.targets);
 const monday=new Date(2026,10,23,12);
 const resolved=Schedule.resolve({storage:laptop.schedule,custom:laptop.custom.allPlans([]),date:monday});
 assert.equal(resolved.id,plan.id);
 assert.equal(resolved.scheduleSource,'weekly');
 assert.deepEqual(Schedule.read(laptop.schedule),{'1':plan.id,'3':plan.id});
});
test('editing exercise targets advances cloud revision; other device existing data never silently overwritten',async()=>{
 const phone=device(),laptop=device(),cloud=cloudDb();
 phone.store.setItem(key,JSON.stringify([plan]));
 await engine(phone,cloud).backup();
 laptop.store.setItem(key,JSON.stringify([plan]));
 const next={...plan,targets:{chest:{sets:3,reps:9,weight:90,restSeconds:90},lat:{reps:12}}};
 phone.store.setItem(key,JSON.stringify([next]));
 const changed=await engine(phone,cloud).backup();
 assert.equal(changed.uploaded,1);
 assert.equal(cloud.rows.get(owner+':custom-plan:snapshot-v1').revision,2);
 const offered=await engine(laptop,cloud).previewRecovery();
 assert.equal(offered.canRestore,false,'existing laptop routine is not overwritten');
 assert.equal((await engine(laptop,cloud).restore({confirmRestore:async()=>true})).status,'up-to-date');
 assert.equal(laptop.custom.allPlans([])[0].targets.chest.weight,85);
 const laptopEdit={...plan,targets:{chest:{weight:105}}};
 laptop.store.setItem(key,JSON.stringify([laptopEdit]));
 const conflict=await engine(laptop,cloud).backup();
 assert.equal(conflict.status,'conflict');
 assert.equal(cloud.rows.get(owner+':custom-plan:snapshot-v1').revision,2);
});
test('manual selection beats weekly schedule and can be explicitly cleared',()=>{
 const d=device();d.store.setItem(key,JSON.stringify([plan]));
 Schedule.assign(d.schedule,1,plan.id,[plan]);
 const presets=[{id:'upper-a',title:'Preset A',ids:['chest']}];
 d.schedule.setItem('mlc2-selected-workout-v1','upper-a');
 const date=new Date(2026,10,23,12);
 assert.equal(Schedule.resolve({storage:d.schedule,custom:d.custom.allPlans([]),presets,date}).id,'upper-a');
 Schedule.clearOverride(d.schedule);
 const next=Schedule.resolve({storage:d.schedule,custom:d.custom.allPlans([]),presets,date});
 assert.equal(next.id,plan.id);
 assert.equal(next.scheduleSource,'weekly');
});
test('offline change remains local without cloud writes or remote mutation',async()=>{
 const d=device(),cloud=cloudDb();
 d.store.setItem(key,JSON.stringify([plan]));
 const result=await engine(d,cloud,()=>false).backup();
 assert.equal(result.status,'offline');
 assert.equal(cloud.rows.size,0);
 assert.deepEqual(JSON.parse(JSON.stringify(d.custom.allPlans([])[0].targets)),plan.targets);
});
