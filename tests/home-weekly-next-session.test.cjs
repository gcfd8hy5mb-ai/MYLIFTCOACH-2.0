'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Weekly=require('../weekly-workout-schedule.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const monday={id:'custom-mon',title:'Monday Workout',ids:['chest']};
const wednesday={id:'custom-wed',title:'Wednesday Workout',ids:['row']};
const plans=[monday,wednesday];
const local=values=>({getItem:key=>key===Weekly.KEY?JSON.stringify(values):null});
test('rest-day Sunday resolves the upcoming Monday custom workout without changing today',()=>{
 const storage=local({'0':'rest-day','1':'custom-mon','2':'rest-day','3':'custom-wed'});
 const sunday=new Date(2026,10,22,12);
 const today=Weekly.resolve({storage,custom:plans,date:sunday});
 assert.equal(today.scheduleSource,'rest');
 const next=Weekly.nextTraining({storage,custom:plans,date:sunday});
 assert.equal(next.id,'custom-mon');assert.equal(next.daysAhead,1);assert.equal(next.scheduledWeekday,1);
 assert.equal(Weekly.resolve({storage,custom:plans,date:sunday}).scheduleSource,'rest');
});
test('upcoming session starts today when it is a training day and skips later rest days',()=>{
 const storage=local({'0':'rest-day','1':'custom-mon','2':'rest-day','3':'custom-wed'});
 const mondayDate=new Date(2026,10,23,12),tuesday=new Date(2026,10,24,12);
 assert.equal(Weekly.nextTraining({storage,custom:plans,date:mondayDate}).daysAhead,0);
 const next=Weekly.nextTraining({storage,custom:plans,date:tuesday});
 assert.equal(next.id,'custom-wed');assert.equal(next.daysAhead,1);
});
test('missing schedule, all rest days, or deleted workouts cannot invent a next session',()=>{
 assert.equal(Weekly.nextTraining({storage:local({'0':'rest-day','1':'rest-day'}),custom:plans,date:new Date(2026,10,22,12)}),null);
 assert.equal(Weekly.nextTraining({storage:local({'1':'custom-deleted'}),custom:plans,date:new Date(2026,10,22,12)}),null);
});
test('Home plan summary reflects scheduled training days and custom routines',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/id="metricTrainingPlanDays"/);
 assert.match(html,/id="metricTrainingPlanType"/);
 assert.match(app,/function renderHomeTrainingPlan\(/);
 assert.match(app,/assigned\.filter/);
 assert.match(app,/Custom Program/);
 assert.match(app,/renderHomeTrainingPlan\(plan\)/);
 assert.doesNotMatch(html,/<strong>4-day<\/strong><small>Strength split<\/small>/);
});
test('Home next-session card and CTA are clickable even while Today is an explicit rest day',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('home-weekly-session.css');
 assert.ok(html.includes('id="homeNextSession"'));
 assert.ok(html.includes('id="homeNextSessionTitle"'));
 assert.ok(html.includes('home-weekly-session.css?v=1'));
 assert.ok(html.includes('weekly-workout-schedule.js?v=7'));
 assert.ok(app.includes("const plan=nextPlan(),upcoming=nextHomeSession(plan);"));
 assert.ok(app.includes("'todayStart').disabled=$('homeNextSession').disabled=!upcoming"));
 assert.ok(app.includes("startPreviewWorkout(event.currentTarget,nextHomeSession)"));
 assert.ok(app.includes("if(today?.scheduleSource!=='rest')return today"));
 assert.ok(app.includes("nextTraining({storage:planStorage(),presets:plans,custom})"));
 assert.match(css,/cursor:pointer/);
 assert.match(css,/:focus-visible/);
});
