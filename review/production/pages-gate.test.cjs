'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifyPagesGate}=require('./pages-gate.cjs');
const sha='a'.repeat(40);
function verify(run){
 return verifyPagesGate({repository:'gcfd8hy5mb-ai/workout-tracker',approvedSha:sha,candidateSha:sha,
  read:async path=>run?run(path):clean(path)});
}
function clean(path){
 return path.includes('/runs?')?{total_count:0,workflow_runs:[]}:
  {path:'.github/workflows/'+path.split('/').pop(),state:'disabled_manually'};
}
test('approved pin and both paused workflows with no unfinished runs pass',async()=>verify());
test('unapproved pins stop before the workflow API is contacted',async()=>{
 await assert.rejects(verifyPagesGate({repository:'gcfd8hy5mb-ai/workout-tracker',approvedSha:sha,
  candidateSha:'b'.repeat(40),read(){throw Error('must not query')}}),/approved release SHA/);
});
test('active workflows, queued or running work, and unverified API responses all block publication',async()=>{
 await assert.rejects(verify(path=>({...clean(path),state:'active'})),/not confirmed disabled/);
 for(const status of ['queued','in_progress','waiting','pending','requested']){
  await assert.rejects(verify(path=>path.endsWith('status='+status)?
   {total_count:1,workflow_runs:[{}]}:clean(path)),/active or unverified run/);
 }
 await assert.rejects(verify(path=>path.includes('/runs?')?{}:clean(path)),/unverified run/);
});
