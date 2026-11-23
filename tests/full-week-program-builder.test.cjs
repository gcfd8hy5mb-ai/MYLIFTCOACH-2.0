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
 assert.ok(html.includes('full-week-builder.js?v=3'));
 assert.ok(html.includes('custom-workouts.css?v=5'));
 for(const term of ['weeklyProgramName','weeklyBuilderTabs','weeklyRestDay','weeklyExerciseSearch','weekly-target-grid','saveFullWeek','restSeconds'])assert.ok((ui+css).includes(term));
 assert.ok(ui.includes('onSaved?.(result)'));
});

test('weekly builder parses and binds saving to its original account',()=>{
 assert.doesNotThrow(()=>new vm.Script(read('full-week-builder.js')));
 const custom=read('custom-workouts.js'),ui=read('full-week-builder.js');
 assert.ok(custom.includes("if(expectedOwner!==owner)throw Error"));
 assert.ok(custom.includes('MLC2FullWeekBuilder?.forceClose?.()'));
 assert.ok(ui.includes('expectedOwner:initialOwner'));
});

test('each one-to-seven-day program saves all weekdays without inventing optional targets',()=>{
 for(let count=1;count<=7;count++){
  const fixture=setup(),program=Array.from({length:7},(_,i)=>i<count?{ids:['chest']}:{rest:true});
  const result=fixture.api.saveFullWeek({title:'Test week',days:program});
  assert.equal(result.created,count);
  assert.equal(result.restDays,7-count);
  const schedule=Weekly.read({getItem:key=>fixture.storage.getItem(fixture.key(key))});
  assert.equal(Object.keys(schedule).length,7);
  assert.ok(result.plans.every(plan=>Object.keys(plan.targets).length===0));
 }
});

test('weekly editor prevents duplicate dialogs and rejects invalid targets before saving',async()=>{
 const dialogs=[],messages=[];let saves=0;
 function node(){
  return {events:{},value:'',addEventListener(type,fn){this.events[type]=fn},focus(){},innerHTML:''};
 }
 const document={
  body:{append(dialog){dialogs.push(dialog)}},
  createElement(){
   const fields=new Map(),dialog=node();
   dialog.querySelector=selector=>{
    if(!fields.has(selector))fields.set(selector,node());
    return fields.get(selector);
   };
   dialog.remove=()=>dialogs.splice(dialogs.indexOf(dialog),1);
   return dialog;
  },
  addEventListener(){},removeEventListener(){}
 };
 const window={MLC2Custom:{getOwner:()=>null,scheduleVersion:()=>null,runPlanWrite:work=>work(),saveFullWeek(){saves++}},
  MLC2_EXERCISE_CATALOG:[{id:'chest',name:'Press',group:'Chest'}]};
 let confirmed=false;
 vm.runInNewContext(read('full-week-builder.js'),{window,document,confirm:()=>confirmed,alert:message=>messages.push(message)});
 window.MLC2FullWeekBuilder.open();
 const dialog=dialogs[0],q=id=>dialog.querySelector('#'+id),day=q('weeklyBuilderDay');
 q('weeklyProgramName').value='Week';q('weeklyProgramName').events.input();
 window.MLC2FullWeekBuilder.open();assert.equal(dialogs.length,1);
 day.events.change({target:{id:'weeklyRestDay',checked:false}});
 day.events.click({target:{closest:selector=>selector==='[data-week-add]'?{dataset:{weekAdd:'chest'}}:null}});
 const input=value=>day.events.input({target:{id:'',matches:()=>true,value,dataset:{weekTarget:'chest',field:'reps'}}});
 input('101');confirmed=true;
 await q('saveWeeklyProgram').events.click();assert.equal(saves,0);assert.match(messages.at(-1),/Correct the optional targets/);
 input('');await q('saveWeeklyProgram').events.click();assert.equal(saves,1);assert.equal(dialogs.length,0);
});

test('interrupted program writes resume only when pending keys still match their recorded values',()=>{
 const t=setup(),plans=t.key('mlc2-custom-plans-v1'),week=t.key(Weekly.KEY),journal=t.key('mlc2-plan-write-v1');
 const before=JSON.stringify([{id:'custom-old',ids:['row']}]);
 const after=JSON.stringify([{id:'custom-new',ids:['chest']},{id:'custom-old',ids:['row']}]);
 const oldWeek=JSON.stringify({'1':'custom-old'}),newWeek=JSON.stringify({'1':'custom-new'});
 t.storage.setItem(plans,after);
 t.storage.setItem(week,oldWeek);
 t.storage.setItem(journal,JSON.stringify({field:'after',changes:[
  {key:plans,before,after},{key:week,before:oldWeek,after:newWeek}
 ]}));
 t.api.setOwner('different-account');
 assert.equal(t.api.recoverPlanWrite(),false);
 assert.equal(t.storage.getItem(week),oldWeek);
 t.api.setOwner('test-user');
 assert.throws(()=>t.api.requireStablePlans(),/pending/);
 assert.equal(t.api.recoverPlanWrite(),true);
 assert.equal(t.storage.getItem(week),newWeek);
 assert.equal(t.storage.getItem(journal),null);
 assert.equal(t.api.allPlans([]).length,2);
});

test('recovery preserves the journal and newer writes when an interrupted transaction diverges',()=>{
 const t=setup(),plans=t.key('mlc2-custom-plans-v1'),week=t.key(Weekly.KEY),journal=t.key('mlc2-plan-write-v1');
 const retained='{"2":"rest-day"}',after=JSON.stringify([{id:'custom-new',ids:['chest']}]);
 t.storage.setItem(week,retained);
 const pending=JSON.stringify({field:'after',changes:[
  {key:plans,before:null,after},{key:week,before:null,after:'{"1":"custom-new"}'}
 ]});
 t.storage.setItem(journal,pending);
 assert.throws(()=>t.api.recoverPlanWrite(),/changed in another window/);
 assert.equal(t.storage.getItem(week),retained);
 assert.equal(t.storage.getItem(plans),null);
 assert.equal(t.storage.getItem(journal),pending);
});

test('goal program edits roll back calendar, source and calorie profile if storage fails',()=>{
 const t=setup(),calendar=t.key('mlc2-goal-program-v1'),source=t.key('mlc2-goal-program-source-v1');
 const calories=t.key('mlc2-estimated-calorie-goal-v1'),journal=t.key('mlc2-plan-write-v1');
 t.storage.setItem(calendar,'old-calendar');
 t.storage.setItem(source,'old-source');
 t.storage.setItem(calories,'old-profile');
 t.failure.key=source;
 assert.throws(()=>t.api.transactProgram(staged=>{
  staged.setItem(calendar,'new-calendar');
  staged.setItem(source,'new-source');
  staged.setItem(calories,'new-profile');
 }),/Storage blocked/);
 assert.equal(t.storage.getItem(calendar),'old-calendar');
 assert.equal(t.storage.getItem(source),'old-source');
 assert.equal(t.storage.getItem(calories),'old-profile');
 assert.equal(t.storage.getItem(journal),null);
});
