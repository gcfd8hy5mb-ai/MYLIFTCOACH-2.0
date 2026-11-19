/* Original MYLIFTCOACH direct-cloud viewer — test-only account fixtures. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const live=require(path.resolve(__dirname,'../cloud-live-original-history.js'));
const archive=require(path.resolve(__dirname,'../cloud-account-archive.js'));
const viewer=require(path.resolve(__dirname,'../cloud-original-history.js'));
const inspector=require(path.resolve(__dirname,'../cloud-migration-readiness.js'));
const model=require(path.resolve(__dirname,'../legacy-storage-model.js'));
const owner='owner-1',token='test-session',calls=[];
const base={url:'https://example.supabase.co',publishableKey:'public',token,userId:owner,tables:model.TABLES,
 archiveService:archive,historyViewer:viewer,inspector:inspector.inspectArchive,
 storageModel:model,makeUrl:address=>new URL(address)};
const fetcher=async(url,init)=>{
 calls.push({url,method:init.method});
 if(url.includes('/auth/v1/user'))return {ok:true,json:async()=>({id:owner})};
 const endpoint=new URL(url);
 assert.equal(endpoint.searchParams.get('user_id'),'eq.'+owner);
 if(endpoint.pathname.endsWith('prism_account_sources'))return {ok:true,json:async()=>[
  {id:'source-1',user_id:owner,revision:1,source_key:'workoutHistoryV52',payload:{shape:'array'}}]};
 if(endpoint.pathname.endsWith('prism_account_sessions'))return {ok:true,json:async()=>[
  {id:'session-1',user_id:owner,revision:1,source_key:'workoutHistoryV52',
   payload:{id:'original-123',date:'2026-11-18T10:00:00Z',workoutTitle:'Archived Upper'},position:0}]};
 return {ok:true,json:async()=>[]};
};
(async()=>{
 const input={...base,fetcher,stillAuthenticated:(id,t)=>id===owner&&t===token};
 const view=await live.load(input);
 assert.equal(view.sessionCount,1);
 assert.equal(view.sessions[0].title,'Archived Upper');
 assert.equal(view.cloudWrites,false);
 assert.equal(view.readOnly,true);
 assert.ok(calls.length>2);
 assert.ok(calls.every(x=>x.method==='GET'),'live history may use GET only');
 let seenAuth=false;
 await assert.rejects(live.load({...input,stillAuthenticated:()=>{
  if(!seenAuth){seenAuth=true;return true}return false;
 }}),/Account changed during cloud history read/);
 await assert.rejects(live.load({...input,fetcher:async(url)=>{
  if(url.includes('/auth/v1/'))return {ok:true,json:async()=>({id:owner})};
  return {ok:false,status:500};
 }}),/could not be read/);
 await assert.rejects(live.load({...input,fetcher:async(url)=>{
  if(url.includes('/auth/v1/'))return {ok:true,json:async()=>({id:owner})};
  return {ok:true,json:async()=>[{id:'stolen',user_id:'other',revision:1}]};
 }}),/ownership/);
 assert.equal(calls.some(x=>x.method!=='GET'),false);
 console.log('MYLIFTCOACH live original history: PASS — owner validation, GET-only, account-change cancellation, failure isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
