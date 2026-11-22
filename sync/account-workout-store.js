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
  if(!Array.isArray(entries)||entries.length>500)throw Error('Invalid workout history');
  const ids=new Set();
  for(const entry of entries){
   if(!entry||typeof entry.id!=='string'||!Array.isArray(entry.sets)||
     entry.sets.length>250||ids.has(entry.id)||entry.sets.some(s=>!s||typeof s!=='object'))
    throw Error('Invalid completed workout');
   if(owner!==null&&entry.ownerId!==owner)throw Error('Workout belongs to another account');
   ids.add(entry.id);
  }
  // Earlier beta builds sometimes stamped an account ID into the shared demo
  // key. Keep those records intact, but never expose them as guest workouts.
  return owner===null?entries.filter(entry=>!entry.ownerId):entries;
 }
 function save(storage,owner,entries){
  if(!Array.isArray(entries)||entries.length>500)throw Error('Workout history limit reached; export before adding more');
  const storageKey=key(owner);
  // Preserve old account-stamped records in the legacy shared key, without
  // treating them as guest sessions or uploading them to another account.
  let full=entries;
  if(owner===null){
   const raw=storage.getItem(LEGACY_KEY);
   if(raw!==null){
    const all=JSON.parse(raw);
    if(!Array.isArray(all))throw Error('Legacy history invalid; cannot overwrite');
    const protectedRows=all.filter(entry=>entry&&entry.ownerId);
    full=[...protectedRows,...entries];
   }
  }
  if(full.length>500)throw Error('Workout history limit reached; no records changed');
  // Reuse read's strict owner/shape/duplicate checks without touching actual storage.
  const payload=JSON.stringify(full);
  const validationStore={getItem:()=>payload};
  read(validationStore,owner);
  storage.setItem(storageKey,payload);
  if(storage.getItem(storageKey)!==payload)throw Error('Workout was not retained in browser storage');
  return entries;
 }
 function clear(storage,owner){
  if(owner!==null){storage.removeItem(key(owner));return}
  const raw=storage.getItem(LEGACY_KEY);
  if(raw===null)return;
  const all=JSON.parse(raw);
  if(!Array.isArray(all))throw Error('Legacy history invalid; cannot clear');
  const protectedRows=all.filter(entry=>entry&&entry.ownerId);
  // Validate before changing guest history. Preserve tagged records in-place.
  if(protectedRows.length){const next=JSON.stringify(protectedRows);
   read({getItem:()=>next},null);storage.setItem(LEGACY_KEY,next);
  }else storage.removeItem(LEGACY_KEY);
 }
 return Object.freeze({LEGACY_KEY,PREFIX,key,read,save,clear});
});
