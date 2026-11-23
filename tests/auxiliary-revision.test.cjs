'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const AuxCloud=require('../sync/auxiliary-cloud.js'),Aux=require('../sync/aux-data.js');
const Journal=require('../sync/sync-journal.js');
const owner='account-a';let counter=0;
const Sync={create:o=>Journal.create({...o,makeId:()=>('00000000-0000-4000-8000-'+String(++counter).padStart(12,'0'))})};
const key='mlc2-local-daily-v1:user:'+owner;
const data=id=>[{id,type:'water',day:'2026-11-21',value:400}];
function store(){const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
function cloud(){const rows=new Map(),receipts=new Map();let writes=0;
 return {rows,get writes(){return writes},async read(type,id,who){return rows.get(who+'/'+type+'/'+id)||null},
 async commit(op,who){const k=who+'/'+op.type+'/'+op.id;
  if(receipts.has(op.opId))return receipts.get(op.opId);
  const previous=rows.get(k),revision=previous?.revision||0;
  if(revision!==op.baseRevision)throw Object.assign(Error('Revision conflict'),{status:409});
  writes++;rows.set(k,{owner:who,type:op.type,id:op.id,revision:revision+1,
   deleted:false,payload:op.payload});
  const ack={owner:who,opId:op.opId,revision:revision+1};
  receipts.set(op.opId,ack);return ack;
 }};
}
const make=(s,c)=>AuxCloud.create({owner,storage:s,aux:Aux,Sync,transport:c,
 verify:async()=>({userId:owner}),active:()=>owner});
test('repeat backup updates changed tracking data using confirmed server revision',async()=>{
 const s=store(),c=cloud();s.setItem(key,JSON.stringify(data('one')));
 assert.equal((await make(s,c).backup()).uploaded,1);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').revision,1);
 s.setItem(key,JSON.stringify([...data('one'),...data('two')]));
 const second=await make(s,c).backup();
 assert.equal(second.uploaded,1);assert.equal(second.conflicts,0);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').revision,2);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').payload.entries.length,2);
 assert.equal((await make(s,c).backup()).uploaded,0);
 assert.equal(c.writes,2);
});
test('another device with no confirmed baseline cannot overwrite remote fitness history',async()=>{
 const a=store(),b=store(),c=cloud();a.setItem(key,JSON.stringify(data('a')));
 await make(a,c).backup();
 b.setItem(key,JSON.stringify(data('b')));
 const result=await make(b,c).backup();
 assert.equal(result.status,'conflict');assert.equal(c.writes,1);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').payload.entries[0].id,'a');
});
test('stale device cannot overwrite a newer remote revision',async()=>{
 const a=store(),b=store(),c=cloud();a.setItem(key,JSON.stringify(data('a')));
 await make(a,c).backup();
 b.setItem(key,JSON.stringify(data('a')));await make(b,c).backup();
 a.setItem(key,JSON.stringify(data('new-a')));await make(a,c).backup();
 b.setItem(key,JSON.stringify(data('new-b')));
 const result=await make(b,c).backup();
 assert.equal(result.status,'conflict');assert.equal(c.writes,2);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').payload.entries[0].id,'new-a');
});
test('corrupt local confirmed baseline cannot authorize an overwrite',async()=>{
 const s=store(),c=cloud();s.setItem(key,JSON.stringify(data('a')));
 await make(s,c).backup();s.setItem(key,JSON.stringify(data('b')));
 s.setItem(AuxCloud.BASELINE_PREFIX+owner+':tracking:snapshot-v1','{broken');
 await assert.rejects(make(s,c).backup(),/baseline unreadable/);
 assert.equal(c.writes,1);
});
test('revision race is blocked by database-style optimistic conflict',async()=>{
 const s=store(),c=cloud();s.setItem(key,JSON.stringify(data('a')));
 await make(s,c).backup();s.setItem(key,JSON.stringify(data('b')));
 const originalRead=c.read;let raced=false;
 c.read=async(...args)=>{
  const result=await originalRead(...args);
  if(!raced&&args[0]==='tracking'){
   raced=true;const old=c.rows.get(owner+'/tracking/snapshot-v1');
   c.rows.set(owner+'/tracking/snapshot-v1',{...old,revision:old.revision+1,
    payload:Aux.payload(data('other-device'))});
  }
  return result;
 };
 const result=await make(s,c).backup();
 assert.equal(result.status,'conflict');
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').payload.entries[0].id,'other-device');
});
test('a local edit after a lost cloud acknowledgement can advance the confirmed revision',async()=>{
 const s=store(),c=cloud();
 s.setItem(key,JSON.stringify(data('original')));
 const commit=c.commit;
 c.commit=async(...args)=>{
  await commit(...args);
  throw Error('Connection lost after commit');
 };
 assert.equal((await make(s,c).backup()).status,'retry');
 c.commit=commit;
 s.setItem(key,JSON.stringify(data('edited')));
 const result=await make(s,c).backup();
 assert.equal(result.uploaded,1);
 assert.equal(result.pending,0);
 assert.equal(c.writes,2);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').payload.entries[0].id,'edited');
});

test('an uncommitted retry is superseded by the latest local data without uploading the stale value',async()=>{
 const s=store(),c=cloud(),commit=c.commit;
 s.setItem(key,JSON.stringify(data('old')));
 c.commit=async()=>{throw Error('Connection lost before commit')};
 assert.equal((await make(s,c).backup()).status,'retry');
 s.setItem(key,JSON.stringify(data('latest')));
 c.commit=commit;
 assert.equal((await make(s,c).backup()).uploaded,1);
 assert.equal(c.writes,1);
 assert.equal(c.rows.get(owner+'/tracking/snapshot-v1').payload.entries[0].id,'latest');
});

test('a local clear during an earlier cloud commit keeps the later stale schedule out of the batch',async()=>{
 const s=store(),c=cloud(),commit=c.commit;
 const weekly='mlc2-weekly-schedule-v1:user:'+owner;
 s.setItem(key,JSON.stringify(data('tracking')));
 s.setItem(weekly,JSON.stringify({'1':'custom-first'}));
 c.commit=async(op,who)=>{
  if(op.type==='tracking')s.setItem(weekly,'{}');
  return commit(op,who);
 };
 const first=await make(s,c).backup();
 const remoteKey=owner+'/goal/weekly-schedule-v1';
 assert.equal(first.uploaded,1);
 assert.equal(c.rows.has(remoteKey),false);
 assert.equal(first.pending,1);
 assert.equal((await make(s,c).backup()).pending,0);
 assert.equal(c.rows.has(remoteKey),false);
 assert.equal(s.getItem(weekly),'{}');
});
