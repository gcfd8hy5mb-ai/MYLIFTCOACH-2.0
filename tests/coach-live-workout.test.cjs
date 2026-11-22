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
const start=app.indexOf('function liveCoachSuggestion(id){'),end=app.indexOf('\nfunction openWorkout(id){',start);
assert.ok(start>=0&&end>start,'Coach functions must be loaded before active workout');
const source=app.slice(start,end);
const plan={id:'custom-123',title:'My Custom Workout',ids:['chest-press']};
const exercise={id:'chest-press',name:'Machine Chest Press',group:'Chest',sets:3,reps:'8–12'};
function harness(mode='pro',ready='Normal',suggestion={status:'ready',action:'hold',weight:65,reason:'Continue toward target reps.'}){
 const env={
  betaView:()=>({mode}),libraryExercises:()=>[exercise],exercises:[exercise],
  demoSessions:[],session:{sets:[]},activePlan:plan,
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
test('Active workout mounts Coach, uses existing draft and cloud paths, and avoids automatic plan changes',()=>{
 for(const marker of ["liveCoachPreview(plan)","data-live-coach","coachText.textContent=liveCoachFeedback(id)","liveCoachRecap(proposed)","window.MLC2AccountWorkouts.save(localStorage,verifiedOwnerId,proposed)","queueWorkoutForSync(entry)","window.MLC2SessionDraft?.save(activeDraftStore,activePlan,session.sets)"]){
  assert.ok(app.includes(marker),'missing '+marker);
 }
 assert.match(css,/\.live-coach-box/);
 assert.match(html,/live-coach-workout\.css\?v=4/);
 assert.match(html,/app\.js\?v=20/);
});
