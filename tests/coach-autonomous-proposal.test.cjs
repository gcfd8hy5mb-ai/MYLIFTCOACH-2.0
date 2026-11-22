'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const builder=require('../coach-program-builder.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const catalog=['Chest','Back','Shoulders','Arms','Legs','Core'].flatMap(group=>
 [1,2,3].map(n=>({id:group.toLowerCase()+'-'+n,name:group+' '+n,group,equipment:'Machine'})));
test('Autonomous program generates 4-day exercise selection from zero history without invented weights',()=>{
 const result=builder.build(catalog,[],{goal:'balanced',days:4,equipment:'Any'});
 assert.equal(result.status,'ready');
 assert.equal(result.days.length,4);
 assert.equal(result.usedLoggedHistory,false);
 for(const day of result.days){
  assert.ok(day.exercises.length>0);
  assert.ok(day.exercises.every(e=>e.weight===null));
  assert.equal(new Set(day.exercises.map(e=>e.id)).size,day.exercises.length);
 }
});
test('Real completed workouts influence exercise choice while invalid or absent data does not',()=>{
 const workout=[{sets:[{exerciseId:'chest-3',weight:50,reps:10},{exerciseId:'chest-3',weight:50,reps:10}]}];
 const result=builder.build(catalog,workout,{goal:'balanced',days:4});
 assert.equal(result.usedLoggedHistory,true);
 assert.equal(result.days[0].exercises[0].id,'chest-3');
});
test('Autonomous proposal cannot replace a selected workout or persist generated plans',()=>{
 assert.match(app,/function coachAutonomousPlan\(\)/);
 assert.match(app,/function renderAutonomousCoach\(\)/);
 assert.match(app,/coachAutonomousDraft\?\.id===id\?coachAutonomousDraft:null/);
 assert.match(app,/openWorkout\(proposal\.id\)/);
 assert.match(app,/window\.MLC2WeeklySchedule\?\.resolve/);
 assert.doesNotMatch(builder.build.toString(),/localStorage|fetch|setItem|\.save\(/);
 assert.match(html,/id="coachAutoPanel"/);
 assert.match(html,/id="coachAutoStart"/);
 assert.match(html,/coach-program-builder\.js\?v=1/);
});
