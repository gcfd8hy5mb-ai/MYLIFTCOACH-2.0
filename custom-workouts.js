/* MYLIFTCOACH 2.0 custom workout manager. Browser-only preview; never writes original or Supabase records. */
(function(){
'use strict';
const KEY='mlc2-custom-plans-v1', TODAY='mlc2-selected-workout-v1', WEEK='mlc2-weekly-schedule-v1';
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
function saveWithWeekdays({next,updated,existing=null,chosenDays=[]}){
 const scheduleAPI=window.MLC2WeeklySchedule;
 const selectedDays=new Set(chosenDays);
 if([...selectedDays].some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('Invalid weekday');
 const initialSchedule=scheduleAPI?.read({getItem:key=>localStorage.getItem(scoped(key))})||{};
  try{saveWithWeekdays({next,updated,existing,chosenDays:[...chosenDays]})}
  catch(error){alert('Workout not saved: '+String(error.message||error).slice(0,120));return}
  close();onChanged?.();
 });
 selectedView();options();$('customName').focus();
}
function handleClick(e,onChanged,onSchedule){
 const schedule=e.target.closest('[data-custom-schedule]');
 if(schedule){const item=read().find(p=>p.id===schedule.dataset.customSchedule);if(item)onSchedule?.(item);return true}
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
window.MLC2Custom={allPlans,currentPlan,controls,openEditor,handleClick,setOwner,guestRecovery,recoverGuest,saveCoachDay,saveWithWeekdays};
})();