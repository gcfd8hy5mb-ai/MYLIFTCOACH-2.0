'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const UX=require('../workout-active-ux.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const session=(date,planId,id,weight,reps)=>({
 created:date,planId,sets:[{exerciseId:id,weight,reps},{exerciseId:id,weight,reps}]
});
test('previous set uses newest valid session of exactly the same workout',()=>{
 const history=[
  session('2026-11-02T12:00:00Z','custom-a','press',40,8),
  session('2026-11-04T12:00:00Z','custom-b','press',90,10),
  session('2026-11-03T12:00:00Z','custom-a','press',45,9)
 ];
 const prior=UX.previous('press',history,'custom-a');
 assert.equal(prior.sets[0].weight,45);
 assert.equal(prior.sets[0].reps,9);
 assert.equal(prior.count,2);
 assert.equal(prior.date,'2026-11-03T12:00:00Z');
});
test('new workout defaults use previous same-plan set, but never another plan',()=>{
 const history=[session('2026-11-01T10:00:00Z','plan-one','press',65,7)];
 assert.deepEqual(UX.defaults('press',[],history,'plan-one'),{weight:65,reps:7,source:'previous'});
 assert.deepEqual(UX.defaults('press',[],history,'plan-two'),{weight:40,reps:10,source:'default'});
});
test('during a workout current sets override historical suggestions',()=>{
 const history=[session('2026-11-01T10:00:00Z','plan-one','press',65,7)];
 const logged=[{exerciseId:'press',weight:75,reps:6}];
 assert.deepEqual(UX.defaults('press',logged,history,'plan-one'),{weight:75,reps:6,source:'current'});
});
test('workout progress reflects only actual logged sets and exercises',()=>{
 const p=UX.progress(['press','row'],[{exerciseId:'press',weight:30,reps:10},{exerciseId:'press',weight:30,reps:12}]);
 assert.deepEqual(p,{logged:2,completedExercises:1,totalExercises:2,volume:660});
 assert.deepEqual(UX.progress(['press'],[]),{logged:0,completedExercises:0,totalExercises:1,volume:0});
});
test('invalid previous values are never shown or used as defaults',()=>{
 const hist=[{created:'2026-11-04T00:00:00Z',planId:'a',sets:[{exerciseId:'press',weight:Infinity,reps:8},{exerciseId:'press',weight:5,reps:101}]}];
 assert.equal(UX.previous('press',hist,'a'),null);
 assert.deepEqual(UX.defaults('press',[],hist,'a'),{weight:40,reps:10,source:'default'});
});
test('active workout uses inline checkmark logging and preserves existing draft/save pipeline',()=>{
 for(const token of ['id="workoutLog"','id="autoRestToggle"','id="activeWorkoutProgress"','data-addset','data-set-rows','data-undo','function updateExerciseFeedback(id)','window.MLC2SessionDraft?.save(activeDraftStore,activePlan,session.sets)','window.MLC2AccountWorkouts.save(localStorage,verifiedOwnerId,proposed)','queueWorkoutForSync(entry)']){
  assert.ok(app.includes(token),'missing workflow element: '+token);
 }
 assert.ok(html.includes('workout-active-ux.js?v=1'));
 assert.ok(html.includes('active-workout-ux.css?v=1'));
 assert.ok(app.includes("if($('autoRestToggle')?.checked)openRest()"));
 assert.ok(app.includes("const defaults=ux?.defaults(id,session.sets,demoSessions,activePlan.id)"));
});
