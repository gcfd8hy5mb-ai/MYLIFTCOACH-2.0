'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');
function load(){
 const window={};vm.runInNewContext(read('progress-migration.js'),{window,document:{}});
 return window.MLC2Progress;
}
test('actual logged ten 40lb x 10rep sets yield exactly 4000lb training volume',()=>{
 const api=load();const sets=Array.from({length:10},(_,i)=>({exerciseId:'ex-'+i%4,weight:40,reps:10}));
 assert.equal(api.volumeTotal(sets),4000);
 const sessions=[{created:'2026-11-22T12:09:00.000Z',title:'Upper Body A',sets}];
 const normalized=api.normalizedSessions(sessions,'demo');
 assert.equal(api.weeklyVolume(normalized)[0].volume,4000);
 assert.equal(api.weeklyVolume(normalized)[0].sets,10);
});
test('no imagined volume from empty, missing, malformed or incomplete entries',()=>{
 const api=load();
 const sets=[
  {weight:'',reps:10},{weight:40,reps:''},{weight:null,reps:10},
  {weight:'unknown',reps:10},{weight:-40,reps:10},
  {weight:40,reps:0},{weight:40,reps:2.5},{weight:2000,reps:10},
  {weight:'22.5',reps:'8'},{weight:0,reps:10}
 ];
 assert.equal(api.volumeTotal(sets),180);
 assert.equal(sets.filter(api.validSet).length,1);
});
test('workout inputs no longer invent 40lb and 10 reps for a new exercise',()=>{
 const ux=read('workout-active-ux.js');
 const app=read('app.js');
 assert.match(ux,/weight:'',reps:'',source:'empty'/);
 assert.doesNotMatch(ux,/weight:40,reps:10,source:'default'/);
 assert.match(app,/\|\|\{weight:'',reps:''\}/);
 assert.match(app,/weightField\.value\.trim\(\)===''\|\|repsField\.value\.trim\(\)===''/);
});
test('volume graph and personal records use same validated set calculation',()=>{
 const app=read('app.js');
 const migration=read('progress-migration.js');
 const html=read('index.html');
 assert.ok(app.includes('window.MLC2Progress?.volumeTotal(x.sets)||0'));
 assert.ok(app.includes('window.MLC2Progress?.validSet(set)'));
 assert.ok(migration.includes('sum of weight × reps from your completed sets'));
 assert.ok(html.indexOf('progress-migration.js')<html.indexOf('app.js?v=15'));
});
