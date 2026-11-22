/* MYLIFTCOACH 2.0 — owner-bound offline workout backup and fill-only recovery.
   No Supabase writes, no imported legacy keys, no auth tokens or photo bytes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AccountRecovery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FORMAT='MYLIFTCOACH-2.0-account-workouts';
 const VERSION=1,MAX_BYTES=4*1024*1024,OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 const ID=/^[a-zA-Z0-9_:.\-]{1,160}$/;
 function assertOwner(owner){if(!OWNER.test(owner||''))throw Error('Verified account owner required')}
 function validSession(s,owner){
  return s&&typeof s==='object'&&!Array.isArray(s)&&
   s.ownerId===owner&&ID.test(s.id||'')&&
   typeof s.title==='string'&&s.title.length<=200&&
   typeof s.created==='string'&&Number.isFinite(Date.parse(s.created))&&
   Array.isArray(s.sets)&&s.sets.length>0&&s.sets.length<=250&&
   s.sets.every(set=>set&&typeof set==='object'&&!Array.isArray(set)&&
    typeof set.exerciseId==='string'&&ID.test(set.exerciseId)&&
    Number.isFinite(set.weight)&&set.weight>=0&&set.weight<=1500&&
    Number.isInteger(set.reps)&&set.reps>=1&&set.reps<=100);
 }
 function validate(sessions,owner){
  assertOwner(owner);
  if(!Array.isArray(sessions)||sessions.length>500)throw Error('Invalid workout history list');
  const seen=new Set();
  for(const s of sessions){
   if(!validSession(s,owner)||seen.has(s.id))throw Error('Invalid, duplicate or foreign-owned workout in backup');
   seen.add(s.id);
  }
  return sessions;
 }
 function make(storage,owner,now=new Date().toISOString()){
  assertOwner(owner);
  const sessions=validate(windowlessRead(storage,owner),owner);
  if(!Number.isFinite(Date.parse(now)))throw Error('Invalid backup timestamp');
  const record={format:FORMAT,version:VERSION,owner,created:now,
   containsAuthentication:false,containsPhotos:false,sessions};
  if(JSON.stringify(record).length>MAX_BYTES)throw Error('Account backup exceeds 4 MB');
  return record;
 }
 function windowlessRead(storage,owner){
  const raw=storage.getItem('mlc2-account-workouts-v1:'+owner);
  if(raw===null)return [];
  if(raw.length>MAX_BYTES)throw Error('Account storage exceeds backup limit');
  let value;try{value=JSON.parse(raw)}catch{throw Error('Unreadable account workout history')}
  return value;
 }
 function parse(source,owner){
  assertOwner(owner);
  if(typeof source!=='string'||source.length>MAX_BYTES)throw Error('Backup file exceeds 4 MB');
  let data;try{data=JSON.parse(source)}catch{throw Error('Invalid account backup JSON')}
  if(!data||typeof data!=='object'||Array.isArray(data)||data.format!==FORMAT||
   data.version!==VERSION||data.owner!==owner||data.containsAuthentication!==false||
   data.containsPhotos!==false||typeof data.created!=='string'||
   !Number.isFinite(Date.parse(data.created))||Object.keys(data).some(k=>!
    ['format','version','owner','created','containsAuthentication','containsPhotos','sessions'].includes(k)))
   throw Error('Backup is invalid or belongs to a different account');
  validate(data.sessions,owner);
  return data;
 }
 function plan(storage,backup,owner){
  assertOwner(owner);
  if(!backup||backup.owner!==owner||backup.format!==FORMAT||backup.version!==VERSION)
   throw Error('Backup owner mismatch');
  validate(backup.sessions,owner);
  const existing=validate(windowlessRead(storage,owner),owner);
  const byId=new Map(existing.map(row=>[row.id,row]));
  const missing=[],identical=[],conflicts=[];
  for(const item of backup.sessions){
   const current=byId.get(item.id);
   if(!current)missing.push(item);
   else if(JSON.stringify(current)===JSON.stringify(item))identical.push(item.id);
   else conflicts.push(item.id);
  }
  return {owner,missing,identical,conflicts,localCount:existing.length,
   backupCount:backup.sessions.length,canRestore:conflicts.length===0&&existing.length+missing.length<=500};
 }
 function restore(storage,backup,owner){
  const p=plan(storage,backup,owner);
  if(!p.canRestore)throw Error('Workout conflicts or storage limit; no changes made');
  if(!p.missing.length)return {restored:0,alreadyPresent:p.identical.length};
  const existing=validate(windowlessRead(storage,owner),owner);
  const next=[...existing,...p.missing].sort((a,b)=>Date.parse(b.created)-Date.parse(a.created));
  validate(next,owner);
  const key='mlc2-account-workouts-v1:'+owner,payload=JSON.stringify(next);
  if(payload.length>MAX_BYTES)throw Error('Restored history exceeds storage size limit');
  // Detect intervening edits to the account's local storage before saving.
  const prior=storage.getItem(key);
  const expected=JSON.stringify(existing);
  if(prior!==null&&prior!==expected)throw Error('Account history changed before restore');
  storage.setItem(key,payload);
  if(storage.getItem(key)!==payload)throw Error('Device did not retain restored workout history');
  return {restored:p.missing.length,alreadyPresent:p.identical.length};
 }
 return Object.freeze({FORMAT,VERSION,MAX_BYTES,make,parse,plan,restore,validate});
});
