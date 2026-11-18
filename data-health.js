/* Pure MYLIFTCOACH 2.0 device-data health checks.
   No reads except explicitly passed storage; no mutation, network, uploads or record repair. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.MLC2DataHealth=api;
})(globalThis,function(){
'use strict';
const KEYS=[
 'mlc2-custom-plans-v1','mlc2-demo-workouts-v1','mlc2-local-daily-v1',
 'mlc2-measurements-v1','mlc2-coach-readiness-v1'
];
const SELECTED='mlc2-selected-workout-v1';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
function check(storage,catalog=[],presets=[]){
 if(typeof storage?.getItem!=='function')throw Error('Browser storage is unavailable');
 const values=Object.create(null),errors=[],warnings=[],counts=Object.create(null),present=[];
 for(const key of KEYS){
  const raw=storage.getItem(key);
  if(raw===null)continue;
  present.push(key);
  try{values[key]=JSON.parse(raw)}
  catch{errors.push('Invalid JSON: '+key)}
 }
 const custom=values['mlc2-custom-plans-v1']??[];
 const sessions=values['mlc2-demo-workouts-v1']??[];
 const tracking=values['mlc2-local-daily-v1']??[];
 const measures=values['mlc2-measurements-v1']??[];
 const readiness=values['mlc2-coach-readiness-v1']??{};
 for(const [label,data] of [['Custom workouts',custom],['Practice sessions',sessions],['Daily logs',tracking],['Measurements',measures]]){
  if(!Array.isArray(data)){errors.push(label+' must be a list');counts[label]=0}else counts[label]=data.length;
 }
 if(!obj(readiness))errors.push('Readiness entries must be an object');
 else counts['Readiness check-ins']=Object.keys(readiness).length;
 const ids=new Set((Array.isArray(catalog)?catalog:[]).map(x=>x.id));
 const seenPlans=new Set(),seenSessions=new Set();
 if(Array.isArray(custom))for(const p of custom){
  if(!obj(p)||typeof p.id!=='string'||!p.id.startsWith('custom-')||!Array.isArray(p.ids)||!p.ids.length){errors.push('Malformed custom workout');continue}
  if(seenPlans.has(p.id))errors.push('Duplicate workout ID: '+p.id);seenPlans.add(p.id);
  for(const id of p.ids)if(!ids.has(id))warnings.push('Unrecognized exercise in custom workout: '+String(id));
 }
 if(Array.isArray(sessions))for(const s of sessions){
  if(!obj(s)||typeof s.id!=='string'||!Array.isArray(s.sets)){errors.push('Malformed practice session');continue}
  if(seenSessions.has(s.id))errors.push('Duplicate session ID: '+s.id);seenSessions.add(s.id);
  for(const set of s.sets){
   if(!obj(set)||typeof set.exerciseId!=='string'||!Number.isFinite(Number(set.weight))||
    Number(set.weight)<0||Number(set.weight)>1500||!Number.isInteger(Number(set.reps))||Number(set.reps)<1||Number(set.reps)>100){
    errors.push('Invalid workout set in '+s.id);continue;
   }
   if(!ids.has(set.exerciseId))warnings.push('Unknown exercise in session '+s.id+': '+set.exerciseId);
  }
 }
 const selected=storage.getItem(SELECTED);
 const available=new Set([...seenPlans,...(Array.isArray(presets)?presets.map(p=>p.id):[])]);
 if(selected&&!available.has(selected))warnings.push('Selected workout ID cannot be found: '+selected);
 if(Array.isArray(tracking))for(const x of tracking)if(!obj(x)||!['water','weight'].includes(x.type)||!(Number(x.value)>0))errors.push('Invalid daily tracking entry');
 if(Array.isArray(measures))for(const x of measures)if(!obj(x)||!['Waist','Chest','Arm','Thigh','Hips'].includes(x.area)||!(Number(x.value)>0))errors.push('Invalid measurement entry');
 return {status:errors.length?'needs-attention':warnings.length?'review':'pass',errors:[...new Set(errors)].slice(0,25),
  warnings:[...new Set(warnings)].slice(0,25),counts,presentKeys:present.length,selectedWorkout:selected||null,
  originalDataChanged:false,cloudDataAccessed:false};
}
return Object.freeze({check});
});