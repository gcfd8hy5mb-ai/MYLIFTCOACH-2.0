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
 const REMOVED_PREFIX='mlc2-locally-removed-workouts-v1:';
 const MAX_CHARS=2_500_000;
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 function key(owner){if(owner===null)return LEGACY_KEY;if(!OWNER.test(owner||''))throw Error('Verified account ID required');return PREFIX+owner}
 function read(storage,owner=null){
  const raw=storage.getItem(key(owner));
  if(raw===null)return [];
  if(raw.length>MAX_CHARS)throw Error('Workout history exceeds safety limit');
  let entries;
  try{entries=JSON.parse(raw)}catch{throw Error('Workout history cannot be parsed')}
  if(!Array.isArray(entries))throw Error('Invalid workout history');
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
  if(!Array.isArray(entries))throw Error('Workout history limit reached; export before adding more');
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
  // Reuse read's strict owner/shape/duplicate checks without touching actual storage.
  const payload=JSON.stringify(full);
  if(payload.length>MAX_CHARS)throw Error('Workout history storage limit reached; export before adding more');
  const validationStore={getItem:()=>payload};
  read(validationStore,owner);
  storage.setItem(storageKey,payload);
  if(storage.getItem(storageKey)!==payload)throw Error('Workout was not retained in browser storage');
  return entries;
 }
 function complete(storage,owner,entry){
  if(removed(storage,owner).has(entry.id))throw Error('This workout was deliberately removed from this device');
  const current=read(storage,owner);
  const existing=current.find(record=>record.id===entry.id);
  if(existing){
   const {created:previousDate,...previous}=existing;
   const {created:retryDate,...retry}=entry;
   if(JSON.stringify(previous)!==JSON.stringify(retry))
    throw Error('Workout ID was already completed with different details');
   return current;
  }
  return save(storage,owner,[entry,...current]);
 }
 function removed(storage,owner){
  if(owner===null)return new Set();
  key(owner);
  const raw=storage.getItem(REMOVED_PREFIX+owner);
  if(raw===null)return new Set();
  const ids=JSON.parse(raw);
  if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw Error('Removed-workout metadata is unreadable');
  return new Set(ids);
 }
 function clear(storage,owner){
  if(owner!==null){
   const ids=removed(storage,owner);
   for(const entry of read(storage,owner))ids.add(entry.id);
   const marker=REMOVED_PREFIX+owner,value=JSON.stringify([...ids]);
   storage.setItem(marker,value);
   if(storage.getItem(marker)!==value)throw Error('Removed workouts could not be recorded');
   storage.removeItem(key(owner));
   if(storage.getItem(key(owner))!==null)throw Error('Workout history could not be cleared');
   return;
  }
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
 return Object.freeze({LEGACY_KEY,PREFIX,MAX_CHARS,key,read,save,complete,clear,removed});
});
