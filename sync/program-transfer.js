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
function download(record,doc=document,URLApi=URL,BlobApi=Blob){
 const contents=JSON.stringify(record,null,2);
 const blob=new BlobApi([contents],{type:'application/json'});
 const url=URLApi.createObjectURL(blob),a=doc.createElement('a');
 a.href=url;a.download='MYLIFTCOACH-2.0-private-program-transfer-'+record.created.slice(0,10)+'.json';
 doc.body.appendChild(a);
 try{a.click()}finally{a.remove();setTimeout(()=>URLApi.revokeObjectURL(url),60000)}
 return {categories:Object.keys(record.entries).length,bytes:blob.size};
}
return Object.freeze({FORMAT,VERSION,KEYS,capture,parse,compare,download});
});
