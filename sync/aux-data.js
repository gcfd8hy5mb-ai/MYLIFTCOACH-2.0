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
  {type:'goal',id:'selected-workout-v1',key:'mlc2-selected-workout-v1',label:'Selected workout',kind:'selected-workout',max:1},
  {type:'goal',id:'coach-weekly-goal-v1',key:'mlc2-weekly-goal-v1',label:'Coach weekly goal',kind:'coach-weekly-goal',max:1},
  {type:'goal',id:'coach-readiness-v1',key:'mlc2-coach-readiness-v1',label:'Coach readiness',kind:'coach-readiness',max:365}
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
  if(config.kind==='selected-workout')return typeof payload==='string'&&planId.test(payload);
  if(config.kind==='coach-weekly-goal')return Number.isInteger(payload)&&payload>=1&&payload<=7;
  if(config.kind==='weekly-schedule')
   return !!payload&&typeof payload==='object'&&!Array.isArray(payload)&&
    Object.keys(payload).length<=7&&
    Object.entries(payload).every(([day,workout])=>/^[0-6]$/.test(day)&&
     typeof workout==='string'&&planId.test(workout));
  if(config.kind==='coach-readiness')
   return !!payload&&typeof payload==='object'&&!Array.isArray(payload)&&
    Object.keys(payload).length<=365&&
    Object.entries(payload).every(([key,value])=>/^\d{4}-\d{2}-\d{2}:.{1,100}$/.test(key)&&
     ['Great','Normal','Tired'].includes(value));
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
 function payload(data){return {format:'mlc2-aux-v1',entries:data}}
 function validateRemote(config,record){
  if(!record||record.deleted)return null;
  if(record.type!==config.type||record.id!==recordId(config)||!record.payload||
    record.payload.format!=='mlc2-aux-v1'||!valid(config,record.payload.entries))
   throw Error(config.label+' remote backup is invalid; no local changes');
  return record.payload.entries;
 }
 function restoreMissing(store,owner,records){
  if(!Array.isArray(records))throw Error('Cloud records must be an array');
  const actions=[];
  for(const config of CONFIG){
   const record=records.find(x=>x&&x.type===config.type&&x.id===recordId(config)&&!x.deleted);
   if(!record)continue;
   const entries=validateRemote(config,record);
   const local=loadLocal(store,owner,config);
   if(local.exists&&!empty(config,local.value))continue;
   if(empty(config,entries))continue;
   actions.push({key:local.key,previous:store.getItem(local.key),
    value:config.kind==='selected-workout'?entries:JSON.stringify(entries),label:config.label});
  }
  const written=[];
  try{
   for(const change of actions){
    store.setItem(change.key,change.value);
    if(store.getItem(change.key)!==change.value)throw Error('Write not verified');
    written.push(change);
   }
  }catch{
   for(const change of [...written].reverse()){
    try{if(change.previous===null)store.removeItem(change.key);else store.setItem(change.key,change.previous)}catch{}
   }
   throw Error('Local recovery write failed; review device storage');
  }
  return actions.map(x=>x.label);
 }
 return Object.freeze({CONFIG,id,recordId,canonical,equal,valid,loadLocal,empty,payload,validateRemote,restoreMissing});
});
