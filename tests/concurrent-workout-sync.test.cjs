'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const from=app.indexOf('function queueWorkoutForSync(entry){'),to=app.indexOf('\nasync function runWorkoutSync(){',from);
assert.ok(from>=0&&to>from);
const src=app.slice(from,to);
function harness({owner='member-1',accountId='member-1',busy=false,auxBusy=false,queueThrows=false}={}){
 const queued=[],scheduled=[],statuses=[],context={
  verifiedOwnerId:owner,account:{id:accountId},workoutSyncBusy:busy,auxOperationBusy:auxBusy,
  syncAgainAfterCurrent:false,navigator:{onLine:true},
  syncEngine:id=>({queue:entry=>{if(queueThrows)throw Error('Journal unavailable');queued.push({owner:id,entry})}}),
  setWorkoutSyncState:s=>statuses.push(s),scheduleWorkoutSync:delay=>scheduled.push(delay)
 };
 vm.createContext(context);vm.runInContext(src,context);
 const send=entry=>{context.entry=entry;vm.runInContext('queueWorkoutForSync(entry)',context)};
 return {context,queued,scheduled,statuses,send};
}
const entry={id:'session-1',ownerId:'member-1',sets:[{exerciseId:'press',weight:50,reps:10}]};
test('Fresh completed workout enqueues before scheduling cloud upload',()=>{
 const h=harness();h.send(entry);
 assert.equal(h.queued.length,1);assert.equal(h.queued[0].entry.id,'session-1');
 assert.equal(h.scheduled.length,1);
});
test('Workout completed during ongoing cloud sync is still durably enqueued',()=>{
 const h=harness({busy:true});h.send(entry);
 assert.equal(h.queued.length,1,'new workout must not be skipped');
 assert.equal(h.context.syncAgainAfterCurrent,true);
 assert.equal(h.scheduled.length,0,'running flush will schedule retry');
});
test('Workout completed during auxiliary cloud backup is queued and marked for follow-up',()=>{
 const h=harness({auxBusy:true});h.send(entry);
 assert.equal(h.queued.length,1);
 assert.equal(h.context.syncAgainAfterCurrent,true);
 assert.match(h.statuses.at(-1),/queued locally/);
});
test('Unverified account or mismatched session owner cannot enqueue account workouts',()=>{
 for(const opts of [{owner:'member-1',accountId:'member-2'},{owner:null,accountId:'member-1'}]){
  const h=harness(opts);h.send(entry);assert.equal(h.queued.length,0);
 }
 const h=harness();h.send({...entry,ownerId:'member-2'});assert.equal(h.queued.length,0);
});
test('Failed queue retains locally completed workout and schedules another attempt',()=>{
 const h=harness({queueThrows:true});h.send(entry);
 assert.equal(h.queued.length,0);
 assert.equal(h.scheduled.length,1);
 assert.match(h.statuses.at(-1),/queue requires attention/);
});
test('Finishing auxiliary backup wakes queued workout sync without waiting for another session',()=>{
 const portion=app.slice(app.indexOf('async function runAutomaticAuxSync(){'),app.indexOf('function auxEngine(owner)'));
 assert.match(portion,/if\(syncAgainAfterCurrent&&!workoutSyncBusy\)/);
 assert.match(portion,/syncAgainAfterCurrent=false;\s*scheduleWorkoutSync\(800\)/);
});
