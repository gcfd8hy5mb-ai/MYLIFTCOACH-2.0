'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const goal=require('../goal-program-calendar.js');
const store=()=>{const values=new Map();return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)}};
test('Each fitness goal supports exactly 6, 8 and 12 week programs',()=>{
 for(const name of goal.GOALS)for(const weeks of goal.DURATIONS){
  const db=store(),saved=goal.start(db,'account-a',{goal:name,weeks},new Date('2026-11-22T22:00:00Z'));
  assert.deepEqual(goal.read(db,'account-a'),saved);
  const first=goal.progress(saved,new Date('2026-11-22T23:59:59Z'));
  assert.equal(first.week,1);
  assert.equal(first.totalWeeks,weeks);
  assert.equal(first.status,'active');
  const last=goal.progress(saved,new Date(Date.parse('2026-11-22T00:00:00Z')+(weeks*7-1)*86400000));
  assert.equal(last.week,weeks);
  assert.equal(last.status,'active');
  const done=goal.progress(saved,new Date(Date.parse('2026-11-22T00:00:00Z')+weeks*7*86400000));
  assert.equal(done.week,weeks);
  assert.equal(done.status,'completed');
  assert.equal(done.percent,100);
  assert.equal(done.daysRemaining,0);
 }
});
test('Week calculation uses calendar days without DST shifting the program',()=>{
 const db=store();
 const p=goal.start(db,null,{goal:'cut',weeks:8},'2026-03-07T22:00:00Z');
 assert.equal(goal.progress(p,'2026-03-14T22:00:00Z').week,2);
 assert.equal(goal.progress(p,'2026-05-02T22:00:00Z').status,'completed');
 assert.equal(goal.progress(p,'2026-03-08T22:00:00Z').week,1);
});
test('Program history cannot leak between verified accounts',()=>{
 const db=store();
 goal.start(db,'account-a',{goal:'bulk',weeks:12},'2026-11-22T12:00:00Z');
 goal.start(db,'account-b',{goal:'cut',weeks:6},'2026-11-22T12:00:00Z');
 assert.equal(goal.read(db,'account-a').weeks,12);
 assert.equal(goal.read(db,'account-b').goal,'cut');
 assert.equal(goal.read(db,null),null);
});
test('Invalid durations and malformed programs fail without changing stored program',()=>{
 const db=store(),good=goal.start(db,'account-a',{goal:'maintain',weeks:8},'2026-11-22T12:00:00Z');
 for(const bad of [4,7,10,14,0])assert.throws(()=>goal.start(db,'account-a',{goal:'cut',weeks:bad},'2026-11-22T12:00:00Z'));
 assert.deepEqual(goal.read(db,'account-a'),good);
 db.setItem(goal.key('account-a'),JSON.stringify({goal:'bulk',weeks:8,startDate:'2026-02-30'}));
 assert.equal(goal.read(db,'account-a'),null);
});
test('Program restart retains previously saved workouts by design',()=>{
 const db=store(),history=[{id:'done-1',sets:[{exerciseId:'press',weight:65,reps:10}]}];
 goal.start(db,'account-a',{goal:'strength',weeks:6},'2026-11-22T12:00:00Z');
 goal.start(db,'account-a',{goal:'strength',weeks:6},'2026-12-01T12:00:00Z');
 assert.equal(goal.read(db,'account-a').startDate,'2026-12-01');
 assert.equal(history.length,1);
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.match(app,/goalProgramRestart/);
 assert.match(app,/old\.goal!==profile\.goal\|\|old\.weeks!==weeks/);
 assert.match(app,/MLC2GoalProgram\.progress\(program\)/);
 assert.match(app,/bulk:'muscle',maintain:'balanced',cut:'balanced'/);
 assert.match(html,/name="programWeeks"/);
 assert.match(html,/goal-program-calendar\.js\?v=1/);
 assert.match(html,/id="goalProgramProgress"/);
 assert.match(html,/id="goalProgramRestart"/);
 assert.doesNotMatch(html.slice(html.indexOf('<section id="nutrition"'),html.indexOf('<section id="settings"')),/foodLog|macroCounter|scanBarcode/i);
});
