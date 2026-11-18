/* MYLIFTCOACH 2.0 custom workout manager. Browser-only preview; never writes original or Supabase records. */
(function(){
'use strict';
const KEY='mlc2-custom-plans-v1', TODAY='mlc2-selected-workout-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=()=>Array.isArray(window.MLC2_EXERCISE_CATALOG)?window.MLC2_EXERCISE_CATALOG:[];
const byId=id=>catalog().find(e=>e.id===id);
function read(){
 try{
 const a=JSON.parse(localStorage.getItem(KEY)||'[]');
 return Array.isArray(a)?a.slice(0,60).filter(p=>p&&typeof p.id==='string'&&p.id.startsWith('custom-')&&Array.isArray(p.ids)).map(p=>({
  id:p.id,title:String(p.title||'My workout').slice(0,75),kind:'Custom',description:String(p.description||'Custom routine').slice(0,160),
  ids:[...new Set(p.ids.filter(id=>typeof id==='string'&&byId(id)))].slice(0,40)
 })).filter(p=>p.ids.length):[];
 }catch{return []}
}
function allPlans(presets){return [...read(),...presets]}
function currentPlan(presets,completed){const a=allPlans(presets);let id='';try{id=localStorage.getItem(TODAY)||''}catch{};return a.find(p=>p.id===id)||read()[0]||presets[completed%presets.length]}
function controls(p,currentId){
 const custom=p.id.startsWith('custom-');
 return '<div class="custom-plan-actions"><button type="button" data-custom-select="'+esc(p.id)+'">'+(currentId===p.id?'Selected for today ✓':'Use for today')+'</button>'+(custom?'<button type="button" data-custom-edit="'+esc(p.id)+'">Edit</button><button type="button" data-custom-delete="'+esc(p.id)+'">Delete</button>':'')+'</div>';
}
function openEditor(id,unused,onChanged){
 const existing=read().find(p=>p.id===id);
 let selected=existing?[...existing.ids]:[];
 const root=document.createElement('div');root.className='custom-editor-backdrop';root.setAttribute('role','presentation');
 root.innerHTML='<div class="custom-editor-dialog" role="dialog" aria-modal="true" aria-label="Custom workout editor"><div class="custom-editor-heading"><h2>'+esc(existing?'Edit custom workout':'New custom workout')+'</h2><button type="button" data-editor-close aria-label="Close">✕</button></div><form id="mlc-custom-form"><label>Workout name<input id="customName" name="title" maxlength="75" required value="'+esc(existing?.title||'')+'" placeholder="My workout"></label><label>Description<input name="description" maxlength="160" value="'+esc(existing?.description||'')+'" placeholder="Optional notes"></label><h3>Selected exercises <span id="customCount"></span></h3><div id="customSelected"></div><label>Find exercises<input id="customSearch" type="search" placeholder="Search 344 exercises"></label><div id="customOptions"></div><div class="custom-editor-footer"><button type="button" data-editor-close>Cancel</button><button type="submit">Save workout</button></div></form></div>';
 document.body.appendChild(root);
 const $=id=>root.querySelector('#'+id);
 const close=()=>{document.removeEventListener('keydown',escapeKey);root.remove()};
 const escapeKey=e=>{if(e.key==='Escape')close()};
 document.addEventListener('keydown',escapeKey);
 root.addEventListener('click',e=>{if(e.target===root||e.target.closest('[data-editor-close]'))close()});
 function selectedView(){
  $('customCount').textContent=selected.length+' of 40';
  $('customSelected').innerHTML=selected.map(id=>'<button type="button" data-custom-remove="'+esc(id)+'">'+esc(byId(id)?.name||id)+' ×</button>').join('')||'<p>No exercises selected yet.</p>';
 }
 function options(){
  const q=$('customSearch').value.toLowerCase().trim();
  $('customOptions').innerHTML=catalog().filter(e=>(e.name+' '+e.group).toLowerCase().includes(q)).map(e=>'<label><input type="checkbox" data-custom-exercise="'+esc(e.id)+'" '+(selected.includes(e.id)?'checked':'')+'><span>'+esc(e.name)+' <small>'+esc(e.group)+'</small></span></label>').join('')||'<p>No matching exercises.</p>';
 }
 $('customSearch').addEventListener('input',options);
 $('customOptions').addEventListener('change',e=>{
  const field=e.target.closest('[data-custom-exercise]');if(!field)return;
  const key=field.dataset.customExercise;
  if(field.checked&&!selected.includes(key)){if(selected.length>=40){field.checked=false;alert('Maximum 40 exercises.');return}selected.push(key)}
  else if(!field.checked)selected=selected.filter(x=>x!==key);
  selectedView();
 });
 $('customSelected').addEventListener('click',e=>{
  const button=e.target.closest('[data-custom-remove]');if(!button)return;
  selected=selected.filter(x=>x!==button.dataset.customRemove);selectedView();options();
 });
 $('mlc-custom-form').addEventListener('submit',e=>{
  e.preventDefault();
  const form=e.currentTarget,name=form.elements.title.value.trim(),description=form.elements.description.value.trim();
  if(!name||!selected.length){alert('Enter a workout name and select at least one exercise.');return}
  const plans=read();if(!existing&&plans.length>=60){alert('Maximum 60 custom workouts.');return}
  const updated={id:existing?.id||'custom-'+Date.now(),title:name.slice(0,75),kind:'Custom',description:description.slice(0,160),ids:[...selected]};
  const next=existing?plans.map(p=>p.id===existing.id?updated:p):[updated,...plans];
  try{localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem(TODAY,updated.id)}catch{alert('Browser storage is unavailable; workout was not saved.');return}
  close();onChanged?.();
 });
 selectedView();options();$('customName').focus();
}
function handleClick(e,onChanged){
 const selection=e.target.closest('[data-custom-select]');if(selection){try{localStorage.setItem(TODAY,selection.dataset.customSelect)}catch{alert('Could not save selection.');return true}onChanged?.();return true}
 const edit=e.target.closest('[data-custom-edit]');if(edit){openEditor(edit.dataset.customEdit,null,onChanged);return true}
 const del=e.target.closest('[data-custom-delete]');if(del){
  const id=del.dataset.customDelete,items=read(),item=items.find(x=>x.id===id);if(!item)return true;
  if(!confirm('Delete '+item.title+'? Workout history will remain.'))return true;
  try{localStorage.setItem(KEY,JSON.stringify(items.filter(x=>x.id!==id)));if(localStorage.getItem(TODAY)===id)localStorage.removeItem(TODAY)}catch{alert('Could not delete workout.');return true}
  onChanged?.();return true;
 }
 return false;
}
window.MLC2Custom={allPlans,currentPlan,controls,openEditor,handleClick};
})();