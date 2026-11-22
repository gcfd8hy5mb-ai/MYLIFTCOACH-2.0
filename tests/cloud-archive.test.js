/* Offline owner-bound original-account cloud archive tests.
   No production credentials, API calls, storage writes or downloads. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const archive=require(path.resolve(__dirname,'../cloud-account-archive.js'));
const requestMethods=[];
const mockURL=address=>new URL(address);
const fetcher=async(url,opts)=>{
 requestMethods.push(opts.method);
 if(url.includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'owner-1'})};
 const parsed=new URL(url);
 assert.equal(parsed.searchParams.get('user_id'),'eq.owner-1');
 assert.equal(parsed.searchParams.get('select'),'*');
 return {ok:true,json:async()=>parsed.pathname.includes('prism_account_sessions')?
  [{id:'session-1',user_id:'owner-1',source_key:'workoutHistoryV52',payload:{value:1}}]:[]};
};
(async()=>{
 const result=await archive.collect({
  url:'https://example.supabase.co',publishableKey:'public',token:'mock',
  userId:'owner-1',tables:['sources','sessions'],fetcher,makeUrl:mockURL
 });
 assert.equal(result.accountId,'owner-1');
 assert.equal(result.recordCount,1);
 assert.equal(result.counts.sessions,1);
 assert.ok(requestMethods.every(m=>m==='GET'),'archive fetch may only use GET');
 const data=JSON.parse(archive.serialize(result));
 assert.equal(data.records[0].row.user_id,'owner-1');
 assert.equal(data.records[0].table,'sessions');
 assert.equal(JSON.stringify(data).includes('mock'),false,'auth token should never enter archive');
 await assert.rejects(archive.collect({
  url:'https://example.supabase.co',publishableKey:'public',token:'mock',
  userId:'wrong-owner',tables:['sessions'],fetcher:async()=>({ok:true,json:async()=>({id:'owner-1'})}),makeUrl:mockURL
 }),/does not match/);
 await assert.rejects(archive.collect({
  url:'https://example.supabase.co',publishableKey:'public',token:'mock',
  userId:'owner-1',tables:['sessions'],fetcher:async(url)=>url.includes('/auth/v1/')?
   {ok:true,json:async()=>({id:'owner-1'})}:{ok:true,json:async()=>[{id:'bad',user_id:'wrong-owner'}]},
  makeUrl:mockURL
 }),/ownership/);
 await assert.rejects(archive.collect({
  url:'https://example.supabase.co',publishableKey:'public',token:'mock',
  userId:'owner-1',tables:['sessions'],fetcher:async(url)=>url.includes('/auth/v1/')?
   {ok:true,json:async()=>({id:'owner-1'})}:{ok:false,status:503},
  makeUrl:mockURL
 }),/could not be read/);
 assert.throws(()=>archive.validateTables(['sessions','sessions']),/Unrecognized/);
 assert.throws(()=>archive.serialize({...result,records:[{table:'sessions',row:{id:'x',user_id:'attacker'}}]}),/mismatched owner/);
 assert.throws(()=>archive.serialize({...result,records:[{table:'sessions',row:{id:'x',user_id:'owner-1',payload:'x'.repeat(31*1024*1024)}}]}),/30 MB/);
 console.log('MYLIFTCOACH original cloud archive: PASS — GET-only, owner isolation, fail-closed, no auth tokens');
})().catch(error=>{console.error(error);process.exitCode=1});
