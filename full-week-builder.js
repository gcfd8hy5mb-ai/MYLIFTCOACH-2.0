/* Full Weekly Program editor. Uses the existing isolated custom-workout
   storage and explicit weekday schedule; no remote writes or legacy mutation. */
(function(){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const LIMITS={sets:[1,20],reps:[1,100],weight:[0,1500],restSeconds:[0,1800]};
let closeCurrent=null,forceCurrent=null;
function open(onSaved){
 closeCurrent?.();
 if(closeCurrent)return;
 const initialOwner=window.MLC2Custom?.getOwner?.();
 const catalog=()=>Array.isArray(window.MLC2_EXERCISE_CATALOG)?window.MLC2_EXERCISE_CATALOG:[];
 const rows=DAYS.map((day)=>({title:day+' workout',rest:true,ids:[],targets:{}}));
 const invalidTargets=DAYS.map(()=>new Map());
 let active=1,dirty=false,query='',group='All';
 const backdrop=document.createElement('div');backdrop.className='custom-editor-backdrop weekly-builder-backdrop';
 backdrop.innerHTML='<div class="custom-editor-dialog weekly-builder-dialog" role="dialog" aria-modal="true" aria-label="Full weekly workout program"><div class="custom-editor-heading"><div><span class="custom-editor-kicker">MYLIFTCOACH 2.0 · WEEKLY PROGRAM</span><h2>Build your entire week</h2></div><button type="button" data-week-close aria-label="Close weekly program">✕</button></div><label class="weekly-program-label">Program name<input id="weeklyProgramName" maxlength="75" placeholder="e.g. My 7-day split"></label><p class="weekly-program-help">Choose a day, add its exercises and optional targets, then save the whole week once. Unconfigured days are rest days. Your old routines and workout history stay saved.</p><div id="weeklyBuilderTabs" class="weekly-builder-tabs" role="tablist" aria-label="Day to edit"></div><div id="weeklyBuilderDay" class="weekly-builder-day"></div><div class="custom-editor-footer weekly-builder-footer"><button type="button" data-week-close>Cancel</button><button type="button" id="saveWeeklyProgram">Save weekly program</button></div></div>';
 document.body.append(backdrop);
 const $=id=>backdrop.querySelector('#'+id);
 const forceClose=()=>{
  backdrop.remove();document.removeEventListener('keydown',onKey);
  if(closeCurrent===close)closeCurrent=null;
  if(forceCurrent===forceClose)forceCurrent=null;
 };
 const close=()=>{
  if(dirty&&!confirm('Discard your unsaved weekly program?'))return;
  forceClose();
 };
 closeCurrent=close;forceCurrent=forceClose;
 const onKey=e=>{if(e.key==='Escape')close()};
 document.addEventListener('keydown',onKey);
 backdrop.addEventListener('click',e=>{if(e.target===backdrop||e.target.closest('[data-week-close]'))close()});
 const find=id=>catalog().find(e=>e.id===id);
 const thumb=e=>{
  const t=e?.demonstration?.status==='approved'?e.demonstration.thumbnail:'';
  return typeof t==='string'&&t.startsWith('assets/exercise-demonstrations/')&&t.endsWith('.webp')&&!t.includes('..')
   ?'<img class="weekly-exercise-thumb" src="./'+esc(t)+'" alt="" loading="lazy">':'<span class="weekly-exercise-placeholder" aria-hidden="true">✦</span>';
 };
 function tabs(){
  $('weeklyBuilderTabs').innerHTML=DAYS.map((name,i)=>{
   const row=rows[i],count=row.rest?'Rest':row.ids.length+' exercises';
   return '<button type="button" role="tab" aria-selected="'+(i===active)+'" data-weekday="'+i+'"><strong>'+name.slice(0,3)+'</strong><small>'+count+'</small></button>';
  }).join('');
 }
 const input=(id,field,value,min,max,step,label)=>'<label>'+label+'<input data-week-target="'+esc(id)+'" data-field="'+field+'" type="number" inputmode="'+(field==='weight'?'decimal':'numeric')+'" min="'+min+'" max="'+max+'" step="'+step+'" placeholder="Optional" value="' +esc(value??'')+'"></label>';
 function render(){
  tabs();const row=rows[active];
  const chosen=row.ids.map((id,i)=>{
   const e=find(id),t=row.targets[id]||{};
   return '<article class="weekly-selected"><div class="weekly-selected-head"><span class="custom-exercise-order">'+(i+1)+'</span><div class="custom-exercise-copy"><strong>'+esc(e?.name||id)+'</strong><small>'+esc(e?.group||'Exercise')+'</small></div><button type="button" data-week-up="'+esc(id)+'" aria-label="Move exercise up" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-week-down="'+esc(id)+'" aria-label="Move exercise down" '+(i===row.ids.length-1?'disabled':'')+'>↓</button><button type="button" data-week-remove="'+esc(id)+'" aria-label="Remove exercise">✕</button></div><details class="weekly-selected-targets" '+(Object.keys(t).length?'open':'')+'><summary>Optional sets, reps, weight & rest</summary><div class="weekly-target-grid">'+
   input(id,'sets',invalidTargets[active].get(id+':sets')??t.sets,1,20,1,'Sets')+input(id,'reps',invalidTargets[active].get(id+':reps')??t.reps,1,100,1,'Reps')+input(id,'weight',invalidTargets[active].get(id+':weight')??t.weight,0,1500,0.5,'Weight (lb)')+input(id,'restSeconds',invalidTargets[active].get(id+':restSeconds')??t.restSeconds,0,1800,1,'Rest (seconds)')+'</div></details></article>';
  }).join('');
  $('weeklyBuilderDay').innerHTML='<div class="weekly-builder-day-heading"><h3>'+DAYS[active]+'</h3><label class="weekly-rest-toggle"><input type="checkbox" id="weeklyRestDay" '+(row.rest?'checked':'')+'> Rest day</label></div>'+
   (row.rest?'<p class="weekly-rest-explanation">Recovery day. No workout will be scheduled for '+DAYS[active]+'.</p>':
   '<label class="weekly-program-label">Workout name<input id="weeklyDayName" maxlength="75" value="'+esc(row.title)+'"></label><h4>Exercises ('+row.ids.length+')</h4>'+ (chosen||'<p class="custom-editor-empty">Add your exercises below.</p>')+
   '<label class="weekly-program-label">Find exercises<input type="search" id="weeklyExerciseSearch" placeholder="Search 344 exercises" value="'+esc(query)+'"></label>'+
   '<div id="weeklyMuscles" class="custom-editor-filters"></div><div id="weeklyExerciseOptions" class="weekly-exercise-results"></div>');
  if(!row.rest){filters();results()}
 }
 function filters(){
  const names=['All',...new Set(catalog().map(e=>e.group).filter(Boolean))];
  $('weeklyMuscles').innerHTML=names.map(g=>'<button type="button" data-week-group="'+esc(g)+'" aria-pressed="'+(g===group)+'">'+esc(g)+'</button>').join('');
 }
 function results(){
  const box=$('weeklyExerciseOptions');if(!box)return;
  const row=rows[active];
  box.innerHTML=catalog().filter(e=>(group==='All'||e.group===group)&&(e.name+' '+(e.group||'')+' '+(e.equipment||'')).toLowerCase().includes(query.toLowerCase())).map(e=>
   '<div class="weekly-option">'+thumb(e)+'<div class="custom-exercise-copy"><strong>'+esc(e.name)+'</strong><small>'+esc(e.group||'Exercise')+'</small></div><button type="button" data-week-add="'+esc(e.id)+'" '+(row.ids.includes(e.id)?'disabled':'')+'>'+(row.ids.includes(e.id)?'Added ✓':'Add +')+'</button></div>'
  ).join('')||'<p class="custom-editor-empty">No matching exercises.</p>';
 }
 $('weeklyBuilderTabs').addEventListener('click',e=>{
  const button=e.target.closest('[data-weekday]');if(!button)return;
  active=Number(button.dataset.weekday);query='';group='All';render();
 });
 $('weeklyBuilderDay').addEventListener('input',e=>{
  const el=e.target;if(el.id==='weeklyDayName'){rows[active].title=el.value;dirty=true;return}
  if(el.id==='weeklyExerciseSearch'){query=el.value;results();return}
  if(!el.matches('[data-week-target]'))return;
  const row=rows[active],id=el.dataset.weekTarget,field=el.dataset.field;
  if(!row.ids.includes(id)||!Object.hasOwn(LIMITS,field))return;
  const val=el.value.trim();
  const key=id+':'+field;
  invalidTargets[active].delete(key);
  if(el.validity?.badInput){invalidTargets[active].set(key,val);dirty=true;return}
  if(val===''){delete row.targets[id]?.[field];if(row.targets[id]&&!Object.keys(row.targets[id]).length)delete row.targets[id];dirty=true;return}
  const n=Number(val),[lo,hi]=LIMITS[field];
  if(!Number.isFinite(n)||n<lo||n>hi||(field!=='weight'&&!Number.isInteger(n))){invalidTargets[active].set(key,val);dirty=true;return}
  row.targets[id]??={};row.targets[id][field]=n;dirty=true;
 });
 $('weeklyBuilderDay').addEventListener('change',e=>{
  if(e.target.id!=='weeklyRestDay')return;
  rows[active].rest=e.target.checked;dirty=true;render();
 });
 $('weeklyBuilderDay').addEventListener('click',e=>{
  const groupBtn=e.target.closest('[data-week-group]');if(groupBtn){group=groupBtn.dataset.weekGroup;filters();results();return}
  const row=rows[active],add=e.target.closest('[data-week-add]'),remove=e.target.closest('[data-week-remove]'),up=e.target.closest('[data-week-up]'),down=e.target.closest('[data-week-down]');
  if(add){const id=add.dataset.weekAdd;if(!find(id)||row.ids.includes(id))return;if(row.ids.length>=40){alert('Maximum 40 exercises per day');return}row.ids.push(id);dirty=true;render();return}
  if(remove){row.ids=row.ids.filter(id=>id!==remove.dataset.weekRemove);delete row.targets[remove.dataset.weekRemove];for(const field of Object.keys(LIMITS))invalidTargets[active].delete(remove.dataset.weekRemove+':'+field);dirty=true;render();return}
  const move=up||down;if(move){const i=row.ids.indexOf(up?up.dataset.weekUp:down.dataset.weekDown),j=i+(up?-1:1);if(i<0||j<0||j>=row.ids.length)return;[row.ids[i],row.ids[j]]=[row.ids[j],row.ids[i]];dirty=true;render()}
 });
 $('weeklyProgramName').addEventListener('input',()=>{dirty=true});
 let saving=false;
 $('saveWeeklyProgram').addEventListener('click',async()=>{
  if(saving)return;
  const title=$('weeklyProgramName').value.trim();
  if(!title){alert('Enter a program name.');$('weeklyProgramName').focus();return}
  const missing=rows.findIndex(r=>!r.rest&&!r.ids.length);
  if(missing>=0){active=missing;render();alert('Add an exercise or mark '+DAYS[missing]+' as a rest day.');return}
  const invalid=rows.findIndex((row,day)=>!row.rest&&invalidTargets[day].size);
  if(invalid>=0){active=invalid;render();alert('Correct the optional targets for '+DAYS[invalid]+' before saving.');return}
  if(!rows.some(r=>!r.rest)){alert('Choose at least one training day.');return}
  const editorOwner=window.MLC2Custom,schedule=editorOwner.scheduleVersion();
  if(!confirm('Save this program as a new saved weekly schedule and activate it? Previous schedules, workouts and history will remain saved.'))return;
  try{
   saving=true;
   const days=rows.map(row=>({...row,ids:[...row.ids],targets:JSON.parse(JSON.stringify(row.targets))}));
   const result=await editorOwner.runPlanWrite(()=>{
    if(forceCurrent!==forceClose)throw Error('Weekly editor closed before saving.');
    if(editorOwner.scheduleVersion()!==schedule)throw Error('Weekly assignments changed. Review the schedule before saving.');
    return editorOwner.saveFullWeek({title,days,expectedOwner:initialOwner});
   });
   dirty=false;close();
   onSaved?.(result);
  }catch(err){if(forceCurrent===forceClose)alert('Weekly program was not saved: '+String(err.message||err).slice(0,140))}
  finally{saving=false}
 });
 render();$('weeklyProgramName').focus();
}
window.MLC2FullWeekBuilder={open,forceClose:()=>forceCurrent?.()};
})();
