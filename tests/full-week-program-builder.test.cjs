'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Weekly=require('../weekly-workout-schedule.js');
function setup(owner='test-user'){
 const data=new Map(),failure={key:null};let syncs=0;
 const storage={getItem:k=>data.has(k)?data.get(k):null,
  setItem(k,v){if(failure.key===k)throw Error('Storage blocked');data.set(k,String(v))},
  removeItem:k=>data.delete(k)};
 const win={MLC2WeeklySchedule:Weekly,
  MLC2ScheduleAuxSync:()=>syncs++,
  MLC2_EXERCISE_CATALOG:[{id:'chest',name:'Chest Press',group:'Chest'},{id:'row',name:'Seated Row',group:'Back'}]};
 vm.runInNewContext(read('custom-workouts.js'),{window:win,localStorage:storage,console});
 win.MLC2Custom.setOwner(owner);
 return {data,storage,failure,api:win.MLC2Custom,key:k=>k+':user:'+owner,get syncs(){return syncs}};
}
const days=()=>[
 {rest:true},{title:'Monday Chest',rest:false,ids:['chest'],targets:{chest:{sets:3,reps:10,weight:85,restSeconds:90}}},
 {rest:true},{title:'Wednesday Back',rest:false,ids:['row'],targets:{row:{sets:4}}},
 {rest:true},{rest:true},{rest:true}
];
test('one save creates different workouts for different weekdays with explicit rest days',()=>{
 const t=setup(),old=[{id:'custom-old',title:'Old',ids:['chest']}];
 t.storage.setItem(t.key('mlc2-custom-plans-v1'),JSON.stringify(old));
 t.storage.setItem(t.key('mlc2-weekly-schedule-v1'),JSON.stringify({'1':'custom-old'}));
 t.storage.setItem(t.key('mlc2-selected-workout-v1'),'custom-old');
 const result=t.api.saveFullWeek({title:'My Split',days:days()});
 assert.equal(result.created,2);
 assert.equal(result.restDays,5);
 const plans=t.api.allPlans([]);
 assert.equal(plans.length,3);
 assert.equal(plans.find(p=>p.id==='custom-old').title,'Old');
 assert.equal(plans.find(p=>p.title==='Monday Chest').targets.chest.weight,85);
 const schedule=JSON.parse(t.storage.getItem(t.key('mlc2-weekly-schedule-v1')));
 assert.equal(schedule['0'],'rest-day');
 assert.equal(schedule['2'],'rest-day');
 assert.equal(schedule['3'],plans.find(p=>p.title==='Wednesday Back').id);
 assert.equal(t.storage.getItem(t.key('mlc2-selected-workout-v1')),'');
 const scoped={getItem:k=>t.storage.getItem(t.key(k))};
 const monday=Weekly.resolve({storage:scoped,custom:plans,date:new Date(2026,10,23,12)});
 const tuesday=Weekly.resolve({storage:scoped,custom:plans,date:new Date(2026,10,24,12)});
 assert.equal(monday.title,'Monday Chest');
 assert.equal(monday.scheduleSource,'weekly');
 assert.equal(tuesday.scheduleSource,'rest');
 assert.equal(tuesday.ids.length,0);
 assert.equal(t.syncs,1);
});
test('failure rolls back every category without deleting prior routines',()=>{
 const t=setup();
 const old=[{id:'custom-old',title:'Old',ids:['chest']}];
 const pk=t.key('mlc2-custom-plans-v1'),sk=t.key('mlc2-weekly-schedule-v1'),tk=t.key('mlc2-selected-workout-v1');
 t.storage.setItem(pk,JSON.stringify(old));t.storage.setItem(sk,JSON.stringify({'2':'custom-old'}));t.storage.setItem(tk,'custom-old');
 t.failure.key=sk;
 assert.throws(()=>t.api.saveFullWeek({title:'New',days:days()}),/Storage blocked/);
 assert.equal(t.storage.getItem(pk),JSON.stringify(old));
 assert.equal(t.storage.getItem(sk),JSON.stringify({'2':'custom-old'}));
 assert.equal(t.storage.getItem(tk),'custom-old');
 assert.equal(t.syncs,0);
});
test('invalid or empty weeks never alter existing data',()=>{
 const t=setup(),before=t.data.size;
 assert.throws(()=>t.api.saveFullWeek({title:'All rest',days:Array.from({length:7},()=>({rest:true}))}),/at least one training day/);
 assert.throws(()=>t.api.saveFullWeek({title:'Invalid',days:[{ids:['not-an-exercise']},...Array.from({length:6},()=>({rest:true}))]}),/Choose 1–40/);
 assert.equal(t.data.size,before);
});
test('seven distinct routines fit in one save; old workouts still available',()=>{
 const t=setup();
 const d=Array.from({length:7},(_,i)=>({rest:false,title:'Day '+i,ids:[i%2?'row':'chest'],targets:{}}));
 const result=t.api.saveFullWeek({title:'Every Day',days:d});
 assert.equal(result.created,7);assert.equal(t.api.allPlans([]).length,7);
 assert.equal(Weekly.read({getItem:k=>t.storage.getItem(t.key(k))})['6'],result.plans[6].id);
});
test('rest selection is available in schedule editor and excludes workout launch',()=>{
 const sch=read('weekly-workout-schedule.js'),app=read('app.js');
 assert.ok(sch.includes("rest.value='rest-day'"));
 assert.ok(app.includes("standard?.scheduleSource==='rest'"));
 assert.ok(app.includes("start.disabled=!activeId||selected?.scheduleSource==='rest'"));
 assert.ok(app.includes('restDay'));
});
test('UI has single and weekly builders with editable day tabs and optional targets',()=>{
 const html=read('index.html'),ui=read('full-week-builder.js'),css=read('custom-workouts.css');
 assert.ok(html.includes('id="createWeeklyProgram"'));
 assert.ok(html.includes('id="createWorkout"'));
 assert.ok(html.includes('full-week-builder.js?v=1'));
 assert.ok(html.includes('custom-workouts.css?v=5'));
 for(const term of ['weeklyProgramName','weeklyBuilderTabs','weeklyRestDay','weeklyExerciseSearch','weekly-target-grid','saveFullWeek','restSeconds'])assert.ok((ui+css).includes(term));
 assert.ok(ui.includes('onSaved?.(result)'));
});
