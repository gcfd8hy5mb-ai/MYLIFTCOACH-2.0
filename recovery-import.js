/* MYLIFTCOACH 2.0 — guarded local recovery importer.
   Works only on isolated mlc2-* browser keys. Never calls network, writes
   original-app keys, touches IndexedDB photos, or changes Supabase.
   Only restores absent/identical keys and refuses all differing existing values. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2RecoveryImport=api;
})(globalThis,function(){
'use strict';
const KEY_TYPES=Object.freeze({
 'mlc2-custom-plans-v1':'plans',
 'mlc2-selected-workout-v1':'selection',
 'mlc2-weekly-schedule-v1':'schedule',
 'mlc2-demo-workouts-v1':'sessions',
 'mlc2-active-session-v1':'draft',
 'mlc2-coach-readiness-v1':'readiness',
 'mlc2-weekly-goal-v1':'weeklyGoal',
 'mlc2-measurements-v1':'measurements',
 'mlc2-local-daily-v1':'daily'
});
const KEYS=Object.keys(KEY_TYPES),MAX_BYTES=4*1024*1024;
const safeObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isNum=x=>typeof x==='number'&&Number.isFinite(x);
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'));
const validId=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(s);
function rejectUnsafe(value,depth=0){
 if(depth>18)throw Error('Backup contains excessive nesting');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){if(value.length>2000)throw Error('Backup list too large');value.forEach(v=>rejectUnsafe(v,depth+1));return}
 if(!safeObj(value))throw Error('Unsupported backup data type');
 for(const [key,entry] of Object.entries(value)){
  if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe backup property');
  rejectUnsafe(entry,depth+1);
 }
}
function validSet(s){return safeObj(s)&&validId(s.exerciseId)&&isNum(s.weight)&&s.weight>=0&&s.weight<=1500&&Number.isInteger(s.reps)&&s.reps>=1&&s.reps<=100}
function validateData(key,v){
 const kind=KEY_TYPES[key];
 if(!kind)throw Error('Unrecognized backup category');
 if(kind==='schedule'){
  if(!safeObj(v)||Object.keys(v).length>7||Object.entries(v).some(([k,id])=>!/^[0-6]$/.test(k)||!validId(id)))throw Error('Invalid weekly workout schedule');return;
 }
 if(kind==='weeklyGoal'){if(!Number.isInteger(v)||v<1||v>7)throw Error('Invalid weekly workout goal');return}
 if(kind==='selection'){if(typeof v!=='string'||v.length>100)throw Error('Invalid selected workout');return}
 if(kind==='plans'){
  if(!Array.isArray(v)||v.length>60)throw Error('Invalid custom workouts');
  const ids=new Set();
  for(const p of v){if(!safeObj(p)||!validId(p.id)||!p.id.startsWith('custom-')||typeof p.title!=='string'||p.title.length>75||!p.title.trim()||!Array.isArray(p.ids)||!p.ids.length||p.ids.length>40||p.ids.some(id=>!validId(id))||new Set(p.ids).size!==p.ids.length||ids.has(p.id))throw Error('Invalid or duplicate workout');ids.add(p.id)}
  return;
 }
 if(kind==='sessions'){
  if(!Array.isArray(v)||v.length>100)throw Error('Invalid session history');
  const ids=new Set();
  for(const s of v){if(!safeObj(s)||typeof s.id!=='string'||!s.id.startsWith('demo-')||s.id.length>100||ids.has(s.id)||typeof s.title!=='string'||!Array.isArray(s.sets)||s.sets.length>1000||!s.sets.every(validSet)||!Number.isFinite(Date.parse(s.created)))throw Error('Invalid or duplicate session');ids.add(s.id)}
  return;
 }
 if(kind==='draft'){
  if(!safeObj(v)||v.version!==1||typeof v.planId!=='string'||!Array.isArray(v.ids)||!v.ids.length||v.ids.length>40||
   new Set(v.ids).size!==v.ids.length||v.ids.some(id=>!validId(id))||
   !Number.isFinite(v.savedAt)||!Array.isArray(v.sets)||v.sets.length>500||
   v.sets.some(set=>!validSet(set)||!v.ids.includes(set.exerciseId)))throw Error('Invalid unfinished workout draft');
  return;
 }
 if(kind==='readiness'){
  if(!safeObj(v)||Object.keys(v).length>365)throw Error('Invalid readiness data');
  for(const [k,value] of Object.entries(v))if(!/^\d{4}-\d{2}-\d{2}:.{1,100}$/.test(k)||!['Great','Normal','Tired'].includes(value))throw Error('Invalid readiness check-in');
  return;
 }
 if(kind==='measurements'){
  if(!Array.isArray(v)||v.length>1000)throw Error('Invalid measurements');
  for(const m of v)if(!safeObj(m)||!['Waist','Chest','Arm','Thigh','Hips'].includes(m.area)||!day(m.day)||!isNum(m.value)||m.value<1||m.value>200)throw Error('Invalid body measurement');
  return;
 }
 if(kind==='daily'){
  if(!Array.isArray(v)||v.length>400)throw Error('Invalid daily logs');
  for(const row of v)if(!safeObj(row)||!['water','weight'].includes(row.type)||!day(row.day)||!isNum(row.value)||row.value<=0||row.value>5000)throw Error('Invalid daily log');
 }
}
function parse(text){
 if(typeof text!=='string'||text.length>MAX_BYTES)throw Error('Backup must be smaller than 4 MB');
 let backup;
 try{backup=JSON.parse(text)}catch{throw Error('Invalid JSON file')}
 rejectUnsafe(backup);
 if(!safeObj(backup)||backup.format!=='MYLIFTCOACH-2.0-recovery'||backup.version!==1||!safeObj(backup.data)||typeof backup.created!=='string'||!Number.isFinite(Date.parse(backup.created)))throw Error('Not a supported 2.0 recovery file');
 const keys=Object.keys(backup.data);
 if(keys.some(key=>!KEYS.includes(key)))throw Error('File includes unsupported storage keys');
 for(const key of keys)validateData(key,backup.data[key]);
 const candidate=Object.create(null);
 for(const key of keys)candidate[key]=key==='mlc2-selected-workout-v1'?backup.data[key]:JSON.stringify(backup.data[key]);
 return {keys,candidate,created:backup.created};
}
function planRestore(parsed,storage){
 if(!parsed||!Array.isArray(parsed.keys)||!parsed.candidate||typeof storage?.getItem!=='function')throw Error('Invalid restore preview');
 const writes=[],identical=[],conflicts=[];
 for(const key of parsed.keys){
  const before=storage.getItem(key),incoming=parsed.candidate[key];
  if(before===null){writes.push({key,value:incoming});continue}
  let same=before===incoming;
  if(!same&&key!=='mlc2-selected-workout-v1'){
   try{same=JSON.stringify(JSON.parse(before))===incoming}catch{same=false}
  }
  if(same)identical.push(key);else conflicts.push(key);
 }
 return {writes,identical,conflicts,canRestore:conflicts.length===0};
}
function restore(parsed,storage){
 const plan=planRestore(parsed,storage);
 if(!plan.canRestore)throw Error('Existing 2.0 data differs. No records were changed.');
 if(!plan.writes.length)return {restored:0,unchanged:plan.identical.length};
 const changed=[];
 try{
  // Confirm the initial key state immediately before each write.
  for(const {key,value} of plan.writes){
   if(storage.getItem(key)!==null)throw Error('Browser data changed during restore');
   storage.setItem(key,value);changed.push(key);
   if(storage.getItem(key)!==value)throw Error('Browser did not retain restored data');
  }
  return {restored:changed.length,unchanged:plan.identical.length};
 }catch(error){
  // Clear only keys written by this restore, never preexisting records.
  for(const key of changed.reverse())try{
   if(storage.getItem(key)===parsed.candidate[key])storage.removeItem(key);
  }catch{}
  throw Error('Recovery could not finish; attempted to roll back new keys. '+error.message);
 }
}
return Object.freeze({KEYS,parse,planRestore,restore});
});