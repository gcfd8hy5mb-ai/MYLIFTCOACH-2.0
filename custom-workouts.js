/* MYLIFTCOACH 2.0 custom workout manager. Browser-only preview; never writes original or Supabase records. */
(function(){
'use strict';
const KEY='mlc2-custom-plans-v1', TODAY='mlc2-selected-workout-v1', WEEK='mlc2-weekly-schedule-v1', LIB='mlc2-schedule-library-v1';
let owner=null,ownerGeneration=0,closeEditor=null;
const validOwner=o=>typeof o==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(o);
function setOwner(nextOwner){if(nextOwner!==null&&!validOwner(nextOwner))throw Error('Verified owner required');if(nextOwner!==owner){ownerGeneration++;closeEditor?.();window.MLC2FullWeekBuilder?.forceClose?.()}owner=nextOwner}
const scoped=key=>owner===null?key:key+':user:'+owner;
const JOURNAL='mlc2-plan-write-v1';
const PROGRAM_KEYS=['mlc2-goal-program-v1','mlc2-goal-program-source-v1','mlc2-estimated-calorie-goal-v1'];
const TRANSFER_KEYS=['mlc2-auto-coach-preferences-v1','mlc2-weekly-goal-v1'];
const planKeys=()=>[KEY,WEEK,TODAY,LIB,...PROGRAM_KEYS,...TRANSFER_KEYS].map(scoped);
function writeVerified(key,value){
 if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
 if(localStorage.getItem(key)!==value)throw Error('Workout changes were not retained.');
}
function settlePlanWrite(key,raw,changes,field){
 const validCurrent=change=>{
  const current=localStorage.getItem(change.key);
  if(current!==change.before&&current!==change.after)
   throw Error('Workout storage changed in another window. Pending changes were preserved.');
  return current;
 };
 changes.forEach(validCurrent);
 for(const change of changes){
  if(localStorage.getItem(key)!==raw)throw Error('Pending workout save changed.');
  if(validCurrent(change)!==change[field])writeVerified(change.key,change[field]);
 }
 if(localStorage.getItem(key)!==raw)throw Error('Pending workout save changed.');
 writeVerified(key,null);
}
function recoverPlanWrite(){
 const key=scoped(JOURNAL),raw=localStorage.getItem(key);
 if(raw===null)return false;
 const journal=JSON.parse(raw),allowed=planKeys();
 if(!journal||!['after','before'].includes(journal.field)||!Array.isArray(journal.changes)||
    journal.changes.length<1||journal.changes.length>allowed.length||
    journal.changes.some(change=>!change||!allowed.includes(change.key)||
     ![change.before,change.after].every(value=>value===null||typeof value==='string'))||
    new Set(journal.changes.map(change=>change.key)).size!==journal.changes.length)
  throw Error('Pending workout save needs review.');
 settlePlanWrite(key,raw,journal.changes,journal.field);
 return true;
}
function requireStablePlans(){
 if(localStorage.getItem(scoped(JOURNAL))!==null)throw Error('A pending workout save needs recovery.');
}
function commitPlanWrite(keys,before,after){
 requireStablePlans();
 const changes=keys.map((key,i)=>({key,before:before[i],after:after[i]}))
  .filter(change=>change.before!==change.after);
 if(!changes.length)return;
 for(const change of changes)
  if(localStorage.getItem(change.key)!==change.before)throw Error('Workout data changed. Review it and try again.');
 if(changes.length===1){writeVerified(changes[0].key,changes[0].after);return}
 const key=scoped(JOURNAL),raw=JSON.stringify({field:'after',changes});
 writeVerified(key,raw);
 try{settlePlanWrite(key,raw,changes,'after')}
 catch(error){
  if(localStorage.getItem(key)===raw){
   try{
    const rollback=JSON.stringify({field:'before',changes});
    writeVerified(key,rollback);
    settlePlanWrite(key,rollback,[...changes].reverse(),'before');
   }catch{}
  }
  throw error;
 }
}
function stagedScheduleStore(keys,before){
 const values=new Map(keys.map((key,i)=>[key,before[i]]));
 const allowed=new Set([WEEK,TODAY,LIB]);
 const locate=key=>{if(!allowed.has(key))throw Error('Unsupported schedule library data');return scoped(key)};
 return {
  getItem:key=>values.get(locate(key))??null,
  setItem:(key,value)=>values.set(locate(key),String(value)),
  removeItem:key=>values.set(locate(key),null)
 };
}
function transactScheduleLibrary(work){
 requireStablePlans();
 const names=[WEEK,TODAY,LIB],keys=names.map(scoped),before=keys.map(key=>localStorage.getItem(key));
 const staged=stagedScheduleStore(keys,before);
 const value=work(staged);
 commitPlanWrite(keys,before,names.map(name=>staged.getItem(name)));
 try{window.MLC2ScheduleAuxSync?.()}catch{}
 return value;
}
function commitRecoveredPlans(changes){
 const allowed=planKeys();
 if(changes.some(change=>!allowed.includes(change.key)))throw Error('Unsupported workout recovery storage');
 commitPlanWrite(changes.map(change=>change.key),changes.map(change=>change.previous),changes.map(change=>change.value));
}
function transactProgram(work){
 requireStablePlans();
 const keys=PROGRAM_KEYS.map(scoped),before=keys.map(key=>localStorage.getItem(key));
 const staged=new Map(keys.map((key,i)=>[key,before[i]]));
 const checked=key=>{
  if(!staged.has(key))throw Error('Unsupported program storage');
  return key;
 };
 const result=work({
  getItem:key=>staged.get(checked(key)),
  setItem:(key,value)=>staged.set(checked(key),value)
 });
 commitPlanWrite(keys,before,keys.map(key=>staged.get(key)));
 return result;
}
function runPlanWrite(work){
 const expectedOwner=owner,generation=ownerGeneration;
 const guarded=()=>{
  if(owner!==expectedOwner||generation!==ownerGeneration)throw Error('Workout account changed');
  recoverPlanWrite();
  return work();
 };
 const locks=window.navigator?.locks;
 return locks?locks.request('myliftcoach2:plans:'+(owner===null?'guest':'user:'+owner),guarded):guarded();
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=()=>Array.isArray(window.MLC2_EXERCISE_CATALOG)?window.MLC2_EXERCISE_CATALOG:[];
const byId=id=>catalog().find(e=>e.id===id);
const newPlanId=()=> 'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
// Targets are optional: no synthesized defaults are written for unfilled fields.
// Unknown or out-of-range values are ignored on reads, not propagated to logs.
const TARGET_LIMITS={sets:[1,20],reps:[1,100],weight:[0,1500],restSeconds:[0,1800]};
function normalizeTargets(raw,ids){
 const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 for(const id of ids){
  const value=raw[id];if(!value||typeof value!=='object'||Array.isArray(value))continue;
  const row={};
  for(const [field,[min,max]] of Object.entries(TARGET_LIMITS)){
   const n=value[field];
   if(n===undefined||n===null||n==='')continue;
   if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)continue;
   if(field!=='weight'&&!Number.isInteger(n))continue;
   row[field]=n;
  }
  if(Object.keys(row).length)out[id]=row;
 }
 return out;
}

function persistPlans(next){requireStablePlans();writeVerified(scoped(KEY),JSON.stringify(next));try{window.MLC2ScheduleAuxSync?.()}catch{}}
function read({forWrite=false}={}){
 try{
 if(forWrite)requireStablePlans();
 const raw=localStorage.getItem(scoped(KEY));
 const a=raw===null?[]:JSON.parse(raw);
 if(forWrite){
  if(!Array.isArray(a)||a.length>60||a.some(p=>!p||typeof p.id!=='string'||!/^custom-[a-z0-9-]{1,93}$/.test(p.id)||
    !Array.isArray(p.ids)||p.ids.length<1||p.ids.length>40||new Set(p.ids).size!==p.ids.length||
    p.ids.some(id=>typeof id!=='string'||!byId(id)))||new Set(a.map(p=>p.id)).size!==a.length)
   throw Error('Saved workouts are unreadable. Nothing was changed.');
  // Keep all fields belonging to untouched plans, including older metadata.
  return a;
 }
 return Array.isArray(a)?a.slice(0,60).filter(p=>p&&typeof p.id==='string'&&p.id.startsWith('custom-')&&Array.isArray(p.ids)).map(p=>({
  id:p.id,title:String(p.title||'My workout').slice(0,75),kind:'Custom',description:String(p.description||'Custom routine').slice(0,160),
  ids:[...new Set(p.ids.filter(id=>typeof id==='string'&&byId(id)))].slice(0,40),coachSaved:p.coachSaved===true,
  targets:normalizeTargets(p.targets,p.ids)
 })).filter(p=>p.ids.length):[];
 }catch(error){if(forWrite)throw error;return []}
}
function saveWithWeekdays({next,updated,existing=null,chosenDays=[]}){
 const scheduleAPI=window.MLC2WeeklySchedule;
 const selectedDays=new Set(chosenDays);
 if([...selectedDays].some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('Invalid weekday');
 const initialSchedule=scheduleAPI?.read({getItem:key=>localStorage.getItem(scoped(key))})||{};
  // Save the routine and weekday assignments as one local transaction.
  // Preserve all other weekdays and any unrelated workout history.
  const scheduleKey=scoped(WEEK),plansKey=scoped(KEY),selectedKey=scoped(TODAY);
  const keys=[plansKey,scheduleKey,selectedKey,scoped(LIB)],before=keys.map(key=>localStorage.getItem(key));
  const hasDays=selectedDays.size>0;
  const shouldUpdateSchedule=hasDays||Boolean(existing&&Object.values(initialSchedule).includes(existing.id));
  let nextSchedule;
  if(shouldUpdateSchedule){
    if(!scheduleAPI)throw Error('Workout scheduling is temporarily unavailable.');
    const raw=before[1];
    let current={};
    if(raw!==null){
     current=JSON.parse(raw);
     if(!scheduleAPI.valid(current))throw Error('Saved weekly schedule needs review. Nothing changed.');
    }
    // An edit can remove only days that previously belonged to this routine.
    nextSchedule={...current};
    if(existing){
     for(const [day,workout] of Object.entries(nextSchedule))if(workout===existing.id&&!selectedDays.has(Number(day))){
      if(Object.keys(current).length===7)nextSchedule[day]='rest-day';
      else delete nextSchedule[day];
     }
    }
    for(const day of selectedDays)nextSchedule[String(day)]=updated.id;
    if(!scheduleAPI.valid(nextSchedule))throw Error('Invalid day selection.');
   }
  const selected=hasDays?(owner===null?null:''):
   (!existing&&!updated.coachSaved?updated.id:before[2]);
  const after=[JSON.stringify(next),shouldUpdateSchedule?JSON.stringify(nextSchedule):before[1],selected,before[3]];
  if(shouldUpdateSchedule&&window.MLC2ScheduleLibrary){
   const staged=stagedScheduleStore(keys,before);
   window.MLC2ScheduleLibrary.edited(staged,nextSchedule);
   after[1]=staged.getItem(WEEK);after[2]=staged.getItem(TODAY);after[3]=staged.getItem(LIB);
  }
  commitPlanWrite(keys,before,after);
 try{window.MLC2ScheduleAuxSync?.()}catch{}
 return {days:[...selectedDays].sort(),scheduled:selectedDays.size>0};
}
/* Save a complete weekly training program in one verified local transaction.
 * No existing custom routine or history record is deleted. Each training day
 * becomes a normal editable custom plan, and rest days get explicit markers. */
function saveFullWeek({title,days,expectedOwner=owner}){
 if(expectedOwner!==owner)throw Error('Account changed. Weekly program was not saved');
 if(typeof title!=='string'||!title.trim()||title.trim().length>75)throw Error('Enter a weekly program name');
 if(!Array.isArray(days)||days.length!==7)throw Error('Configure all seven days');
 const scheduleAPI=window.MLC2WeeklySchedule;
 if(!scheduleAPI?.valid)throw Error('Weekly schedule is unavailable');
 const existing=read({forWrite:true});
 const added=[],nextSchedule={};
 const stamp=Date.now().toString(36);
 for(let day=0;day<7;day++){
  const choice=days[day];
  if(!choice)throw Error('Configure '+scheduleAPI.DAYS[day]+' or mark it as a rest day');
  if(choice.rest===true){
   nextSchedule[String(day)]='rest-day';
   continue;
  }
  const ids=Array.isArray(choice.ids)?choice.ids:[];
  if(ids.length<1||ids.length>40||new Set(ids).size!==ids.length||ids.some(id=>!byId(id)))
   throw Error('Choose 1–40 unique exercises for '+scheduleAPI.DAYS[day]);
  const customTitle=String(choice.title||'').trim()||scheduleAPI.DAYS[day]+' workout';
  if(customTitle.length>75)throw Error('Workout name is too long');
  let id='custom-week-'+stamp+'-'+day;
  while(existing.some(p=>p.id===id)||added.some(p=>p.id===id))id+='x';
  const plan={id,title:customTitle,kind:'Custom',description:title.trim().slice(0,75)+' · '+scheduleAPI.DAYS[day],ids:[...ids],
   targets:normalizeTargets(choice.targets,ids)};
  added.push(plan);nextSchedule[String(day)]=id;
 }
 if(!added.length)throw Error('Add at least one training day');
 if(existing.length+added.length>60)throw Error('Custom workout limit reached. Your existing routines were not changed.');
 if(!scheduleAPI.valid(nextSchedule))throw Error('Weekly program schedule is invalid');
 const plansKey=scoped(KEY),scheduleKey=scoped(WEEK),selectedKey=scoped(TODAY);
 const keys=[plansKey,scheduleKey,selectedKey,scoped(LIB)],prior=keys.map(k=>localStorage.getItem(k));
 // Never accept unreadable stored schedules; do not silently erase them.
 const oldRaw=prior[1];
 if(oldRaw!==null){
  let old;try{old=JSON.parse(oldRaw)}catch{throw Error('Existing schedule is unreadable. Nothing changed.')}
  if(!scheduleAPI.valid(old))throw Error('Existing schedule needs review. Nothing changed.');
 }
 const staged=stagedScheduleStore(keys,prior);
 const library=window.MLC2ScheduleLibrary;
 const updatedLibrary=library?library.newFullWeek(staged,title.trim(),nextSchedule):null;
 commitPlanWrite(keys,prior,[JSON.stringify([...added,...existing]),
  JSON.stringify(nextSchedule),owner===null?null:'',updatedLibrary?JSON.stringify(updatedLibrary):prior[3]]);
 try{window.MLC2ScheduleAuxSync?.()}catch{}
 return {created:added.length,restDays:7-added.length,plans:added};
}
function guestRecovery(){
 if(owner===null)return {available:0,conflicts:0};
 const here=read(),ids=new Set(here.map(p=>p.id)),before=owner;
 let guest=[];
 try{owner=null;guest=read()}finally{owner=before}
 return {available:guest.filter(p=>!ids.has(p.id)).length,conflicts:guest.filter(p=>ids.has(p.id)).length};
}
function recoverGuest(){
 if(owner===null)throw Error('Sign in to recover guest routines');
 // A corrupted account copy is never replaced by an empty parsed fallback.
 const accountRaw=localStorage.getItem(scoped(KEY));
 if(accountRaw!==null&&!Array.isArray(JSON.parse(accountRaw)))
  throw Error('Account workout data needs review; recovery did not write');
 const guestRaw=localStorage.getItem(KEY);
 if(guestRaw!==null&&!Array.isArray(JSON.parse(guestRaw)))
  throw Error('Guest workout data needs review; recovery did not write');
 const existing=read({forWrite:true}),seen=new Set(existing.map(p=>p.id)),before=owner;
 let guest=[],previousChoice='';
 try{
  owner=null;guest=read();
  previousChoice=localStorage.getItem(TODAY)||'';
 }finally{owner=before}
 const additions=guest.filter(p=>!seen.has(p.id)).slice(0,Math.max(0,60-existing.length));
 if(!additions.length)return {added:0,preserved:existing.length,skipped:guest.length};
 // Never modify the guest key; never replace an account ID collision.
 const chosen=localStorage.getItem(scoped(TODAY));
 const selection=chosen===null&&additions.some(p=>p.id===previousChoice)?previousChoice:chosen;
 commitPlanWrite([scoped(KEY),scoped(TODAY)],[accountRaw,chosen],
  [JSON.stringify([...existing,...additions]),selection]);
 try{window.MLC2ScheduleAuxSync?.()}catch{}
 return {added:additions.length,preserved:existing.length,skipped:guest.length-additions.length};
}
function saveCoachDay(day){
 // Only explicit user-confirmed creation. Existing workouts and today's choice
 // must remain unchanged; account storage stays in its verified owner scope.
 if(!day||!Array.isArray(day.exercises))throw Error('Invalid Coach workout');
 const ids=[...new Set(day.exercises.map(e=>e?.id).filter(id=>typeof id==='string'&&byId(id)))];
 if(!ids.length||ids.length>40||ids.length!==day.exercises.length)
  throw Error('Coach workout contains unsupported or repeated exercises');
 const original=localStorage.getItem(scoped(KEY));
 if(original!==null){
  let parsed;try{parsed=JSON.parse(original)}catch{throw Error('Saved workouts are unreadable. Nothing was changed.')}
  if(!Array.isArray(parsed))throw Error('Saved workouts are unreadable. Nothing was changed.');
 }
 const existing=read({forWrite:true});
 if(existing.length>=60)throw Error('Custom workout limit reached');
 let id=newPlanId();
 while(existing.some(p=>p.id===id))id=newPlanId();
 const number=Number(day.day);
 const title='Coach Day '+(Number.isInteger(number)&&number>=1&&number<=7?number:1);
 const plan={id,title,kind:'Custom',coachSaved:true,description:'Coach-generated starting point. Review and edit your exercises as needed.',ids};
 persistPlans([plan,...existing]);
 return plan;
}
function allPlans(presets){return [...read(),...presets]}
function currentPlan(presets,completed){const a=allPlans(presets);let id='';try{id=localStorage.getItem(scoped(TODAY))||''}catch{};return a.find(p=>p.id===id)||read().find(p=>!p.coachSaved)||presets[completed%presets.length]||a[0]}
function controls(p,currentId){
 const custom=p.id.startsWith('custom-');
 return '<div class="custom-plan-actions"><button type="button" data-custom-select="'+esc(p.id)+'">'+(currentId===p.id?'Selected for today ✓':'Use for today')+'</button>'+(p.coachSaved?'<button type="button" data-custom-schedule="'+esc(p.id)+'">Schedule</button>':'')+(custom?'<button type="button" data-custom-edit="'+esc(p.id)+'">Edit</button><button type="button" data-custom-delete="'+esc(p.id)+'">Delete</button>':'')+'</div>';
}
function openEditor(id,unused,onChanged){
 closeEditor?.();
 const editorOwner=owner;
 const existing=read().find(p=>p.id===id);
 const original=JSON.stringify(existing);
 let selected=existing?[...existing.ids]:[];
 let draftTargets=normalizeTargets(existing?.targets,selected);
 // Editing preselects the weekdays already assigned to this exact routine.
 const scheduleAPI=window.MLC2WeeklySchedule;
 const initialSchedule=scheduleAPI?.read({
  getItem:key=>localStorage.getItem(scoped(key))
 })||{};
 let chosenDays=new Set(Object.keys(initialSchedule).filter(day=>initialSchedule[day]===existing?.id).map(Number));
 const root=document.createElement('div');root.className='custom-editor-backdrop';root.setAttribute('role','presentation');
 root.innerHTML='<div class="custom-editor-dialog" role="dialog" aria-modal="true" aria-label="Custom workout editor"><div class="custom-editor-heading"><div><span class="custom-editor-kicker">MYLIFTCOACH 2.0 · YOUR ROUTINE</span><h2>'+esc(existing?'Edit custom workout':'Create your workout')+'</h2></div><button type="button" data-editor-close aria-label="Close workout editor">✕</button></div><form id="mlc-custom-form"><div class="custom-editor-fields"><label>Workout name<input id="customName" name="title" maxlength="75" required value="'+esc(existing?.title||'')+'" placeholder="e.g. Upper Body — Custom"></label><label class="custom-editor-optional">Notes (optional)<input name="description" maxlength="160" value="'+esc(existing?.description||'')+'" placeholder="What is this workout focused on?"></label></div><section class="custom-editor-selection" aria-label="Exercises in your workout"><div class="custom-editor-section-title"><h3>Your exercises</h3><span id="customCount" aria-live="polite"></span></div><div id="customSelected"></div></section><section class="custom-editor-weekdays" aria-label="Schedule this workout"><div class="custom-editor-section-title"><h3>Training days</h3><span>Choose any days</span></div><p class="custom-weekday-help">Choose when to train. Saving will add this workout to those days and automatically follow your weekly schedule. Other days stay unchanged.</p><div class="custom-weekday-grid" id="customWeekdays" role="group" aria-label="Days for this workout"></div></section><section class="custom-editor-picker" aria-label="Add exercises"><div class="custom-editor-section-title"><h3>Add exercises</h3><span>Search the library</span></div><label class="custom-editor-search-label">Search by name or muscle<input id="customSearch" type="search" placeholder="Search 344 exercises" autocomplete="off"></label><div class="custom-editor-filters" id="customMuscleFilters" role="group" aria-label="Filter by muscle group"></div><div id="customOptions" aria-label="Exercise search results"></div></section><div class="custom-editor-footer"><button type="button" data-editor-close>Cancel</button><button type="submit">Save workout</button></div></form></div>';
 document.body.appendChild(root);
 const $=id=>root.querySelector('#'+id);
 const close=()=>{
  document.removeEventListener('keydown',escapeKey);root.remove();
  if(closeEditor===close)closeEditor=null;
 };
 closeEditor=close;
 const escapeKey=e=>{if(e.key==='Escape')close()};
 document.addEventListener('keydown',escapeKey);
 root.addEventListener('click',e=>{if(e.target===root||e.target.closest('[data-editor-close]'))close()});
 let activeMuscle='';
 const imageFor=e=>{
  const thumbnail=e?.demonstration?.status==='approved'?e.demonstration.thumbnail:'';
  return typeof thumbnail==='string'&&thumbnail.startsWith('assets/exercise-demonstrations/')&&thumbnail.endsWith('.webp')&& !thumbnail.includes('..')
   ?'<img src="./'+esc(thumbnail)+'" alt="" loading="lazy">':'<span class="custom-exercise-glyph" aria-hidden="true">✦</span>';
 };
 const weekdays=scheduleAPI?.DAYS||['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 $('customWeekdays').innerHTML=weekdays.map((name,day)=>'<label class="custom-weekday-option"><input type="checkbox" data-custom-day="'+day+'" '+(chosenDays.has(day)?'checked':'')+'><span>'+esc(name.slice(0,3))+'</span></label>').join('');
 $('customWeekdays').addEventListener('change',event=>{
  const field=event.target.closest('[data-custom-day]');if(!field)return;
  const day=Number(field.dataset.customDay);
  if(!Number.isInteger(day)||day<0||day>6)return;
  if(field.checked)chosenDays.add(day);else chosenDays.delete(day);
 });
 const groups=['All',...new Set(catalog().map(e=>e.group).filter(Boolean))];
 $('customMuscleFilters').innerHTML=groups.map(g=>'<button type="button" data-custom-filter="'+esc(g)+'" aria-pressed="'+(g==='All'?'true':'false')+'">'+esc(g)+'</button>').join('');
 function selectedView(){
  $('customCount').textContent=selected.length+' of 40';
  $('customSelected').innerHTML=selected.map((id,index)=>{
   const e=byId(id);
   const t=draftTargets[id]||{};
   const entry=(field,label,min,max,step,placeholder)=>'<label>'+label+'<input type="number" data-custom-target="'+esc(id)+'" data-target-field="'+field+'" inputmode="'+(field==='weight'?'decimal':'numeric')+'" min="'+min+'" max="'+max+'" step="'+step+'" placeholder="'+placeholder+'" value="'+(t[field]??'')+'"></label>';
   return '<div class="custom-selected-row"><div class="custom-selected-main"><span class="custom-exercise-order">'+(index+1)+'</span><div class="custom-exercise-copy"><strong>'+esc(e?.name||id)+'</strong><small>'+esc(e?.group||'Exercise')+'</small></div><div class="custom-selected-actions"><button type="button" data-custom-up="'+esc(id)+'" aria-label="Move '+esc(e?.name||id)+' up" '+(index===0?'disabled':'')+'>↑</button><button type="button" data-custom-down="'+esc(id)+'" aria-label="Move '+esc(e?.name||id)+' down" '+(index===selected.length-1?'disabled':'')+'>↓</button><button type="button" data-custom-remove="'+esc(id)+'" aria-label="Remove '+esc(e?.name||id)+'">✕</button></div></div><details class="custom-target-details" '+(Object.keys(t).length?'open':'')+'><summary>Optional sets, reps, weight & rest</summary><div class="custom-target-fields">'+entry('sets','Sets',1,20,1,'—')+entry('reps','Reps',1,100,1,'—')+entry('weight','Target weight (lb)',0,1500,0.5,'—')+entry('restSeconds','Rest (seconds)',0,1800,1,'—')+'</div><p>Leave any field blank to use your usual workout logging.</p></details></div>';
  }).join('')||'<p class="custom-editor-empty">No exercises yet. Search below and tap Add to build your workout.</p>';
 }
 function options(){
  const q=$('customSearch').value.toLowerCase().trim();
  const matched=catalog().filter(e=>(activeMuscle==='All'||!activeMuscle||e.group===activeMuscle)&&(e.name+' '+e.group+' '+(e.equipment||'')).toLowerCase().includes(q));
  $('customOptions').innerHTML=matched.map(e=>{
   const added=selected.includes(e.id);
   return '<div class="custom-option-row">'+imageFor(e)+'<div class="custom-exercise-copy"><strong>'+esc(e.name)+'</strong><small>'+esc(e.group)+(e.equipment?' · '+esc(e.equipment):'')+'</small></div><button type="button" data-custom-exercise="'+esc(e.id)+'" aria-pressed="'+added+'" '+(added?'disabled':'')+'>'+(added?'Added ✓':'Add +')+'</button></div>';
  }).join('')||'<p class="custom-editor-empty">No matching exercises. Try another muscle group or search.</p>';
 }
 $('customSearch').addEventListener('input',options);
 $('customMuscleFilters').addEventListener('click',e=>{
  const button=e.target.closest('[data-custom-filter]');if(!button)return;
  activeMuscle=button.dataset.customFilter;
  $('customMuscleFilters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  options();
 });
 $('customOptions').addEventListener('click',e=>{
  const button=e.target.closest('[data-custom-exercise]');if(!button)return;
  const key=button.dataset.customExercise;
  if(!byId(key)||selected.includes(key))return;
  if(selected.length>=40){alert('Maximum 40 exercises.');return}
  selected.push(key);
  selectedView();options();
 });
 $('customSelected').addEventListener('click',e=>{
  const remove=e.target.closest('[data-custom-remove]');
  if(remove){selected=selected.filter(x=>x!==remove.dataset.customRemove);delete draftTargets[remove.dataset.customRemove];selectedView();options();return}
  const up=e.target.closest('[data-custom-up]'),down=e.target.closest('[data-custom-down]'),button=up||down;
  if(!button)return;
  const index=selected.indexOf(up?up.dataset.customUp:down.dataset.customDown);
  const next=index+(up?-1:1);
  if(index<0||next<0||next>=selected.length)return;
  [selected[index],selected[next]]=[selected[next],selected[index]];
  selectedView();
 });
 $('customSelected').addEventListener('input',e=>{
  const input=e.target.closest('[data-custom-target]');if(!input)return;
  const id=input.dataset.customTarget,field=input.dataset.targetField;
  if(!selected.includes(id)||!Object.hasOwn(TARGET_LIMITS,field))return;
  const raw=input.value.trim();
  if(raw===''){if(draftTargets[id]){delete draftTargets[id][field];if(!Object.keys(draftTargets[id]).length)delete draftTargets[id]}return}
  const n=Number(raw),[min,max]=TARGET_LIMITS[field];
  if(!Number.isFinite(n)||n<min||n>max||(field!=='weight'&&!Number.isInteger(n)))return;
  draftTargets[id]??={};draftTargets[id][field]=n;
 });
 let saving=false;
 $('mlc-custom-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(editorOwner!==owner||closeEditor!==close||saving)return;
  const form=e.currentTarget,name=form.elements.title.value.trim(),description=form.elements.description.value.trim();
  if(!name||!selected.length){alert('Enter a workout name and select at least one exercise.');return}
  const ids=[...selected],targets=normalizeTargets(draftTargets,ids),days=[...chosenDays];
  saving=true;
  try{
   const saved=await runPlanWrite(()=>{
    if(closeEditor!==close)return false;
    const plans=read({forWrite:true});
    if(existing&&!plans.some(plan=>plan.id===existing.id))throw Error('This workout was deleted.');
    if(existing&&JSON.stringify(read().find(p=>p.id===id))!==original)
     throw Error('This workout changed in another window. Reopen it before editing.');
    if(!existing&&plans.length>=60)throw Error('Maximum 60 custom workouts.');
    const currentSchedule=scheduleAPI?.read({getItem:key=>localStorage.getItem(scoped(key))})||{};
    const relevant=Object.keys({...initialSchedule,...currentSchedule}).filter(day=>
     days.includes(Number(day))||initialSchedule[day]===existing?.id||currentSchedule[day]===existing?.id);
    if(relevant.some(day=>currentSchedule[day]!==initialSchedule[day]))
     throw Error('One of these weekdays changed. Reopen the editor to review the schedule.');
    const updated={...(existing?plans.find(plan=>plan.id===existing.id):{}),id:existing?.id||newPlanId(),title:name.slice(0,75),kind:'Custom',
     coachSaved:existing?.coachSaved===true,description:description.slice(0,160),ids,targets};
    const next=existing?plans.map(p=>p.id===existing.id?updated:p):[updated,...plans];
    saveWithWeekdays({next,updated,existing,chosenDays:days});
    return true;
   });
   if(saved&&closeEditor===close){close();onChanged?.()}
  }catch(error){if(closeEditor===close)alert('Workout not saved: '+String(error.message||error).slice(0,120))}
  finally{saving=false}
 });
 selectedView();options();$('customName').focus();
}
// Deleting a custom day also clears dangling schedule references safely.
 // Affected weekdays become rest days; other weekday assignments and history stay intact.
function deleteCustomPlan(id){
 const current=read({forWrite:true}),item=current.find(p=>p.id===id);
 if(!item)throw Error('Workout no longer exists');
 const draftStore=window.MLC2AccountDraft?.scope(localStorage,owner);
 const draft=draftStore&&window.MLC2SessionDraft?.read(draftStore);
 if(draft?.planId===id&&draft.sets.length)throw Error('Finish the saved workout before deleting this routine.');
 const pkey=scoped(KEY),wkey=scoped(WEEK),tkey=scoped(TODAY);
 const keys=[pkey,wkey,tkey],before=keys.map(k=>localStorage.getItem(k));
 let currentSchedule={};
 if(before[1]!==null){
  try{currentSchedule=JSON.parse(before[1])}catch{throw Error('Weekly schedule needs review. Nothing deleted.')}
  if(!window.MLC2WeeklySchedule?.valid(currentSchedule))throw Error('Weekly schedule needs review. Nothing deleted.');
 }
 const savedLibrary=window.MLC2ScheduleLibrary?.read({getItem:key=>localStorage.getItem(scoped(key))});
 if(savedLibrary?.profiles.some(p=>Object.values(p.days).includes(id)))
  throw Error('This routine belongs to a saved weekly program. Edit that program before deleting it.');
 const nextSchedule={...currentSchedule},assigned=[];
 for(const [day,planId] of Object.entries(nextSchedule)){
  if(planId===id){nextSchedule[day]='rest-day';assigned.push(Number(day))}
 }
 commitPlanWrite(keys,before,[JSON.stringify(current.filter(p=>p.id!==id)),
  assigned.length?JSON.stringify(nextSchedule):before[1],
  before[2]===id?(owner===null?null:''):before[2]]);
 try{window.MLC2ScheduleAuxSync?.()}catch{}
 return {deleted:id,restDays:assigned,historyPreserved:true};
}
function handleClick(e,onChanged,onSchedule){
 const schedule=e.target.closest('[data-custom-schedule]');
 if(schedule){const item=read().find(p=>p.id===schedule.dataset.customSchedule);if(item)onSchedule?.(item);return true}
 const selection=e.target.closest('[data-custom-select]');
 if(selection){
  void (async()=>{
   try{
    await runPlanWrite(()=>{
     writeVerified(scoped(TODAY),selection.dataset.customSelect);
     window.MLC2ScheduleAuxSync?.();
    });
    onChanged?.();
   }catch{alert('Could not save selection.')}
  })();
  return true;
 }
 const edit=e.target.closest('[data-custom-edit]');if(edit){openEditor(edit.dataset.customEdit,null,onChanged);return true}
 const del=e.target.closest('[data-custom-delete]');if(del){
  const id=del.dataset.customDelete,items=read(),item=items.find(x=>x.id===id);if(!item)return true;
  if(!confirm('Delete '+item.title+'? Workout history will remain.'))return true;
  void (async()=>{
   try{
    await runPlanWrite(()=>{
     if(JSON.stringify(read().find(x=>x.id===id))!==JSON.stringify(item))throw Error('Workout changed. Review it before deleting.');
     deleteCustomPlan(id);
    });
    onChanged?.();
   }catch(error){alert('Could not delete workout: '+String(error.message||error).slice(0,110))}
  })();
  return true;
 }
 return false;
}
window.MLC2Custom={allPlans,currentPlan,controls,openEditor,handleClick,setOwner,guestRecovery,recoverGuest,saveCoachDay,saveWithWeekdays,saveFullWeek,deleteCustomPlan,runPlanWrite,recoverPlanWrite,requireStablePlans,commitRecoveredPlans,transactProgram,transactScheduleLibrary,scheduleVersion:()=>localStorage.getItem(scoped(WEEK)),getOwner:()=>owner};
})();