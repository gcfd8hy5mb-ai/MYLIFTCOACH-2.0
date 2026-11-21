'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Auth=require('../sync/refresh-session.js');
const owner='owner-a',other='owner-b';
function fixture({expired=true}={}){
 let epoch=1,currentOwner=owner,renews=0,verified=0,commits=0;
 let session={access_token:'old-token',refresh_token:'refresh-old',user:{id:owner},
  expires_at:Math.floor(Date.now()/1000)+(expired?-60:3600)};
 const helper=Auth.create({
  getSession:()=>session,getOwner:()=>currentOwner,getEpoch:()=>epoch,
  refresh:async()=>{
   renews++;return {access_token:'fresh-token',refresh_token:'refresh-new',user:{id:owner},expires_in:3600};
  },
  fetchUser:async()=>{verified++;return {id:owner,app_metadata:{mlc2_beta_tester:true}}},
  commit:next=>{commits++;session=next}
 });
 return {helper,get session(){return session},get renews(){return renews},
  get verified(){return verified},get commits(){return commits},
  signOut(){epoch++;currentOwner=null;session=null},
  switchAccount(){epoch++;currentOwner=other;session={access_token:'other',user:{id:other},expires_at:1}}};
}
test('fresh token is reused without unnecessary renewal',async()=>{
 const f=fixture({expired:false});const result=await f.helper.sessionFor(owner);
 assert.equal(result.access_token,'old-token');assert.equal(f.renews,0);
});
test('expired Supabase session renews safely and persists verified account metadata',async()=>{
 const f=fixture();const renewed=await f.helper.sessionFor(owner);
 assert.equal(f.renews,1);assert.equal(f.verified,1);assert.equal(f.commits,1);
 assert.equal(renewed.access_token,'fresh-token');
 assert.equal(renewed.user.app_metadata.mlc2_beta_tester,true);
});
test('concurrent sync checks share one token refresh',async()=>{
 const f=fixture();
 const two=await Promise.all([f.helper.sessionFor(owner),f.helper.sessionFor(owner)]);
 assert.equal(f.renews,1);assert.equal(f.commits,1);
 assert.equal(two[0].access_token,two[1].access_token);
});
test('invalid owner or sign-out blocks token refresh',async()=>{
 const f=fixture();
 await assert.rejects(f.helper.sessionFor(other),/Account changed/);
 f.signOut();await assert.rejects(f.helper.sessionFor(owner),/Account changed/);
 assert.equal(f.commits,0);
});
test('sign-out during network verification cannot restore authentication',async()=>{
 const f=fixture();
 const interrupted=Auth.create({getSession:()=>f.session,getOwner:()=>owner,
  getEpoch:()=>1,refresh:async()=>{f.signOut();return {access_token:'new',user:{id:owner},expires_in:3600}},
  fetchUser:async()=>({id:owner}),commit:()=>{throw Error('must not run')}
 });
 await assert.rejects(interrupted.sessionFor(owner),/Account changed/);
});
test('renewal cannot commit a different account ID',async()=>{
 const old={access_token:'old',refresh_token:'refresh',user:{id:owner},expires_at:1};
 const helper=Auth.create({getSession:()=>old,getOwner:()=>owner,getEpoch:()=>0,
  refresh:async()=>({access_token:'new',user:{id:other},expires_in:3600}),
  fetchUser:async()=>{throw Error('not expected')},commit:()=>{throw Error('not expected')}});
 await assert.rejects(helper.sessionFor(owner),/Refreshed account mismatch/);
});
