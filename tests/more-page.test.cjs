'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const more=html.slice(html.indexOf('<section id="settings"'),html.indexOf('</main>'));
test('More groups existing controls and keeps technical controls in the hidden disclosure',()=>{
 const groups=[...more.matchAll(/<details[^>]*>([\s\S]+?)<\/details>/g)].map(match=>match[1]);
 assert.equal(groups.length,7);
 for(const [index,ids] of [
  [0,['authAction','accountIdentity']],
  [2,['betaAccessSelect','betaAccessStatus']],
  [3,['autoWorkoutSyncNow','restoreAccountWorkouts','backupOtherFitnessData','recoveryExportAction','recoveryRestoreAction']],
  [4,['clearDemo']],
  [5,['previewWelcome']],
  [6,['cloudArchiveAction','checkpointCompareAction','dataHealthAction','migrationReadinessFile','reviewLegacyMedia']]
 ]){
  for(const id of ids)assert.ok(groups[index].includes('id="'+id+'"'),id);
 }
 assert.match(more,/<details id="advancedTools"[^>]*hidden>/);
 for(const [,page] of more.matchAll(/data-account-page="([^"]+)"/g)){
  assert.ok(html.includes('<section id="'+page+'"'),page);
 }
 assert.match(app,/setPage\(el\.dataset\.accountPage\)/);
});
test('advanced visibility requires the verified owner and server-managed metadata',()=>{
 const start=app.indexOf('function canViewAdvancedTools');
 const allow=vm.runInNewContext(app.slice(start,app.indexOf('function renderSettings',start))+';canViewAdvancedTools');
 const approved={id:'owner',app_metadata:{myliftcoach_advanced_tools:true}};
 assert.equal(allow('owner',approved),true);
 assert.equal(allow(null,approved),false);
 assert.equal(allow('other',approved),false);
 assert.equal(allow('owner',{id:'owner',user_metadata:approved.app_metadata}),false);
});

test('all More panels close within their intended disclosure',()=>{
 const stack=[];
 for(const [tag,closing,type] of more.matchAll(/<(\/?)(section|article|div|details)(?=[\s>])[^>]*>/g)){
  if(closing)assert.equal(stack.pop(),type,tag);
  else stack.push(type);
 }
 assert.deepEqual(stack,[]);
});
