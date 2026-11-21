'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Auto=require('../sync/automatic-workouts.js');
const Store=require('../sync/account-workout-store.js');
const Journal=require('../sync/sync-journal.js');
const owner='user-a',other='user-b';
let seq=0;
const Sync={create:options=>Journal.create({...options,
 makeId:()=>('00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'))})};
function storage(){const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}}
function session(id,who=owner,weight=50){return {id,ownerId:who,title:'Workout',created:'2026-11-21T13:00:00Z',planId:'upper-a',sets:[{exerciseId:'press',weight,reps:10}]}}
function remote(){
 const rows=new Map(),acks=new Map();let commits=0;
 return {rows,get commits(){return commits},async listSessions(who,{afterId='',limit=50}={}){
  return [...rows.values()].filter(x=>x.owner===who&&x.id>afterId).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit);
 },async commit(op,who){
  commits++;
  if(op.owner!==who)throw Error('Foreign owner');
  if(acks.has(op.opId))return acks.get(op.opId);
  const k=who+'/'+op.id,existing=rows.get(k);
  if(existing)throw Object.assign(Error('Conflict'),{status:409});
  rows.set(k,{owner:who,type:'session',id:op.id,revision:1,deleted:false,payload:op.payload});
  const ack={owner:who,opId:op.opId,revision:1};acks.set(op.opId,ack);return ack;
 }};
}
function setup(db,cloud,options={}){
 let active=owner,online=true;
 const engine=Auto.create({owner,storage:db,accountStore:Store,Sync,transport:cloud,
  verify:async()=>({userId:owner}),active:()=>active,online:()=>online,...options});
 return {engine,switchOwner:o=>{active=o},setOnline:x=>{online=x}};
}
test('offline queue uploads once and duplicate retry does not re-upload',async()=>{
 const db=storage(),cloud=remote(),rec=session('demo-1');Store.save(db,owner,[rec]);
 const {engine,setOnline}=setup(db,cloud);
 assert.equal(engine.queue(rec).status,'queued');setOnline(false);
 assert.equal((await engine.flush()).status,'offline');assert.equal(cloud.commits,0);
 setOnline(true);const first=await engine.flush();assert.equal(first.uploaded,1);
 assert.equal((await engine.flush()).uploaded,0);assert.equal(cloud.commits,1);
 assert.equal(Store.read(db,owner).length,1);
});
test('fresh device restores only missing cloud workouts and preserves existing history',async()=>{
 const source=storage(),target=storage(),cloud=remote();
 Store.save(source,owner,[session('demo-a'),session('demo-b')]);
 await setup(source,cloud).engine.flush();
 Store.save(target,owner,[session('demo-a')]);
 const engine=setup(target,cloud).engine;
 assert.equal((await engine.previewRecovery()).missing,1);
 const outcome=await engine.restore({confirmRestore:async()=>true});
 assert.equal(outcome.restored,1);
 assert.equal(Store.read(target,owner).length,2);
 assert.equal((await engine.restore({confirmRestore:async()=>true})).restored,0);
});
test('same id with different sets blocks all remote overwrites',async()=>{
 const db=storage(),cloud=remote();
 Store.save(db,owner,[session('same',owner,100)]);
 cloud.rows.set(owner+'/same',{owner,type:'session',id:'same',revision:1,deleted:false,payload:session('same',owner,50)});
 const engine=setup(db,cloud).engine;
 const result=await engine.flush();assert.equal(result.status,'conflict');
 assert.equal(cloud.commits,0);assert.equal(Store.read(db,owner)[0].sets[0].weight,100);
 await assert.rejects(engine.restore({confirmRestore:async()=>true}),/conflicts/);
});
test('foreign owner and account changes cannot read or upload',async()=>{
 const db=storage(),cloud=remote();Store.save(db,owner,[session('only-a')]);
 const {engine,switchOwner}=setup(db,cloud);switchOwner(other);
 assert.equal((await engine.flush()).status,'owner-changed');
 await assert.rejects(engine.previewRecovery(),/Account changed/);
 assert.equal(cloud.commits,0);
});
test('recovery cancels without changing source or destination',async()=>{
 const source=storage(),target=storage(),cloud=remote();
 Store.save(source,owner,[session('a')]);await setup(source,cloud).engine.flush();
 const engine=setup(target,cloud).engine;
 assert.equal((await engine.restore({confirmRestore:async()=>false})).status,'cancelled');
 assert.deepEqual(Store.read(target,owner),[]);
 assert.equal(Store.read(source,owner).length,1);
});
test('owner switching during explicit confirmation cancels before storage writes',async()=>{
 const source=storage(),target=storage(),cloud=remote();
 Store.save(source,owner,[session('a')]);await setup(source,cloud).engine.flush();
 const context=setup(target,cloud);
 await assert.rejects(context.engine.restore({confirmRestore:async()=>{context.switchOwner(other);return true}}),/Account changed/);
 assert.equal(Store.read(target,owner).length,0);
});
