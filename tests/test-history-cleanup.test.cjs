'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Cleanup=require('../sync/test-history-cleanup.js');
const Store=require('../sync/account-workout-store.js');
function storage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
function setup({failOnce=false,extra=false}={}){
 const owner='owner-one',store=storage();
 const rows=new Map(Array.from({length:8},(_,i)=>{
  const id='demo-synthetic-'+i;
  return [id,{owner,type:'session',id,revision:1,deleted:false,
   payload:{id,ownerId:owner,title:'Simulated workout '+i,created:'2026-11-20T00:00:00.000Z',planId:'upper-a',
    sets:Array.from({length:6},(_,j)=>({exerciseId:'chest-press',weight:50,reps:8+j}))}}];
 }));
 if(extra)rows.set('real-session',{owner,type:'session',id:'real-session',revision:1,deleted:false,
  payload:{id:'real-session',ownerId:owner,title:'Real',sets:[],created:'2026-11-20',planId:'upper-a'}});
 Store.save(store,owner,[...rows.values()].filter(x=>x.id!=='real-session').map(x=>x.payload));
 store.setItem('mlc2-custom-plans-v1:user:'+owner,'PROTECTED-CUSTOM');
 store.setItem('mlc2-schedule-library-v1:user:'+owner,'PROTECTED-SCHEDULE');
 let failure=failOnce,commits=0;
 const transport={
  async listSessions(requestOwner,{afterId,limit}){assert.equal(requestOwner,owner);
   return [...rows.values()].filter(x=>x.id>afterId).sort((a,b)=>a.id.localeCompare(b.id))
    .slice(0,limit).map(({payload,...rest})=>rest)},
  async read(type,id,requestOwner){assert.equal(type,'session');assert.equal(requestOwner,owner);
   return rows.has(id)?structuredClone(rows.get(id)):null},
  async commit(op,requestOwner){assert.equal(requestOwner,owner);assert.equal(op.owner,owner);assert.equal(op.kind,'delete');
   const row=rows.get(op.id);assert.equal(row.revision,op.baseRevision);
   if(failure&&++commits===2){failure=false;throw Error('Connection dropped')}
   row.deleted=true;row.revision++;return {owner,opId:op.opId,revision:row.revision};
  }
 };
 const engine=Cleanup.create({owner,storage:store,accountStore:Store,transport,
  verify:async()=>({userId:owner}),active:()=>owner});
 return {engine,rows,store,owner};
}
test('preview is read only, contains eight sessions and 48 sets, and backs up cloud and local data',async()=>{
 const x=setup();const p=await x.engine.prepare();
 assert.equal(p.count,8);assert.equal(p.sets,48);assert.equal(p.backup.cloud.length,8);
 assert.equal(p.backup.device.length,8);assert.equal(p.backup.owner,x.owner);
 assert.equal([...x.rows.values()].filter(x=>x.deleted).length,0);
 assert.equal(Store.read(x.store,x.owner).length,8);
});
test('explicit execution deletes only verified cloud sessions and local history, preserving schedules and plans',async()=>{
 const x=setup(),p=await x.engine.prepare(),r=await x.engine.execute(p);
 assert.deepEqual(r,{status:'complete',removed:8});
 assert.equal([...x.rows.values()].filter(x=>x.deleted).length,8);
 assert.equal(Store.read(x.store,x.owner).length,0);
 assert.equal(x.store.getItem('mlc2-custom-plans-v1:user:'+x.owner),'PROTECTED-CUSTOM');
 assert.equal(x.store.getItem('mlc2-schedule-library-v1:user:'+x.owner),'PROTECTED-SCHEDULE');
 assert.equal(x.engine.hasPending(),false);
});
test('additional live cloud workouts block cleanup before any deletion',async()=>{
 const x=setup({extra:true});
 await assert.rejects(x.engine.prepare(),/exactly 8/);
 assert.equal([...x.rows.values()].filter(x=>x.deleted).length,0);
});
test('revision changes after preview block all cloud writes',async()=>{
 const x=setup(),p=await x.engine.prepare();x.rows.get('demo-synthetic-0').revision++;
 await assert.rejects(x.engine.execute(p),/changed after preview/);
 assert.equal([...x.rows.values()].filter(x=>x.deleted).length,0);
});
test('cloud interruption keeps local data and permits retry against checkpoint',async()=>{
 const x=setup({failOnce:true}),p=await x.engine.prepare();
 await assert.rejects(x.engine.execute(p),/interrupted/);
 assert.equal(x.engine.hasPending(),true);
 assert.equal(Store.read(x.store,x.owner).length,8);
 const result=await x.engine.resume();
 assert.equal(result.status,'complete');
 assert.equal(x.engine.hasPending(),false);
 assert.equal(Store.read(x.store,x.owner).length,0);
 assert.equal([...x.rows.values()].filter(x=>x.deleted).length,8);
});
test('in-flight account changes block deletion',async()=>{
 const x=setup(),p=await x.engine.prepare();
 const blocked=Cleanup.create({owner:x.owner,storage:x.store,accountStore:Store,
  transport:{listSessions:async()=>[]},verify:async()=>({userId:'other'}),active:()=>x.owner});
 await assert.rejects(blocked.prepare(),/Verified account required/);
 assert.equal([...x.rows.values()].filter(x=>x.deleted).length,0);
});
