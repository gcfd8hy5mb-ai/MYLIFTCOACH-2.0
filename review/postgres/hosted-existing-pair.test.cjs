'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const {runExistingPair}=require('./hosted-existing-pair.cjs');

const host='https://kirlpjflaoriiusfamsk.supabase.co';
const owners=['aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'];
const env={
 MLC2_HOSTED_PUBLISHABLE_KEY:'sb_publishable_fixture',
 MLC2_SYNTHETIC_A_UUID:owners[0],
 MLC2_SYNTHETIC_B_UUID:owners[1],
 MYLIFTCOACH_TEST_A_EMAIL:'first@example.test',
 MYLIFTCOACH_TEST_A_PASSWORD:'fixture-first',
 MYLIFTCOACH_TEST_B_EMAIL:'second@example.test',
 MYLIFTCOACH_TEST_B_PASSWORD:'fixture-second'
};

test('incomplete or duplicate account configuration makes no hosted requests',async()=>{
 const unexpected=()=>assert.fail('Unexpected request');
 const variants=[{MYLIFTCOACH_TEST_B_PASSWORD:''},{MLC2_SYNTHETIC_B_UUID:owners[0]},
  {MYLIFTCOACH_TEST_B_EMAIL:' FIRST@example.test '},{MLC2_HOSTED_PUBLISHABLE_KEY:'sb_secret_fixture'}];
 for(const variant of variants){
  await assert.rejects(runExistingPair({...env,...variant},unexpected),/two distinct/);
 }
});

test('wrong or unmarked second identity prevents all cloud recovery calls',async()=>{
 for(const second of [{id:owners[0],app_metadata:{mlc2_synthetic_recovery:true}},
  {id:owners[1],user_metadata:{mlc2_synthetic_recovery:true}}]){
  const calls=[];
  await assert.rejects(runExistingPair(env,async(url,options)=>{
   calls.push(url);
   const index=calls.length-1;
   assert.equal(options.redirect,'error');
   const label=index===0?'A':'B';
   assert.deepEqual(JSON.parse(options.body),{
    email:env[`MYLIFTCOACH_TEST_${label}_EMAIL`],password:env[`MYLIFTCOACH_TEST_${label}_PASSWORD`]
   });
   return Response.json({access_token:'fixture',user:index===0?
    {id:owners[0],app_metadata:{mlc2_synthetic_recovery:true}}:second});
  }),/unapproved identity/);
  assert.deepEqual(calls,Array(2).fill(host+'/auth/v1/token?grant_type=password'));
 }
});

test('password exchange passes the two sessions to hosted identity verification',async()=>{
 const paths=[];
 const verified=[];
 await assert.rejects(runExistingPair(env,async(url,options)=>{
  assert.equal(new URL(url).origin,host);
  const path=new URL(url).pathname;
  const index=paths.push(path)-1;
  if(index<2){
   return Response.json({access_token:`fixture-${index}`,
    user:{id:owners[index],app_metadata:{mlc2_synthetic_recovery:true}}});
  }
  if(index<4){
   verified.push(options.headers.Authorization);
   return Response.json({id:owners[index-2],app_metadata:{mlc2_synthetic_recovery:true}});
  }
  return new Response(null,{status:503});
 }),/Hosted recovery checks failed after synthetic sign-in/);
 assert.deepEqual(paths.slice(0,4),['/auth/v1/token','/auth/v1/token','/auth/v1/user','/auth/v1/user']);
 assert.deepEqual(verified,['Bearer fixture-0','Bearer fixture-1']);
 assert.equal(paths.length,5);
});
