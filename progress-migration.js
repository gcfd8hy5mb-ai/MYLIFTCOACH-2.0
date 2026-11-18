/* MYLIFTCOACH 2.0 progress migration: read-only record analysis, no database or storage mutations. */
(function(){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validSet(set){
 const weight=Number(set?.weight),reps=Number(set?.reps);
 return Number.isFinite(weight)&&weight>0&&Number.isFinite(reps)&&Number.isInteger(reps)&&reps>0&&reps<=100;
}
function normalizedSessions(sessions,source){
 if(!Array.isArray(sessions))return [];
 return sessions.filter(s=>s&&typeof s==='object').slice(0,1000).map(s=>{
  const date=String(s.date||s.created||'');
  if(source==='original')return {date,title:String(s.title||s.workoutTitle||'Workout'),exercises:(Array.isArray(s.exercises)?s.exercises:[]).map(e=>({
   id:String(e.id||e.name||''),name:String(e.name||e.id||'Exercise'),sets:(Array.isArray(e.sets)?e.sets:[]).filter(validSet).map(t=>({weight:Number(t.weight),reps:Number(t.reps)}))
  }))};
  const grouped=new Map();
  for(const t of Array.isArray(s.sets)?s.sets:[]){
   if(!validSet(t))continue;
   const id=String(t.exerciseId||'');if(!id)continue;
   if(!grouped.has(id))grouped.set(id,[]);
   grouped.get(id).push({weight:Number(t.weight),reps:Number(t.reps)});
  }
  return {date,title:String(s.title||'Workout'),exercises:[...grouped].map(([id,sets])=>({id,name:id,sets}))};
 });
}
function personalRecords(sessions){
 const map=new Map();
 for(const session of sessions)for(const e of session.exercises||[])for(const set of e.sets||[]){
  if(!validSet(set))continue;
  const key=String(e.id||e.name||'').trim();if(!key)continue;
  if(!map.has(key))map.set(key,{id:key,name:e.name||key,bestWeight:0,bestReps:0,bestSetVolume:0,estimated1RM:0,lastLogged:'',sets:0});
  const row=map.get(key);row.sets++;row.bestWeight=Math.max(row.bestWeight,set.weight);
  row.bestReps=Math.max(row.bestReps,set.reps);
  row.bestSetVolume=Math.max(row.bestSetVolume,set.weight*set.reps);
  // Same Epley estimate/rep limit as the original app.
  if(set.reps<=10)row.estimated1RM=Math.max(row.estimated1RM,set.weight*(1+set.reps/30));
  if(session.date>row.lastLogged)row.lastLogged=session.date;
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function weeklyVolume(sessions){
 const map=new Map();
 for(const session of sessions){
  const d=new Date(session.date);
  if(!Number.isFinite(d.getTime()))continue;
  const utc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
  const weekday=(utc.getUTCDay()+6)%7;utc.setUTCDate(utc.getUTCDate()-weekday);
  const key=utc.toISOString().slice(0,10);
  let value=0,sets=0;
  for(const e of session.exercises||[])for(const s of e.sets||[]){if(!validSet(s))continue;value+=s.weight*s.reps;sets++}
  const item=map.get(key)||{week:key,volume:0,sets:0,sessions:0};item.volume+=value;item.sets+=sets;item.sessions++;map.set(key,item);
 }
 return [...map.values()].sort((a,b)=>a.week.localeCompare(b.week));
}
function renderRecords(element,rawSessions,source,resolveName){
 if(!element)return;
 const sessions=normalizedSessions(rawSessions,source),records=personalRecords(sessions),weeks=weeklyVolume(sessions);
 const totalSets=weeks.reduce((sum,w)=>sum+w.sets,0),volume=weeks.reduce((sum,w)=>sum+w.volume,0);
 const summary=document.createElement('div');summary.className='records-summary';
 summary.innerHTML='<strong>'+sessions.length+'</strong> sessions · <strong>'+totalSets+'</strong> weighted sets · <strong>'+Math.round(volume).toLocaleString()+'</strong> lb total volume';
 element.replaceChildren(summary);
 const weekly=document.createElement('div');weekly.className='records-weekly';
 weekly.innerHTML='<h4>Recent weekly volume</h4>'+(weeks.length?weeks.slice(-8).reverse().map(w=>'<div class="records-week"><span>Week of '+escape(w.week)+'</span><strong>'+Math.round(w.volume).toLocaleString()+' lb</strong><small>'+w.sets+' sets</small></div>').join(''):'<p class="empty-note">No weighted sessions yet.</p>');
 element.append(weekly);
 const recordsEl=document.createElement('div');recordsEl.className='records-list';
 recordsEl.innerHTML='<h4>Personal records</h4>'+(records.length?records.map(r=>{
  const name=typeof resolveName==='function'?resolveName(r.id,r.name):r.name;
  return '<details class="records-item"><summary>'+escape(name)+'<span>Best '+r.bestWeight+' lb</span></summary><p>Best reps: '+r.bestReps+' · Best set volume: '+Math.round(r.bestSetVolume)+' lb · Estimated 1RM: '+(r.estimated1RM?Math.round(r.estimated1RM)+' lb':'—')+'</p><small>'+r.sets+' saved weighted sets · Last logged '+escape(r.lastLogged.slice(0,10)||'Unknown')+'</small></details>';
 }).join(''):'<p class="empty-note">Personal records appear after weighted sets are logged.</p>');
 element.append(recordsEl);
}
window.MLC2Progress={normalizedSessions,personalRecords,weeklyVolume,renderRecords};
})();