/* MYLIFTCOACH 2.0: local-first completed workout storage by verified owner.
   Never migrates legacy guest demo sessions automatically, never contacts cloud.
   Existing guest key stays readable as-is to avoid data loss. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AccountWorkouts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LEGACY_KEY='mlc2-demo-workouts-v1';
 const PREFIX='mlc2-account-workouts-v1:';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 function key(owner){if(owner===null)return LEGACY_KEY;if(!OWNER.test(owner||''))throw Error('Verified account ID required');return PREFIX+owner}
 function read(storage,owner=null){
  const raw=storage.getItem(key(owner));
  if(raw===null)return [];
  if(raw.length>2_500_000)throw Error('Workout history exceeds safety limit');
  let entries;
  try{entries=JSON.parse(raw)}catch{throw Error('Workout history cannot be parsed')}
  if(!Array.isArray(entries)||entries.length>100)throw Error('Invalid workout history');
  const ids=new Set();
  for(const entry of entries){
   if(!entry||typeof entry.id!=='string'||!Array.isArray(entry.sets)||
     entry.sets.length>250||ids.has(entry.id)||entry.sets.some(s=>!s||typeof s!=='object'))
    throw Error('Invalid completed workout');
   if(owner!==null&&entry.ownerId!==owner)throw Error('Workout belongs to another account');
   ids.add(entry.id);
  }
  return entries;
 }
 function save(storage,owner,entries){
  if(!Array.isArray(entries)||entries.length>100)throw Error('Too many workouts');
  const storageKey=key(owner);
  // Reuse read's strict owner/shape/duplicate checks without touching actual storage.
  const payload=JSON.stringify(entries);
  const validationStore={getItem:()=>payload};
  read(validationStore,owner);
  storage.setItem(storageKey,payload);
  if(storage.getItem(storageKey)!==payload)throw Error('Workout was not retained in browser storage');
  return entries;
 }
 function clear(storage,owner){storage.removeItem(key(owner))}
 return Object.freeze({LEGACY_KEY,PREFIX,key,read,save,clear});
});
