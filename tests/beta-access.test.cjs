'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Beta=require('../beta-access.js');
const owner='00000000-0000-4000-8000-000000000001';
const profile=(flag=false,mode='free')=>({
 id:owner,app_metadata:{mlc2_beta_tester:flag},
 user_metadata:{mlc2_private_beta_mode:mode}
});
test('all signed-in accounts can use Free or Pro regardless of tester metadata',()=>{
 assert.deepEqual(Beta.resolve(profile(false,'pro')),{
  owner,authorized:true,mode:'pro',paidSubscription:false,persistence:'account'});
 assert.equal(Beta.resolve(profile(true,'free')).mode,'free');
 assert.equal(Beta.resolve(profile(true,'pro')).mode,'pro');
});
test('guests can preview both modes in device session and never receive paid entitlement',()=>{
 assert.deepEqual(Beta.resolve(null,'pro'),{
  owner:null,authorized:true,mode:'pro',paidSubscription:false,persistence:'device'});
 assert.equal(Beta.resolve(null,'free').mode,'free');
 assert.equal(Beta.resolve(null,'fake').mode,'free');
});
test('an unflagged signed-in account saves Pro feature preview in user metadata',async()=>{
 let server=profile(false,'free'),updates=0;
 const result=await Beta.change({user:server,mode:'pro',stillCurrent:id=>id===owner,
  verify:async()=>server,update:async metadata=>{
   updates++;server={...server,user_metadata:metadata};return server;
  }});
 assert.equal(updates,1);
 assert.equal(server.user_metadata.mlc2_private_beta_mode,'pro');
 assert.equal(result.mode,'pro');
 assert.equal(result.paidSubscription,false);
 assert.equal(Beta.resolve(server).mode,'pro');
});
test('all signed-in users can switch from Pro back to Free',async()=>{
 let server=profile(false,'pro');
 const result=await Beta.change({user:server,mode:'free',stillCurrent:()=>true,
  verify:async()=>server,update:async metadata=>{server={...server,user_metadata:metadata};return server}});
 assert.equal(result.mode,'free');
 assert.equal(Beta.resolve(server).mode,'free');
});
test('an account switch during saving rejects stale mode',async()=>{
 let server=profile(false,'free'),active=true;
 await assert.rejects(Beta.change({user:server,mode:'pro',stillCurrent:()=>active,
  verify:async()=>server,update:async metadata=>{
   active=false;server={...server,user_metadata:metadata};return server;
  }}),/Account changed/);
});
test('server owner mismatch rejects setting another account preference',async()=>{
 const server=profile(false,'free');
 await assert.rejects(Beta.change({user:server,mode:'pro',stillCurrent:()=>true,
  verify:async()=>({...server,id:'different-owner'}),
  update:async()=>{throw Error('must not write')}}),/Verified account changed/);
});
test('server disagreement cannot confirm a Pro selection',async()=>{
 const server=profile(false,'free');
 await assert.rejects(Beta.change({user:server,mode:'pro',stillCurrent:()=>true,
  verify:async()=>server,update:async()=>server}),/did not confirm/);
});
test('invalid beta mode cannot be written or count as paid subscription',async()=>{
 const server=profile(false,'free');
 await assert.rejects(Beta.change({user:server,mode:'lifetime_pro',stillCurrent:()=>true,
  verify:async()=>server,update:async()=>server}),/Unsupported/);
 assert.equal(Beta.resolve({...server,user_metadata:{mlc2_private_beta_mode:'paid'}}).mode,'free');
 assert.equal(Beta.resolve(profile(false,'pro')).paidSubscription,false);
});
test('guest-only mode does not permit writing to a non-existent account',async()=>{
 await assert.rejects(Beta.change({user:null,mode:'pro',verify:async()=>null,
  update:async()=>null,stillCurrent:()=>true}),/Sign in/);
});
