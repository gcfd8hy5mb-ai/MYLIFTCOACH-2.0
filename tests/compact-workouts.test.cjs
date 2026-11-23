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
test('Scheduled routines appear first while unused presets remain available for manual selection',()=>{
 assert.match(app,/const all=\[\.\.\.custom,\.\.\.plans\]/);
 assert.match(app,/const weeklyMap=window\.MLC2WeeklySchedule\?\.read\(planStorage\(\)\)\|\|\{\}/);
 assert.match(app,/const scheduled=all\.filter\(p=>scheduledDays\.has\(p\.id\)\)/);
 assert.match(app,/const otherPresets=plans\.filter\(p=>!scheduledDays\.has\(p\.id\)\)/);
 assert.match(app,/section\(scheduled,'Your scheduled workouts'/);
 assert.match(app,/otherPresets\.length\?'<details class="workout-other-presets"/);
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
 assert.ok(html.includes('compact-workouts.css?v=5'));
 assert.match(css,/#workouts \.workout-today-card/);
 assert.match(css,/#workouts \.workout-compact-card/);
 assert.match(css,/background:#04252d!important/);
 assert.match(css,/border:1px solid rgba\(213,176,109,\.65\)/);
 assert.ok(html.includes('active-workout-ux.css?v=5'));
 assert.ok(html.includes('workout-auth-ux-fix.css?v=2'));
 assert.match(app,/queueWorkoutForSync\(entry\)/);
 assert.match(app,/window\.MLC2SessionDraft\.save\(draft,plan,next\)/);
});

test('Today workout follows approved rich dark-teal card material, not the old light teal',()=>{
 const start=css.indexOf('#workouts .workout-today-card{');
 const end=css.indexOf('}',start);
 assert.ok(start>=0&&end>start,'Today card style exists');
 const today=css.slice(start,end+1);
 assert.match(today,/background-color:#04252d!important/);
 assert.match(today,/background-image:var\(--mlc-rich-teal-surface/);
 assert.match(today,/border:1\.5px solid #d7b476!important/);
 assert.match(read('rich-teal-cards.css'),/--mlc-rich-teal-top:#04252d/);
});

test('following the weekly schedule shows Today and visible confirmation',()=>{
 const schedule=read('weekly-workout-schedule.js');
 assert.ok(html.includes('weekly-workout-schedule.js?v=7'));
 assert.match(schedule,/onChanged\?\.\('follow',selected\)/);
 assert.match(schedule,/Following weekly schedule · Today:/);
 assert.match(schedule,/Manual selection active:/);
 assert.match(app,/if\(action==='follow'\)\{/);
 assert.match(app,/setWorkoutTab\('today'\)/);
 assert.match(app,/notice\(plan\?\.scheduleSource==='weekly'/);
});
test('compact workout and schedule cards use the approved deep teal material',()=>{
 assert.match(css,/#workouts \.workout-compact-card[\s\S]*?background:#04252d!important/);
 assert.match(css,/#workouts \.workout-schedule-panel[\s\S]*?background:#04252d!important/);
 assert.match(css,/--mlc-rich-teal-surface/);
});

test('weekday assignment labels are not inferred from the full preset catalog',()=>{
 assert.match(app,/scheduledDays\.get\(id\)\.push\(window\.MLC2WeeklySchedule\.DAYS\[day\]\)/);
 assert.match(app,/Scheduled: /);
 const css=read('compact-workouts.css');
 assert.match(css,/#workouts \.workout-other-presets/);
 assert.match(css,/#workouts \.workout-assigned-days/);
 assert.ok(html.includes('app.js?v=50'));
});
