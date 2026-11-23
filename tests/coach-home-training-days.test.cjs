'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const start=code.indexOf('function renderHomeTrainingPlan(){');
const end=code.indexOf('\nfunction renderHome(){',start);
if(start<0||end<0)throw Error('Training plan rendering boundary missing');
const fn=code.slice(start,end);
function render({schedule={},plans=[{id:'upper'},{id:'custom-upper'}],source='program',goalStatus='active',coachDays=5}={}){
 const els={metricTrainingPlanDays:{textContent:''},metricTrainingPlanType:{textContent:''}};
 const context={
  window:{
   MLC2WeeklySchedule:{read:()=>schedule},
   MLC2Custom:{allPlans:()=>plans},
   MLC2GoalProgram:{read:()=>({id:'program'}),progress:()=>({status:goalStatus})},
   MLC2CoachPreferences:{read:()=>({days:coachDays})}
  },
  plans,verifiedOwnerId:'test-owner',localStorage:{},planStorage:()=>({}),
  nextPlan:()=>({scheduleSource:source}),$:id=>els[id]
 };
 vm.runInNewContext(fn+';renderHomeTrainingPlan()',context);
 return {days:els.metricTrainingPlanDays.textContent,type:els.metricTrainingPlanType.textContent};
}
test('Home displays chosen five-day Coach program rather than default four-day split',()=>{
 assert.deepEqual(render(),{days:'5-day',type:'Coach goal program'});
});
test('User schedule takes priority over Coach preference',()=>{
 assert.deepEqual(render({schedule:{monday:'upper',tuesday:'custom-upper',wednesday:'rest-day'},coachDays:5}),
  {days:'2-day',type:'Custom weekly program'});
});
test('All-rest week remains a rest week',()=>{
 const schedule=Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d=>[d,'rest-day']));
 assert.deepEqual(render({schedule}),{days:'Rest week',type:'Weekly schedule'});
});
test('Manual selection or inactive program never mislabels as Coach',()=>{
 assert.deepEqual(render({source:'manual',coachDays:5}),{days:'4-day',type:'Strength split'});
 assert.deepEqual(render({goalStatus:'completed',coachDays:5}),{days:'4-day',type:'Strength split'});
});
test('Updating Coach training days refreshes Home immediately',()=>{
 assert.match(code,/renderAutonomousCoach\(\);renderHome\(\);notice\('Coach training preferences saved/);
});
