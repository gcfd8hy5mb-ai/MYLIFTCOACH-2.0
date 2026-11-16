'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../sync/supabase-transport.js');
const op={opId:'11111111-1111-4111-8111-111111111111',owner:'00000000-0000-4000-8000-000000000001',
 type:'session',id:'session-1',kind:'upsert',baseRevision:0,payload:{sets:[{reps:8,weight:40}]}};
const cfg={baseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test',
 getVerifiedAuth:async()=>({userId:op.owner,accessToken:'fake-token'})};
test('transport is disabled even when passed verified credentials',async()=>{
 let calls=0;const t=create({...cfg,fetcher:async()=>{calls++;return {ok:true}}});
 await assert.rejects(t.commit(op,op.owner),/deliberately disabled/);
 assert.equal(calls,0);
});
test('transport verifies owner before sending credentials to RPC',async()=>{
 let calls=0;const t=create({...cfg,enabled:true,getVerifiedAuth:async()=>({userId:'other',accessToken:'token'}),fetcher:async()=>{calls++;return {ok:true}}});
 await assert.rejects(t.commit(op,op.owner),/Owner authentication unavailable/);
 await assert.rejects(t.commit(op,'other'),/Account mismatch/);
 assert.equal(calls,0);
});
test('transport sends authenticated data only to isolated function',async()=>{
 const requests=[];const t=create({...cfg,enabled:true,fetcher:async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>({owner:op.owner,opId:op.opId,revision:1})};
 }});
 const response=await t.commit(op,op.owner);
 assert.deepEqual(response,{owner:op.owner,opId:op.opId,revision:1});
 assert.equal(requests[0].url,'https://example.supabase.co/rest/v1/rpc/mlc2_v1_commit');
 const body=JSON.parse(requests[0].options.body);
 assert.equal(body.p_record_id,'session-1');
 assert.equal(body.p_base_revision,0);
 assert.equal(body.p_payload.sets[0].weight,40);
 assert.equal(requests[0].options.headers.Authorization,'Bearer fake-token');
});
test('409 conflict is preserved for manual conflict review',async()=>{
 const t=create({...cfg,enabled:true,fetcher:async()=>({
  ok:false,status:409,json:async()=>({code:'PT409',message:'MLC2_REVISION_CONFLICT'})
 })});
 await assert.rejects(t.commit(op,op.owner),err=>err.code==='CONFLICT'&&err.status===409);
});
test('refuses forged acknowledgement, wrong endpoint and invalid operation id',async()=>{
 const t=create({...cfg,enabled:true,fetcher:async()=>({ok:true,json:async()=>({owner:'another',opId:op.opId,revision:1})})});
 await assert.rejects(t.commit(op,op.owner),/Unverified server response/);
 await assert.rejects(t.commit({...op,opId:'not-a-uuid'},op.owner),/UUID operation ID/);
 assert.throws(()=>create({...cfg,baseUrl:'http://example.supabase.co',fetcher:async()=>{}}),/Approved HTTPS/);
});
