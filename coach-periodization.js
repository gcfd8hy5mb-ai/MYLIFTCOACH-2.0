/* MYLIFTCOACH 2.0 — read-only phase and recovery coaching.
 * Uses selected program, real completed sets, and explicit readiness only.
 * Does not edit a user's custom plan, log weight, or persist a suggestion.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2Periodization=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const GOALS=['strength','bulk','maintain','cut'];
 function propose({program,progress,plan,sessions=[],readiness='Normal',catalog=[]}={}){
  if(!program||!GOALS.includes(program.goal)||!progress||progress.status!=='active'||
     !plan||!Array.isArray(plan.ids)||!plan.ids.length)
   return {status:'unavailable',reason:'An active goal program and selected workout are required.'};
  const safe=['Great','Normal','Tired'].includes(readiness)?readiness:'Normal';
  // Identify genuine completed sessions of this workout within the active program.
  const recent=(Array.isArray(sessions)?sessions:[]).filter(x=>x?.planId===plan.id&&
   typeof x.created==='string'&&Date.parse(x.created)>=Date.parse(program.startDate+'T00:00:00Z')&&
   Array.isArray(x.sets)&&x.sets.length>0).sort((a,b)=>Date.parse(b.created)-Date.parse(a.created)).slice(0,3);
  const latest=recent[0],previous=recent[1];
  const reps=(session,id)=>session?.sets?.filter(s=>s.exerciseId===id&&
   Number.isInteger(Number(s.reps))&&Number(s.reps)>0&&
   Number.isFinite(Number(s.weight))&&Number(s.weight)>=0).map(s=>Number(s.reps))||[];
  // A decline only counts when comparable exercises exist in two completed sessions.
  const comparable=plan.ids.map(id=>({current:reps(latest,id),prior:reps(previous,id)}))
   .filter(x=>x.current.length>=2&&x.prior.length>=2);
  const decline=comparable.length>=2&&comparable.filter(x=>
   x.current.reduce((a,b)=>a+b,0)/x.current.length<
   0.85*x.prior.reduce((a,b)=>a+b,0)/x.prior.length).length>=Math.ceil(comparable.length/2);
  const recovery=safe==='Tired'?'rest-or-light':decline?'hold-and-review':'normal';
  const phase=progress.phase;
  // Use conservative per-exercise set deltas; never prescribe extra training
  // volume for an untested person or someone reporting fatigue.
  const phaseDelta=phase==='Build'&&recent.length>=2&&safe==='Great'&&!decline&&
   (program.goal==='bulk'||program.goal==='strength')?1:
   phase==='Consolidate'?-1:0;
  const setDelta=recovery==='rest-or-light'?-1:recovery==='hold-and-review'?Math.min(phaseDelta,0):phaseDelta;
  const recommendations=plan.ids.map(id=>{
   const exercise=Array.isArray(catalog)?catalog.find(e=>e?.id===id):null;
   const original=Number.isInteger(exercise?.sets)&&exercise.sets>=1&&exercise.sets<=8?exercise.sets:3;
   return {id,sets:Math.max(1,Math.min(5,original+setDelta)),
    originalSets:original,adjustment:Math.max(1,Math.min(5,original+setDelta))-original};
  });
  const goalTarget={strength:'5–8 reps for primary strength work',bulk:'8–12 reps for muscle building',
   maintain:'maintain established technique and rep ranges',cut:'preserve strength and technique while recovering'}[program.goal];
  const rationale=recovery==='rest-or-light'?'You marked yourself tired. Consider a rest day or a lighter session; no weight increase is recommended.':
   recovery==='hold-and-review'?'Reps declined across comparable completed sessions. Keep loads steady and review rest and form.':
   phaseDelta===1?'Two completed sessions and great readiness support an optional small increase in working sets.':
   phase==='Consolidate'?'Consolidation phase: consider one fewer working set for recovery.':
   'Keep your current working-set volume until enough consistent completed workouts support a change.';
  return {status:'ready',phase,week:progress.week,totalWeeks:progress.totalWeeks,
   readiness:safe,recovery,setDelta,goalTarget,rationale,recommendations,
   historySessions:recent.length,allowLoadIncrease:recovery==='normal'&&phase!=='Consolidate'};
 }
 return Object.freeze({propose});
});