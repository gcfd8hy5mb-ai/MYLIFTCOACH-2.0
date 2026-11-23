'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {preview}=require('./migration-preview.cjs');
const model=require('../../legacy-storage-model.js');
const recovery=require('../../sync/account-recovery.js');
const week=require('../../weekly-workout-schedule.js');
const owner='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const created='2026-11-22T11:00:00.000Z';
const catalog=[{id:'bench-press'},{id:'barbell-row'}];
const original={
 customWorkoutsV5:[{id:10,name:'Strength',exercises:['bench-press']}],
 workoutHistoryV52:[{id:20,date:created,workoutKey:'custom-0',workoutTitle:'Strength',
  exercises:[{id:'bench-press',sets:[{weight:'135',reps:'5'}]}]}],
 myliftcoachWeeklyDayOverridesV1:{0:{customWorkoutId:10,name:'Strength',ids:['bench-press']},
  1:{rest:true},6:{name:'Rows',ids:['barbell-row']}},
 prismCoachActionsV1:{preference:'legacy-value'}
};
function scoped(data){return Object.fromEntries(Object.entries(data).map(([key,value])=>[key,JSON.stringify(value)]))}
function destination(extra={}){return {owner,routines:[],sessions:[],schedule:null,
 deletedSessionIds:[],deletedRoutineIds:[],cloudDeletedSessionIds:[],cloudDeletedRoutineIds:[],...extra}}
async function archive(data,stamp){
 const records=(await model.normalize(scoped(data))).map(({table,...row})=>({table,row:{...row,user_id:owner,revision:1}}));
 const counts=Object.fromEntries(model.TABLES.map(table=>[table,records.filter(record=>record.table===table).length]));
 return {format:'MYLIFTCOACH-original-account-cloud-archive',version:1,accountId:owner,createdAt:stamp,
  tableCount:model.TABLES.length,recordCount:records.length,counts,records};
}
async function fixture(data=original,old=data){
 return {owner,baselineText:JSON.stringify(await archive(old,'2026-11-21T11:00:00.000Z')),
  currentText:JSON.stringify(await archive(data,created)),destination:destination(),catalog,
  deviceText:JSON.stringify({format:'MYLIFTCOACH-original-account-device-checkpoint',version:1,
   accountId:owner,containsAuthentication:false,containsPhotoFiles:false,data:scoped(data),deletions:null,photoDeletions:null})};
}

test('synthetic shadow import preserves sets, routines, rest days and archived Coach data',async()=>{
 const args=await fixture();
 const before=JSON.stringify(args);
 const p=preview(args);
 assert.equal(p.readyForShadowRehearsal,true);
 assert.deepEqual(p.preservedOnly,['prismCoachActionsV1']);
 assert.deepEqual(p.additions.schedule,{0:'custom-legacy-weekday-6',1:'custom-legacy-10',2:'rest-day'});
 assert.equal(p.additions.routines.length,2);
 const shadow=new Map();
 const storage={getItem:key=>shadow.get(key)??null,setItem:(key,value)=>shadow.set(key,value)};
 const restore={format:recovery.FORMAT,version:1,owner,created,containsAuthentication:false,
  containsPhotos:false,sessions:p.additions.sessions};
 assert.equal(recovery.restore(storage,restore,owner).restored,1);
 assert.deepEqual(JSON.parse(storage.getItem('mlc2-account-workouts-v1:'+owner))[0].sets,
  [{exerciseId:'bench-press',weight:135,reps:5}]);
 assert.equal(week.nextTraining({storage:{getItem:()=>JSON.stringify(p.additions.schedule)},
  custom:p.additions.routines,presets:[],date:new Date('2026-11-23T12:00:00')}).id,'custom-legacy-10');
 assert.equal(JSON.stringify(args),before);
 const again=preview({...args,destination:destination({routines:p.additions.routines,sessions:p.additions.sessions,schedule:p.additions.schedule})});
 assert.deepEqual(again.additions,{routines:[],sessions:[],schedule:null,auxiliary:[]});
});

test('cross-account snapshots and pending original or destination deletion state block migration',async()=>{
 const args=await fixture();
 assert.throws(()=>preview({...args,destination:destination({owner:other})}),/account must match/);
 assert.throws(()=>preview({...args,deviceText:JSON.stringify({...JSON.parse(args.deviceText),accountId:other})}),/does not belong/);
 const cloudDelete=preview({...args,destination:destination({cloudDeletedSessionIds:['legacy-session-20']})});
 assert.ok(cloudDelete.blockers.includes('Destination workout was deleted'));
 assert.equal(cloudDelete.additions,null);
 const localDelete=preview({...args,destination:destination({deletedRoutineIds:['custom-legacy-10']})});
 assert.ok(localDelete.blockers.includes('Destination routine was deleted'));
 const pending=preview({...args,deviceText:JSON.stringify({...JSON.parse(args.deviceText),deletions:'{"workoutHistoryV52":"[]"}'})});
 assert.ok(pending.blockers.includes('Original device has pending deletions'));
 assert.equal(pending.additions,null);
});

test('discarded source rows, device divergence, and an explicitly cleared target schedule stop projection',async()=>{
 const args=await fixture({...original,workoutHistoryV52:[]},original);
 assert.match(preview(args).blockers.join(' '),/deleted rows or revisions/);
 const current=await fixture();
 const device=JSON.parse(current.deviceText);
 device.data.workoutHistoryV52='[]';
 assert.match(preview({...current,deviceText:JSON.stringify(device)}).blockers.join(' '),/device and current cloud disagree/);
 assert.match(preview({...current,destination:destination({schedule:{}})}).blockers.join(' '),/deliberately cleared/);
});

test('an open workout and unknown exercise require review before any additions are offered',async()=>{
 const open=await fixture({...original,prismActiveWorkoutV1:{key:'custom-0',ids:['bench-press']}});
 assert.ok(preview(open).blockers.includes('Original active workout needs to be finished or retained'));
 const result=preview({...open,catalog:[{id:'barbell-row'}]});
 assert.equal(result.additions,null);
 assert.match(result.blockers.join(' '),/unverified exercise/);
});

test('original cloud tombstone wins over older history and 2.0 records remain untouched',async()=>{
 const args=await fixture();
 const updated=JSON.parse(args.currentText);
 const tombstone=updated.records.find(record=>record.table==='sessions');
 tombstone.row.payload={__prismDeletedV1:true};
 tombstone.row.revision++;
 const device=JSON.parse(args.deviceText);
 device.data.workoutHistoryV52='[]';
 const draft={id:'new-workout',ownerId:owner,title:'New workout',created,
  sets:[{exerciseId:'barbell-row',weight:100,reps:5}]};
 const result=preview({...args,currentText:JSON.stringify(updated),deviceText:JSON.stringify(device),
  destination:destination({sessions:[draft]})});
 assert.deepEqual(result.additions.sessions,[]);
 assert.equal(draft.sets[0].weight,100);
 const stale=preview({...args,currentText:JSON.stringify(updated)});
 assert.equal(stale.additions,null);
 assert.match(stale.blockers.join(' '),/device and current cloud disagree/);
});

test('synthetic Coach preferences and measurements fill missing native 2.0 categories with archive notes',async()=>{
 const measured={...original,prismAthleteProfileV1:{goal:'hypertrophy',days:4,equipment:'mixed',experience:'advanced'},
  prismMeasurementsV1:[{id:'measure-test',date:'2026-11-22',waist:32.5,bodyFat:20,phaseId:'old-phase'}]};
 const args=await fixture(measured);
 const available=[{type:'measurement',id:'snapshot-v1',value:null,cloudDeleted:false},
  {type:'goal',id:'coach-training-preferences-v1',value:null,cloudDeleted:false}];
 const projected=preview({...args,destination:destination({auxiliary:available})});
 assert.equal(projected.readyForShadowRehearsal,true);
 assert.equal(projected.archivedDetails.length,2);
 const Aux=require('../../sync/aux-data.js'), shadow=new Map();
 const storage={getItem:k=>shadow.get(k)??null,setItem:(k,v)=>shadow.set(k,v),removeItem:k=>shadow.delete(k)};
 const rows=projected.additions.auxiliary.map(({type,id,entries})=>({type,id,owner,revision:1,deleted:false,payload:Aux.payload(entries)}));
 assert.deepEqual(Aux.restoreMissing(storage,owner,rows),['Measurements','Coach training preferences']);
 assert.deepEqual(JSON.parse(storage.getItem('mlc2-measurements-v1:user:'+owner)),[
  {id:'legacy-measure-test-waist',area:'Waist',day:'2026-11-22',value:32.5}
 ]);
 assert.deepEqual(require('../../coach-preferences.js').read(storage,owner),{goal:'muscle',days:4,equipment:'Any'});
 const cleared=preview({...args,destination:destination({auxiliary:[{...available[0],value:[]},available[1]]})});
 assert.equal(cleared.additions,null);
 assert.match(cleared.blockers.join(' '),/cleared for Measurements/);
});
