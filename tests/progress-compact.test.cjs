'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=x=>fs.readFileSync(x,'utf8');
test('progress compact scripts parse, load after app, and do not access persistence',()=>{
 const js=read('progress-compact.js');
 assert.doesNotThrow(()=>new vm.Script(js));
 const html=read('index.html');
 assert.ok(html.indexOf('progress-compact.js?v=1')>html.indexOf('app.js?v=15'));
 assert.ok(html.includes('progress-compact.css?v=1'));
 assert.ok(!/\b(localStorage|sessionStorage|indexedDB|fetch|supabase|delete|removeItem|setItem)\b/.test(js));
});
test('all existing progress data render targets are retained, not replaced',()=>{
 const js=read('progress-compact.js');
 const html=read('index.html');
 for(const id of ['postWorkoutRecap','progressChart','sessionHistory','demoRecords','legacyRecords','progressSessions','progressSets','progressMovements']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(js.includes('groups.overview.append(recap,chart)'));
 assert.ok(js.includes('groups.strength.append(records)'));
 assert.ok(js.includes('groups.strength.append(auditCard,original)'));
 assert.ok(js.includes("auditBody.id='progressVolumeAudit'"));
 assert.ok(js.includes('groups.history.append(history)'));
 assert.ok(js.includes('metrics.after(tabs,'));
 assert.ok(!js.includes('innerHTML'));
});
test('progress tab navigation and detail page shortcuts retain app-owned page state',()=>{
 const js=read('progress-compact.js');
 const app=read('app.js');
 assert.ok(js.includes("window.MLC2ProgressNavigate?.('history')"));
 assert.ok(js.includes("window.MLC2ProgressNavigate?.('tracking')"));
 assert.ok(app.includes("window.MLC2ProgressNavigate=next=>{if(next==='history'||next==='tracking')setPage(next)}"));
 for(const id of ['overview','strength','history','body'])assert.ok(js.includes("['"+id+"'")||js.includes(",'"+id+"'"),id);
 assert.ok(js.includes("setAttribute('aria-selected'"));
 assert.ok(js.includes("ArrowLeft"));
});
