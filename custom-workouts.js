/* MYLIFTCOACH 2.0 custom workout manager. Browser-only preview; never writes original or Supabase records. */
(function(){
'use strict';
const KEY='mlc2-custom-plans-v1', TODAY='mlc2-selected-workout-v1';
let owner=null,closeEditor=null;
const validOwner=o=>typeof o==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(o);
function setOwner(nextOwner){if(nextOwner!==null&&!validOwner(nextOwner))throw Error('Verified owner required');if(nextOwner!==owner)closeEditor?.();owner=nextOwner}
const scoped=key=>owner===null?key:key+':user:'+owner;
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

function persistPlans(next){const payload=JSON.stringify(next);localStorage.setItem(scoped(KEY),payload);if(localStorage.getItem(scoped(KEY))!==payload)throw Error('Workout changes were not retained.');try{window.MLC2ScheduleAuxSync?.()}catch{}}
function read({forWrite=false}={}){
 try{
 const a=JSON.parse(localStorage.getItem(scoped(KEY))||'[]');
 if(forWrite&&!Array.isArray(a))throw Error('Saved workouts are unreadable');
 return Array.isArray(a)?a.slice(0,60).filter(p=>p&&typeof p.id==='string'&&p.id.startsWith('custom-')&&Array.isArray(p.ids)).map(p=>({
  id:p.id,title:String(p.title||'My workout').slice(0,75),kind:'Custom',description:String(p.description||'Custom routine').slice(0,160),
  ids:[...new Set(p.ids.filter(id=>typeof id==='string'&&byId(id)))].slice(0,40),coachSaved:p.coachSaved===true,
  targets:normalizeTargets(p.targets,p.ids)
 })).filter(p=>p.ids.length):[];
 }catch(error){if(forWrite)throw error;return []}
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
 const existing=read(),seen=new Set(existing.map(p=>p.id)),before=owner;
 let guest=[],previousChoice='';
 try{
  owner=null;guest=read();
  previousChoice=localStorage.getItem(TODAY)||'';
 }finally{owner=before}
 const additions=guest.filter(p=>!seen.has(p.id)).slice(0,Math.max(0,60-existing.length));
 if(!additions.length)return {added:0,preserved:existing.length,skipped:guest.length};
 // Never modify the guest key; never replace an account ID collision.
 persistPlans([...existing,...additions]);
 const chosen=localStorage.getItem(scoped(TODAY))||'';
 if(!chosen&&previousChoice&&additions.some(p=>p.id===previousChoice)){
  try{localStorage.setItem(scoped(TODAY),previousChoice)}catch{}
 }
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
 const existing=read();
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
 let selected=existing?[...existing.ids]:[];
 let draftTargets=normalizeTargets(existing?.targets,selected);
 const root=document.createElement('div');root.className='custom-editor-backdrop';root.setAttribute('role','presentation');
 root.innerHTML='<div class="custom-editor-dialog" role="dialog" aria-modal="true" aria-label="Custom workout editor"><div class="custom-editor-heading"><div><span class="custom-editor-kicker">MYLIFTCOACH 2.0 · YOUR ROUTINE</span><h2>'+esc(existing?'Edit custom workout':'Create your workout')+'</h2></div><button type="button" data-editor-close aria-label="Close workout editor">✕</button></div><form id="mlc-custom-form"><div class="custom-editor-fields"><label>Workout name<input id="customName" name="title" maxlength="75" required value="'+esc(existing?.title||'')+'" placeholder="e.g. Upper Body — Custom"></label><label class="custom-editor-optional">Notes (optional)<input name="description" maxlength="160" value="'+esc(existing?.description||'')+'" placeholder="What is this workout focused on?"></label></div><section class="custom-editor-selection" aria-label="Exercises in your workout"><div class="custom-editor-section-title"><h3>Your exercises</h3><span id="customCount" aria-live="polite"></span></div><div id="customSelected"></div></section><section class="custom-editor-picker" aria-label="Add exercises"><div class="custom-editor-section-title"><h3>Add exercises</h3><span>Search the library</span></div><label class="custom-editor-search-label">Search by name or muscle<input id="customSearch" type="search" placeholder="Search 344 exercises" autocomplete="off"></label><div class="custom-editor-filters" id="customMuscleFilters" role="group" aria-label="Filter by muscle group"></div><div id="customOptions" aria-label="Exercise search results"></div></section><div class="custom-editor-footer"><button type="button" data-editor-close>Cancel</button><button type="submit">Save workout</button></div></form></div>';
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
 $('mlc-custom-form').addEventListener('submit',e=>{
  e.preventDefault();
  if(editorOwner!==owner||closeEditor!==close)return;
  const form=e.currentTarget,name=form.elements.title.value.trim(),description=form.elements.description.value.trim();
  if(!name||!selected.length){alert('Enter a workout name and select at least one exercise.');return}
  let plans;
  try{plans=read({forWrite:true})}catch{alert('Saved workouts are unreadable. Nothing was changed.');return}
  if(existing&&!plans.some(plan=>plan.id===existing.id)){alert('This workout was deleted.');close();return}
  if(!existing&&plans.length>=60){alert('Maximum 60 custom workouts.');return}
  const updated={id:existing?.id||newPlanId(),title:name.slice(0,75),kind:'Custom',coachSaved:existing?.coachSaved===true,description:description.slice(0,160),ids:[...selected],targets:normalizeTargets(draftTargets,selected)};
  const next=existing?plans.map(p=>p.id===existing.id?updated:p):[updated,...plans];
  try{persistPlans(next)}catch{alert('Browser storage is unavailable; workout was not saved.');return}
  // Editing a Coach suggestion must not silently override the Home workout.
  // An explicit "Use for today" action is still available in Workouts.
  if(!existing&&!updated.coachSaved){
   try{localStorage.setItem(scoped(TODAY),updated.id)}catch{alert('Workout saved, but selecting it for today failed. You can select it from Workouts.')}
  }
  try{window.MLC2ScheduleAuxSync?.()}catch{}
  close();onChanged?.();
 });
 selectedView();options();$('customName').focus();
}
function handleClick(e,onChanged,onSchedule){
 const schedule=e.target.closest('[data-custom-schedule]');
 if(schedule){const item=read().find(p=>p.id===schedule.dataset.customSchedule&&p.coachSaved);if(item)onSchedule?.(item);return true}
 const selection=e.target.closest('[data-custom-select]');if(selection){try{localStorage.setItem(scoped(TODAY),selection.dataset.customSelect);if(localStorage.getItem(scoped(TODAY))!==selection.dataset.customSelect)throw Error('Selection not retained')}catch{alert('Could not save selection.');return true}try{window.MLC2ScheduleAuxSync?.()}catch{}onChanged?.();return true}
 const edit=e.target.closest('[data-custom-edit]');if(edit){openEditor(edit.dataset.customEdit,null,onChanged);return true}
 const del=e.target.closest('[data-custom-delete]');if(del){
  const id=del.dataset.customDelete,items=read(),item=items.find(x=>x.id===id);if(!item)return true;
  if(!confirm('Delete '+item.title+'? Workout history will remain.'))return true;
  try{persistPlans(items.filter(x=>x.id!==id));if(localStorage.getItem(scoped(TODAY))===id){if(owner)localStorage.setItem(scoped(TODAY),'');else localStorage.removeItem(scoped(TODAY))}}catch{alert('Could not delete workout.');return true}
  onChanged?.();return true;
 }
 return false;
}
window.MLC2Custom={allPlans,currentPlan,controls,openEditor,handleClick,setOwner,guestRecovery,recoverGuest,saveCoachDay};
})();