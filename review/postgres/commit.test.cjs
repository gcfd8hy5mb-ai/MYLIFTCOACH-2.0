'use strict';
const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const sql=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const fixture=sql('schema.sql');
const patch=sql('../mlc2-commit-tombstones.sql');
const rollback=sql('../mlc2-commit-tombstones.rollback.sql');
const one='00000000-0000-4000-8000-000000000001';
const two='00000000-0000-4000-8000-000000000002';
let db,sequence=10;
const operation=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
before(async()=>{
 db=await PGlite.create();
 await db.exec(fixture);
 await db.exec(sql('live-read-fixture.sql'));
 await db.exec(rollback.slice(rollback.indexOf('CREATE OR REPLACE FUNCTION'),rollback.lastIndexOf('commit;')));
 await db.exec(patch);
});
after(async()=>db?.close());
async function role(name,user=''){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 if(name==='authenticated')await db.exec('set role authenticated');
 if(name==='anon')await db.exec('set role anon');
}
async function commit(type,id,revision,{deleted=false,op=operation(),value={fixture:true}}={}){
 const {rows}=await db.query('select public.mlc2_v1_commit($1,$2,$3,$4,$5,$6) result',
  [op,type,id,revision,deleted,value]);
 return rows[0].result;
}

test('migration preserves restricted grants, and the RPC requires a verified owner',async()=>{
 await role('anon');
 await assert.rejects(commit('session','no-anon',0),{code:'42501'});
 await role('authenticated');
 await assert.rejects(commit('session','no-owner',0),{code:'42501'});
 await role('authenticated',one);
 assert.equal((await commit('session','owned',0)).owner,one);
 await role('authenticated',two);
 const visible=await db.query("select record_id from mlc2_private.records where record_id='owned'");
 assert.deepEqual(visible.rows,[]);
 assert.equal((await commit('session','owned',0)).owner,two);
});

test('deletion is final for every workout and schedule record class',async()=>{
 await role('authenticated',one);
 for(const [type,id] of [['session','workout'],['custom-plan','snapshot-v1'],
  ['goal','weekly-schedule-v1'],['goal','selected-workout-v1']]){
  const original=operation();
  assert.equal((await commit(type,id,0,{op:original})).revision,1);
  const deletion=operation();
  assert.equal((await commit(type,id,1,{deleted:true,op:deletion})).revision,2);
  await assert.rejects(commit(type,id,1),{code:'PT409'});
  await assert.rejects(commit(type,id,2),{code:'PT409'});
  const retry=await commit(type,id,1,{deleted:true,op:deletion});
  assert.equal(retry.replayed,true);
  assert.equal(retry.revision,2);
  const originalRetry=await commit(type,id,0,{op:original});
  assert.equal(originalRetry.replayed,true);
  assert.equal(originalRetry.revision,1);
  const {rows}=await db.query('select revision, deleted_at is not null as deleted from mlc2_private.records where record_type=$1 and record_id=$2',[type,id]);
  assert.deepEqual(rows,[{revision:2,deleted:true}]);
 }
});

test('conflicting backup revisions preserve the latest payload, and interruption rolls back record and receipt',async()=>{
 await role('authenticated',two);
 assert.equal((await commit('goal','schedule-update',0)).revision,1);
 const interrupted=operation();
 await db.exec('begin');
 assert.equal((await commit('goal','schedule-update',1,{op:interrupted,value:{draft:true}})).revision,2);
 await db.exec('rollback');
 const retried=await commit('goal','schedule-update',1,{op:interrupted,value:{draft:true}});
 assert.equal(retried.replayed,false);
 assert.equal(retried.revision,2);
 await assert.rejects(commit('goal','schedule-update',1,{value:{stale:true}}),{code:'PT409'});
 await assert.rejects(commit('goal','schedule-update',1,{op:interrupted,value:{changed:true}}),{code:'22023'});
 const {rows}=await db.query("select payload from mlc2_private.records where record_id='schedule-update'");
 assert.deepEqual(rows,[{payload:{draft:true}}]);
});

test('rollback and forward reapply preserve row counts, tombstones and execution grants',async()=>{
 await role(null);
 const counts=() => db.query('select count(*) total, count(deleted_at) deleted from mlc2_private.records');
 const before=(await counts()).rows;
 await db.exec(rollback);
 assert.deepEqual((await counts()).rows,before);
 await role('anon');
 await assert.rejects(commit('session','no-anon',0),{code:'42501'});
 await role(null);
 await db.exec(patch);
 assert.deepEqual((await counts()).rows,before);
});

test('forward and rollback refuse body or function-option drift with matching signature and grants',async()=>{
 await role(null);
 const signature='public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb)';
 const definition=async()=>(await db.query('select pg_get_functiondef($1::regprocedure) as ddl',[signature])).rows[0].ddl;
 await db.exec(rollback);
 for(const [migration,drift] of [
  [patch,ddl=>ddl.replace('declare','declare\n -- synthetic drift')],
  [patch,()=>`ALTER FUNCTION ${signature} SET statement_timeout = '20s'`]
 ]){
  const reviewed=await definition();
  await db.exec(drift(reviewed));
  const drifted=await definition();
  await assert.rejects(db.exec(migration),/definition differs from the reviewed baseline/);
  await db.exec('rollback');
  assert.equal(await definition(),drifted);
  await db.exec(reviewed);
 }
 await db.exec(patch);
 const reviewed=await definition();
 await db.exec(`ALTER FUNCTION ${signature} SET statement_timeout = '20s'`);
 const drifted=await definition();
 await assert.rejects(db.exec(rollback),/definition differs from the reviewed baseline/);
 await db.exec('rollback');
 assert.equal(await definition(),drifted);
 await db.exec(reviewed);
});

test('full recovery preserves populated accounts with both current and corrected RPC definitions',async()=>{
 const sourceOwner='00000000-0000-4000-8000-000000000003';
 const separateOwner='00000000-0000-4000-8000-000000000004';
 const {rehearse}=require('./recovery-rehearsal.cjs');
 const Transport=require('../../sync/supabase-transport.js');
 const requests=[];
 const commits=[];
 const shapes={
  mlc2_v1_read:['p_type','p_record_id'],
  mlc2_v1_list_sessions:['p_after_id','p_limit'],
  mlc2_v1_commit:['p_op_id','p_type','p_record_id','p_base_revision','p_deleted','p_payload']
 };
 function transport(owner){
  return Transport.create({baseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_fixture',
   enabled:true,getVerifiedAuth:async()=>({userId:owner,accessToken:owner}),
   fetcher:async(url,options)=>{
    assert.equal(new URL(url).origin,'https://synthetic.supabase.co');
    assert.equal(options.headers.Authorization,'Bearer '+owner);
    await role('authenticated',owner);
    const rpc=new URL(url).pathname.split('/').pop(),args=shapes[rpc];
    assert.ok(args);
    requests.push(rpc);
    const body=JSON.parse(options.body);
    if(rpc==='mlc2_v1_commit')commits.push({owner,id:body.p_record_id});
    try{
     const result=await db.query('select public.'+rpc+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',
      args.map(name=>body[name]));
     return new Response(JSON.stringify(result.rows[0].result));
    }catch(error){
     return new Response(JSON.stringify({message:error.message,code:error.code}),{status:error.code==='PT409'?409:400});
    }
   }});
 }
 const knownIds=['existing-workout','z-existing-workout','snapshot-v1','weekly-schedule-v1'];
 for(const owner of [sourceOwner,separateOwner]){
  await role('authenticated',owner);
  for(const [i,type] of ['session','session','custom-plan','goal'].entries()){
   await commit(type,knownIds[i],0);
  }
 }
 await role(null);
 const existing=async()=>Promise.all(['records','receipts'].map(async table=>(await db.query(
  `select * from mlc2_private.${table} where user_id in ($1,$2) and record_id=any($3::text[]) order by user_id,record_id`,
  [sourceOwner,separateOwner,knownIds])).rows));
 const baseline=await existing();
 assert.deepEqual(baseline.map(rows=>rows.length),[8,8]);
 for(const migration of [rollback,patch]){
  await role(null);
  await db.exec(migration);
  const result=await rehearse({owner:sourceOwner,transport:transport(sourceOwner)},
   {owner:separateOwner,transport:transport(separateOwner)});
  assert.equal(Object.values(result).filter(Boolean).length,6);
  await role(null);
  assert.deepEqual(await existing(),baseline);
 }
 assert.equal(new Set(commits.map(({id})=>id)).size,8);
 assert.ok(commits.every(({owner,id})=>owner===sourceOwner&&id.startsWith('synthetic-recovery-')));
 const leftovers=await db.query("select record_id from mlc2_private.records where user_id=$1 and record_id like 'synthetic-recovery-%' and deleted_at is null",[sourceOwner]);
 assert.deepEqual(leftovers.rows,[]);
 assert.ok(requests.includes('mlc2_v1_list_sessions')&&requests.includes('mlc2_v1_read')&&requests.includes('mlc2_v1_commit'));
});

test('hosted rehearsal rejects an unmarked or mismatched account before any RPC traffic',async()=>{
 const {verifyHosted}=require('./recovery-rehearsal.cjs');
 const baseUrl='https://synthetic.supabase.co';
 const accounts=[{owner:one,accessToken:'fake-session-a'},{owner:two,accessToken:'fake-session-b'}];
 for(const second of [{id:two,app_metadata:{},user_metadata:{mlc2_synthetic_recovery:true}},
  {id:one,app_metadata:{mlc2_synthetic_recovery:true}}]){
  const calls=[];
  await assert.rejects(verifyHosted({baseUrl,key:'sb_publishable_fixture',accounts,fetcher:async url=>{
   calls.push(url);
   return new Response(JSON.stringify(calls.length===1?
    {id:one,app_metadata:{mlc2_synthetic_recovery:true}}:second));
  }}),/server-owned synthetic recovery marker/);
  assert.deepEqual(calls,[baseUrl+'/auth/v1/user',baseUrl+'/auth/v1/user']);
 }
});

test('a generated ID collision in the second account prevents all writes',async()=>{
 const {rehearse}=require('./recovery-rehearsal.cjs');
 const requests=[];
 const transport={
  async read(type,id,owner){
   requests.push({type,id,owner});
   return owner===two&&type==='goal'?{id}:null;
  },
  async commit(){assert.fail('Collision preflight must happen before any write')}
 };
 await assert.rejects(rehearse({owner:one,transport},{owner:two,transport}),/schedule ID already exists/);
 const idsFor=owner=>requests.filter(request=>request.owner===owner).map(request=>request.id);
 assert.equal(idsFor(one).length,4);
 assert.deepEqual(idsFor(one),idsFor(two));
 assert.ok(idsFor(one).every(id=>id.startsWith('synthetic-recovery-')));
});
