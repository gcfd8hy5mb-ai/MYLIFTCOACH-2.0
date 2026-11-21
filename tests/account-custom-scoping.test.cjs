'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','custom-workouts.js'),'utf8');
function make(){
 const rows=new Map();
 const localStorage={getItem:key=>rows.has(key)?rows.get(key):null,setItem:(key,value)=>rows.set(key,String(value)),removeItem:key=>rows.delete(key)};
 const context={window:{MLC2_EXERCISE_CATALOG:[{id:'chest-press',name:'Chest Press',group:'Chest'}]},localStorage,console};
 vm.runInNewContext(source,context,{filename:'custom-workouts.js'});
 return {app:context.window.MLC2Custom,rows};
}
const custom=id=>[{id,title:'Chest Routine',ids:['chest-press']}];
test('guest workouts remain distinct from signed-in account workouts',()=>{
 const {app,rows}=make();
 rows.set('mlc2-custom-plans-v1',JSON.stringify(custom('custom-guest')));
 rows.set('mlc2-custom-plans-v1:user:account-a',JSON.stringify(custom('custom-a')));
 rows.set('mlc2-custom-plans-v1:user:account-b',JSON.stringify(custom('custom-b')));
 const presets=[{id:'upper-a',title:'Upper',ids:['chest-press']}];
 assert.equal(app.allPlans(presets)[0].id,'custom-guest');
 app.setOwner('account-a');assert.equal(app.allPlans(presets)[0].id,'custom-a');
 app.setOwner('account-b');assert.equal(app.allPlans(presets)[0].id,'custom-b');
 app.setOwner(null);assert.equal(app.allPlans(presets)[0].id,'custom-guest');
});
test('selected routine stays inside its own account namespace',()=>{
 const {app,rows}=make();
 rows.set('mlc2-custom-plans-v1:user:account-a',JSON.stringify(custom('custom-a')));
 rows.set('mlc2-custom-plans-v1:user:account-b',JSON.stringify(custom('custom-b')));
 rows.set('mlc2-selected-workout-v1:user:account-a','custom-a');
 app.setOwner('account-a');
 assert.equal(app.currentPlan([{id:'upper-a',title:'Upper',ids:['chest-press']}],0).id,'custom-a');
 app.setOwner('account-b');
 assert.equal(app.currentPlan([{id:'upper-a',title:'Upper',ids:['chest-press']}],0).id,'custom-b');
});
test('invalid owner IDs are rejected',()=>{
 const {app}=make();
 assert.throws(()=>app.setOwner('../guest'),/Verified owner/);
});
