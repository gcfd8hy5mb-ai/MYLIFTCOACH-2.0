'use strict';
const model=require('../../legacy-storage-model.js');
const {inspectArchive}=require('../../cloud-migration-readiness.js');
const checkpoint=require('../../cloud-checkpoint-review.js');
const recovery=require('../../sync/account-recovery.js');
const week=require('../../weekly-workout-schedule.js');
const aux=require('../../sync/aux-data.js');

const ownerPattern=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const mappedKeys=['customWorkoutsV5','workoutHistoryV52','myliftcoachWeeklyDayOverridesV1'];
const coachKey='prismAthleteProfileV1', measurementKey='prismMeasurementsV1';
const areas={waist:'Waist',chest:'Chest',arm:'Arm',thigh:'Thigh',hips:'Hips'};
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(left,right)=>checkpoint.stable(left)===checkpoint.stable(right);
const originalID=id=>{
 if(!Number.isSafeInteger(id)||id<1)throw Error('Unrecognized original numeric ID');
 return id;
};
function parseDevice(deviceText,owner){
 if(typeof deviceText!=='string'||Buffer.byteLength(deviceText)>20*1024*1024)
  throw Error('Owner-bound device checkpoint required');
 const device=JSON.parse(deviceText);
 if(!isRecord(device)||device.format!=='MYLIFTCOACH-original-account-device-checkpoint'||
    device.version!==1||device.accountId!==owner||device.containsAuthentication!==false||
    device.containsPhotoFiles!==false||!isRecord(device.data))
  throw Error('Device checkpoint does not belong to the verified account');
 return device;
}
function preview({owner,baselineText,currentText,deviceText,destination,catalog}){
 if(typeof owner!=='string'||!ownerPattern.test(owner)||destination?.owner!==owner)
  throw Error('Verified original and destination account must match');
 if(!Array.isArray(catalog)||!Array.isArray(destination.sessions)||!Array.isArray(destination.routines)||
    !Array.isArray(destination.deletedSessionIds)||!Array.isArray(destination.deletedRoutineIds)||
    !Array.isArray(destination.cloudDeletedSessionIds)||!Array.isArray(destination.cloudDeletedRoutineIds))
  throw Error('Destination snapshot and deletion markers are required');
 recovery.validate(destination.sessions,owner);
 if(destination.schedule!==null&&!week.valid(destination.schedule))
  throw Error('Invalid destination schedule');
 const device=parseDevice(deviceText,owner);
 const review=checkpoint.inspect({baselineText,currentText,ownerId:owner,tables:model.TABLES,archiveInspector:inspectArchive});
 const current=inspectArchive(currentText,owner,model.TABLES);
 const source=model.restoreSnapshot(current.records);
 const stop=[];
 if(!review.checkpointCompatible)stop.push('Original archives disagree on deleted rows or revisions');
 for(const field of ['deletions','photoDeletions']){
  if(device[field]===null)continue;
  const deletion=JSON.parse(device[field]);
  if(!isRecord(deletion)&&!Array.isArray(deletion))throw Error('Unreadable device deletion metadata');
  if(Object.keys(deletion).length)stop.push('Original device has pending deletions');
 }
 for(const key of [...mappedKeys,coachKey,measurementKey]){
  if(Object.hasOwn(device.data,key)&&(!Object.hasOwn(source,key)||
    !equal(JSON.parse(device.data[key]),JSON.parse(source[key]))))
   stop.push('Original device and current cloud disagree for '+key);
 }
 for(const raw of [source.prismActiveWorkoutV1,device.data.prismActiveWorkoutV1]){
  if(raw===undefined)continue;
  const active=JSON.parse(raw);
  if(active!==null&&(!isRecord(active)||Object.keys(active).length))
   stop.push('Original active workout needs to be finished or retained');
 }
 const exerciseIds=new Set(catalog.map(exercise=>exercise.id));
 const read=(key,empty)=>Object.hasOwn(source,key)?JSON.parse(source[key]):empty;
 const routines=read('customWorkoutsV5',[]),history=read('workoutHistoryV52',[]);
 const overrides=read('myliftcoachWeeklyDayOverridesV1',{});
 if(!Array.isArray(routines)||!Array.isArray(history)||!isRecord(overrides))
  throw Error('Original archive has an incompatible workout or schedule shape');
 const sourceRoutines=new Map(),routineAdds=[],sessionAdds=[];
 const existingRoutines=new Map(destination.routines.map(routine=>[routine.id,routine]));
 const existingSessions=new Map(destination.sessions.map(session=>[session.id,session]));
 const deletedSessions=new Set([...destination.deletedSessionIds,...destination.cloudDeletedSessionIds]);
 const deletedRoutines=new Set([...destination.deletedRoutineIds,...destination.cloudDeletedRoutineIds]);
 const legacySessions=new Set();
 function routine(id,title,ids){
  if(typeof title!=='string'||!title.trim()||title.length>75||!Array.isArray(ids)||!ids.length||
     ids.length>40||new Set(ids).size!==ids.length||ids.some(id=>!exerciseIds.has(id)))
   throw Error('Routine needs a verified exercise and title mapping');
  return {id,title,ids};
 }
 function addRoutine(row){
  const existing=existingRoutines.get(row.id);
  if(deletedRoutines.has(row.id))throw Error('Destination routine was deleted');
  if(existing&&!equal({id:existing.id,title:existing.title,ids:existing.ids},row))
   throw Error('Destination routine differs');
  if(!existing)routineAdds.push(row);
 }
 for(const old of routines){
  try{
   const id=originalID(old.id);
   if(sourceRoutines.has(id))throw Error('Duplicate original routine ID');
   const row=routine('custom-legacy-'+id,old.name,old.exercises);
   addRoutine(row);
   sourceRoutines.set(id,row.id);
  }catch(error){stop.push(error.message)}
 }
 for(const old of history){
  try{
   const id=originalID(old.id);
   if(legacySessions.has(id))throw Error('Duplicate original workout ID');
   legacySessions.add(id);
   const sets=old.exercises.flatMap(exercise=>{
    if(!exerciseIds.has(exercise.id)||!Array.isArray(exercise.sets)||!exercise.sets.length)
     throw Error('Completed workout has unverified exercise or set data');
    return exercise.sets.map(set=>{
     if(!['number','string'].includes(typeof set.weight)||String(set.weight).trim()===''||
        !['number','string'].includes(typeof set.reps)||String(set.reps).trim()==='')
      throw Error('Completed workout has unverified set values');
     return {exerciseId:exercise.id,weight:Number(set.weight),reps:Number(set.reps)};
    });
   });
   const row={id:'legacy-session-'+id,ownerId:owner,title:old.workoutTitle,created:old.date,planId:'legacy-plan-session-'+id,sets,
    legacyWorkoutKey:typeof old.workoutKey==='string'?old.workoutKey:null};
   recovery.validate([row],owner);
   const existing=existingSessions.get(row.id);
   if(deletedSessions.has(row.id))throw Error('Destination workout was deleted');
   if(existing&&!equal(existing,row))throw Error('Destination workout differs');
   if(!existing&&destination.sessions.some(session=>Date.parse(session.created)===Date.parse(row.created)))
    throw Error('Existing workout at the same time needs duplicate review');
   if(!existing)sessionAdds.push(row);
  }catch(error){stop.push(error.message)}
 }
 const schedule={};
 for(const [day,entry] of Object.entries(overrides)){
  try{
   if(!/^[0-6]$/.test(day)||!isRecord(entry))throw Error('Original weekday needs review');
   const target=(Number(day)+1)%7; // Original uses Monday = 0. 2.0 uses Sunday = 0.
   if(entry.rest===true){schedule[target]='rest-day';continue}
   if(entry.customWorkoutId!=null){
    const linked=sourceRoutines.get(originalID(entry.customWorkoutId));
    if(!linked)throw Error('Original weekday links to a missing or deleted routine');
    schedule[target]=linked;
   }else{
    const row=routine('custom-legacy-weekday-'+day,entry.name,entry.ids);
    addRoutine(row);
    schedule[target]=row.id;
   }
  }catch(error){stop.push(error.message)}
 }
 if(Object.keys(schedule).length&&destination.schedule!==null&&!equal(destination.schedule,schedule))
  stop.push('Existing destination schedule differs or was deliberately cleared');
 const auxiliary=[];
 const archivedDetails=[];
 function stageAuxiliary(config,value){
  const id=aux.recordId(config);
  const evidence=destination.auxiliary?.find(entry=>entry.type===config.type&&entry.id===id);
  if(!evidence||typeof evidence.cloudDeleted!=='boolean'||!Object.hasOwn(evidence,'value')){
   stop.push('Destination evidence is missing for '+config.label);return;
  }
  if(evidence.cloudDeleted){stop.push('Destination category was deleted for '+config.label);return}
  if(!aux.valid(config,value)){stop.push('Mapped values exceed the limits for '+config.label);return}
  if(evidence.value!==null){
   if(!equal(evidence.value,value))stop.push('Existing destination values differ or were cleared for '+config.label);
   return;
  }
  auxiliary.push({type:config.type,id,entries:value});
 }
 const profile=read(coachKey,null);
 if(profile!==null){
  if(!isRecord(profile))throw Error('Original Coach profile has an incompatible shape');
  const goal=Object.hasOwn({strength:1,hypertrophy:1,general:1},profile.goal)?
   {strength:'strength',hypertrophy:'muscle',general:'balanced'}[profile.goal]:null;
  // Mixed equipment is the only old preference with an unrestricted 2.0 equivalent.
  const preferences={goal,days:profile.days,equipment:'Any'};
  if(goal&&[3,4,5].includes(profile.days)&&profile.equipment==='mixed')
   stageAuxiliary(aux.CONFIG.find(config=>config.kind==='coach-training-preferences'),preferences);
  else archivedDetails.push('Original Coach training preference has no equivalent preset');
  archivedDetails.push('Original Coach experience, session duration and priority remain in the original archive');
 }
 const measurements=read(measurementKey,[]);
 if(!Array.isArray(measurements))throw Error('Original measurements have an incompatible shape');
 const converted=[],measurementIds=new Set();
 for(const measurement of measurements){
  if(!isRecord(measurement)||typeof measurement.id!=='string'||!/^[a-z0-9_-]{1,120}$/i.test(measurement.id)||
     typeof measurement.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(measurement.date)||
     !Number.isFinite(Date.parse(measurement.date))||new Date(measurement.date).toISOString().slice(0,10)!==measurement.date||
     measurementIds.has(measurement.id)){stop.push('Original measurements need ID or date review');continue}
  measurementIds.add(measurement.id);
  for(const [key,area] of Object.entries(areas)){
   const value=measurement[key];
   if(value==null)continue;
   if(!Number.isFinite(value)||value<1||value>200){stop.push('Original circumference measurement needs range review');continue}
   converted.push({id:'legacy-'+measurement.id+'-'+key,area,day:measurement.date,value});
  }
 }
 if(converted.length)stageAuxiliary(aux.CONFIG.find(config=>config.type==='measurement'),converted);
 if(measurements.length)archivedDetails.push('Original measurement phases, body-fat and weight fields remain in the original archive');
 const preservedOnly=[...new Set([...Object.keys(source),...Object.keys(device.data)])]
  .filter(key=>!mappedKeys.includes(key)).sort();
 if(existingRoutines.size+routineAdds.length>60)stop.push('Destination routine limit exceeded');
 const blockers=[...new Set(stop)];
 return {owner,blockers,preservedOnly,archivedDetails,readyForShadowRehearsal:blockers.length===0,
  additions:blockers.length?null:{routines:routineAdds,sessions:sessionAdds,
   schedule:destination.schedule===null&&Object.keys(schedule).length?schedule:null,auxiliary}};
}
module.exports={preview};
