'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function renderCoach(){'),end=app.indexOf('\nfunction renderSettings(){',start);
assert.ok(start>=0&&end>start);
const code=app.slice(start,end);
function run(mode='pro'){
 const used={history:null,next:null,readiness:null,trends:null,plan:null};
 const good={id:'demo-good',planId:'custom-a',title:'Workout',sets:[{exerciseId:'press',weight:50,reps:10}],created:'2026-11-21T12:00:00Z'};
 const plan={id:'custom-a',title:'Custom',kind:'Custom',ids:['press']},catalog=[{id:'press',name:'Press',group:'Chest'}];
 const elements={coachFreeNotice:{hidden:false},coachSuggestions:{replaceChildren(){}},coachSubstitutions:{replaceChildren(){}},
 coachPlanPreview:{replaceChildren(){}},coachProgramBuilder:{replaceChildren(){}},coachNextWorkout:{},coachTechnique:{},coachReadiness:{},coachTrends:{}};
 const context={page:'coaching',window:{MLC2Coach:{render:(_,rows)=>used.history=rows,renderTools(){},renderNextWorkout:(_,__,rows)=>used.next=rows,renderTechnique(){}},
 MLC2CoachReadiness:{current:()=>'Normal',render:(_,rows,__,callback)=>{used.readiness=rows;used.callback=callback},weeklyGoal:()=>4},
 MLC2CoachTrends:{render:(_,rows)=>used.trends=rows},
 MLC2ProgramBuilder:{render:() => {}},
 MLC2CoachPlan:{render:(_,__,___,rows)=>used.plan=rows},
 MLC2Custom:{saveCoachDay:()=>({id:'custom-b'})},
 MLC2CoachPreferences:{read:()=>({days:4,goal:'balanced',equipment:'Any'})}},
  document:{querySelectorAll:()=>[{hidden:false}]},'$':id=>elements[id]||{},nextPlan:()=>plan,
  libraryExercises:()=>catalog,coachEvidence:()=>[good],betaView:()=>({mode}),localStorage:{},
  verifiedOwnerId:'account-a',renderHome(){},renderWorkouts(){},notice(){},openWorkout(){},renderAutonomousCoach(){}};
 vm.createContext(context);vm.runInContext(code,context);
 vm.runInContext('renderCoach()',context);
 return {used,context};
}
test('All Coach panels use the same qualified saved workout history',()=>{
 const {used}=run();
 for(const key of ['history','next','readiness','trends','plan']){
  assert.ok(used[key]&&used[key].length===1,'Coach panel skipped verified evidence: '+key);
  assert.equal(used[key][0].id,'demo-good');
 }
});
test('Readiness callback refreshes selected plan with current qualified evidence',()=>{
 const {used}=run();assert.equal(typeof used.callback,'function');
 used.callback();
 assert.equal(used.plan[0].id,'demo-good');
});
test('Free beta still shows readiness and trends and refreshes weekly goal without paid Coach panels',()=>{
 const {used}=run('free');
 assert.equal(used.history,null);
 assert.equal(used.next.length,1);
 assert.equal(used.readiness.length,1);
 assert.equal(used.trends.length,1);
 used.trends=null;
 used.callback();
 assert.equal(used.trends.length,1,'Free mode weekly goal refresh must update trend card');
 assert.equal(used.plan,null,'Free beta may not render Pro plan');
});
test('Integrated Coach description no longer says working features are pending',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const section=html.slice(html.indexOf('<section id="coaching"'),html.indexOf('<section id="nutrition"'));
 assert.ok(section.includes('Coach uses your completed MYLIFTCOACH workouts'));
 assert.ok(!section.includes('will be carried over'));
 assert.ok(!section.includes('synchronization remains separate and is not active'));
});
