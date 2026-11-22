'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,PREFIX}=require('../sync/sync-journal.js');

function localStore(){
 const map=new Map();
 return {
  map,
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>{map.set(key,String(value))},
  removeItem:key=>map.delete(key)
 };
}
function fakeServer(){
 const rows=new Map(),receipts=new Map(),calls=[];
 return {
  rows,receipts,calls,
  async commit(op,verifiedOwner){
   calls.push(op);
   if(op.owner!==verifiedOwner)throw Object.assign(Error('Unauthorized owner'),{status:403});
   const receiptKey=verifiedOwner+'/'+op.opId;
   if(receipts.has(receiptKey)){
    const prev=receipts.get(receiptKey);
    if(JSON.stringify(prev.operation)!==JSON.stringify({type:op.type,id:op.id,kind:op.kind,baseRevision:op.baseRevision,payload:op.payload}))throw Error('Reused operation ID');
    return prev.ack;
   }
   const rowKey=verifiedOwner+'/'+op.type+'/'+op.id;
   const row=rows.get(rowKey);
   if((row?.revision||0)!==op.baseRevision)throw Object.assign(Error('CONFLICT'),{status:409,revision:row?.revision||0});
   if(op.kind==='delete'&&!row)throw Object.assign(Error('CONFLICT'),{status:409});
   const revision=op.baseRevision+1,ack={owner:verifiedOwner,opId:op.opId,revision};
   rows.set(rowKey,{revision,deleted:op.kind==='delete',payload:op.kind==='delete'?null:op.payload});
   receipts.set(receiptKey,{operation:{type:op.type,id:op.id,kind:op.kind,baseRevision:op.baseRevision,payload:op.payload},ack});
   return ack;
  }
 };
}
let counter=0;
const id=()=>('op-'+String(++counter).padStart(6,'0'));
test('sync engine is inert by default even with transport and verified owner',async()=>{
 const store=localStore(),cloud=fakeServer(),engine=create({owner:'a',storage:store,transport:cloud,makeId:id});
 engine.enqueue('session','s1',{sets:[{weight:40,reps:10}]});
 assert.equal(engine.list().items.length,1);
 assert.equal((await engine.drain({verifiedOwner:'a'})).status,'disabled');
 assert.equal(cloud.calls.length,0);
});
test('write-ahead queue survives recreation and network errors without changing op id',async()=>{
 const store=localStore(),cloud=fakeServer();let fail=true;
 const transport={commit:async(...args)=>{if(fail)throw Error('offline');return cloud.commit(...args)}};
 const engine=create({owner:'a',storage:store,transport,enabled:true,makeId:id});
 const op=engine.enqueue('session','s2',{sets:[{weight:40,reps:10}]});
 const res=await engine.drain({verifiedOwner:'a'});
 assert.equal(res.status,'retry');
 assert.equal(engine.list().items[0].opId,op.opId);
 fail=false;
 const restored=create({owner:'a',storage:store,transport,enabled:true,makeId:id});
 assert.equal((await restored.drain({verifiedOwner:'a'})).status,'idle');
 assert.equal(cloud.rows.get('a/session/s2').revision,1);
 assert.equal(restored.list().items.length,0);
});
test('one owner cannot flush another owners operations',async()=>{
 const store=localStore(),cloud=fakeServer();
 const a=create({owner:'a',storage:store,transport:cloud,enabled:true,makeId:id});
 a.enqueue('meal','meal1',{calories:600});
 assert.equal((await a.drain({verifiedOwner:'b'})).status,'owner-unverified');
 const b=create({owner:'b',storage:store,transport:cloud,enabled:true,makeId:id});
 assert.equal(b.list().items.length,0);
 assert.equal(cloud.calls.length,0);
});
test('duplicate server acknowledgement after interrupted local receipt is idempotent',async()=>{
 const store=localStore(),cloud=fakeServer();let blockAck=true;
 const transport={commit:async(op,owner)=>{
  const ack=await cloud.commit(op,owner);
  if(blockAck)throw Error('connection dropped before response');
  return ack;
 }};
 const e=create({owner:'a',storage:store,transport,enabled:true,makeId:id});
 const op=e.enqueue('session','s3',{sets:[{weight:60,reps:8}]});
 assert.equal((await e.drain({verifiedOwner:'a'})).status,'retry');
 blockAck=false;
 assert.equal((await e.drain({verifiedOwner:'a'})).status,'idle');
 assert.equal(cloud.rows.get('a/session/s3').revision,1);
 assert.equal(cloud.receipts.size,1);
 assert.equal(cloud.calls[0].opId,op.opId);
 assert.equal(cloud.calls[1].opId,op.opId);
});
test('stale base revision is held as conflict, not overwritten automatically',async()=>{
 const store=localStore(),cloud=fakeServer();
 const a=create({owner:'a',storage:store,transport:cloud,enabled:true,makeId:id});
 a.enqueue('tracking','water-1',{ml:200},0);
 assert.equal((await a.drain({verifiedOwner:'a'})).status,'idle');
 const b=create({owner:'a',storage:localStore(),transport:cloud,enabled:true,makeId:id});
 b.enqueue('tracking','water-1',{ml:900},0);
 assert.equal((await b.drain({verifiedOwner:'a'})).status,'conflict');
 assert.equal(cloud.rows.get('a/tracking/water-1').payload.ml,200);
 assert.equal(b.list().conflicts.length,1);
 assert.equal((await b.drain({verifiedOwner:'a'})).status,'conflict');
 b.resolveConflict(b.list().items[0].opId,{strategy:'keep-server'});
 assert.equal(b.list().items.length,0);
});
test('explicit tombstone requires known revision, never silently deletes records',async()=>{
 const cloud=fakeServer(),e=create({owner:'a',storage:localStore(),transport:cloud,enabled:true,makeId:id});
 assert.throws(()=>e.enqueueDelete('meal','m1',0),/known server revision/);
 e.enqueue('meal','m1',{food:'eggs'});
 await e.drain({verifiedOwner:'a'});
 e.enqueueDelete('meal','m1',1);
 assert.equal((await e.drain({verifiedOwner:'a'})).status,'idle');
 assert.deepEqual(cloud.rows.get('a/meal/m1'),{revision:2,deleted:true,payload:null});
});
test('storage-denied writes never mutate queue memory or send network requests',async()=>{
 const cloud=fakeServer(),store=localStore(),e=create({owner:'a',storage:store,transport:cloud,enabled:true,makeId:id});
 const old=store.setItem;store.setItem=()=>{throw Error('quota exceeded')};
 assert.throws(()=>e.enqueue('session','s4',{sets:[]}),/quota exceeded/);
 assert.equal(e.list().items.length,0);
 assert.equal(cloud.calls.length,0);
 store.setItem=old;
});
test('untrusted or corrupt journals must not be silently overwritten',()=>{
 const store=localStore();store.setItem(PREFIX+'a','{bad');
 assert.throws(()=>create({owner:'a',storage:store,makeId:id}),/Journal unreadable/);
 assert.equal(store.getItem(PREFIX+'a'),'{bad');
});
test('ack is validated before an operation is removed',async()=>{
 const store=localStore(),transport={commit:async()=>({owner:'someone-else',opId:'fake',revision:1})};
 const e=create({owner:'a',storage:store,enabled:true,transport,makeId:id});
 e.enqueue('goal','g1',{calories:2100});
 assert.equal((await e.drain({verifiedOwner:'a'})).status,'unverified-ack');
 assert.equal(e.list().items.length,1);
});
test('invalid operations are rejected',()=>{
 const e=create({owner:'a',storage:localStore(),makeId:id});
 assert.throws(()=>e.enqueue('token','password',{password:'123'}),/Unsupported/);
 assert.throws(()=>e.enqueue('session','bad id',{sets:[]}),/Unsupported/);
 assert.throws(()=>e.enqueue('session','s',{a:1},-1),/base revision/);
 assert.throws(()=>create({owner:'../../other',storage:localStore()}),/owner ID/);
});

test('remote inspection does not overwrite pending local changes',async()=>{
 const store=localStore(),cloud=fakeServer();
 const engine=create({owner:'a',storage:store,enabled:true,transport:{
  ...cloud,
  read:async(type,id,owner)=>{
   const row=cloud.rows.get(owner+'/'+type+'/'+id);
   return row?{owner,type,id,revision:row.revision,payload:row.payload,deleted:row.deleted}:null;
  }
 },makeId:id});
 engine.enqueue('session','s5',{sets:[{weight:80,reps:10}]});
 const copy=await engine.inspectRemote('session','s5',{verifiedOwner:'a'});
 assert.equal(copy.status,'not-found');
 assert.equal(engine.list().items.length,1);
 assert.equal((await engine.inspectRemote('session','s5',{verifiedOwner:'b'})).status,'owner-unverified');
 const saved=engine.list();
 assert.deepEqual(engine.list(),saved,'Inspecting remote rows must not touch the local journal');
});
test('read-only recovery verifies remote account, revision and record identity',async()=>{
 const e=create({owner:'a',storage:localStore(),enabled:true,transport:{
  read:async()=>({owner:'b',type:'session',id:'s6',revision:1,payload:{sets:[]},deleted:false})
 },makeId:id});
 await assert.rejects(e.inspectRemote('session','s6',{verifiedOwner:'a'}),/Unverified remote record/);
});

test('two devices can inspect the same saved cloud record without silently replacing local history',async()=>{
 const server=fakeServer(),firstStorage=localStore(),secondStorage=localStore();
 const transport={commit:(op,owner)=>server.commit(op,owner),read:async(type,id,owner)=>{
  const data=server.rows.get(owner+'/'+type+'/'+id);
  return data?{owner,type,id,revision:data.revision,payload:data.payload,deleted:data.deleted}:null;
 }};
 const deviceA=create({owner:'athlete-a',storage:firstStorage,transport,enabled:true,makeId:id});
 deviceA.enqueue('session','week-1',{sets:[{weight:75,reps:10}]});
 assert.equal((await deviceA.drain({verifiedOwner:'athlete-a'})).status,'idle');
 const deviceB=create({owner:'athlete-a',storage:secondStorage,transport,enabled:true,makeId:id});
 const remote=await deviceB.inspectRemote('session','week-1',{verifiedOwner:'athlete-a'});
 assert.equal(remote.status,'read-only');
 assert.equal(remote.record.revision,1);
 assert.equal(remote.record.payload.sets[0].weight,75);
 assert.equal(secondStorage.getItem(PREFIX+'athlete-a'),null,'Reading cloud history cannot overwrite device data');
 deviceB.enqueue('session','week-1',{sets:[{weight:85,reps:12}]},0);
 assert.equal((await deviceB.drain({verifiedOwner:'athlete-a'})).status,'conflict');
 assert.equal(server.rows.get('athlete-a/session/week-1').payload.sets[0].weight,75);
});

test('an acknowledgement retains operations enqueued by another journal while awaiting transport',async()=>{
 const db=new Map();
 const storage={getItem:key=>db.get(key)??null,setItem:(key,value)=>db.set(key,value)};
 const opts={owner:'member',storage};
 const transport={async commit(op){
  create({...opts,makeId:()=> 'op-two'}).enqueue('tracking','second',{entries:[]});
  return {owner:op.owner,opId:op.opId,revision:1};
 }};
 const journal=create({...opts,transport,enabled:true,makeId:()=> 'op-one'});
 journal.enqueue('session','first',{});
 await journal.drain({verifiedOwner:'member',types:['session']});
 assert.deepEqual(journal.list().items.map(op=>op.id),['second']);
});
