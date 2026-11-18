/* MYLIFTCOACH 2.0 Coach migration: deterministic suggestions from logged sets only.
   Never write original keys, user profiles, or production data. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function suggestion(id,sessions,catalog,range={min:8,max:10}){
 if(!Array.isArray(sessions)||!Array.isArray(catalog))return {status:'insufficient'};
 const exercise=catalog.find(x=>x.id===id);
 if(!exercise)return {status:'insufficient'};
 const normalized=window.MLC2Progress?.normalizedSessions(sessions,'demo')||[];
 const recent=normalized.filter(session=>session.exercises.some(e=>e.id===id))
  .slice(0,3).map(session=>{
   const sets=session.exercises.find(e=>e.id===id)?.sets||[];
   if(sets.length<2)return null;
   const weight=Math.max(...sets.map(s=>s.weight));
   const working=sets.filter(s=>s.weight===weight);
   return working.length>=2?{weight,reps:working.map(s=>s.reps)}:null;
  }).filter(Boolean);
 if(recent.length<2)return {status:'insufficient'};
 const last=recent[0],meta=String(exercise.equipment||'').toLowerCase();
 const details=window.MLC2_COACH_ATTRIBUTES?.[id];
 const increment=meta.includes('dumbbell')||details?.type==='Isolation'?2.5:5;
 const top=last.reps.every(x=>x>=range.max);
 const low=recent.slice(0,2).every(s=>s.weight===last.weight&&s.reps.filter(x=>x<range.min).length>s.reps.length/2);
 const action=top?'increase':low?'reduce':'hold';
 const weight=top?last.weight+increment:low?Math.max(increment,last.weight-increment):last.weight;
 const reason=top?'All working sets reached the top of the target range.':low?'Most working sets fell below the target range in two sessions.':'Continue working toward the top of the target rep range.';
 return {status:'ready',weight,action,reason,lastWeight:last.weight,range};
}
function render(root,sessions,catalog){
 if(!root)return;
 const ids=[...new Set((sessions||[]).flatMap(s=>(s.sets||[]).map(t=>t.exerciseId)).filter(Boolean))];
 const rows=ids.map(id=>({exercise:catalog.find(e=>e.id===id),id,result:suggestion(id,sessions,catalog)})).filter(row=>row.result.status==='ready');
 root.innerHTML=rows.length?rows.slice(0,12).map(r=>'<article class="coach-suggestion"><h4>'+esc(r.exercise?.name||r.id)+'</h4><p><strong>'+esc(r.result.action.toUpperCase())+' · '+r.result.weight+' lb suggested</strong></p><small>'+esc(r.result.reason)+' Based only on your locally logged sessions.</small></article>').join(''):'<p class="empty-note">For an evidence-based progression suggestion, log at least two working sets of an exercise in each of two sessions. No advice is generated from missing history.</p>';
}

function substitutions(id,catalog){
 const metadata=window.MLC2_COACH_ATTRIBUTES||{},current=catalog.find(e=>e.id===id),from=metadata[id];
 if(!current||!from?.pattern)return [];
 return catalog.filter(e=>{
  const item=metadata[e.id];
  return e.id!==id&&item?.pattern===from.pattern&&
   String(e.muscle||e.group).toLowerCase()===String(current.muscle||current.group).toLowerCase();
 }).map(e=>{
  const to=metadata[e.id],same=to.equipment===from.equipment,
   shared=to.secondary.filter(v=>from.secondary.includes(v)).length,
   score=100+40+Math.min(shared,3)*9+(same?9:0)+(from.type===to.type?3:0);
  return {id:e.id,name:e.name,equipment:to.equipment,pattern:to.pattern,score,
   reason:'Same '+from.pattern.toLowerCase()+' movement for '+(current.muscle||current.group)+'; '+(same?'matching':'different')+' equipment.'};
 }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}
function renderTools(root,catalog,plan){
 if(!root)return;
 const tagged=catalog.filter(e=>window.MLC2_COACH_ATTRIBUTES?.[e.id]);
 const choices=tagged.filter(e=>substitutions(e.id,catalog).length);
 const current=(plan?.ids||[]).map(id=>choices.find(e=>e.id===id)).find(Boolean)||choices[0];
 root.innerHTML='<label class="coach-sub-label">Exercise to replace <select id="coachSubChoice">'+
 choices.map(e=>'<option value="'+esc(e.id)+'" '+(e.id===current?.id?'selected':'')+'>'+esc(e.name)+'</option>').join('')+
 '</select></label><div id="coachSubList"></div>'+
 '<p class="coach-sub-note">Suggestions are informational. They are limited to movements with matching technique metadata from the original app. Confirm available equipment and exercise suitability before changing your routine. No workout is edited automatically.</p>';
 const select=root.querySelector('#coachSubChoice'),list=root.querySelector('#coachSubList');
 if(!choices.length){root.textContent='No verified movement substitutions are currently available.';return}
 function update(){
  const candidates=substitutions(select.value,catalog).slice(0,5);
  list.innerHTML=candidates.map(e=>'<article class="coach-sub-item"><strong>'+esc(e.name)+'</strong><small>'+esc(e.equipment)+' · '+esc(e.reason)+'</small></article>').join('')||'<p class="empty-note">No verified substitutions for this exercise.</p>';
 }
 select.addEventListener('change',update);update();
}

window.MLC2Coach={suggestion,render,substitutions,renderTools};
})();