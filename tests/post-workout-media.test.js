/* Offline post-workout recap and legacy media inventory checks. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const recap=require(path.resolve(__dirname,'../coach-post-workout.js'));
const media=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../media/legacy-source-audit.json'),'utf8'));
const old={id:'demo-1',planId:'custom-a',created:'2026-11-10T10:00:00Z',title:'Upper',sets:[
 {exerciseId:'chest-press',weight:50,reps:10},{exerciseId:'chest-press',weight:50,reps:10}]};
const latest={id:'demo-2',planId:'custom-a',created:'2026-11-18T10:00:00Z',title:'Upper',sets:[
 {exerciseId:'chest-press',weight:55,reps:10},{exerciseId:'chest-press',weight:55,reps:10}]};
const unrelated={id:'demo-3',planId:'custom-b',created:'2026-11-12T10:00:00Z',title:'Lower',sets:[
 {exerciseId:'leg-press',weight:100,reps:10}]};
const report=recap.summarize([old,latest,unrelated]);
assert.equal(report.hasHistory,true);
assert.equal(report.current.volume,1100);
assert.equal(report.previous.volume,1000);
assert.equal(report.deltaVolume,100);
assert.equal(report.improvedExercises,1);
assert.equal(report.referenceSessionId,'demo-1');
assert.equal(recap.summarize([]).hasHistory,false);
assert.equal(recap.summarize([latest]).previous,null);
assert.equal(recap.stats({sets:[{exerciseId:'chest-press',weight:0,reps:10}]}).sets,0);
assert.equal(media.catalogTotal,344);
assert.equal(media.verifiedLegacyCandidateCount,14);
assert.equal(new Set(media.assets.map(x=>x.exerciseId)).size,14);
assert.ok(media.assets.every(x=>x.reused===false&&x.reviewStatus==='provenance-and-approval-pending'));
assert.ok(media.assets.every(x=>/^images\/[a-z0-9-]+\.png$/.test(x.sourcePath)));
console.log('MYLIFTCOACH post-workout and legacy media audit: PASS');
