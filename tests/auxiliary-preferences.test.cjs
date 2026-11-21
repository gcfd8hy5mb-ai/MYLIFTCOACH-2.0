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
 one.setItem(selected,'custom-press');
 one.setItem(schedule,JSON.stringify({'1':'custom-press','3':'upper-a'}));
 one.setItem(weekly,'5');
 one.setItem(readiness,JSON.stringify({'2026-11-21:upper-a':'Great'}));
 const upload=await engine(one,remote).backup();
 assert.equal(upload.uploaded,4);
 assert.equal(remote.records.size,4);
 assert.equal((await engine(one,remote).backup()).uploaded,0);
 const restore=await engine(two,remote).restore({confirmRestore:async()=>true});
 assert.equal(restore.restored.length,4);
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
  payload:Aux.payload('custom-press')};
 const broken={getItem:k=>s.getItem(k),setItem:(k,v)=>{s.setItem(k,'damaged')},removeItem:k=>s.removeItem(k)};
 assert.throws(()=>Aux.restoreMissing(broken,owner,[record]),/write failed/);
 assert.equal(s.getItem(selected),null);
});
