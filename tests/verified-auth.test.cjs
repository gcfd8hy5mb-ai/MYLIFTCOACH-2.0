'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../sync/verified-auth.js');
const owner='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const session={access_token:'local-test-token',user:{id:owner},expires_at:Math.floor(Date.now()/1000)+3600};
const base={baseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test',getSession:()=>session};
test('cloud verification is disabled by default, with no HTTP requests',async()=>{
 let calls=0;const auth=create({...base,fetcher:async()=>{calls++}});
 await assert.rejects(auth.verify(owner),/disabled/);assert.equal(calls,0);
});
test('reject expired credentials, foreign owner and absent account without HTTP calls',async()=>{
 let calls=0;const fetcher=async()=>{calls++};
 const expired=create({...base,enabled:true,getSession:()=>({...session,expires_at:1}),fetcher});
 await assert.rejects(expired.verify(owner),/Expired/);
 const foreign=create({...base,enabled:true,fetcher});
 await assert.rejects(foreign.verify(other),/does not match/);
 assert.equal(calls,0);
});
test('verify identity against Supabase Auth and return only matching owner credentials',async()=>{
 const requests=[];
 const auth=create({...base,enabled:true,fetcher:async(url,options)=>{
  requests.push({url,options});return {ok:true,json:async()=>({id:owner})};
 }});
 assert.deepEqual(await auth.verify(owner),{userId:owner,accessToken:session.access_token});
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.method,'GET');
 assert.match(requests[0].url,/\/auth\/v1\/user$/);
});
test('reject wrong server identity or failed Auth HTTP response',async()=>{
 const wrong=create({...base,enabled:true,fetcher:async()=>({ok:true,json:async()=>({id:other})})});
 await assert.rejects(wrong.verify(owner),/owner mismatch/);
 const failed=create({...base,enabled:true,fetcher:async()=>({ok:false,status:401})});
 await assert.rejects(failed.verify(owner),/could not be confirmed/);
});
test('reject account switching while Auth response is in flight',async()=>{
 let current=session;
 const auth=create({...base,enabled:true,getSession:()=>current,fetcher:async()=>{
  current={...session,access_token:'different-token',user:{id:other}};
  return {ok:true,json:async()=>({id:owner})};
 }});
 await assert.rejects(auth.verify(owner),/changed during verification/);
});
