/* MYLIFTCOACH 2.0 cloud migration readiness planner.
   Pure, fail-closed inspection of an original cloud archive and isolated 2.0 data.
   Never writes, uploads, merges, restores, or changes account ownership. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2MigrationReadiness=api;
})(globalThis,function(){
'use strict';
const FORMAT='MYLIFTCOACH-original-account-cloud-archive';
const MAX_BYTES=30*1024*1024;
const safe=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function inspectArchive(source,expectedOwner,allowedTables){
 if(typeof source!=='string'||source.length>MAX_BYTES)throw Error('Archive exceeds inspection limit');
 let data;
 try{data=JSON.parse(source)}catch{throw Error('Invalid cloud archive JSON')}
 if(!safe(data)||data.format!==FORMAT||data.version!==1||!safe(data.counts)||
  !Array.isArray(data.records)||!Number.isSafeInteger(data.tableCount)||!Number.isSafeInteger(data.recordCount)||
  typeof data.accountId!=='string'||!data.accountId||!Array.isArray(allowedTables))
  throw Error('Not a supported original account archive');
 if(expectedOwner!==data.accountId)throw Error('Archive belongs to a different account');
 const tables=new Set(allowedTables);
 if(tables.size!==allowedTables.length||!tables.size||[...tables].some(t=>typeof t!=='string'||!/^[a-z][a-z0-9_]*$/.test(t)))
  throw Error('Original table manifest invalid');
 const countEntries=Object.entries(data.counts);
 if(data.tableCount!==tables.size||countEntries.length!==tables.size||
  countEntries.some(([table,n])=>!tables.has(table)||!Number.isSafeInteger(n)||n<0))
  throw Error('Archive tables do not match original manifest');
 if(data.recordCount!==data.records.length)throw Error('Archive row count mismatch');
 const tally=Object.create(null),seen=new Set();
 for(const t of tables)tally[t]=0;
 for(const item of data.records){
  if(!safe(item)||!tables.has(item.table)||!safe(item.row)||
   item.row.user_id!==data.accountId||typeof item.row.id!=='string'||!item.row.id)
   throw Error('Archive contains invalid or unauthorized records');
  const key=item.table+':'+item.row.id;
  if(seen.has(key))throw Error('Archive contains duplicate cloud record IDs');
  seen.add(key);tally[item.table]++;
 }
 for(const table of tables)if(tally[table]!==data.counts[table])throw Error('Archive category count mismatch: '+table);
 return {owner:data.accountId,recordCount:data.recordCount,tableCount:data.tableCount,
  sourceKeys:[...new Set(data.records.map(x=>x.row.source_key).filter(x=>typeof x==='string'))],
  records:data.records.map(x=>({table:x.table,...x.row}))};
}
function plan({archiveText,ownerId,allowedTables,customPlans=[],sessions=[],catalog=[],mapper,storageModel}){
 const cloud=inspectArchive(archiveText,ownerId,allowedTables);
 if(!mapper||typeof mapper.summarize!=='function'||!storageModel||typeof storageModel.restoreSnapshot!=='function')
  throw Error('Original migration models are unavailable');
 // This is a pure conversion in memory. Never copy restored original-app keys into browser storage.
 let original;
 try{original=storageModel.restoreSnapshot(cloud.records)}catch{throw Error('Original cloud records could not be decoded safely')}
 const decode=key=>{
  const v=original[key];if(v===undefined)return [];
  let list;try{list=JSON.parse(v)}catch{throw Error('Invalid original '+key+' structure')}
  if(!Array.isArray(list))throw Error('Original '+key+' must be a list');
  return list;
 };
 const existingPlans=decode('customWorkoutsV5'),existingSessions=decode('workoutHistoryV52');
 const mapped=mapper.summarize({customPlans,sessions,catalog,existingPlans,existingSessions});
 const missingSourceKeys=Object.keys(storageModel.RULES).filter(k=>!cloud.sourceKeys.includes(k));
 const warnings=[...mapped.warnings];
 if(cloud.recordCount===0)warnings.push('Archive contains no rows; verify the original account before interpreting missing data.');
 if(missingSourceKeys.length)warnings.push('Archive has no records for '+missingSourceKeys.length+' original source categories. Absence cannot prove data was never saved.');
 const blockers=[
 'No shared account revision checkpoint has been verified',
 'No numeric original-compatible workout ID mapping has been approved',
 'No write, recovery or rollback process has been authorized'
 ];
 if(mapped.rejected.length)blockers.push(mapped.rejected.length+' local 2.0 records cannot be converted');
 if(mapped.workoutIdCollisions.length||mapped.sessionIdCollisions.length)blockers.push('Existing record ID collisions must be reconciled');
 return Object.freeze({
  ownerVerified:true,cloudRows:cloud.recordCount,cloudTables:cloud.tableCount,
  originalWorkouts:existingPlans.length,originalSessions:existingSessions.length,
  localWorkouts:customPlans.length,localSessions:sessions.length,
  convertibleWorkouts:mapped.customWorkouts,convertibleSessions:mapped.sessions,convertibleSets:mapped.plannedSets,
  rejected:mapped.rejected,collidingWorkoutIds:mapped.workoutIdCollisions,
  collidingSessionIds:mapped.sessionIdCollisions,missingSourceCategories:missingSourceKeys.length,
  warnings,blockers,
  canWrite:false,canMerge:false,requiresCheckpoint:true
 });
}
return Object.freeze({inspectArchive,plan});
});