'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
test('Today identifies enrolled custom and generated goal programs instead of mislabeling them as presets',()=>{
 const begin=app.indexOf('function renderWorkouts(){');
 const end=app.indexOf('// An external catalog is optional.',begin);
 assert.ok(begin>=0&&end>begin);
 const view=app.slice(begin,end);
 assert.match(view,/selected\.scheduleSource==='program'/);
 assert.match(view,/selected\.programSource==='custom'\?'Custom goal program':'Coach goal program'/);
 assert.match(view,/selected\.kind==='Coach'\?'Coach session':'Preset routine'/);
 assert.match(view,/Part of your active goal program/);
 assert.match(view,/selected\.scheduleSource==='manual'/);
 assert.match(view,/selected\.scheduleSource==='weekly'/);
});
test('Normal Progress and Coach screens use actual completed-session terminology',()=>{
 const coach=html.slice(html.indexOf('<section id="coaching"'),html.indexOf('<section id="nutrition"'));
 const progress=html.slice(html.indexOf('<section id="progress"'),html.indexOf('<section id="history"'));
 assert.match(coach,/completed MYLIFTCOACH workouts/);
 assert.match(progress,/Completed workouts/);
 assert.match(progress,/WORKOUT LOGS/);
 assert.doesNotMatch(progress,/DEMO DATA|Demo only|LOCAL DEMO|isolated preview workspace/);
 assert.match(app,/Workout saved on this device\. Account backup will sync when connected\./);
});
test('Preview-specific simulated Coach data remains isolated',()=>{
 assert.match(app,/if\(isCoachTestPreview\(\)&&previewCoachHistory\)return previewCoachHistory/);
 assert.match(app,/!row\.id\.startsWith\('SIMULATED-COACH-'\)/);
});
