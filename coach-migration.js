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
 const increment=meta.includes('dumbbell')||meta.includes('cable')?2.5:5;
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
window.MLC2Coach={suggestion,render};
})();