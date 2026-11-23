'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Weekly=require('../weekly-workout-schedule.js');
function make(owner='account-1'){
 const rows=new Map(),fail={key:null};
 const localStorage={
  getItem:k=>rows.has(k)?rows.get(k):null,
  setItem(k,v){if(fail.key===k)throw Error('Storage write blocked');rows.set(k,String(v))},
  removeItem:k=>rows.delete(k)
 };
 let synced=0;
 const win={MLC2WeeklySchedule:Weekly,MLC2ScheduleAuxSync:()=>synced++,
  MLC2_EXERCISE_CATALOG:[{id:'press',name:'Press',group:'Chest'}]};
 vm.runInNewContext(read('custom-workouts.js'),{window:win,localStorage,console});
 win.MLC2Custom.setOwner(owner);
 const key=k=>owner?k+':user:'+owner:k;
 const base={id:'custom-new',title:'New',ids:['press'],targets:{press:{sets:3,reps:10}}};
 return {rows,fail,api:win.MLC2Custom,localStorage,key,base,get synced(){return synced}};
}
test('create routine assigns multiple weekdays and automatically clears manual selection',()=>{
 const d=make();
 d.localStorage.setItem(d.key(Weekly.KEY),JSON.stringify({'0':'lower-a','1':'upper-a','3':'upper-a'}));
 d.localStorage.setItem(d.key('mlc2-selected-workout-v1'),'upper-a');
 const result=d.api.saveWithWeekdays({next:[d.base],updated:d.base,chosenDays:[1,3,5]});
 assert.deepEqual(JSON.parse(d.localStorage.getItem(d.key(Weekly.KEY))),{'0':'lower-a','1':'custom-new','3':'custom-new','5':'custom-new'});
 assert.equal(d.localStorage.getItem(d.key('mlc2-selected-workout-v1')),'');
 const plan=Weekly.resolve({storage:{getItem:k=>d.localStorage.getItem(d.key(k))},custom:d.api.allPlans([]),presets:[{id:'upper-a',title:'Upper',ids:['press']}],date:new Date(2026,10,23,12)});
 assert.equal(plan.id,'custom-new');
 assert.equal(plan.scheduleSource,'weekly');
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{days:[1,3,5],scheduled:true});
 assert.deepEqual(JSON.parse(JSON.stringify(d.api.allPlans([])[0].targets)),d.base.targets);
 assert.equal(d.synced,1);
});
test('editing a routine changes only its own selected days and preserves other assignments',()=>{
 const d=make();
 d.localStorage.setItem(d.key('mlc2-custom-plans-v1'),JSON.stringify([d.base]));
 d.localStorage.setItem(d.key(Weekly.KEY),JSON.stringify({'1':'custom-new','2':'lower-a','4':'custom-new','6':'other'}));
 d.api.saveWithWeekdays({next:[d.base],updated:d.base,existing:d.base,chosenDays:[4,5]});
 assert.deepEqual(JSON.parse(d.localStorage.getItem(d.key(Weekly.KEY))),{'2':'lower-a','4':'custom-new','5':'custom-new','6':'other'});
});
test('editing and clearing all selected days removes only that routine from schedule',()=>{
 const d=make();
 d.localStorage.setItem(d.key('mlc2-custom-plans-v1'),JSON.stringify([d.base]));
 d.localStorage.setItem(d.key(Weekly.KEY),JSON.stringify({'0':'custom-new','1':'upper-a'}));
 d.api.saveWithWeekdays({next:[d.base],updated:d.base,existing:d.base,chosenDays:[]});
 assert.deepEqual(JSON.parse(d.localStorage.getItem(d.key(Weekly.KEY))),{'1':'upper-a'});
});
test('no weekdays is allowed; new unscheduled routine retains existing use-for-today behavior',()=>{
 const d=make();
 d.api.saveWithWeekdays({next:[d.base],updated:d.base,chosenDays:[]});
 assert.equal(d.localStorage.getItem(d.key(Weekly.KEY)),null);
 assert.equal(d.localStorage.getItem(d.key('mlc2-selected-workout-v1')),'custom-new');
});
test('failed weekday save rolls back plan and schedule without data loss or cloud scheduling',()=>{
 const d=make(),original={id:'custom-old',title:'Old',ids:['press']};
 d.localStorage.setItem(d.key('mlc2-custom-plans-v1'),JSON.stringify([original]));
 d.localStorage.setItem(d.key(Weekly.KEY),JSON.stringify({'2':'custom-old'}));
 d.localStorage.setItem(d.key('mlc2-selected-workout-v1'),'custom-old');
 d.fail.key=d.key(Weekly.KEY);
 assert.throws(()=>d.api.saveWithWeekdays({next:[original,d.base],updated:d.base,chosenDays:[2]}),/Storage write blocked/);
 assert.deepEqual(JSON.parse(d.localStorage.getItem(d.key('mlc2-custom-plans-v1'))),[original]);
 assert.equal(d.localStorage.getItem(d.key(Weekly.KEY)),JSON.stringify({'2':'custom-old'}));
 assert.equal(d.localStorage.getItem(d.key('mlc2-selected-workout-v1')),'custom-old');
 assert.equal(d.synced,0);
});
test('guest weekly schedule follows chosen routine with no manual override',()=>{
 const d=make(null);
 d.localStorage.setItem('mlc2-selected-workout-v1','upper-a');
 d.api.saveWithWeekdays({next:[d.base],updated:d.base,chosenDays:[6]});
 assert.equal(d.localStorage.getItem('mlc2-selected-workout-v1'),null);
 assert.equal(JSON.parse(d.localStorage.getItem(Weekly.KEY))['6'],'custom-new');
});
test('editor offers all days before save, preserves optional exercise targets and approved styling',()=>{
 const js=read('custom-workouts.js'),css=read('custom-workouts.css'),html=read('index.html');
 for(const phrase of ['Training days','customWeekdays','data-custom-day','chosenDays','saveWithWeekdays']){
  assert.ok(js.includes(phrase),phrase);
 }
 assert.ok(js.indexOf('custom-editor-weekdays')<js.indexOf('custom-editor-picker'));
 assert.ok(js.includes('targets:normalizeTargets(draftTargets,selected)'));
 assert.match(css,/custom-weekday-grid/);
 assert.ok(html.includes('custom-workouts.css?v=5'));
});
