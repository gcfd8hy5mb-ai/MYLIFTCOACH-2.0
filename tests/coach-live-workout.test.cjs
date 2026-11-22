/* Dedicated Coach-in-workout integration checks. Run with node tests/coach-live-workout.test.cjs. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'live-coach-workout.css'),'utf8');
const start=app.indexOf('/* Strictly isolated, RAM-only Coach demo history'),end=app.indexOf('\nfunction openWorkout(id){',start);
assert.ok(start>=0&&end>start,'Coach functions must be loaded before active workout');
const source=app.slice(start,end);
const plan={id:'custom-123',title:'My Custom Workout',ids:['chest-press']};
const exercise={id:'chest-press',name:'Machine Chest Press',group:'Chest',sets:3,reps:'8–12'};
function harness(mode='pro',ready='Normal',suggestion={status:'ready',action:'hold',weight:65,reason:'Continue toward target reps.'}){
 const env={
  betaView:()=>({mode}),libraryExercises:()=>[exercise],exercises:[exercise],
  demoSessions:[],session:{sets:[]},activePlan:plan,verifiedOwnerId:null,
  coachProgramAdvice:()=>null,
  window:{MLC2Coach:{suggestion:()=>suggestion},MLC2CoachReadiness:{current:()=>ready},MLC2PostWorkout:{summarize:()=>({hasHistory:true,current:{sets:2,movements:1},previous:null})}},
  escapeHTML:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]))
 };
 vm.createContext(env);
 vm.runInContext(source,env,{filename:'app.js:liveCoach'});
 return env;
}
test('Coach shows actual established progression without rewriting custom routine',()=>{
 const env=harness();const before=JSON.stringify(plan);
 const markup=vm.runInContext('liveCoachPreview(activePlan)',env);
 assert.match(markup,/Coach · Before you start/);
 assert.match(markup,/<details class="live-coach-box live-coach-dropdown"/);
 assert.doesNotMatch(markup,/<details[^>]+open/);
 assert.match(markup,/65 lb suggested/);
 assert.match(markup,/My Custom Workout|Machine Chest Press/);
 assert.equal(JSON.stringify(plan),before);
});
test('Free beta never reveals a Pro-generated load recommendation',()=>{
 const env=harness('free');const markup=vm.runInContext('liveCoachPreview(activePlan)',env);
 assert.match(markup,/Free beta mode/);
 assert.doesNotMatch(markup,/65 lb suggested/);
});
test('Insufficient history does not fabricate specific weight',()=>{
 const env=harness('pro','Normal',{status:'insufficient'});
 const markup=vm.runInContext('liveCoachPreview(activePlan)',env);
 assert.match(markup,/Log more completed working sets/);
 assert.doesNotMatch(markup,/65 lb suggested/);
});
test('Coach set feedback updates from actual reps with readiness consideration',()=>{
 const env=harness('pro','Tired');env.session.sets.push({exerciseId:'chest-press',weight:65,reps:6});
 const low=vm.runInContext("liveCoachFeedback('chest-press')",env);
 assert.match(low,/below target/);assert.match(low,/Tired/);
 env.session.sets.push({exerciseId:'chest-press',weight:65,reps:10});
 const good=vm.runInContext("liveCoachFeedback('chest-press')",env);
 assert.match(good,/within the planned rep range/);
});

test('Using Coach weight is an explicit input-only action and refuses missing evidence',()=>{
 const env=harness();
 const weight={value:'45'},message={textContent:''};
 const card={dataset:{exerciseCard:'chest-press'},querySelector:selector=>selector==='[data-weight]'?weight:selector==='[data-coach-applied]'?message:null};
 env.document={querySelectorAll:selector=>selector==='[data-exercise-card]'?[card]:[]};
 env.activeDraftOwner=null;env.verifiedOwnerId=null;env.notice=()=>{};
 assert.equal(vm.runInContext("applyCoachWeight('chest-press')",env),true);
 assert.equal(weight.value,'65');
 assert.deepEqual(env.session.sets,[],'no set should be logged by applying suggestion');
 assert.match(message.textContent,/Review it before logging/);
 const noEvidence=harness('pro','Normal',{status:'insufficient'});
 noEvidence.document=env.document;noEvidence.activeDraftOwner=null;noEvidence.verifiedOwnerId=null;noEvidence.notice=()=>{};
 weight.value='45';
 assert.equal(vm.runInContext("applyCoachWeight('chest-press')",noEvidence),false);
 assert.equal(weight.value,'45','missing evidence must never edit weight');
 const free=harness('free');free.document=env.document;free.activeDraftOwner=null;free.verifiedOwnerId=null;free.notice=()=>{};
 assert.equal(vm.runInContext("applyCoachWeight('chest-press')",free),false);
 assert.equal(weight.value,'45');
});
test('Coach weight button delegates through active modal and cannot auto-log a set',()=>{
 assert.match(app,/data-coach-apply/);
 assert.match(app,/applyCoachWeight\(suggest\.dataset\.coachApply\)/);
 assert.match(app,/input\.value=String\(weight\)/);
 assert.match(app,/session\.sets\.push\(\{exerciseId:id,weight,reps\}\)/);
 assert.match(css,/\.coach-apply-weight/);
});


test('Simulated Coach evidence exists only at isolated preview URL and never enters real history',()=>{
 const env=harness();env.location={pathname:'/MYLIFTCOACH-2.0-PREVIEW/coach-live-test/'};
 const before=JSON.stringify(env.demoSessions);
 const rows=vm.runInContext('generatePreviewCoachHistory(activePlan)',env);
 assert.equal(rows.length,2);
 assert.equal(rows[0].sets.length,2);
 assert.equal(rows[1].sets.length,2);
 assert.equal(rows[0].sets[0].reps,8);
 assert.equal(rows[1].sets[0].reps,10);
 assert.equal(JSON.stringify(env.demoSessions),before,'sample history must not alter real sessions');
 const off=harness();off.location={pathname:'/MYLIFTCOACH-2.0/'};
 assert.equal(vm.runInContext('generatePreviewCoachHistory(activePlan).length',off),0);
 assert.equal(vm.runInContext('coachTestControls()',off),'');
});
test('Simulation and real records are separate, and clearing removes sample evidence',()=>{
 const env=harness();env.location={pathname:'/MYLIFTCOACH-2.0-PREVIEW/coach-live-test/'};
 assert.match(vm.runInContext('coachTestControls()',env),/SIMULATED COACH TEST DATA/);
 vm.runInContext('previewCoachHistory=generatePreviewCoachHistory(activePlan)',env);
 assert.equal(vm.runInContext('coachEvidence().length',env),2);
 vm.runInContext('previewCoachHistory=null',env);
 assert.equal(vm.runInContext('coachEvidence().length',env),0);
 assert.equal(env.demoSessions.length,0);
 assert.match(app,/function toggleCoachTestHistory\(action\)/);
 assert.match(app,/const simulation=e\.target\.closest\('\[data-coach-test\]'\)/);
 assert.ok(!app.includes('demoSessions=generatePreviewCoachHistory'));
});
test('The established Coach engine can recommend from two clearly synthetic sessions',()=>{
 const e=harness();e.location={pathname:'/MYLIFTCOACH-2.0-PREVIEW/coach-live-test/'};
 const sample=vm.runInContext('generatePreviewCoachHistory(activePlan)',e);
 const engine={window:{MLC2Progress:{normalizedSessions:(rows)=>rows.map(s=>({
   date:s.created,exercises:[{id:'chest-press',sets:s.sets.map(t=>({weight:t.weight,reps:t.reps}))}]
 }))}}};
 vm.createContext(engine);
 const coach=fs.readFileSync(path.join(root,'coach-migration.js'),'utf8');
 vm.runInContext(coach,engine);
 const result=engine.window.MLC2Coach.suggestion('chest-press',sample,[exercise]);
 assert.equal(result.status,'ready');
 assert.equal(result.action,'increase');
 assert.equal(result.weight,55);
});


test('Coach accepts only completed workouts belonging to the verified account',()=>{
 const env=harness();
 env.verifiedOwnerId='account-a';
 env.demoSessions=[
  {id:'real-a',ownerId:'account-a',sets:[{exerciseId:'chest-press',weight:50,reps:10}]},
  {id:'foreign',ownerId:'account-b',sets:[{exerciseId:'chest-press',weight:95,reps:10}]},
  {id:'SIMULATED-COACH-injected',ownerId:'account-a',sets:[{exerciseId:'chest-press',weight:100,reps:10}]},
  {id:'guest',sets:[{exerciseId:'chest-press',weight:70,reps:10}]},
  {id:'empty',ownerId:'account-a',sets:[]}
 ];
 assert.equal(vm.runInContext('coachEvidence().length',env),1);
 assert.equal(vm.runInContext('coachEvidence()[0].id',env),'real-a');
 assert.match(vm.runInContext('coachEvidenceLabel()',env),/1 saved 2.0 workout/);
 env.verifiedOwnerId=null;
 assert.equal(vm.runInContext('coachEvidence().length',env),1);
 assert.equal(vm.runInContext('coachEvidence()[0].id',env),'guest');
});
test('Synthetic Coach evidence is always labeled and never mutates account history',()=>{
 const env=harness();
 env.location={pathname:'/MYLIFTCOACH-2.0-PREVIEW/coach-live-test/'};
 const saved={id:'saved-1',sets:[{exerciseId:'chest-press',weight:40,reps:8}]};
 env.demoSessions=[saved];
 vm.runInContext('previewCoachHistory=generatePreviewCoachHistory(activePlan)',env);
 assert.match(vm.runInContext('coachEvidenceLabel()',env),/SIMULATED TEST DATA/);
 assert.equal(vm.runInContext('coachEvidence().length',env),2);
 assert.strictEqual(env.demoSessions[0],saved);
 vm.runInContext('previewCoachHistory=null',env);
 assert.equal(vm.runInContext('coachEvidence().length',env),1);
 assert.match(vm.runInContext('coachEvidenceLabel()',env),/personal history only/);
});

test('Active workout mounts Coach, uses existing draft and cloud paths, and avoids automatic plan changes',()=>{
 for(const marker of ["liveCoachPreview(plan)","data-live-coach","coachText.textContent=liveCoachFeedback(id)","liveCoachRecap(proposed)","window.MLC2AccountWorkouts.save(localStorage,verifiedOwnerId,proposed)","queueWorkoutForSync(entry)","window.MLC2SessionDraft?.save(activeDraftStore,activePlan,session.sets)"]){
  assert.ok(app.includes(marker),'missing '+marker);
 }
 assert.match(css,/\.live-coach-box/);
 assert.match(html,/live-coach-workout\.css\?v=10/);
 assert.match(html,/app\.js\?v=31/);
});
