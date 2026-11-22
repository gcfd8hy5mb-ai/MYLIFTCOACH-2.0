'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const weekly=require('../progress-weekly-summary.js');
const at='2026-11-22T14:00:00Z';
test('last and current weeks separate correctly and count only real logged training volume',()=>{
 const sessions=[
  {created:'2026-11-22T13:00:00Z',sets:[{weight:40,reps:10},{weight:0,reps:10},{weight:'',reps:8}]},
  {created:'2026-11-16T09:00:00Z',sets:[{weight:50,reps:5}]},
  {created:'2026-11-15T12:00:00Z',sets:[{weight:20,reps:5}]},
  {created:'2026-11-23T08:00:00Z',sets:[{weight:100,reps:10}]}
 ];
 const v=weekly.compare(sessions,new Date(at));
 assert.equal(v.current,'2026-11-16');
 assert.equal(v.previous,'2026-11-09');
 assert.equal(v.thisWeek.sessions,2);
 assert.equal(v.thisWeek.sets,4);
 assert.equal(v.thisWeek.weightedSets,2);
 assert.equal(v.thisWeek.volume,650);
 assert.equal(v.lastWeek.sessions,1);
 assert.equal(v.lastWeek.volume,100);
});
test('empty and malformed history never invents volume',()=>{
 const d=weekly.compare([null,{created:'unknown',sets:[]},{created:at,sets:[{weight:'',reps:10},{weight:-1,reps:10},{weight:40,reps:2.5}]}],new Date('2026-11-22T15:00:00Z'));
 assert.equal(d.thisWeek.sessions,1);
 assert.equal(d.thisWeek.volume,0);
 assert.equal(d.thisWeek.weightedSets,0);
 assert.equal(d.thisWeek.sets,3);
 const empty=weekly.compare([],new Date(at));
 assert.equal(empty.thisWeek.sessions,0);
 assert.equal(empty.lastWeek.volume,0);
});
test('weekly calculation is pure and contains no storage, remote fetch or account mutation',()=>{
 const js=fs.readFileSync('progress-weekly-summary.js','utf8');
 assert.doesNotMatch(js,/\b(localStorage|sessionStorage|indexedDB|fetch|supabase|setItem|removeItem)\b/i);
 const sessions=[{created:'2026-11-22T13:00:00Z',sets:[{weight:10,reps:3}]}];
 const before=JSON.stringify(sessions);
 weekly.compare(sessions,new Date(at));
 assert.equal(JSON.stringify(sessions),before);
});
test('weekly panel is present in compact Overview and recalculates during Progress render',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const compact=fs.readFileSync('progress-compact.js','utf8');
 const app=fs.readFileSync('app.js','utf8');
 assert.ok(html.includes('id="progressWeeklyComparison"'));
 assert.ok(html.indexOf('progress-weekly-summary.js')<html.indexOf('src="./app.js?'));
 assert.ok(compact.includes('groups.overview.append(weekly,recap,chart)'));
 assert.ok(app.includes("window.MLC2ProgressWeekly?.render($('progressWeeklyComparison'),coachEvidence().filter"));
});

test('2.0 detailed workout History displays names from the full imported catalog',()=>{
 const app=fs.readFileSync('app.js','utf8');
 const start=app.indexOf('function renderHistory(){');
 const end=app.indexOf('function renderOriginalPlans(){',start);
 assert.ok(start>=0&&end>start);
 const history=app.slice(start,end);
 assert.ok(history.includes("exerciseNames.get(y.exerciseId)"));
 assert.ok(!history.includes("exercises.find(e=>e.id===y.exerciseId)?.name"));
});
