'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const draft=require('../session-draft.js'),scoping=require('../sync/account-draft-store.js');
const app=fs.readFileSync('app.js','utf8');
const begin=app.indexOf('function unfinishedDraftFor(plan){');
const end=app.indexOf('\nfunction renderHome(){',begin);
assert.ok(begin>=0&&end>begin);
const source=app.slice(begin,end);
const plan={id:'custom-upper',title:'Upper Body',ids:['press','row']};
function storage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
function lookup(store,owner,p,demoSessions=[]){
 const env={localStorage:store,verifiedOwnerId:owner,demoSessions,JSON,window:{MLC2AccountDraft:scoping,MLC2SessionDraft:draft}};
 vm.createContext(env);vm.runInContext(source,env);env.plan=p;return vm.runInContext('unfinishedDraftFor(plan)',env);
}
test('Matching saved workout exposes resume state for same account',()=>{
 const db=storage(),saved=[{exerciseId:'press',weight:75,reps:8}];
 draft.save(scoping.scope(db,'owner-a'),plan,saved);
 const result=lookup(db,'owner-a',plan);
 assert.ok(result);assert.equal(result.sets.length,1);
 assert.equal(result.sets[0].weight,75);
});
test('Other account or guest cannot see private saved draft',()=>{
 const db=storage();
 draft.save(scoping.scope(db,'owner-a'),plan,[{exerciseId:'press',weight:80,reps:8}]);
 assert.equal(lookup(db,'owner-b',plan),null);
 assert.equal(lookup(db,null,plan),null);
});
test('Modified custom exercise list cannot silently resume an incompatible draft',()=>{
 const db=storage();
 draft.save(scoping.scope(db,'owner-a'),plan,[{exerciseId:'press',weight:80,reps:8}]);
 assert.equal(lookup(db,'owner-a',{...plan,ids:['press']}),null);
 assert.equal(lookup(db,'owner-a',{...plan,id:'custom-other'}),null);
});
test('Blank, invalid or expired drafts never appear as unfinished workouts',()=>{
 const db=storage(),scope=scoping.scope(db,'owner-a');
 draft.save(scope,plan,[]);
 assert.equal(lookup(db,'owner-a',plan),null);
 scope.setItem(draft.KEY,'not-json');
 assert.equal(lookup(db,'owner-a',plan),null);
});
test('Resume labels appear on both Home and Today without resetting saved data',()=>{
 assert.match(app,/\$\('heroStart'\)\.innerHTML=unfinished\?'Resume Workout/);
 assert.match(app,/\$\('todayStart'\)\.innerHTML=unfinished\?'Resume this session/);
 assert.match(app,/start\.textContent=savedDraft\?'Resume workout':'Start workout'/);
 assert.match(app,/savedDraft\.sets\.length\+' saved set\(s\) ready to resume'/);
 const source=app.slice(begin,end);
 assert.doesNotMatch(source,/\b(save|clear|setItem|removeItem)\s*\(/);
});

test('Workout modal distinguishes restored draft from finish and save actions',()=>{
 assert.match(app,/const restoredSets=draftAPI\?\.resume\(draftStore,plan\)\|\|\[\]/);
 assert.match(app,/Resumed workout · /);
 assert.match(app,/saved set/);
 assert.match(app,/Finish workout when you are done/);
 assert.match(app,/id="finishWorkout">Finish workout/);
 assert.match(app,/id="cancelWorkout">Save draft &amp; exit/);
 const style=fs.readFileSync('live-coach-workout.css','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(style,/\.active-resume-confirmation/);
 assert.match(html,/app\.js\?v=43/);
 assert.match(html,/live-coach-workout\.css\?v=12/);
});

test('completed draft IDs cannot offer Resume again after a failed draft cleanup',()=>{
 const db=storage();
 draft.save(scoping.scope(db,'owner-a'),{...plan,workoutId:'demo-completed'},[{exerciseId:'press',weight:80,reps:8}]);
 assert.equal(lookup(db,'owner-a',plan,[{id:'demo-completed'}]),null);
 assert.equal(lookup(db,'owner-a',plan,[]).workoutId,'demo-completed');
});
