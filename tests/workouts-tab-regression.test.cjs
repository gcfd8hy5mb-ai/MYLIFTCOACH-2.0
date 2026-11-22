'use strict';
/* Guard rails for the stable 11-21N baseline. No browser or paid dependencies. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const BASE='9b70e2dc716223a6d0cafc553d9cebf23269b8a7';
const read=path=>fs.readFileSync(path,'utf8');
const gitBlob=path=>crypto.createHash('sha1').update('blob '+fs.readFileSync(path).length+'\0').update(fs.readFileSync(path)).digest('hex');
test('working N modules remain byte-for-byte identical',()=>{
 const blobs={
  'app.js':'984f57d8e2cd340a77cf6994a823a3681ccedc2b',
  'sync/automatic-workouts.js':'126c913fef6787a693051de253246bf457ea34cc',
  'sync/auth-session-store.js':'4dd8ab6bfc3b5bbe5901440b6d5fc836c0647a66',
  'custom-workouts.js':'09c29aa123262008fb1d9c651d2a000dd36c0982',
  'weekly-workout-schedule.js':'cdc3745c40e8747c5e3d49f44de8a7487430d3bc'
 };
 for(const [path,sha] of Object.entries(blobs))assert.equal(gitBlob(path),sha,path+' unexpectedly changed');
});
test('only approved files differ from base N',()=>{
 const modified=execFileSync('git',['diff','--name-only',BASE+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim();
 assert.equal(untracked,'');
 const allowed=new Set(['index.html','workouts-tabs-n.js','workouts-tabs-n.css','tests/workouts-tab-regression.test.cjs','tests/workouts-tabs-dom.test.cjs','.github/workflows/workouts-tabs-ci.yml']);
 for(const path of modified)assert.ok(allowed.has(path),'Protected N file changed: '+path);
});
test('index keeps base N intact other than scoped asset references',()=>{
 const current=read('index.html');
 const base=execFileSync('git',['show',BASE+':index.html'],{encoding:'utf8'});
 const stripped=current.replace('<link rel="stylesheet" href="./workouts-tabs-n.css?v=1">\n','').replace('\n<script defer src="./workouts-tabs-n.js?v=1"></script>','');
 assert.equal(stripped,base,'Base N HTML must remain identical');
 assert.ok(current.includes('iPhone beta test build 11-21N'));
 assert.ok(current.indexOf('app.js?v=15')<current.indexOf('workouts-tabs-n.js?v=1'),'Workouts enhancement must run after app.js');
});
test('Workouts enhancement does not persist or mutate account data',()=>{
 const js=read('workouts-tabs-n.js'),css=read('workouts-tabs-n.css');
 new Function(js);
 for(const expression of [/localStorage/,/sessionStorage/,/supabase/i,/fetch\s*\(/,/\.remove\s*\(/,/\.replaceChildren\s*\(/,/deleteWorkout/i])
  assert.ok(!expression.test(js),'Side effect forbidden: '+expression);
 assert.match(js,/homeStart\.click\(\)/);
 assert.match(js,/panels\.schedule\.append\(schedule\)/);
 assert.match(js,/panels\.routines\.append\(listHead,toolbar,recovery,grid\)/);
 assert.match(css,/#workouts \.workout-tabs-n/);
 assert.ok(!/(^|\n)\s*(?:body|html|:root|\.modal|\.auth-fullscreen)[\s.{:#]/m.test(css),'Style escapes Workouts scope');
});
