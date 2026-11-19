/* Original account archive vs 2.0 readiness. Pure synthetic fixtures. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const planner=require(path.resolve(__dirname,'../cloud-migration-readiness.js'));
const mapper=require(path.resolve(__dirname,'../legacy-mapping-preview.js'));
const model=require(path.resolve(__dirname,'../legacy-storage-model.js'));
const tables=[...model.TABLES];
function archive(rows=[]){
 const counts=Object.fromEntries(tables.map(table=>[table,rows.filter(x=>x.table===table).length]));
 return JSON.stringify({format:'MYLIFTCOACH-original-account-cloud-archive',version:1,
  accountId:'owner-1',createdAt:'2026-11-18T12:00:00.000Z',
  tableCount:tables.length,recordCount:rows.length,counts,records:rows});
}
const catalog=[{id:'chest-press',name:'Machine Chest Press'}];
const customPlans=[{id:'custom-101-abc',title:'Chest',ids:['chest-press']}];
const sessions=[{id:'demo-101-abc',created:'2026-11-18T12:00:00.000Z',title:'Chest',planId:'custom-101-abc',
 sets:[{exerciseId:'chest-press',weight:55,reps:10}]}];
const args={archiveText:archive(),ownerId:'owner-1',allowedTables:tables,
 customPlans,sessions,catalog,mapper,storageModel:model};
const report=planner.plan(args);
assert.equal(report.ownerVerified,true);
assert.equal(report.cloudRows,0);
assert.equal(report.localWorkouts,1);
assert.equal(report.convertibleWorkouts,1);
assert.equal(report.convertibleSessions,1);
assert.equal(report.convertibleSets,1);
assert.equal(report.canWrite,false);
assert.equal(report.canMerge,false);
assert.equal(report.requiresCheckpoint,true);
assert.ok(report.blockers.some(x=>x.includes('checkpoint')));
assert.throws(()=>planner.plan({...args,ownerId:'owner-2'}),/different account/);
const badRow={table:'sessions',row:{id:'session-1',user_id:'wrong-user'}};
const wrongOwner=archive([badRow]);
assert.throws(()=>planner.plan({...args,archiveText:wrongOwner}),/unauthorized/);
const validRow={table:'sessions',row:{id:'session-1',user_id:'owner-1',source_key:'workoutHistoryV52',payload:[]}};
assert.throws(()=>planner.inspectArchive(archive([validRow,validRow]),'owner-1',tables),/duplicate/);
const inconsistent=JSON.parse(archive());inconsistent.recordCount=1;
assert.throws(()=>planner.inspectArchive(JSON.stringify(inconsistent),'owner-1',tables),/row count mismatch/);
assert.throws(()=>planner.inspectArchive(archive(), 'owner-1',tables.slice(1)),/tables do not match/);
const malformed={...args,customPlans:[{id:'custom-1',title:'Broken',ids:['unknown-exercise']}]};
const rejected=planner.plan(malformed);
assert.equal(rejected.rejected.length,1);
assert.equal(rejected.canWrite,false);
console.log('MYLIFTCOACH cloud migration readiness: PASS — fail-closed owner and archive validation; no sync approval');
