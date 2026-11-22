/* MYLIFTCOACH 2.0 recovery export. No cloud writes, import, or legacy storage mutations.
   Includes only allowlisted 2.0 local workout data; no auth tokens or private photos. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2Recovery=api;
})(globalThis,function(){
'use strict';
const KEYS=Object.freeze([
 'mlc2-custom-plans-v1','mlc2-selected-workout-v1','mlc2-weekly-schedule-v1','mlc2-demo-workouts-v1',
 'mlc2-active-session-v1',
 'mlc2-coach-readiness-v1','mlc2-weekly-goal-v1','mlc2-measurements-v1','mlc2-local-daily-v1'
]);
const LIMIT=4*1024*1024;
function snapshot(storage){
 if(!storage||typeof storage.getItem!=='function')throw Error('Storage unavailable');
 const data=Object.create(null);
 for(const key of KEYS){
  const raw=storage.getItem(key);if(raw===null||raw===undefined)continue;
  if(typeof raw!=='string'||raw.length>LIMIT)throw Error('Data too large for local backup: '+key);
  if(key==='mlc2-selected-workout-v1')data[key]=raw;
  else{try{data[key]=JSON.parse(raw)}catch{throw Error('Invalid 2.0 JSON in '+key)}}
 }
 return data;
}
function createBackup(storage,stamp=new Date().toISOString()){
 const saved=snapshot(storage);
 const result={format:'MYLIFTCOACH-2.0-recovery',version:1,created:stamp,
  containsPhotos:false,containsAuthentication:false,data:saved};
 const serialized=JSON.stringify(result);
 if(serialized.length>LIMIT)throw Error('Backup exceeds 4 MB; export cancelled');
 return result;
}
function checkBackup(record){
 if(!record||record.format!=='MYLIFTCOACH-2.0-recovery'||record.version!==1||
  !record.data||typeof record.data!=='object'||Array.isArray(record.data))throw Error('Not a supported 2.0 recovery file');
 if(Object.keys(record.data).some(key=>!KEYS.includes(key)))throw Error('Backup includes unrecognized storage keys');
 if(Object.prototype.hasOwnProperty.call(record.data,'mlc2-selected-workout-v1')&&
  typeof record.data['mlc2-selected-workout-v1']!=='string')throw Error('Invalid selected workout key');
 return true;
}
function download(storage,doc=document,URLApi=URL){
 const record=createBackup(storage);checkBackup(record);
 const day=record.created.slice(0,10);
 const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
 const url=URLApi.createObjectURL(blob),anchor=doc.createElement('a');
 anchor.href=url;anchor.download='MYLIFTCOACH-2.0-recovery-'+day+'.json';
 doc.body.appendChild(anchor);
 try{anchor.click()}finally{anchor.remove();setTimeout(()=>URLApi.revokeObjectURL(url),1000)}
 return {keys:Object.keys(record.data).length,bytes:blob.size,photos:false};
}
return Object.freeze({KEYS,snapshot,createBackup,checkBackup,download});
});