'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const schedule=require('../weekly-workout-schedule.js');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
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
test('Coach shortcut enters the native Schedule panel, rejects stale accounts and requires confirmation',()=>{
 const vm=require('node:vm');
 const from=app.indexOf('let pendingCoachSchedule='),to=app.indexOf('function renderWorkouts(){');
 const nodes=new Map(),s=storage();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'3',focus(){this.focused=true}});return nodes.get(id)};
 let confirmation=false,tab;
 const ctx={coach,$,verifiedOwnerId:'a',authEpoch:1,plans:presets,
  window:{MLC2WeeklySchedule:schedule,MLC2Custom:{allPlans:()=>[coach,...presets]}},
  planStorage:()=>s,confirm:()=>confirmation,setWorkoutTab:name=>{tab=name},
  page:'workouts',renderHome(){},renderWorkouts(){},notice(){}};
 vm.runInNewContext(app.slice(from,to),ctx);
 vm.runInNewContext('openCoachSchedule(coach);assignCoachSchedule()',ctx);
 assert.equal(tab,'schedule');
 assert.equal($('coachScheduleDay').focused,true);
 assert.deepEqual(schedule.read(s),{});
 ctx.confirm=()=>true;ctx.authEpoch=2;
 vm.runInNewContext('assignCoachSchedule()',ctx);
 assert.deepEqual(schedule.read(s),{});
 vm.runInNewContext('openCoachSchedule(coach);assignCoachSchedule()',ctx);
 assert.equal(schedule.read(s)['3'],coach.id);
 assert.equal(s.getItem('mlc2-selected-workout-v1'),null);
 assert.match(html,/<section id="workoutPanelSchedule"[\s\S]*?<article id="coachSchedulePanel"/);
});
