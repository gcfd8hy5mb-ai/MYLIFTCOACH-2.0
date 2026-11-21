'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Beta=require('../beta-access.js');
const owner='00000000-0000-4000-8000-000000000001';
const profile=(flag=true,mode='free')=>({id:owner,
 app_metadata:{mlc2_beta_tester:flag},user_metadata:{mlc2_private_beta_mode:mode}});
test('authorized tester can select Free or Pro; never receives paid entitlement',()=>{
 assert.deepEqual(Beta.resolve(profile(true,'pro')),{owner,authorized:true,mode:'pro',paidSubscription:false});
 assert.equal(Beta.resolve(profile(true,'free')).mode,'free');
});
test('unauthorized and guest accounts are always Free even if user metadata requests Pro',()=>{
 assert.equal(Beta.resolve(profile(false,'pro')).mode,'free');
 assert.equal(Beta.resolve(profile(false,'pro')).authorized,false);
 assert.equal(Beta.resolve(null).mode,'free');
});
test('server-verified beta choice persists on user metadata',async()=>{
 let server=profile(true,'free');let updates=0;
 const result=await Beta.change({user:server,mode:'pro',stillCurrent:id=>id===owner,
  verify:async()=>server,update:async metadata=>{
   updates++;server={...server,user_metadata:metadata};return server;
  }});
 assert.equal(updates,1);assert.equal(server.user_metadata.mlc2_private_beta_mode,'pro');
 assert.equal(result.mode,'pro');
 assert.equal(result.paidSubscription,false);
});
test('account switch during request rejects stale preference',async()=>{
 let server=profile(true,'free'),active=true;
 await assert.rejects(Beta.change({user:server,mode:'pro',stillCurrent:()=>active,
  verify:async()=>server,update:async metadata=>{active=false;server={...server,user_metadata:metadata};return server}}),/Account changed/);
});
test('revoked server authorization refuses beta switching',async()=>{
 const local=profile(true,'free');
 await assert.rejects(Beta.change({user:local,mode:'pro',stillCurrent:()=>true,
  verify:async()=>profile(false,'free'),update:async()=>{throw Error('must not run')}}),/authorization changed/);
});
test('server disagreement cannot confirm a Pro selection',async()=>{
 const server=profile(true,'free');
 await assert.rejects(Beta.change({user:server,mode:'pro',stillCurrent:()=>true,
  verify:async()=>server,update:async()=>server}),/did not confirm/);
});
test('unapproved beta mode cannot be written',async()=>{
 await assert.rejects(Beta.change({user:profile(),mode:'lifetime_pro',stillCurrent:()=>true,
  verify:async()=>profile(),update:async()=>profile()}),/Unsupported/);
});
