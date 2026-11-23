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
 const recovery=await engine.restore({confirmRestore:async()=>true});
 assert.equal(recovery.status,'conflict');
 assert.equal(recovery.restored,0);assert.equal(recovery.conflicts,1);
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

test('restores independent missing workouts despite a different same-ID workout on this iPhone',async()=>{
 const db=storage(),cloud=remote();
 const local=session('same',owner,100),unrelated=session('cloud-only',owner,75);
 Store.save(db,owner,[local]);
 cloud.rows.set(owner+'/same',{owner,type:'session',id:'same',revision:1,deleted:false,payload:session('same',owner,50)});
 cloud.rows.set(owner+'/cloud-only',{owner,type:'session',id:'cloud-only',revision:1,deleted:false,payload:unrelated});
 const engine=setup(db,cloud).engine;
 const preview=await engine.previewRecovery();
 assert.equal(preview.missing,1);
 assert.equal(preview.conflicts,1);
 assert.equal(preview.canRestore,true);
 let approvals=0;
 const result=await engine.restore({confirmRestore:async n=>{approvals++;assert.equal(n,1);return true}});
 assert.equal(approvals,1);
 assert.equal(result.status,'restored-with-conflicts');
 assert.equal(result.restored,1);
 assert.equal(result.conflicts,1);
 const rows=Store.read(db,owner);
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.id==='same').sets[0].weight,100,'local conflict unchanged');
 assert.equal(rows.find(x=>x.id==='cloud-only').sets[0].weight,75);
 assert.equal(cloud.rows.get(owner+'/same').payload.sets[0].weight,50,'remote conflict unchanged');
 assert.equal(cloud.commits,0,'recovery never uploaded or overwrote cloud data');
});
test('same-ID conflicts with no other missing workouts report the conflict without changing history',async()=>{
 const db=storage(),cloud=remote();
 Store.save(db,owner,[session('same',owner,100)]);
 cloud.rows.set(owner+'/same',{owner,type:'session',id:'same',revision:1,deleted:false,payload:session('same',owner,50)});
 const before=db.getItem(Store.key(owner));
 const report=await setup(db,cloud).engine.restore({confirmRestore:async()=>{throw Error('must not confirm')}});
 assert.equal(report.status,'conflict');
 assert.equal(report.restored,0);assert.equal(report.conflicts,1);
 assert.equal(db.getItem(Store.key(owner)),before);
});

test('older owned Supabase session without ownerId restores safely with account owner stamped locally',async()=>{
 const db=storage(),cloud=remote();
 const historic=session('legacy-four');
 delete historic.ownerId;
 cloud.rows.set(owner+'/legacy-four',{owner,type:'session',id:'legacy-four',revision:1,deleted:false,payload:historic});
 const eng=setup(db,cloud).engine;
 const preview=await eng.previewRecovery();
 assert.equal(preview.missing,1);
 assert.equal(preview.conflicts,0);
 const outcome=await eng.restore({confirmRestore:async n=>n===1});
 assert.equal(outcome.restored,1);
 const local=Store.read(db,owner);
 assert.equal(local[0].ownerId,owner);
 assert.equal(local[0].id,'legacy-four');
 assert.equal(cloud.rows.get(owner+'/legacy-four').payload.ownerId,undefined,'cloud version stays unchanged');
 assert.equal((await eng.flush()).status,'idle');
 assert.equal(cloud.commits,0,'normalized legacy session is not uploaded as a duplicate');
});
test('existing local workout matching older cloud format is not a conflict',async()=>{
 const db=storage(),cloud=remote(),recent=session('legacy-match');
 Store.save(db,owner,[recent]);
 const remoteCopy={...recent};delete remoteCopy.ownerId;
 cloud.rows.set(owner+'/legacy-match',{owner,type:'session',id:'legacy-match',revision:1,deleted:false,payload:remoteCopy});
 const report=await setup(db,cloud).engine.previewRecovery();
 assert.equal(report.conflicts,0);assert.equal(report.missing,0);
});
test('legacy record is rejected when its verified cloud owner differs from the signed-in account',async()=>{
 const db=storage(),cloud=remote(),historic=session('bad-owner');
 delete historic.ownerId;
 cloud.rows.set(owner+'/bad-owner',{owner:other,type:'session',id:'bad-owner',revision:1,deleted:false,payload:historic});
 const preview=await setup(db,cloud).engine.previewRecovery();
 assert.equal(preview.missing,0,'remote listing never exposes another owner');
 assert.equal(preview.conflicts,0);
 assert.deepEqual(Store.read(db,owner),[]);
});
test('historic record carrying a different ownerId is never claimed for this account',async()=>{
 const db=storage(),cloud=remote(),historic=session('foreign-payload',other);
 cloud.rows.set(owner+'/foreign-payload',{owner,type:'session',id:'foreign-payload',revision:1,deleted:false,payload:historic});
 const report=await setup(db,cloud).engine.previewRecovery();
 assert.equal(report.missing,0);assert.equal(report.conflicts,1);
 const response=await setup(db,cloud).engine.restore({confirmRestore:async()=>true});
 assert.equal(response.status,'conflict');assert.equal(Store.read(db,owner).length,0);
});

test('cloud workout arriving after restore confirmation needs a new explicit approval',async()=>{
 const db=storage(),cloud=remote();
 const first=session('cloud-first'),added=session('cloud-added');
 cloud.rows.set(owner+'/cloud-first',{owner,type:'session',id:first.id,revision:1,deleted:false,payload:first});
 const engine=setup(db,cloud).engine;
 let confirmed=0;
 const outcome=await engine.restore({confirmRestore:async count=>{
  confirmed++;
  assert.equal(count,1);
  cloud.rows.set(owner+'/cloud-added',{owner,type:'session',id:added.id,revision:1,deleted:false,payload:added});
  return true;
 }});
 assert.equal(confirmed,1);
 assert.equal(outcome.status,'changed-reconfirm');
 assert.equal(outcome.restored,0);
 assert.deepEqual(Store.read(db,owner),[],'new cloud records never enter the device without approval');
 assert.equal(cloud.commits,0);
 const next=await engine.restore({confirmRestore:async count=>count===2});
 assert.equal(next.restored,2);
 assert.equal(Store.read(db,owner).length,2);
});
test('rejected updated recovery list preserves existing user workouts',async()=>{
 const db=storage(),cloud=remote(),personal=session('my-own');
 Store.save(db,owner,[personal]);
 const first=session('cloud-first'),added=session('cloud-added');
 cloud.rows.set(owner+'/cloud-first',{owner,type:'session',id:first.id,revision:1,deleted:false,payload:first});
 const initial=db.getItem(Store.key(owner));
 const engine=setup(db,cloud).engine;
 const outcome=await engine.restore({confirmRestore:async()=> {
  cloud.rows.set(owner+'/cloud-added',{owner,type:'session',id:added.id,revision:1,deleted:false,payload:added});
  return true;
 }});
 assert.equal(outcome.status,'changed-reconfirm');
 assert.equal(db.getItem(Store.key(owner)),initial,'local records stay byte-for-byte unchanged');
});

test('large cloud history recovers across 20 full pages without truncating or duplicating',async()=>{
 const db=storage(),cloud=remote();
 for(let i=0;i<1001;i++){
  const id='history-'+String(i).padStart(4,'0');
  cloud.rows.set(owner+'/'+id,{owner,type:'session',id,revision:1,deleted:false,payload:session(id)});
 }
 const {engine}=setup(db,cloud);
 const outcome=await engine.restore({confirmRestore:count=>count===1001});
 const recovered=Store.read(db,owner);
 assert.equal(outcome.restored,1001);
 assert.equal(new Set(recovered.map(row=>row.id)).size,1001);
 assert.equal((await engine.previewRecovery()).missing,0);
 assert.equal(cloud.commits,0);
});

test('a newer version of the same cloud workout requires fresh recovery consent',async()=>{
 const db=storage(),cloud=remote(),rec=session('demo-updated');
 const key=owner+'/'+rec.id;
 cloud.rows.set(key,{owner,type:'session',id:rec.id,revision:1,deleted:false,payload:rec});
 const {engine}=setup(db,cloud);
 const result=await engine.restore({confirmRestore:()=>{
  cloud.rows.set(key,{...cloud.rows.get(key),revision:2,payload:session(rec.id,owner,75)});
  return true;
 }});
 assert.equal(result.status,'changed-reconfirm');
 assert.deepEqual(Store.read(db,owner),[]);
 assert.equal((await engine.restore({confirmRestore:()=>true})).restored,1);
 assert.equal(Store.read(db,owner)[0].sets[0].weight,75);
});

test('cleared local history cannot be recovered from an older cloud copy or uploaded by a pending retry',async()=>{
 const db=storage(),cloud=remote(),backed=session('demo-backed'),queued=session('demo-queued'),otherRecord=session('demo-other',other);
 Store.save(db,owner,[backed,queued]);Store.save(db,other,[otherRecord]);
 cloud.rows.set(owner+'/'+backed.id,{owner,type:'session',id:backed.id,revision:1,deleted:false,payload:backed});
 const {engine}=setup(db,cloud);
 engine.queue(queued);
 Store.clear(db,owner);
 const preview=await engine.previewRecovery();
 assert.equal(preview.canRestore,false);
 assert.equal((await engine.restore({confirmRestore:()=>{throw Error('removed record cannot be approved')}})).restored,0);
 assert.equal((await engine.flush()).uploaded,0);
 assert.equal(Journal.load(db,owner).items.length,0);
 assert.equal(cloud.commits,0);
 assert.ok(cloud.rows.has(owner+'/'+backed.id));
 assert.deepEqual(Store.read(db,other),[otherRecord]);
});
