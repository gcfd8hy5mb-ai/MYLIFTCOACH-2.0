/* MYLIFTCOACH 2.0 — isolated owner-scoped auxiliary snapshots.
   All records use the already-deployed isolated RPC types and distinct IDs.
   Never copy guest data into a signed-in account implicitly. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AuxData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CONFIG=Object.freeze([
  {type:'custom-plan',key:'mlc2-custom-plans-v1',label:'Custom workouts',max:100},
  {type:'measurement',key:'mlc2-measurements-v1',label:'Measurements',max:200},
  {type:'tracking',key:'mlc2-local-daily-v1',label:'Water and weight tracking',max:400},
  {type:'meal',key:'mlc2-food-log-v1',label:'Nutrition history',max:400},
  {type:'goal',key:'mlc2-food-goals-v1',label:'Nutrition goals',max:1},
  {type:'goal',id:'weekly-schedule-v1',key:'mlc2-weekly-schedule-v1',label:'Weekly workout schedule',kind:'weekly-schedule',max:7},
  {type:'goal',id:'schedule-library-v1',key:'mlc2-schedule-library-v1',label:'Saved weekly programs',kind:'schedule-library',max:16},
  {type:'goal',id:'selected-workout-v1',key:'mlc2-selected-workout-v1',label:'Selected workout',kind:'selected-workout',max:1},
  {type:'goal',id:'coach-weekly-goal-v1',key:'mlc2-weekly-goal-v1',label:'Coach weekly goal',kind:'coach-weekly-goal',max:1},
  {type:'goal',id:'coach-readiness-v1',key:'mlc2-coach-readiness-v1',label:'Coach readiness',kind:'coach-readiness',max:365},
  {type:'goal',id:'coach-training-preferences-v1',key:'mlc2-auto-coach-preferences-v1',label:'Coach training preferences',kind:'coach-training-preferences',max:1},
  {type:'goal',id:'goal-calorie-estimate-v1',key:'mlc2-estimated-calorie-goal-v1',label:'Estimated calorie goal profile',kind:'calorie-estimate',max:1},
  {type:'goal',id:'goal-program-calendar-v1',key:'mlc2-goal-program-v1',label:'Fixed-duration fitness goal program',kind:'goal-program',max:1},
  {type:'goal',id:'goal-program-source-v1',key:'mlc2-goal-program-source-v1',label:'Program workout source',kind:'goal-program-source',max:1},
  {type:'goal',id:'workout-overrides-v1',key:'mlc2-workout-overrides-v1',label:'Preset and Coach workout edits',kind:'workout-overrides',max:32}
 ]);
 const id='snapshot-v1',planId=/^[a-z0-9][a-z0-9-]{0,99}$/;
 const recordId=config=>config.id||id;
 function canonical(data){
  if(Array.isArray(data))return data.map(canonical);
  if(data&&typeof data==='object')return Object.fromEntries(Object.keys(data).sort().map(k=>[k,canonical(data[k])]));
  return data;
 }
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 function valid(config,payload){
  if(config.kind==='workout-overrides'){
   const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
   const exerciseId=/^[a-z0-9][a-z0-9-]{0,99}$/;
   const limits={sets:[1,20],reps:[1,100],weight:[0,1500],restSeconds:[0,1800]};
   return object(payload)&&Object.keys(payload).length<=32&&Object.entries(payload).every(([id,edit])=>
    planId.test(id)&&(!id.startsWith('coach-auto-')||/^coach-auto-day-[1-5]-split-[345]$/.test(id))&&
    object(edit)&&Array.isArray(edit.ids)&&edit.ids.length>=1&&edit.ids.length<=40&&
    new Set(edit.ids).size===edit.ids.length&&edit.ids.every(ex=>typeof ex==='string'&&exerciseId.test(ex))&&
    object(edit.targets)&&Object.entries(edit.targets).every(([ex,target])=>
     edit.ids.includes(ex)&&object(target)&&Object.entries(target).every(([field,n])=>
      Object.hasOwn(limits,field)&&Number.isFinite(n)&&(field==='weight'||Number.isInteger(n))&&
      n>=limits[field][0]&&n<=limits[field][1])));
  }
  if(config.kind==='selected-workout')return typeof payload==='string'&&(payload===''||planId.test(payload));
  if(config.kind==='coach-weekly-goal')return Number.isInteger(payload)&&payload>=1&&payload<=7;
  if(config.kind==='weekly-schedule')
   return !!payload&&typeof payload==='object'&&!Array.isArray(payload)&&
    Object.keys(payload).length<=7&&
    Object.entries(payload).every(([day,workout])=>/^[0-6]$/.test(day)&&
     typeof workout==='string'&&planId.test(workout));
  if(config.kind==='schedule-library'){
   const id=/^schedule-[a-z0-9-]{1,88}$/;
   const maps=map=>!!map&&typeof map==='object'&&!Array.isArray(map)&&Object.keys(map).length<=7&&
    Object.entries(map).every(([day,workout])=>/^[0-6]$/.test(day)&&typeof workout==='string'&&planId.test(workout));
   return !!payload&&payload.version===1&&['weekly','coach'].includes(payload.mode)&&
    typeof payload.activeId==='string'&&(payload.activeId===''||id.test(payload.activeId))&&
    Array.isArray(payload.profiles)&&payload.profiles.length<=16&&
    new Set(payload.profiles.map(p=>p.id)).size===payload.profiles.length&&
    payload.profiles.every(p=>p&&id.test(p.id)&&typeof p.name==='string'&&
      p.name.trim()===p.name&&p.name.length>0&&p.name.length<=75&&maps(p.days))&&
    (!payload.activeId||payload.profiles.some(p=>p.id===payload.activeId));
  }
  if(config.kind==='coach-readiness')
   return !!payload&&typeof payload==='object'&&!Array.isArray(payload)&&
    Object.keys(payload).length<=365&&
    Object.entries(payload).every(([key,value])=>/^\d{4}-\d{2}-\d{2}:.{1,100}$/.test(key)&&
     ['Great','Normal','Tired'].includes(value));
  const obj=payload&&typeof payload==='object'&&!Array.isArray(payload);
  if(config.kind==='coach-training-preferences')return obj&&
   ['balanced','strength','muscle'].includes(payload.goal)&&[3,4,5].includes(payload.days)&&
   ['Any','Machine','Dumbbell','Bodyweight','Cable','Barbell'].includes(payload.equipment);
  if(config.kind==='calorie-estimate')return obj&&
   Number.isFinite(payload.age)&&payload.age>=18&&payload.age<=100&&
   Number.isFinite(payload.weightKg)&&payload.weightKg>=30&&payload.weightKg<=400&&
   Number.isFinite(payload.heightCm)&&payload.heightCm>=120&&payload.heightCm<=230&&
   ['male','female'].includes(payload.sex)&&
   ['sedentary','light','moderate','active'].includes(payload.activity)&&
   ['strength','bulk','maintain','cut'].includes(payload.goal);
  if(config.kind==='goal-program')return obj&&
   ['strength','bulk','maintain','cut'].includes(payload.goal)&&[6,8,12].includes(payload.weeks)&&
   typeof payload.startDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate)&&
   Number.isFinite(Date.parse(payload.startDate+'T00:00:00Z'))&&
   new Date(payload.startDate+'T00:00:00Z').toISOString().slice(0,10)===payload.startDate;
  if(config.kind==='goal-program-source')return obj&&
   ['custom','generated','mixed'].includes(payload.mode)&&
   typeof payload.customId==='string'&&(payload.customId===''||/^custom-[A-Za-z0-9_-]{1,100}$/.test(payload.customId))&&
   typeof payload.signature==='string'&&/^\d{4}-\d{2}-\d{2}:(strength|bulk|maintain|cut):(6|8|12)$/.test(payload.signature);
  if(config.type==='goal')return payload&&typeof payload==='object'&&!Array.isArray(payload)&&
   Number.isFinite(payload.calories)&&payload.calories>0&&payload.calories<=15000&&
   Number.isFinite(payload.protein)&&payload.protein>=0&&payload.protein<=1500;
  if(!Array.isArray(payload)||payload.length>config.max)return false;
  return payload.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&
   typeof x.id==='string'&&x.id.length>0&&x.id.length<=180);
 }
 function loadLocal(store,owner,config){
  const key=config.key+':user:'+owner,raw=store.getItem(key);
  if(raw===null)return {exists:false,key,value:null};
  if(raw.length>300000)throw Error(config.label+' exceeds safe backup size');
  let value;
  if(config.kind==='selected-workout')value=raw;
  else{try{value=JSON.parse(raw)}catch{throw Error(config.label+' local data is unreadable')}}
  if(!valid(config,value))throw Error(config.label+' has invalid data; not backed up');
  return {exists:true,key,value};
 }
 function empty(config,value){
  if(config.kind==='selected-workout')return value==='';
  if(config.kind==='coach-weekly-goal')return value===null;
  if(config.kind==='weekly-schedule'||config.kind==='coach-readiness')
   return value===null||Object.keys(value).length===0;
  return config.type==='goal'?value===null:Array.isArray(value)&&value.length===0;
 }
 function canFill(_config,local){
  // An empty stored value can reflect a deliberate clear, just like a populated
  // value reflects a current edit. Only a genuinely absent key is fillable.
  return !local.exists;
 }
 function payload(data){return {format:'mlc2-aux-v1',entries:data}}
 function validateRemote(config,record){
  if(!record||record.deleted)return null;
  if(record.type!==config.type||record.id!==recordId(config)||!record.payload||
    record.payload.format!=='mlc2-aux-v1'||!valid(config,record.payload.entries))
   throw Error(config.label+' remote backup is invalid; no local changes');
  return record.payload.entries;
 }
 function recoveryCandidates(store,owner,records){
  if(!Array.isArray(records))throw Error('Cloud records must be an array');
  if(records.some(record=>record&&record.owner!==owner))throw Error('Cloud recovery owner mismatch');
  const plansConfig=CONFIG.find(config=>config.type==='custom-plan');
  const planRecord=records.find(row=>row?.type===plansConfig.type&&row.id===recordId(plansConfig));
  const localPlans=loadLocal(store,owner,plansConfig);
  const plans=planRecord?.deleted?[]:localPlans.exists?localPlans.value:
   planRecord?validateRemote(plansConfig,planRecord):[];
  const knownPlans=new Set(plans.map(plan=>plan.id));
  const hasMissingPlan=ids=>ids.some(id=>id.startsWith('custom-')&&!knownPlans.has(id));
  const candidates=[];
  for(const config of CONFIG){
   const record=records.find(x=>x&&x.type===config.type&&x.id===recordId(config)&&!x.deleted);
   if(!record)continue;
   const entries=validateRemote(config,record);
   const local=loadLocal(store,owner,config);
   if(!canFill(config,local)||empty(config,entries))continue;
   const references=config.kind==='schedule-library'?entries.profiles.flatMap(p=>Object.values(p.days)):
    config.kind==='weekly-schedule'?Object.values(entries):
    config.kind==='selected-workout'?[entries]:
    config.kind==='goal-program-source'?[entries.customId]:[];
   if(hasMissingPlan(references))continue;
   candidates.push({config,record,entries,local});
  }
  return candidates;
 }
 function restoreMissing(store,owner,records,{writePlans}={}){
  const actions=recoveryCandidates(store,owner,records).map(({config,entries,local})=>({
   key:local.key,previous:store.getItem(local.key),
   value:config.kind==='selected-workout'?entries:JSON.stringify(entries),label:config.label
  }));
  const transactional=writePlans?actions.filter(change=>
   ['mlc2-custom-plans-v1','mlc2-weekly-schedule-v1','mlc2-schedule-library-v1','mlc2-selected-workout-v1',
    'mlc2-goal-program-v1','mlc2-goal-program-source-v1','mlc2-estimated-calorie-goal-v1','mlc2-workout-overrides-v1']
    .some(key=>change.key===key+':user:'+owner)):[];
  const written=[];
  try{
   for(const change of actions){
    if(transactional.includes(change))continue;
    if(store.getItem(change.key)!==change.previous)throw Error('Local recovery data changed');
    // Record the attempted mutation before read-back so even a partial or
    // corrupted write is rolled back if verification fails.
    written.push(change);
    store.setItem(change.key,change.value);
    if(store.getItem(change.key)!==change.value)throw Error('Write not verified');
   }
   if(transactional.length)writePlans(transactional);
  }catch{
   for(const change of [...written].reverse()){
    try{if(change.previous===null)store.removeItem(change.key);else store.setItem(change.key,change.previous)}catch{}
   }
   throw Error('Local recovery write failed; review device storage');
  }
  return actions.map(x=>x.label);
 }
 return Object.freeze({CONFIG,id,recordId,canonical,equal,valid,loadLocal,empty,canFill,payload,validateRemote,recoveryCandidates,restoreMissing});
});
