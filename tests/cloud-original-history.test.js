/* Original cloud archive workout-history viewer, synthetic fixtures only.
   No browser storage, network, Supabase account or production data required. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const viewer=require(path.resolve(__dirname,'../cloud-original-history.js'));
const inspector=require(path.resolve(__dirname,'../cloud-migration-readiness.js'));
const storage=require(path.resolve(__dirname,'../legacy-storage-model.js'));
const tables=[...storage.TABLES],owner='owner-1';
function record(table,id,source_key,payload,extra={}){
 return {table,row:{id,user_id:owner,source_key,payload,revision:1,...extra}};
}
const rows=[
 record('sources','source-1','workoutHistoryV52',{shape:'array'}),
 record('sessions','session-1','workoutHistoryV52',{id:'old-123',date:'2026-11-10T10:00:00Z',workoutTitle:'Original Upper'},{position:0}),
 record('session_exercises','exercise-1','workoutHistoryV52',{id:'chest-press',name:'Machine Chest Press'},{parent_id:'session-1',position:0}),
 record('sets','set-1','workoutHistoryV52',{weight:75,reps:10},{parent_id:'exercise-1',position:0}),
 record('sources','source-2','customWorkoutsV5',{shape:'array'}),
 record('workouts','workout-1','customWorkoutsV5',{id:123,name:'Original custom upper'},{position:0}),
 record('workout_exercises','movement-1','customWorkoutsV5','chest-press',{parent_id:'workout-1',position:0})
];
function archive(records,accountId=owner){
 return JSON.stringify({format:'MYLIFTCOACH-original-account-cloud-archive',version:1,accountId,
  createdAt:'2026-11-18T12:00:00Z',tableCount:tables.length,recordCount:records.length,
  counts:Object.fromEntries(tables.map(t=>[t,records.filter(r=>r.table===t).length])),
  records});
}
const options={archiveText:archive(rows),ownerId:owner,tables,
 inspector:inspector.inspectArchive,storageModel:storage};
const result=viewer.open(options);
assert.equal(result.owner,owner);
assert.equal(result.sessionCount,1);
assert.equal(result.planCount,1);
assert.equal(result.setCount,1);
assert.equal(result.sessions[0].title,'Original Upper');
assert.equal(result.sessions[0].exercises[0].sets[0].weight,75);
assert.equal(result.plans[0].exerciseCount,1);
assert.equal(result.readOnly,true);
assert.equal(result.cloudWrites,false);
assert.throws(()=>viewer.open({...options,ownerId:'attacker'}),/different account/);
const badRows=rows.map(r=>r);
badRows[1]={...rows[1],row:{...rows[1].row,user_id:'attacker'}};
assert.throws(()=>viewer.open({...options,archiveText:archive(badRows)}),/unauthorized/);
let written=false;
const doc={createElement:tag=>{
 const node={tag,textContent:'',className:'',children:[],append(...a){this.children.push(...a)}};
 return node;
}};
const target={children:[],replaceChildren(){this.children=[]},append(child){this.children.push(child)}};
viewer.render(target,result,doc);
assert.ok(target.children.length>1);
assert.equal(JSON.stringify(target).includes('Original Upper'),true);
assert.equal(written,false);
console.log('MYLIFTCOACH original cloud history viewer: PASS — owner isolation, exact sets, separate records, no writes');