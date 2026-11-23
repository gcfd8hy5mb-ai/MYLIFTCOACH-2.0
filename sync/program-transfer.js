/* Read-only, signed-in account scoped transfer inspection.
 * No writes to existing local data, Supabase, workouts, or photos.
 * Designed for separately installed iOS Home Screen web apps. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2ProgramTransfer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const FORMAT='MYLIFTCOACH-2.0-account-program-transfer',VERSION=1,MAX_BYTES=500000;
const KEYS=Object.freeze([
 'mlc2-custom-plans-v1','mlc2-weekly-schedule-v1','mlc2-schedule-library-v1',
 'mlc2-selected-workout-v1','mlc2-auto-coach-preferences-v1',
 'mlc2-weekly-goal-v1','mlc2-goal-program-v1','mlc2-goal-program-source-v1'
]);
const ownerOK=owner=>typeof owner==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(owner);
const own=(key,owner)=>key+':user:'+owner;
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function safeTree(value,depth=0){
 if(depth>20)throw Error('Transfer nesting exceeds limit');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){
  if(value.length>250)throw Error('Transfer list exceeds limit');
  value.forEach(v=>safeTree(v,depth+1));return;
 }
 if(!plain(value))throw Error('Invalid transfer data type');
 for(const [key,entry] of Object.entries(value)){
  if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe transfer property');
  safeTree(entry,depth+1);
 }
}
function validateCategory(key,data,aux){
 if(!KEYS.includes(key))throw Error('Unsupported transfer category');
 const config=aux?.CONFIG?.find(x=>x.key===key);
 if(!config||typeof aux.valid!=='function'||!aux.valid(config,data))
  throw Error('Transfer category requires review: '+key);
}
function capture(storage,owner,aux,stamp=new Date().toISOString()){
 if(!ownerOK(owner)||typeof storage?.getItem!=='function')throw Error('Verified account required');
 const entries={};
 for(const key of KEYS){
  const raw=storage.getItem(own(key,owner));
  if(raw===null)continue;
  if(raw.length>MAX_BYTES)throw Error('Account data too large: '+key);
  let data;
  if(key==='mlc2-selected-workout-v1')data=raw;
  else {try{data=JSON.parse(raw)}catch{throw Error('Unreadable account data: '+key)}}
  validateCategory(key,data,aux);
  entries[key]=data;
 }
 if(!Object.keys(entries).length)throw Error('No account programs or Coach settings stored in this installation');
 const result={format:FORMAT,version:VERSION,owner,created:stamp,
  containsAuthentication:false,containsPhotos:false,entries};
 if(JSON.stringify(result).length>MAX_BYTES)throw Error('Account transfer exceeds size limit');
 return result;
}
function parse(raw,owner,aux){
 if(!ownerOK(owner))throw Error('Verified account required');
 if(typeof raw!=='string'||raw.length>MAX_BYTES)throw Error('Transfer file is too large');
 let record;
 try{record=JSON.parse(raw)}catch{throw Error('Transfer file is not valid JSON')}
 safeTree(record);
 if(!plain(record)||record.format!==FORMAT||record.version!==VERSION||
    record.owner!==owner||!plain(record.entries)||typeof record.created!=='string'||
    !Number.isFinite(Date.parse(record.created))||
    Object.keys(record.entries).length===0||
    Object.keys(record.entries).some(key=>!KEYS.includes(key)))
  throw Error('Transfer file is invalid or belongs to another account');
 for(const [key,value] of Object.entries(record.entries))validateCategory(key,value,aux);
 // Never trust device-supplied strings as executable HTML, code or storage keys.
 return record;
}
function compare(record,storage,owner,aux){
 if(!ownerOK(owner)||record?.owner!==owner||typeof storage?.getItem!=='function')
  throw Error('Account mismatch');
 const missing=[],matching=[],different=[];
 for(const [key,value] of Object.entries(record.entries)){
  validateCategory(key,value,aux);
  const current=storage.getItem(own(key,owner));
  if(current===null){missing.push(key);continue}
  let existing;
  if(key==='mlc2-selected-workout-v1')existing=current;
  else {try{existing=JSON.parse(current)}catch{different.push(key);continue}}
  if(aux.equal(existing,value))matching.push(key);else different.push(key);
 }
 return {missing,matching,different,readOnly:true};
}
/* All merge decisions are computed first. No writes occur here. The app commits the
 * resulting owner-scoped changes through its existing all-or-nothing plan journal. */
function planMerge(record,storage,owner,aux,{activateSource=false}={}){
 if(!ownerOK(owner)||record?.owner!==owner||typeof storage?.getItem!=='function')
  throw Error('Sign in to the same verified account first');
 if(!plain(record.entries))throw Error('Invalid transfer record');
 for(const [key,data] of Object.entries(record.entries))validateCategory(key,data,aux);
 const current=new Map(),merged=new Map(),conflicts=[];
 for(const key of KEYS){
  const raw=storage.getItem(own(key,owner));
  current.set(key,raw);
  if(raw!==null){
   let data;
   try{data=key==='mlc2-selected-workout-v1'?raw:JSON.parse(raw)}
   catch{throw Error('Current '+key+' is unreadable; no changes made')}
   validateCategory(key,data,aux);
   merged.set(key,data);
  }
 }
 const incoming=record.entries;
 const PLANS='mlc2-custom-plans-v1',LIBRARY='mlc2-schedule-library-v1',WEEK='mlc2-weekly-schedule-v1';
 const ownPlans=merged.get(PLANS)||[],newPlans=incoming[PLANS]||[];
 const plansById=new Map(ownPlans.map(x=>[x.id,x]));
 const nextPlans=[...ownPlans];
 for(const plan of newPlans){
  const present=plansById.get(plan.id);
  if(present){
   if(!aux.equal(present,plan))conflicts.push('Different custom workout with same ID: '+plan.id);
  }else{nextPlans.push(plan);plansById.set(plan.id,plan)}
 }
 if(nextPlans.length>60)conflicts.push('Custom routine limit reached');
 if(newPlans.length&&nextPlans.length<=60)merged.set(PLANS,nextPlans);
 const left=merged.get(LIBRARY),right=incoming[LIBRARY];
 if(right){
  const profiles=left?[...left.profiles]:[];
  const byId=new Map(profiles.map(x=>[x.id,x]));
  for(const profile of right.profiles){
   const existing=byId.get(profile.id);
   if(existing){
    if(!aux.equal(existing,profile))conflicts.push('Different saved program with same ID: '+profile.id);
   }else{profiles.push(profile);byId.set(profile.id,profile)}
  }
  if(profiles.length>16)conflicts.push('Saved weekly program limit reached');
  const mode=(activateSource||!left)?right.mode:left.mode;
  const activeId=(activateSource||!left)?right.activeId:left.activeId;
  const result={version:1,mode,activeId,profiles};
  if(!aux.valid(aux.CONFIG.find(x=>x.key===LIBRARY),result))conflicts.push('Saved program combination needs review');
  else merged.set(LIBRARY,result);
 }
 for(const key of KEYS){
  if(key===PLANS||key===LIBRARY)continue;
  if(!Object.prototype.hasOwnProperty.call(incoming,key))continue;
  // Source wins only by explicit selection, never through background cloud sync.
  if(!merged.has(key)||activateSource)merged.set(key,incoming[key]);
 }
 const known=new Set(nextPlans.map(x=>x.id));
 const planMissing=id=>id?.startsWith('custom-')&&!known.has(id);
 if(merged.has(WEEK)&&Object.values(merged.get(WEEK)).some(planMissing))
  conflicts.push('Weekly schedule references a missing custom workout');
 if(merged.has(LIBRARY)&&merged.get(LIBRARY).profiles.some(p=>Object.values(p.days).some(planMissing)))
  conflicts.push('Saved program references a missing custom workout');
 if(planMissing(merged.get('mlc2-selected-workout-v1')))
  conflicts.push('Selected workout is not available');
 const src=merged.get('mlc2-goal-program-source-v1');
 if(src?.customId&&planMissing(src.customId))conflicts.push('Goal program references a missing custom workout');
 if(conflicts.length)return {canApply:false,conflicts,changes:[],readOnly:true};
 const changes=[];
 for(const [key,data] of merged){
  const config=aux.CONFIG.find(x=>x.key===key);
  if(!config||!aux.valid(config,data))throw Error('Merged category requires review: '+key);
  const previous=current.get(key),value=key==='mlc2-selected-workout-v1'?data:JSON.stringify(data);
  if(previous===null||!aux.equal(key==='mlc2-selected-workout-v1'?previous:JSON.parse(previous),data))
   changes.push({key:own(key,owner),previous,value,category:key});
 }
 return {canApply:true,conflicts:[],changes,readOnly:true,activateSource:Boolean(activateSource)};
}
function download(record,doc=document,URLApi=URL,BlobApi=Blob){
 const contents=JSON.stringify(record,null,2);
 const blob=new BlobApi([contents],{type:'application/json'});
 const url=URLApi.createObjectURL(blob),a=doc.createElement('a');
 a.href=url;a.download='MYLIFTCOACH-2.0-private-program-transfer-'+record.created.slice(0,10)+'.json';
 doc.body.appendChild(a);
 try{a.click()}finally{a.remove();setTimeout(()=>URLApi.revokeObjectURL(url),60000)}
 return {categories:Object.keys(record.entries).length,bytes:blob.size};
}
return Object.freeze({FORMAT,VERSION,KEYS,capture,parse,compare,planMerge,download});
});
