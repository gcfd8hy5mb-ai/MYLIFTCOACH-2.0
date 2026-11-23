'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Aux=require('../sync/aux-data.js'),Cloud=require('../sync/auxiliary-cloud.js');
const Journal=require('../sync/sync-journal.js');
const owner='account-a',other='account-b';
let seq=0;
const Sync={create:o=>Journal.create({...o,makeId:()=>('00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'))})};
const store=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
function db(){const records=new Map(),receipts=new Map();return {records,
 async read(type,id,who){return records.get(who+':'+type+':'+id)||null},
 async commit(op,who){
  if(receipts.has(op.opId))return receipts.get(op.opId);
  const key=who+':'+op.type+':'+op.id,previous=records.get(key),revision=previous?.revision||0;
  if(revision!==op.baseRevision)throw Object.assign(Error('Conflict'),{status:409});
  records.set(key,{owner:who,type:op.type,id:op.id,revision:revision+1,deleted:false,payload:op.payload});
  const ack={owner:who,opId:op.opId,revision:revision+1};receipts.set(op.opId,ack);return ack;
 }};
}
const engine=(s,d)=>Cloud.create({owner,storage:s,aux:Aux,Sync,transport:d,
 verify:async()=>({userId:owner}),active:()=>owner});
const selected='mlc2-selected-workout-v1:user:'+owner;
const schedule='mlc2-weekly-schedule-v1:user:'+owner;
const weekly='mlc2-weekly-goal-v1:user:'+owner;
const readiness='mlc2-coach-readiness-v1:user:'+owner;
test('selected workout, schedule, Coach weekly goal and readiness recover on second device',async()=>{
 const one=store(),two=store(),remote=db();
 one.setItem('mlc2-custom-plans-v1:user:'+owner,JSON.stringify([{id:'custom-press',ids:['chest-press']} ]));
 one.setItem(selected,'custom-press');
 one.setItem(schedule,JSON.stringify({'1':'custom-press','3':'upper-a'}));
 one.setItem(weekly,'5');
 one.setItem(readiness,JSON.stringify({'2026-11-21:upper-a':'Great'}));
 const upload=await engine(one,remote).backup();
 assert.equal(upload.uploaded,5);
 assert.equal(remote.records.size,5);
 assert.equal((await engine(one,remote).backup()).uploaded,0);
 const restore=await engine(two,remote).restore({confirmRestore:async()=>true});
 assert.equal(restore.restored.length,5);
 assert.equal(two.getItem(selected),'custom-press','selected routine retains raw storage format');
 assert.deepEqual(JSON.parse(two.getItem(schedule)),{'1':'custom-press','3':'upper-a'});
 assert.equal(two.getItem(weekly),'5');
 assert.deepEqual(JSON.parse(two.getItem(readiness)),{'2026-11-21:upper-a':'Great'});
});
test('weekly schedule update increments only its own record revision',async()=>{
 const s=store(),remote=db();s.setItem(schedule,JSON.stringify({'1':'upper-a'}));
 await engine(s,remote).backup();s.setItem(schedule,JSON.stringify({'1':'custom-press'}));
 const second=await engine(s,remote).backup();
 assert.equal(second.uploaded,1);
 assert.equal(remote.records.get(owner+':goal:weekly-schedule-v1').revision,2);
 assert.equal(remote.records.size,1);
});
test('an unknown owner cannot read or overwrite account preference backups',async()=>{
 const first=store(),second=store(),remote=db();
 first.setItem(selected,'custom-press');await engine(first,remote).backup();
 second.setItem('mlc2-selected-workout-v1:user:'+other,'custom-other');
 assert.equal((await engine(second,remote).backup()).uploaded,0);
 assert.equal(remote.records.get(owner+':goal:selected-workout-v1').payload.entries,'custom-press');
});
test('malformed weekly goal and schedule are rejected before a cloud commit',async()=>{
 const s=store(),remote=db();s.setItem(weekly,'9');
 await assert.rejects(engine(s,remote).backup(),/invalid data/);
 assert.equal(remote.records.size,0);
 s.removeItem(weekly);s.setItem(schedule,JSON.stringify({'9':'upper-a'}));
 await assert.rejects(engine(s,remote).backup(),/invalid data/);
 assert.equal(remote.records.size,0);
});
test('a failed recovery read-back does not leave partial preferences behind',()=>{
 const s=store();const config=Aux.CONFIG.find(x=>x.kind==='selected-workout');
 const record={owner,type:'goal',id:Aux.recordId(config),revision:1,deleted:false,
  payload:Aux.payload('upper-a')};
 const broken={getItem:k=>s.getItem(k),setItem:(k,v)=>{s.setItem(k,'damaged')},removeItem:k=>s.removeItem(k)};
 assert.throws(()=>Aux.restoreMissing(broken,owner,[record]),/write failed/);
 assert.equal(s.getItem(selected),null);
});

test('explicit account selection clear advances revision rather than restoring an old plan',async()=>{
 const s=store(),remote=db();s.setItem(selected,'custom-press');
 await engine(s,remote).backup();
 s.setItem(selected,'');
 const updated=await engine(s,remote).backup();
 assert.equal(updated.uploaded,1);
 const row=remote.records.get(owner+':goal:selected-workout-v1');
 assert.equal(row.revision,2);assert.equal(row.payload.entries,'');
 const second=store();const recovered=await engine(second,remote).restore({confirmRestore:async()=>true});
 assert.equal(recovered.restored.includes('Selected workout'),false);
 assert.equal(second.getItem(selected),null);
});
test('deleting last custom plan is backed up only after confirming a previous revision',async()=>{
 const s=store(),remote=db(),key='mlc2-custom-plans-v1:user:'+owner;
 s.setItem(key,JSON.stringify([{id:'custom-press',title:'Press',ids:['chest-press']}]));
 await engine(s,remote).backup();
 s.setItem(key,'[]');
 const updated=await engine(s,remote).backup();
 assert.equal(updated.uploaded,1);
 assert.equal(remote.records.get(owner+':custom-plan:snapshot-v1').revision,2);
 assert.deepEqual(remote.records.get(owner+':custom-plan:snapshot-v1').payload.entries,[]);
});
test('missing category storage never authorizes a cloud delete or empty snapshot',async()=>{
 const s=store(),remote=db(),key='mlc2-custom-plans-v1:user:'+owner;
 s.setItem(key,JSON.stringify([{id:'custom-press',title:'Press',ids:['chest-press']}]));
 await engine(s,remote).backup();
 s.removeItem(key);
 const outcome=await engine(s,remote).backup();
 assert.equal(outcome.uploaded,0);
 assert.equal(remote.records.get(owner+':custom-plan:snapshot-v1').revision,1);
});

test('stale cloud settings cannot resurrect locally cleared routines, schedule, or manual choice',async()=>{
 const local=store(),server=db();
 const plansKey='mlc2-custom-plans-v1:user:'+owner;
 local.setItem(plansKey,JSON.stringify([{id:'custom-press',title:'Press',ids:['chest-press']}]));
 local.setItem(selected,'custom-press');
 local.setItem(schedule,JSON.stringify({'1':'custom-press'}));
 await engine(local,server).backup();
 local.setItem(plansKey,'[]');local.setItem(selected,'');local.setItem(schedule,'{}');
 const result=await engine(local,server).restore({confirmRestore:async()=>{throw Error('No recovery should be proposed')}});
 assert.equal(result.status,'up-to-date');
 assert.equal(local.getItem(plansKey),'[]');assert.equal(local.getItem(selected),'');assert.equal(local.getItem(schedule),'{}');
});

test('a fresh origin skips stale schedule and selection pointing at a deleted custom routine',async()=>{
 const destination=store(),server=db();
 const add=(type,id,entries,deleted=false)=>{
  server.records.set(owner+':'+type+':'+id,{owner,type,id,revision:2,deleted,payload:Aux.payload(entries)});
 };
 add('custom-plan','snapshot-v1',[],true);
 add('goal','weekly-schedule-v1',{'1':'custom-deleted','3':'upper-a'});
 add('goal','selected-workout-v1','custom-deleted');
 assert.deepEqual((await engine(destination,server).previewRecovery()).missing,[]);
 assert.equal((await engine(destination,server).restore({confirmRestore:()=>{throw Error('unexpected recovery')}})).status,'up-to-date');
 assert.equal(destination.getItem(schedule),null);
 assert.equal(destination.getItem(selected),null);
});

test('account changes during dependency reads leave fresh-origin storage untouched',async()=>{
 const destination=store(),server=db();let active=owner;
 const original=server.read;
 server.read=async(...args)=>{active=other;return original(...args)};
 const backup=Cloud.create({owner,storage:destination,aux:Aux,Sync,transport:server,
  verify:async()=>({userId:owner}),active:()=>active});
 await assert.rejects(()=>backup.restore({confirmRestore:()=>true}),/Account changed/);
 assert.equal(destination.m.size,0);
});

test('a fresh origin skips stale dependencies even when the updated workout list is empty without a tombstone',async()=>{
 const destination=store(),server=db();
 for(const [type,id,entries] of [
  ['custom-plan','snapshot-v1',[]],['goal','weekly-schedule-v1',{'1':'custom-retired'}],
  ['goal','selected-workout-v1','custom-retired']]){
  server.records.set(owner+':'+type+':'+id,{owner,type,id,revision:2,deleted:false,payload:Aux.payload(entries)});
 }
 assert.deepEqual((await engine(destination,server).previewRecovery()).missing,[]);
 assert.equal((await engine(destination,server).restore({confirmRestore:()=>true})).status,'up-to-date');
});

test('stale cloud measurement and tracking snapshots do not undo a locally cleared category',()=>{
 const s=store();
 const old=[
  {type:'measurement',id:'snapshot-v1',owner,revision:1,deleted:false,payload:Aux.payload([{id:'old-measure'}])},
  {type:'tracking',id:'snapshot-v1',owner,revision:1,deleted:false,payload:Aux.payload([{id:'old-log'}])}
 ];
 for(const key of ['mlc2-measurements-v1','mlc2-local-daily-v1'])s.setItem(key+':user:'+owner,'[]');
 assert.deepEqual(Aux.recoveryCandidates(s,owner,old),[]);
 assert.deepEqual(Aux.restoreMissing(s,owner,old),[]);
 for(const key of ['mlc2-measurements-v1','mlc2-local-daily-v1'])assert.equal(s.getItem(key+':user:'+owner),'[]');
});
