'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const Store=require('../../sync/account-workout-store.js');
const Sync=require('../../sync/sync-journal.js');
const Workout=require('../../sync/automatic-workouts.js');
const Aux=require('../../sync/aux-data.js');
const AuxCloud=require('../../sync/auxiliary-cloud.js');
const Transport=require('../../sync/supabase-transport.js');

function memory(){
 const map=new Map();
 return {
  getItem:key=>map.get(key)??null,
  setItem:(key,value)=>map.set(key,String(value)),
  removeItem:key=>map.delete(key)
 };
}

// Scope the real recovery code to this run without changing application keys.
function scopedTransport(transport,prefix,sessionIds){
 const auxiliaryIds=new Map([
  ['custom-plan:snapshot-v1',prefix+'routine'],
  ['goal:weekly-schedule-v1',prefix+'schedule']
 ]);
 function remoteId(type,id){
  return type==='session'&&sessionIds.has(id)?id:auxiliaryIds.get(type+':'+id);
 }
 return {
  async listSessions(owner,{afterId='',limit=50}={}){
   const rows=await transport.listSessions(owner,{afterId:afterId||prefix,limit});
   return rows.filter(row=>sessionIds.has(row.id));
  },
  async read(type,id,owner){
   const remote=remoteId(type,id);
   if(!remote)return null;
   const row=await transport.read(type,remote,owner);
   return row&&{...row,id};
  },
  commit(op,owner){
   const id=remoteId(op.type,op.id);
   if(!id)throw Error('Refused a write outside the rehearsal record IDs');
   return transport.commit({...op,id},owner);
  }
 };
}

// Both identities must already be verified synthetic accounts.
async function rehearse(first,second,{requireDeletionFinality=true}={}){
 assert.notEqual(first.owner,second.owner,'Use distinct synthetic identities');
 const label=randomUUID();
 const prefix='synthetic-recovery-'+label+'-';
 const sessionIds=new Set([prefix+'active',prefix+'deleted']);
 [first,second]=[first,second].map(account=>({...account,
  transport:scopedTransport(account.transport,prefix,sessionIds)
 }));
 for(const {owner,transport} of [first,second]){
  for(const id of sessionIds){
   assert.equal(await transport.read('session',id,owner),null,'Generated workout ID already exists');
  }
  assert.equal(await transport.read('custom-plan','snapshot-v1',owner),null,'Generated routine ID already exists');
  assert.equal(await transport.read('goal','weekly-schedule-v1',owner),null,'Generated schedule ID already exists');
 }
 const make=({owner,transport},storage)=>{
  const options={owner,storage,Sync,transport,verify:async()=>({userId:owner}),active:()=>owner};
  return {workouts:Workout.create({...options,accountStore:Store}),auxiliary:AuxCloud.create({...options,aux:Aux})};
 };
 const writer=memory(),reader=memory(),stale=memory();
 const {owner,transport}=first;
 const active={id:prefix+'active',ownerId:owner,title:'Synthetic session',created:'2026-11-22T12:30:00Z',
  planId:'fixture-plan',sets:[{exerciseId:'bench-press',weight:80,reps:5}]};
 const deleted={...active,id:prefix+'deleted'};
 const routineKey='mlc2-custom-plans-v1:user:'+owner;
 const scheduleKey='mlc2-weekly-schedule-v1:user:'+owner;
 const workout={id:'custom-synthetic-'+label,title:'Synthetic routine',ids:['bench-press']};
 const schedule={'1':workout.id,'2':'rest-day'};
 Store.save(writer,owner,[active,deleted]);
 writer.setItem(routineKey,JSON.stringify([workout]));
 writer.setItem(scheduleKey,JSON.stringify(schedule));
 const source=make(first,writer);
 assert.equal((await source.workouts.flush()).uploaded,2);
 assert.equal((await source.auxiliary.backup()).uploaded,2);
 const gone=await transport.read('session',deleted.id,owner);
 const deletion={owner,opId:randomUUID(),type:'session',id:deleted.id,baseRevision:gone.revision,kind:'delete'};
 const acknowledged=await transport.commit(deletion,owner);
 const tombstone=await transport.read('session',deleted.id,owner);
 assert.equal(tombstone.deleted,true);
 assert.deepEqual(await transport.commit(deletion,owner),acknowledged,'Exact receipt retry must return the original revision');
 assert.deepEqual(await transport.read('session',deleted.id,owner),tombstone);

 const absent=make(second,memory());
 assert.equal(await second.transport.read('session',active.id,second.owner),null);
 assert.equal(await second.transport.read('custom-plan','snapshot-v1',second.owner),null);
 assert.equal(await second.transport.read('goal','weekly-schedule-v1',second.owner),null);
 assert.equal((await absent.workouts.previewRecovery()).missing,0);
 assert.deepEqual((await absent.auxiliary.previewRecovery()).missing,[]);

 const fresh=make(first,reader);
 assert.equal((await fresh.workouts.previewRecovery()).missing,1);
 assert.deepEqual(Store.read(reader,owner),[]);
 const before=await Promise.all([
  transport.listSessions(owner),
  transport.read('custom-plan','snapshot-v1',owner),
  transport.read('goal','weekly-schedule-v1',owner)
 ]);
 assert.equal((await fresh.workouts.restore({confirmRestore:()=>true})).restored,1);
 assert.deepEqual(Store.read(reader,owner),[active],'Recovery must preserve sets and exclude tombstones');
 assert.deepEqual((await fresh.auxiliary.restore({confirmRestore:()=>true})).restored,[
  'Custom workouts','Weekly workout schedule'
 ]);
 assert.deepEqual(JSON.parse(reader.getItem(routineKey)),[workout]);
 assert.deepEqual(JSON.parse(reader.getItem(scheduleKey)),schedule);

 stale.setItem(routineKey,JSON.stringify([{...workout,title:'Stale routine'}]));
 assert.equal((await make(first,stale).auxiliary.backup()).status,'conflict');
 await assert.rejects(transport.commit({owner,opId:randomUUID(),type:'session',id:deleted.id,
  baseRevision:gone.revision,kind:'upsert',payload:deleted},owner),{code:'CONFLICT'});
 if(requireDeletionFinality){
  await assert.rejects(transport.commit({owner,opId:randomUUID(),type:'session',id:deleted.id,
   baseRevision:tombstone.revision,kind:'upsert',payload:deleted},owner),{code:'CONFLICT'});
  assert.deepEqual(await transport.read('session',deleted.id,owner),tombstone);
 }
 assert.deepEqual(await Promise.all([
  transport.listSessions(owner),
  transport.read('custom-plan','snapshot-v1',owner),
  transport.read('goal','weekly-schedule-v1',owner)
 ]),before,'Recovery and a stale backup must leave the original revisions unchanged');

 // Tombstone the remaining fixtures so they are not offered by future recovery.
 for(const row of [before[0].find(session=>session.id===active.id),before[1],before[2]]){
  await transport.commit({owner,opId:randomUUID(),type:row.type,id:row.id,baseRevision:row.revision,kind:'delete'},owner);
  assert.equal((await transport.read(row.type,row.id,owner)).deleted,true);
 }
 const afterCleanup=make(first,memory());
 assert.equal((await afterCleanup.workouts.previewRecovery()).missing,0);
 assert.deepEqual((await afterCleanup.auxiliary.previewRecovery()).missing,[]);
 return {accountIsolation:true,workoutHistory:true,customRoutines:true,weeklySchedules:true,
  deletedRecordsExcluded:true,backupIntegrity:true,receiptReplay:true,staleRevisionRejected:true,
  deletedIdReuseRejected:requireDeletionFinality};
}

async function verifyHosted({baseUrl,key,accounts,fetcher=fetch}){
 assert.match(baseUrl,/^https:\/\/[a-z0-9]+\.supabase\.co$/);
 assert.match(key,/^sb_publishable_[a-zA-Z0-9_-]+$/);
 assert.equal(accounts.length,2);
 const verified=[];
 for(const {owner,accessToken} of accounts){
  assert.match(owner,/^[a-f0-9-]{36}$/i);
  if(!accessToken)throw Error('Preprovisioned synthetic account sessions are required');
  const result=await fetcher(baseUrl+'/auth/v1/user',{
   headers:{apikey:key,Authorization:'Bearer '+accessToken},redirect:'error',signal:AbortSignal.timeout(10000)
  });
  if(!result.ok)throw Error('Hosted synthetic identity verification failed ('+result.status+')');
  const user=await result.json();
  if(user.id!==owner||user.app_metadata?.mlc2_synthetic_recovery!==true)
   throw Error('Hosted account must have the server-owned synthetic recovery marker');
  verified.push({owner,transport:Transport.create({
   baseUrl,publishableKey:key,enabled:true,getVerifiedAuth:async()=>({userId:owner,accessToken}),
   fetcher:(url,options)=>fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)})
  })});
 }
 return rehearse(...verified);
}
if(require.main===module){
 const env=process.env;
 verifyHosted({baseUrl:env.MLC2_HOSTED_URL||'',key:env.MLC2_HOSTED_PUBLISHABLE_KEY||'',accounts:[
  {owner:env.MLC2_SYNTHETIC_A_UUID||'',accessToken:env.MLC2_SYNTHETIC_A_ACCESS},
  {owner:env.MLC2_SYNTHETIC_B_UUID||'',accessToken:env.MLC2_SYNTHETIC_B_ACCESS}
 ]}).then(result=>console.log(JSON.stringify(result))).catch(()=>{
  console.error('Hosted recovery verification stopped. Check the synthetic runner configuration and recovery assertions.');
  process.exitCode=1;
 });
}
module.exports={rehearse,verifyHosted};
