'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const AuxCloud=require('../sync/auxiliary-cloud.js');
const Aux=require('../sync/aux-data.js');
const Journal=require('../sync/sync-journal.js');
const owner='account-a',other='account-b';
let seq=0;
const Sync={create:config=>Journal.create({...config,makeId:()=>('00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'))})};
const storage=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const records=()=>{
 const m=new Map();let commits=0;
 return {m,get commits(){return commits},
 async read(type,id,who){return m.get(who+'/'+type+'/'+id)||null},
 async commit(op,who){commits++;const key=who+'/'+op.type+'/'+op.id,prev=m.get(key);
  if(prev)throw Object.assign(Error('Conflict'),{status:409});
  const revision=1;m.set(key,{owner:who,type:op.type,id:op.id,revision,deleted:false,payload:op.payload});
  return {owner:who,opId:op.opId,revision};
 }};
};
const engine=(s,t,active=()=>owner,online=()=>true)=>AuxCloud.create({
 owner,storage:s,aux:Aux,Sync,transport:t,verify:async()=>({userId:owner}),active,online
});
const tracking=[{id:'water-1',type:'water',day:'2026-11-21',value:500}];
test('opt-in backup uploads only populated owner categories',async()=>{
 const s=storage(),t=records();
 s.setItem('mlc2-local-daily-v1:user:'+owner,JSON.stringify(tracking));
 s.setItem('mlc2-local-daily-v1:user:'+other,JSON.stringify([{id:'foreign'}]));
 const result=await engine(s,t).backup();
 assert.equal(result.uploaded,1);assert.equal(t.commits,1);
 assert.deepEqual(t.m.get(owner+'/tracking/snapshot-v1').payload.entries,tracking);
 assert.equal((await engine(s,t).backup()).uploaded,0);
});
test('different cloud snapshot blocks new backups before any uploads',async()=>{
 const s=storage(),t=records();
 s.setItem('mlc2-local-daily-v1:user:'+owner,JSON.stringify(tracking));
 s.setItem('mlc2-custom-plans-v1:user:'+owner,JSON.stringify([{id:'custom-test',title:'Test',ids:['press']}]));
 t.m.set(owner+'/tracking/snapshot-v1',{owner,type:'tracking',id:'snapshot-v1',revision:1,deleted:false,
  payload:Aux.payload([{id:'other-log'}])});
 const result=await engine(s,t).backup();
 assert.equal(result.status,'conflict');assert.equal(result.queued,0);assert.equal(t.commits,0);
 assert.equal(Journal.load(s,owner).items.length,0);
});
test('fill-only recovery restores missing categories and never overwrites populated ones',async()=>{
 const s=storage(),t=records();s.setItem('mlc2-local-daily-v1:user:'+owner,JSON.stringify(tracking));
 t.m.set(owner+'/tracking/snapshot-v1',{owner,type:'tracking',id:'snapshot-v1',revision:1,deleted:false,
  payload:Aux.payload([{id:'cloud-water',type:'water',day:'2026-11-20',value:250}])});
 t.m.set(owner+'/custom-plan/snapshot-v1',{owner,type:'custom-plan',id:'snapshot-v1',revision:1,deleted:false,
  payload:Aux.payload([{id:'custom-1',title:'Plan',ids:['press']}])});
 const result=await engine(s,t).restore({confirmRestore:async()=>true});
 assert.deepEqual(result.restored,['Custom workouts']);
 assert.deepEqual(JSON.parse(s.getItem('mlc2-local-daily-v1:user:'+owner)),tracking);
 assert.equal(t.commits,0);
});
test('account switch during confirmation blocks all recovery',async()=>{
 const s=storage(),t=records();let active=owner;
 t.m.set(owner+'/tracking/snapshot-v1',{owner,type:'tracking',id:'snapshot-v1',revision:1,deleted:false,
  payload:Aux.payload(tracking)});
 await assert.rejects(engine(s,t,()=>active).restore({confirmRestore:async()=>{active=other;return true}}),/Account changed/);
 assert.equal(s.getItem('mlc2-local-daily-v1:user:'+owner),null);
});
test('offline backup does not access cloud or create a journal',async()=>{
 const s=storage(),t=records();
 assert.equal((await engine(s,t,()=>owner,()=>false).backup()).status,'offline');
 assert.equal(t.commits,0);assert.equal(Journal.load(s,owner).items.length,0);
});

test('new cloud fitness category after approval requires reconfirmation before any local recovery',async()=>{
 const db=storage(),cloud=records();
 cloud.m.set(owner+'/tracking/snapshot-v1',{owner,type:'tracking',id:'snapshot-v1',revision:1,deleted:false,payload:Aux.payload(tracking)});
 const plan=[{id:'custom-new',title:'New',ids:['press']}];
 const eng=engine(db,cloud);
 const result=await eng.restore({confirmRestore:async labels=>{
  assert.deepEqual(labels,['Water and weight tracking']);
  cloud.m.set(owner+'/custom-plan/snapshot-v1',{owner,type:'custom-plan',id:'snapshot-v1',revision:1,deleted:false,payload:Aux.payload(plan)});
  return true;
 }});
 assert.equal(result.status,'changed-reconfirm');
 assert.deepEqual(result.restored,[]);
 assert.equal(db.getItem('mlc2-local-daily-v1:user:'+owner),null);
 assert.equal(db.getItem('mlc2-custom-plans-v1:user:'+owner),null);
 const after=await eng.restore({confirmRestore:async labels=>labels.includes('Custom workouts')&&labels.includes('Water and weight tracking')});
 assert.equal(after.status,'restored');
 assert.ok(after.restored.includes('Custom workouts'));
 assert.ok(after.restored.includes('Water and weight tracking'));
});
