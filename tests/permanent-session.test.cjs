'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Aux=require('../sync/aux-data.js'),Cloud=require('../sync/auxiliary-cloud.js');
const AccountDraft=require('../sync/account-draft-store.js'),Draft=require('../session-draft.js');
const Schedule=require('../schedule-library.js'),Weekly=require('../weekly-workout-schedule.js');
const ProgramSource=require('../goal-program-source.js');
const Journal=require('../sync/sync-journal.js');
const source=fs.readFileSync('custom-workouts.js','utf8');
const saved={id:'custom-first',title:'Original name',ids:['row'],description:'Notes',previousMetadata:{keep:true}};
const config={title:'Edited session',ids:['row','press'],targets:{press:{sets:4,reps:8}}};
const preset={id:'upper-a',title:'Built-in upper',ids:['row']};
const owner='owner-a';
function storage(){
 const data=new Map();
 return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
function fixture(s=storage()){
 const window={MLC2AuxData:Aux,MLC2AccountDraft:AccountDraft,MLC2ScheduleLibrary:Schedule,
  MLC2WeeklySchedule:Weekly,MLC2_EXERCISE_CATALOG:['row','press','curl'].map(id=>({id}))};
 vm.runInNewContext(source,{window,localStorage:s});
 const api=window.MLC2Custom;
 api.setOwner(owner);
 const key=k=>k+':user:'+owner;
 return {s,api,key,get:k=>JSON.parse(s.getItem(key(k))),put:(k,v)=>s.setItem(key(k),JSON.stringify(v))};
}
test('today-only configuration leaves the source routine and next day intact',()=>{
 const {s,api,put}=fixture();
 put('mlc2-custom-plans-v1',[saved]);
 const editor=vm.runInNewContext(fs.readFileSync('session-editor.js','utf8')+';SessionEditor',{localStorage:s,structuredClone,Date});
 s.setItem(editor.dayKey(owner,editor.dateFor(saved)),JSON.stringify({...config,planId:saved.id}));
 assert.deepEqual([...editor.effective(saved,owner).ids],config.ids);
 assert.equal(editor.effective({...saved,daysAhead:1},owner).ids[0],'row');
 assert.deepEqual([...api.allPlans([])[0].ids],saved.ids);
});
test('permanent custom edit preserves ID, metadata, weekly programs, and history',()=>{
 const {s,api,key,get,put}=fixture();
 put('mlc2-custom-plans-v1',[saved]);
 const historyKey='mlc2-account-workouts-v1:'+owner;
 s.setItem(historyKey,'historical workout');
 const days={1:saved.id,3:saved.id,4:'rest-day'};
 put(Schedule.WEEK,days);
 const library={version:1,mode:'weekly',activeId:'schedule-first',profiles:[{id:'schedule-first',name:'My week',days}]};
 put(Schedule.KEY,library);
 api.saveSessionRoutine({mode:'permanent',routine:saved,config,expectedVersion:JSON.stringify(api.allPlans([])[0])});
 assert.deepEqual(get('mlc2-custom-plans-v1'),[{...saved,ids:config.ids,targets:config.targets}]);
 assert.deepEqual(get(Schedule.WEEK),days);
 assert.deepEqual(get(Schedule.KEY),library);
 assert.equal(s.getItem(historyKey),'historical workout');
 assert.equal(s.getItem(key('mlc2-plan-write-v1')),null);
});
test('copy gets a new ID, leaves selection intact, and respects the existing custom limit',()=>{
 const {s,api,key,get,put}=fixture();
 const days={1:saved.id,2:'rest-day'};
 const library={version:1,mode:'coach',activeId:'schedule-first',profiles:[{id:'schedule-first',name:'My week',days}]};
 put('mlc2-custom-plans-v1',[saved]);put(Schedule.WEEK,days);put(Schedule.KEY,library);
 s.setItem(key(Schedule.SELECTED),saved.id);
 const copy=api.saveSessionRoutine({mode:'new',config,name:'  Extra day  '});
 assert.notEqual(copy.id,saved.id);assert.equal(copy.title,'Extra day');
 assert.equal(Weekly.resolve({presets:[preset],custom:[copy],storage:s}).id,preset.id);
 const mixed={source:{mode:'mixed'},customPlans:[saved,copy],generated:preset,completed:2};
 assert.equal(ProgramSource.choose(mixed).id,saved.id);
 assert.equal(ProgramSource.choose({...mixed,source:{mode:'mixed',customId:copy.id}}).id,copy.id);
 assert.deepEqual(get(Schedule.WEEK),days);assert.deepEqual(get(Schedule.KEY),library);
 const assigned=api.saveSessionRoutine({mode:'new',config,name:'Saturday',weekday:6});
 assert.deepEqual(get(Schedule.WEEK),{...days,6:assigned.id});
 assert.equal(get(Schedule.KEY).mode,'coach');
 assert.equal(get(Schedule.KEY).activeId,library.activeId);
 assert.equal(s.getItem(key(Schedule.SELECTED)),saved.id);
 put('mlc2-custom-plans-v1',Array.from({length:60},(_,i)=>({...saved,id:'custom-'+i})));
 assert.throws(()=>api.saveSessionRoutine({mode:'new',config,name:'Over limit'}),/Maximum 60/);
});
test('preset and Coach overrides isolate owners and Coach split days, preserve adaptive targets',()=>{
 const {api}=fixture();
 const day={id:'coach-auto-day-1',programDays:4,ids:['row'],targets:{row:{reps:12,weight:83}}};
 for(const routine of [preset,day])
  api.saveSessionRoutine({mode:'permanent',routine,config,expectedVersion:api.overrideVersion()});
 assert.deepEqual([...api.allPlans([preset])[0].ids],config.ids);
 assert.deepEqual(preset.ids,['row']);
 assert.equal(api.applyOverride(day,4).targets.row.weight,83);
 assert.equal(api.applyOverride({...day,targets:{row:{reps:10,weight:91}}},4).targets.row.weight,91);
 assert.equal(api.applyOverride(day,5),day);
 const other={...day,id:'coach-auto-day-2'};
 assert.equal(api.applyOverride(other,4),other);
 api.setOwner('owner-b');
 assert.equal(api.applyOverride(day,4),day);assert.equal(api.allPlans([preset])[0],preset);
 api.setOwner(null);
 assert.equal(api.applyOverride(day,4),day);
});
test('copy and draft commit together, preserving workout identity and completed sets',()=>{
 const {api,s}=fixture();
 const draftKey=AccountDraft.scopedKey(owner);
 const active={...preset,workoutId:'demo-test-session',sessionDate:'2026-11-25'};
 const sets=[{exerciseId:'row',weight:80,reps:9}];
 Draft.save(AccountDraft.scope(s,owner),active,sets);
 const before=s.getItem(draftKey);
 const edited={...active,...config,routineId:active.id};
 const change={key:draftKey,before,after:JSON.stringify(Draft.capture(edited,sets))};
 api.saveSessionRoutine({mode:'new',config,name:'Copy',sessionChange:change});
 const restored=Draft.read(AccountDraft.scope(s,owner));
 assert.equal(restored.planId,active.id);assert.equal(restored.workoutId,active.workoutId);
 assert.deepEqual(restored.sets,sets);assert.deepEqual(restored.ids,config.ids);
 assert.equal(Draft.read(AccountDraft.scope(s,'owner-b')),null);
 assert.throws(()=>api.saveSessionRoutine({mode:'new',config,name:'Stale copy',sessionChange:change}),/changed/);
 assert.equal(api.allPlans([]).length,1);
 assert.throws(()=>api.saveSessionRoutine({mode:'new',config,name:'Cross-account',sessionChange:{...change,key:AccountDraft.scopedKey('owner-b')}}),/account/);
});
test('cloud backup and recovery round-trip the override through the existing owner and revision contracts',async()=>{
 const {s,api}=fixture();
 const rows=new Map();
 let nextId=0;
 const Sync={create:o=>Journal.create({...o,makeId:()=>('00000000-0000-4000-8000-'+String(++nextId).padStart(12,'0'))})};
 const make=({s,api})=>Cloud.create({owner,storage:s,aux:Aux,Sync,verify:async()=>({userId:owner}),active:()=>owner,
  writePlans:changes=>api.commitRecoveredPlans(changes),transport:{
   read:async(type,id)=>rows.get(type+'/'+id)||null,
   commit:async op=>{
    const key=op.type+'/'+op.id;
    assert.equal(op.baseRevision,rows.get(key)?.revision||0);
    const revision=op.baseRevision+1;
    rows.set(key,{owner,type:op.type,id:op.id,revision,payload:op.payload,deleted:false});
    return {owner,opId:op.opId,revision};
   }
  }});
 api.saveSessionRoutine({mode:'permanent',routine:preset,config,expectedVersion:null});
 assert.equal((await make({s,api}).backup()).uploaded,1);
 assert.ok(rows.get('goal/workout-overrides-v1'));
 const fresh=fixture();
 await make(fresh).restore({confirmRestore:()=>true});
 assert.deepEqual([...fresh.api.applyOverride(preset).ids],config.ids);
 assert.throws(()=>Aux.restoreMissing(storage(),'owner-b',[...rows.values()]),/owner mismatch/);
});
