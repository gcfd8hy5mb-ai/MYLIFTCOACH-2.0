/* MYLIFTCOACH 2.0 → original-format conversion preview.
   PURE FUNCTIONS ONLY. No storage, fetch, account, or cloud mutations. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2LegacyMapper=api;
})(globalThis,function(){
'use strict';
const validId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(id);
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const catalogueId=(id,catalog)=>Array.isArray(catalog)&&catalog.some(e=>e&&e.id===id);
function planToOriginal(plan,catalog){
 if(!plan||!validId(plan.id)||!plan.id.startsWith('custom-'))throw Error('Invalid 2.0 custom workout identifier.');
 if(!Array.isArray(plan.ids)||!plan.ids.length||plan.ids.length>40)throw Error('Workout must have 1–40 exercises.');
 if(plan.ids.some(id=>!validId(id)||!catalogueId(id,catalog))||new Set(plan.ids).size!==plan.ids.length)throw Error('Invalid or duplicate exercise identifiers.');
 if(typeof plan.title!=='string'||!plan.title.trim())throw Error('Workout name is required.');
 // Original app's custom ID is numeric. Strings are not silently converted with Number() (collision risk).
 // Keep a deterministic namespace alongside the original-shaped preview, for later explicit mapping.
 const sourceId=plan.id;
 return {sourceId,originalShape:{id:sourceId,name:plan.title.trim().slice(0,75),exercises:[...plan.ids]}};
}
function sessionToOriginal(entry,catalog){
 if(!entry||typeof entry.id!=='string'||!entry.id.startsWith('demo-'))throw Error('Invalid 2.0 session identifier.');
 if(!validDate(entry.created)||typeof entry.title!=='string'||!Array.isArray(entry.sets)||!entry.sets.length)throw Error('Incomplete session.');
 const byExercise=new Map();
 for(const row of entry.sets){
  if(!row||!validId(row.exerciseId)||!catalogueId(row.exerciseId,catalog))throw Error('Session contains an unknown exercise.');
  const weight=Number(row.weight),reps=Number(row.reps);
  if(!Number.isFinite(weight)||weight<=0||weight>1500||!Number.isInteger(reps)||reps<1||reps>100)throw Error('Invalid weighted set.');
  if(!byExercise.has(row.exerciseId))byExercise.set(row.exerciseId,[]);
  byExercise.get(row.exerciseId).push({set:byExercise.get(row.exerciseId).length+1,weight,reps});
 }
 if(!byExercise.size)throw Error('No valid sets.');
 const originalShape={
  id:entry.id,date:entry.created,workoutKey:String(entry.planId||'').slice(0,100),
  workoutTitle:entry.title.slice(0,110),
  exercises:[...byExercise.entries()].map(([id,sets])=>({id,name:catalog.find(e=>e.id===id).name,sets}))
 };
 return {sourceId:entry.id,originalShape};
}
function auditDuplicates(values,name){
 const seen=new Set(),duplicates=[];
 for(const item of values){const id=String(item.id);
  if(seen.has(id))duplicates.push(id);else seen.add(id);
 }
 return duplicates.length?name+' contains duplicate IDs: '+duplicates.slice(0,3).join(', '):null;
}
function summarize({customPlans=[],sessions=[],catalog=[],existingPlans=[],existingSessions=[]}){
 if(!Array.isArray(customPlans)||!Array.isArray(sessions)||!Array.isArray(catalog)||!Array.isArray(existingPlans)||!Array.isArray(existingSessions))throw Error('Expected arrays.');
 const warnings=[];
 const duplicatePlans=auditDuplicates(customPlans,'2.0 plans'),duplicateSessions=auditDuplicates(sessions,'2.0 sessions');
 if(duplicatePlans||duplicateSessions)throw Error([duplicatePlans,duplicateSessions].filter(Boolean).join('; ')+' — resolve duplicate IDs before mapping.');
 const targetPlanIds=new Set(existingPlans.map(p=>String(p?.id)));
 const targetSessionIds=new Set(existingSessions.map(s=>String(s?.id)));
 const idCollisionPlan=[],idCollisionSession=[],rejected=[],plans=[],completed=[];
 for(const p of customPlans){
  try{const value=planToOriginal(p,catalog);
   if(targetPlanIds.has(value.sourceId)){idCollisionPlan.push(value.sourceId);continue}
   plans.push(value);
  }catch(e){rejected.push({type:'workout',sourceId:String(p?.id||''),reason:e.message})}
 }
 for(const entry of sessions){
  try{const value=sessionToOriginal(entry,catalog);
   if(targetSessionIds.has(value.sourceId)){idCollisionSession.push(value.sourceId);continue}
   completed.push(value);
  }catch(e){rejected.push({type:'session',sourceId:String(entry?.id||''),reason:e.message})}
 }
 // A preview never authorizes writing: original app uses numeric custom IDs and
 // original cloud sync stores source-specific hashed rows with revisions/checkpoints.
 warnings.push('Converted string IDs require an explicit collision-safe target mapping before any actual migration.');
 if(existingPlans.length||existingSessions.length)warnings.push('Existing original records must be reconciled using the original revision checkpoints before importing.');
 return Object.freeze({
  customWorkouts:plans.length,sessions:completed.length,plannedSets:completed.reduce((n,s)=>n+s.originalShape.exercises.reduce((m,e)=>m+e.sets.length,0),0),
  workoutIdCollisions:idCollisionPlan,sessionIdCollisions:idCollisionSession,
  rejected,warnings,requiresCheckpoint:true,uploadAllowed:false,
  preview:{plans,sessions:completed}
 });
}
return Object.freeze({planToOriginal,sessionToOriginal,summarize});
});