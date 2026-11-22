'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('compact-workouts.css');
test('Workouts has three separate accessible tabs and sections',()=>{
 for(const [name,id] of [['Today','workoutPanelToday'],['Routines','workoutPanelRoutines'],['Schedule','workoutPanelSchedule']]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/role="tablist" aria-label="Workout sections"/);
 assert.match(html,/data-workout-tab="today"/);
 assert.match(html,/data-workout-tab="routines"/);
 assert.match(html,/data-workout-tab="schedule"/);
 assert.match(app,/function setWorkoutTab\(tab\)/);
 assert.match(app,/panel.hidden=!active/);
 assert.match(app,/button\.setAttribute\('aria-selected',String\(active\)\)/);
});
test('Today starts the selected workout, not a recalculated preset',()=>{
 assert.match(app,/const selected=nextPlan\(\)/);
 assert.match(app,/start.dataset.workout=activeId/);
 assert.match(app,/\$\('workoutTodayStart'\)\.addEventListener\('click'/);
 assert.match(app,/openWorkout\(id\)/);
 assert.match(app,/\$\('workoutTodayChange'\)\.addEventListener\('click',\(\)=>setWorkoutTab\('routines'\)\)/);
});
test('Custom routines remain before presets, with start/select/edit/delete actions',()=>{
 assert.match(app,/const all=\[\.\.\.custom,\.\.\.plans\]/);
 assert.match(app,/section\(custom,'Your custom workouts'\)\+section\(plans,'Ready-made presets'\)/);
 for(const x of ['data-custom-select','data-custom-edit','data-custom-delete','data-workout'])assert.ok(app.includes(x));
 assert.match(app,/window\.MLC2Custom\?\.handleClick/);
 assert.match(app,/window\.MLC2Custom\?\.openEditor/);
});
test('Weekly schedule and guest recovery remain available under correct tabs',()=>{
 const schedule=html.slice(html.indexOf('id="workoutPanelSchedule"'),html.indexOf('id="library"'));
 assert.match(schedule,/id="weeklySchedule"/);
 assert.match(html,/id="guestWorkoutRecovery"/);
 assert.match(html,/id="recoverGuestWorkouts"/);
 assert.match(app,/window\.MLC2WeeklySchedule\?\.render/);
 assert.match(app,/window\.MLC2Custom\.recoverGuest\(\)/);
});
test('Approved teal/gold styling stays scoped to Workouts; active logger, login and sync unaffected',()=>{
 assert.ok(html.includes('compact-workouts.css?v=2'));
 assert.match(css,/#workouts \.workout-today-card/);
 assert.match(css,/#workouts \.workout-compact-card/);
 assert.match(css,/background:#082e35!important/);
 assert.match(css,/border:1px solid rgba\(213,176,109,\.65\)/);
 assert.ok(html.includes('active-workout-ux.css?v=3'));
 assert.ok(html.includes('workout-auth-ux-fix.css?v=2'));
 assert.match(app,/queueWorkoutForSync\(entry\)/);
 assert.match(app,/window\.MLC2SessionDraft\?\.save\(activeDraftStore,activePlan,session.sets\)/);
});

test('Today workout uses the same approved dark teal as Coach without bright gradient',()=>{
 const start=css.indexOf('#workouts .workout-today-card{');
 const end=css.indexOf('}',start);
 assert.ok(start>=0&&end>start,'Today card style exists');
 const today=css.slice(start,end+1);
 assert.match(today,/background:#06373b!important/);
 assert.match(today,/background-image:none!important/);
 assert.match(today,/border:1\.5px solid #d7b476!important/);
 assert.match(read('live-coach-workout.css'),/\.coach-auto-panel\{[^\n]*background:#06373b/);
});
