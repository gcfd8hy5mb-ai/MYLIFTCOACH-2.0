'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const program=fs.readFileSync('custom-workouts.js','utf8');
function setup(){
 const data=new Map(),store={
  getItem:key=>data.has(key)?data.get(key):null,
  setItem:(key,value)=>data.set(key,String(value)),
  removeItem:key=>data.delete(key)
 };
 const window={MLC2_EXERCISE_CATALOG:[
  {id:'press',name:'Press',group:'Chest'},{id:'row',name:'Row',group:'Back'}
 ]};
 vm.runInNewContext(program,{window,localStorage:store,document:{},Date,Math,JSON});
 return {store,window,data};
}
test('Saving a Coach day adds a new custom workout without selecting it or altering the schedule',()=>{
 const {store,window}=setup();
 store.setItem('mlc2-selected-workout-v1','custom-existing');
 store.setItem('mlc2-weekly-schedule-v1',JSON.stringify({'1':'custom-existing'}));
 store.setItem('mlc2-custom-plans-v1',JSON.stringify([{id:'custom-existing',title:'Original',ids:['press'],kind:'Custom'}]));
 const saved=window.MLC2Custom.saveCoachDay({day:2,exercises:[{id:'row'}]});
 assert.equal(saved.title,'Coach Day 2');
 assert.equal(saved.coachSaved,true);
 assert.ok(saved.id.startsWith('custom-'));
 assert.equal(store.getItem('mlc2-selected-workout-v1'),'custom-existing');
 assert.equal(store.getItem('mlc2-weekly-schedule-v1'),'{"1":"custom-existing"}');
 const plans=JSON.parse(store.getItem('mlc2-custom-plans-v1'));
 assert.equal(plans.length,2);assert.equal(plans[1].title,'Original');
 assert.deepEqual(plans[0].ids,['row']);
});
test('Verified user saves are isolated from guest workouts',()=>{
 const {store,window}=setup();
 const guest=window.MLC2Custom.saveCoachDay({day:1,exercises:[{id:'press'}]});
 window.MLC2Custom.setOwner('account_42');
 const account=window.MLC2Custom.saveCoachDay({day:2,exercises:[{id:'row'}]});
 assert.notEqual(guest.id,account.id);
 assert.equal(JSON.parse(store.getItem('mlc2-custom-plans-v1')).length,1);
 assert.equal(JSON.parse(store.getItem('mlc2-custom-plans-v1:user:account_42')).length,1);
});
test('Unknown, duplicate or missing exercises are rejected before any write',()=>{
 const {store,window}=setup();
 for(const day of [
  {day:1,exercises:[]},
  {day:1,exercises:[{id:'nonexistent'}]},
  {day:1,exercises:[{id:'row'},{id:'row'}]}
 ])assert.throws(()=>window.MLC2Custom.saveCoachDay(day));
 assert.equal(store.getItem('mlc2-custom-plans-v1'),null);
});
test('Unreadable stored workouts are never overwritten by Coach',()=>{
 const {store,window}=setup();
 store.setItem('mlc2-custom-plans-v1','{corrupt-json');
 assert.throws(()=>window.MLC2Custom.saveCoachDay({day:1,exercises:[{id:'row'}]}),/unreadable/);
 assert.equal(store.getItem('mlc2-custom-plans-v1'),'{corrupt-json');
});

test('Saving Coach does not change unscheduled Home fallback; explicit selection can activate it',()=>{
 const {store,window}=setup();
 const preset={id:'upper-a',title:'Original scheduled preset',ids:['press']};
 const weekly=require('../weekly-workout-schedule.js');
 const saved=window.MLC2Custom.saveCoachDay({day:1,exercises:[{id:'row'}]});
 const custom=window.MLC2Custom.allPlans([]); 
 assert.equal(weekly.resolve({presets:[preset],custom,storage:store,date:new Date('2026-11-23T12:00:00')}).id,'upper-a');
 assert.equal(window.MLC2Custom.currentPlan([preset],0).id,'upper-a');
 store.setItem('mlc2-selected-workout-v1',saved.id);
 assert.equal(weekly.resolve({presets:[preset],custom,storage:store,date:new Date('2026-11-23T12:00:00')}).id,saved.id);
});

test('Edited Coach routines retain their non-default status and do not silently select Today',()=>{
 const source=fs.readFileSync('custom-workouts.js','utf8');
 assert.match(source,/coachSaved:existing\?\.coachSaved===true/);
 assert.match(source,/if\(!updated\.coachSaved\)\s*\{\s*try\{localStorage\.setItem\(scoped\(TODAY\),updated\.id\)/);
 const {store,window}=setup();
 const newCoach=window.MLC2Custom.saveCoachDay({day:1,exercises:[{id:'row'}]});
 assert.equal(window.MLC2Custom.allPlans([]).find(p=>p.id===newCoach.id).coachSaved,true);
 const old=JSON.parse(store.getItem('mlc2-custom-plans-v1'));
 old[0]={...old[0],title:'Coach Day 1 Edited',coachSaved:true};
 store.setItem('mlc2-custom-plans-v1',JSON.stringify(old));
 assert.equal(window.MLC2Custom.allPlans([])[0].coachSaved,true);
 assert.equal(window.MLC2Custom.currentPlan([{id:'preset',title:'Preset',ids:['press']}],0).id,'preset');
});
