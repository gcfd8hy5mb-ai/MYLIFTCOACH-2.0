'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const schedule=require('../weekly-workout-schedule.js');
const app=fs.readFileSync('app.js','utf8'),custom=fs.readFileSync('custom-workouts.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('workouts-tabs-n.css','utf8');
const storage=()=>{const store=new Map();return {getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}};
const presets=[{id:'preset-push',title:'Push',ids:['press']}];
const coach={id:'custom-coach-1',title:'Coach Day 1',coachSaved:true,ids:['row']};
test('Schedule assignment replaces only requested weekday; explicit Today choice remains unchanged',()=>{
 const s=storage();
 s.setItem(schedule.KEY,JSON.stringify({'1':'preset-push','3':'preset-push'}));
 s.setItem('mlc2-selected-workout-v1','preset-push');
 schedule.assign(s,3,coach.id,[coach,...presets]);
 assert.equal(schedule.read(s)['1'],'preset-push');
 assert.equal(schedule.read(s)['3'],coach.id);
 assert.equal(s.getItem('mlc2-selected-workout-v1'),'preset-push');
 assert.equal(schedule.resolve({presets,custom:[coach],storage:s,date:new Date('2026-11-25T12:00:00')}).id,'preset-push');
 schedule.clearOverride(s);
 assert.equal(schedule.resolve({presets,custom:[coach],storage:s,date:new Date('2026-11-25T12:00:00')}).id,coach.id);
});
test('Invalid weekdays and unknown plan IDs do not write schedule',()=>{
 const s=storage();const baseline=s.getItem(schedule.KEY);
 for(const [day,id] of [[7,coach.id],[2,'not-a-plan'],[-1,coach.id]]){
  assert.throws(()=>schedule.assign(s,day,id,[coach,...presets]));
  assert.equal(s.getItem(schedule.KEY),baseline);
 }
});
test('Coach scheduling has explicit confirmation, ownership check, and no automatic selection',()=>{
 assert.ok(custom.includes('data-custom-schedule'));
 assert.ok(custom.includes('p.coachSaved?'));
 assert.ok(custom.includes("onSchedule?.(item)"));
 assert.ok(app.includes('pendingCoachScheduleOwner!==verifiedOwnerId'));
 assert.ok(app.includes('window.MLC2WeeklySchedule.assign(planStorage(),day,id,window.MLC2Custom.allPlans(plans))'));
 assert.ok(app.includes("if(!confirm('Assign '"));
 const fn=app.slice(app.indexOf('function assignCoachSchedule(){'),app.indexOf('function renderWorkouts(){'));
 assert.doesNotMatch(fn,/setItem\([^)]*selected-workout|clearOverride/);
});
test('Panel is connected, accessible and contained inside Workouts styling',()=>{
 for(const id of ['coachSchedulePanel','coachScheduleDay','coachScheduleApply','coachScheduleCancel','coachScheduleStatus'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes("addEventListener('click',assignCoachSchedule)"));
 assert.ok(app.includes("addEventListener('click',cancelCoachSchedule)"));
 assert.ok(css.includes('#workouts .coach-schedule-panel'));
 assert.ok(css.includes('#workouts .coach-schedule-panel[hidden]'));
});

test('Coach scheduling panel is moved into the Schedule tab and is opened there',()=>{
 const tabs=fs.readFileSync('workouts-tabs-n.js','utf8');
 assert.ok(tabs.includes("const coachSchedule=page.querySelector('#coachSchedulePanel')"));
 assert.ok(tabs.includes('panels.schedule.append(coachSchedule)'));
 assert.ok(tabs.includes('window.MLC2WorkoutsSelectTab=select'));
 assert.ok(app.includes("window.MLC2WorkoutsSelectTab('schedule')"));
});
