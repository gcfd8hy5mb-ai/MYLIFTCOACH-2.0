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
 assert.deepEqual(UX.defaults('press',[],history,'plan-two'),{weight:'',reps:'',source:'empty'});
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
 assert.deepEqual(UX.defaults('press',[],hist,'a'),{weight:'',reps:'',source:'empty'});
});
test('active workout uses inline checkmark logging and preserves existing draft/save pipeline',()=>{
 for(const token of ['id="workoutLog"','id="autoRestToggle"','id="activeWorkoutProgress"','data-addset','data-set-rows','data-undo','function updateExerciseFeedback(id)','window.MLC2SessionDraft.save(draft,plan,next)','window.MLC2AccountWorkouts.complete(localStorage,workoutStartedOwner,entry)','queueWorkoutForSync(proposed.find(row=>row.id===workoutId))']){
  assert.ok(app.includes(token),'missing workflow element: '+token);
 }
 assert.ok(html.includes('workout-active-ux.js?v=3'));
 assert.ok(html.includes('active-workout-ux.css?v=7'));
 assert.ok(app.includes("if(autoRest&&$('autoRestToggle')?.checked)openRest(id)"));
 assert.ok(app.includes("betaView().mode==='pro'&&e.group!=='Cardio'"));
 assert.ok(app.includes("coach?.status==='ready'"));
 assert.ok(app.includes("Optional · no weights changed"));
 assert.ok(app.includes("const defaults=ux?.defaults(id,session.sets,demoSessions,activePlan.id)"));
});

test('approved marble workout styling keeps wallpaper fixed behind readable cards',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','active-workout-ux.css'),'utf8');
 assert.match(css,/url\('\.\/assets\/approved-vertical-marble-sharp\.webp\?v=11'\)/);
 assert.match(css,/background-image:linear-gradient\(rgba\(1,24,29,\.24\),rgba\(1,23,29,\.36\)\)/);
 assert.match(css,/#modal \.active-log-card\{\s*background:#063238!important/);
 assert.match(css,/background:#052d34!important/);
 assert.match(css,/height:min\(100dvh,var\(--workout-height,100dvh\)\)!important/);
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.ok(!app.includes('demoSessions=[]; // styling change'),'workout data must remain intact');
});

test('blank, null and future weights never prefill the next workout',()=>{
 const hist=[session('2999-01-01T00:00:00Z','a','press',110,10),
  session('2026-11-01T00:00:00Z','a','press','',10),
  session('2026-11-02T00:00:00Z','a','press',null,10)];
 assert.equal(UX.previous('press',hist,'a'),null);
 assert.equal(UX.progress(['press'],[{exerciseId:'press',weight:'',reps:10}]).logged,0);
});


test('active workout close control stays beneath iPhone status area and keeps the original exit action',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','active-workout-ux.css'),'utf8');
 assert.match(css,/#modal\.workout-close-overlay > \.modal-close\{[\s\S]*?position:fixed!important/);
 assert.match(css,/top:max\(12px, env\(safe-area-inset-top, 0px\)\)!important/);
 assert.match(css,/width:48px!important/);
 assert.match(css,/height:48px!important/);
 assert.match(app,/modal\.appendChild\(close\)/);
 assert.match(app,/modal\.classList\.add\('workout-close-overlay'\)/);
 assert.match(app,/panel\.prepend\(close\)/);
 assert.ok(app.includes("$('modal').querySelector('.modal-panel').prepend($('closeModal'))"));
 assert.match(app,/function closeModal\(refresh=true\)/);
});
