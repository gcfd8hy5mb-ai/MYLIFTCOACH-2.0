/* MYLIFTCOACH 2.0 — read-only consistency audit for simulated workouts.
   No browser persistence, writes to the app, network requests, or cloud sync. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2SimulationAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function audit(sessions,catalog,progress,weekly){
  if(!Array.isArray(sessions)||!sessions.length||!sessions.every(s=>s?.simulated===true))
   return {status:'inactive',checks:[]};
  const checks=[];
  const check=(title,pass,detail)=>checks.push({title,pass:Boolean(pass),detail:String(detail)});
  const ids=new Set((Array.isArray(catalog)?catalog:[]).map(e=>e?.id).filter(Boolean));
  const allSets=sessions.flatMap(s=>Array.isArray(s.sets)?s.sets:[]);
  const valid=allSets.filter(s=>progress?.validSet?.(s));
  const sum=valid.reduce((n,s)=>n+Number(s.weight)*Number(s.reps),0);
  check('Generated records stay isolated',sessions.every(s=>s.simulated&&/^simulation-/.test(s.id)),sessions.length+' fictional sessions');
  check('Exercise catalog mappings resolve',allSets.every(s=>ids.has(s.exerciseId)),allSets.length+' generated sets');
  const dates=sessions.map(s=>Date.parse(s.created));
  check('Workout dates are ordered',dates.every(Number.isFinite)&&dates.every((n,i)=>i===0||n<=dates[i-1]),'Most recent session first');
  const normalized=progress?.normalizedSessions?.(sessions,'demo')||[];
  const weeklyVolume=progress?.weeklyVolume?.(normalized)||[];
  const weeklyTotal=weeklyVolume.reduce((n,w)=>n+w.volume,0);
  check('Volume chart and weekly totals reconcile',Math.abs(sum-weeklyTotal)<0.001,Math.round(sum).toLocaleString()+' lb weighted volume');
  const records=progress?.personalRecords?.(normalized)||[];
  const unique=new Set(valid.map(s=>s.exerciseId));
  check('Personal records cover logged movements',records.length===unique.size,records.length+' exercises with weighted personal records');
  const latest=weekly?.compare?.(sessions);
  const weeksOk=latest&&latest.thisWeek.volume>=0&&latest.lastWeek.volume>=0&&
    latest.thisWeek.weightedSets>=0&&latest.lastWeek.weightedSets>=0;
  check('Weekly comparison is available',weeksOk,latest?'This week: '+Math.round(latest.thisWeek.volume)+' lb · last week: '+Math.round(latest.lastWeek.volume)+' lb':'Weekly comparison unavailable');
  return {status:checks.every(c=>c.pass)?'pass':'attention',checks,summary:{sessions:sessions.length,sets:allSets.length,weightedSets:valid.length,volume:sum,records:records.length}};
 }
 function render(root,result){
  if(!root)return;
  root.replaceChildren();
  if(!result||result.status==='inactive')return;
  const heading=document.createElement('p');heading.className='simulation-audit-heading';
  heading.textContent=(result.status==='pass'?'Consistency checks passed':'Consistency checks need review')+' · '+result.checks.filter(c=>c.pass).length+'/'+result.checks.length;
  root.append(heading);
  const list=document.createElement('ul');list.className='simulation-audit-list';
  for(const item of result.checks){
   const row=document.createElement('li');row.className=item.pass?'simulation-audit-pass':'simulation-audit-fail';
   row.textContent=(item.pass?'✓ ':'! ')+item.title+' — '+item.detail;
   list.append(row);
  }
  root.append(list);
  const note=document.createElement('p');note.className='simulation-audit-disclaimer';
  note.textContent='Read-only consistency checks of simulated data. This does not verify cloud sync or real-device workout completion.';
  root.append(note);
 }
 return Object.freeze({audit,render});
});
