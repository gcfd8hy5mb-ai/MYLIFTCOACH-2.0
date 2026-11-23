/* Named weekly workout schedules and explicit Coach activation.
   Data is scoped by the app's account-aware storage adapter; no history changes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2ScheduleLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='mlc2-schedule-library-v1',WEEK='mlc2-weekly-schedule-v1',SELECTED='mlc2-selected-workout-v1';
 const VALID_ID=/^[a-z0-9][a-z0-9-]{0,99}$/;
 const validMap=map=>!!map&&typeof map==='object'&&!Array.isArray(map)&&Object.keys(map).length<=7&&
  Object.entries(map).every(([day,id])=>/^[0-6]$/.test(day)&&typeof id==='string'&&VALID_ID.test(id));
 const blank=()=>({version:1,mode:'weekly',activeId:'',profiles:[]});
 function valid(data){
  return data?.version===1&&['weekly','coach'].includes(data.mode)&&typeof data.activeId==='string'&&
   (data.activeId===''||/^schedule-[a-z0-9-]{1,88}$/.test(data.activeId))&&
   Array.isArray(data.profiles)&&data.profiles.length<=16&&
   new Set(data.profiles.map(x=>x.id)).size===data.profiles.length&&
   data.profiles.every(x=>x&&/^schedule-[a-z0-9-]{1,88}$/.test(x.id)&&
    typeof x.name==='string'&&x.name.trim()===x.name&&x.name.length>0&&x.name.length<=75&&validMap(x.days))&&
   (!data.activeId||data.profiles.some(x=>x.id===data.activeId));
 }
 function read(storage){
  const raw=storage.getItem(KEY);
  if(raw===null)return blank();
  let state;try{state=JSON.parse(raw)}catch{throw Error('Saved program library needs recovery. Nothing changed.')}
  if(!valid(state))throw Error('Saved program library needs review. Nothing changed.');
  return state;
 }
 function active(storage){
  try{return read(storage)}catch{return null}
 }
 function current(storage){
  const raw=storage.getItem(WEEK);
  if(raw===null)return {};
  let map;try{map=JSON.parse(raw)}catch{throw Error('Current weekly schedule is unreadable. Nothing changed.')}
  if(!validMap(map))throw Error('Current weekly schedule needs review. Nothing changed.');
  return map;
 }
 function unique(state){
  const taken=new Set(state.profiles.map(x=>x.id));
  let id='schedule-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  while(taken.has(id))id+='x';
  return id;
 }
 function normalizedName(name){
  const text=String(name||'').trim();
  if(!text||text.length>75)throw Error('Enter a program name (75 characters maximum).');
  return text;
 }
 function captureCurrent(state,map){
  // Existing weekly assignments predate this library. Preserve them when first switching.
  if(!state.profiles.length&&!state.activeId&&Object.keys(map).length){
   const id=unique(state);
   return {...state,profiles:[{id,name:'Previous weekly schedule',days:{...map}}],activeId:id};
  }
  if(state.activeId){
   return {...state,profiles:state.profiles.map(p=>p.id===state.activeId?{...p,days:{...map}}:p)};
  }
  return state;
 }
 function newFullWeek(storage,name,map){
  if(!validMap(map))throw Error('Weekly program is invalid.');
  let state=captureCurrent(read(storage),current(storage));
  if(state.profiles.length>=16)throw Error('Maximum 16 saved weekly programs. Nothing was replaced.');
  const id=unique(state);
  state={...state,mode:'weekly',activeId:id,profiles:[...state.profiles,{id,name:normalizedName(name),days:{...map}}]};
  if(!valid(state))throw Error('Saved program was invalid.');
  return state;
 }
 function saveCurrent(store,name){
  let state=captureCurrent(read(store),current(store));
  const map=current(store);
  if(!Object.keys(map).length)throw Error('Assign workout days before saving this program.');
  if(state.activeId){
   state={...state,mode:'weekly',profiles:state.profiles.map(p=>p.id===state.activeId?{...p,name:normalizedName(name),days:{...map}}:p)};
  }else{
   if(state.profiles.length>=16)throw Error('Maximum 16 saved weekly programs.');
   const id=unique(state);state={...state,mode:'weekly',activeId:id,profiles:[...state.profiles,{id,name:normalizedName(name),days:{...map}}]};
  }
  store.setItem(KEY,JSON.stringify(state));
  store.setItem(SELECTED,'');
  return state;
 }
 function saveCopy(store,name){
  const map=current(store);
  if(!Object.keys(map).length)throw Error('Assign workout days before saving a copy.');
  let state=read(store);
  if(state.profiles.length>=16)throw Error('Maximum 16 saved weekly programs.');
  const id=unique(state);
  state={...state,mode:'weekly',activeId:id,
   profiles:[...state.profiles,{id,name:normalizedName(name),days:{...map}}]};
  store.setItem(KEY,JSON.stringify(state));
  store.setItem(SELECTED,'');
  return state;
 }
 function activate(store,id,plans){
  const state=captureCurrent(read(store),current(store));
  const profile=state.profiles.find(p=>p.id===id);
  if(!profile)throw Error('Saved program no longer exists.');
  const known=new Set(plans.map(p=>p.id));
  if(Object.values(profile.days).some(p=>p!=='rest-day'&&!known.has(p)))
   throw Error('A routine used by this program is unavailable. Nothing was replaced.');
  store.setItem(WEEK,JSON.stringify(profile.days));
  store.setItem(KEY,JSON.stringify({...state,mode:'weekly',activeId:id}));
  store.setItem(SELECTED,''); // Clear temporary selection; do not delete routines/history.
  return profile;
 }
 function useCoach(store){
  const state=captureCurrent(read(store),current(store));
  store.setItem(KEY,JSON.stringify({...state,mode:'coach'}));
  store.setItem(SELECTED,''); // Coach becomes active without deleting weekly assignments.
  return state.profiles.find(x=>x.id===state.activeId)||null;
 }
 function edited(store,map){
  if(!validMap(map))throw Error('Weekly schedule is invalid.');
  let state=captureCurrent(read(store),current(store));
  if(state.activeId){
   state={...state,profiles:state.profiles.map(p=>p.id===state.activeId?{...p,days:{...map}}:p)};
  }
  store.setItem(WEEK,JSON.stringify(map));
  store.setItem(KEY,JSON.stringify({...state,mode:'weekly'}));
  store.setItem(SELECTED,'');
 }
 function remove(store,id){
  const state=read(store);
  if(!state.profiles.some(p=>p.id===id))throw Error('Saved program does not exist.');
  const rest=state.profiles.filter(p=>p.id!==id);
  store.setItem(KEY,JSON.stringify({...state,profiles:rest,activeId:state.activeId===id?'':state.activeId}));
  // Never delete the active weekly map or workout routines on profile deletion.
 }
 return Object.freeze({KEY,WEEK,SELECTED,validMap,valid,read,active,current,captureCurrent,newFullWeek,saveCurrent,saveCopy,activate,useCoach,edited,remove});
});
