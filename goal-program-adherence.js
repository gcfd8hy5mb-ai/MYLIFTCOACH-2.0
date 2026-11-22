/* MYLIFTCOACH 2.0 — read-only goal-program adherence.
 * Counts completed, verified workout sessions only, never planned days as done.
 * Calendar progress and exercise recommendations remain independently maintained.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2ProgramAdherence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DAY=86400000;
 function summary({program,progress,source,sessions=[],customPlans=[],days=4,now=new Date()}={}){
  if(!program||!progress||!['active','completed','upcoming'].includes(progress.status)||
     ![6,8,12].includes(program.weeks)||typeof program.startDate!=='string')
   return null;
  const countDays=[3,4,5].includes(Number(days))?Number(days):4;
  const enrolled=new Set((Array.isArray(customPlans)?customPlans:[])
   .filter(p=>p&&typeof p.id==='string'&&p.id.startsWith('custom-')&&
    (!source?.customId||p.id===source.customId)).map(p=>p.id));
  const mode=['custom','mixed','generated'].includes(source?.mode)?source.mode:'generated';
  const start=Date.parse(program.startDate+'T00:00:00Z');
  const finish=start+program.weeks*7*DAY;
  if(!Number.isFinite(start)||!Number.isFinite(finish))return null;
  const earliest=Math.max(start,start+(progress.week-1)*7*DAY);
  const latest=Math.min(finish,start+progress.week*7*DAY);
  const selected=(Array.isArray(sessions)?sessions:[]).filter(s=>{
   if(!s||typeof s.planId!=='string'||!Array.isArray(s.sets)||!s.sets.length)return false;
   if(!s.sets.some(set=>set&&typeof set.exerciseId==='string'&&
    set.reps!==''&&set.reps!=null&&Number.isFinite(Number(set.reps))&&Number(set.reps)>0))return false;
   const timestamp=Date.parse(s.created||'');
   if(!Number.isFinite(timestamp)||timestamp<start||timestamp>=finish)return false;
   const coach=mode!=='custom'&&/^coach-auto-day-[1-5]$/.test(s.planId);
   const custom=mode!=='generated'&&enrolled.has(s.planId);
   return coach||custom;
  });
  // Completed session identities must be unique; never count an imported duplicate twice.
  const seen=new Set(),verified=selected.filter(s=>{
   if(typeof s.id!=='string'||!s.id.trim()||seen.has(s.id))return false;
   seen.add(s.id);return true;
  });
  const current=verified.filter(s=>{const t=Date.parse(s.created);return t>=earliest&&t<latest});
  const nowTimestamp=new Date(now).getTime();
  const dayIndex=Math.max(0,Math.min(program.weeks*7,
   Math.floor((nowTimestamp-start)/DAY)));
  const elapsedWeeks=Math.min(program.weeks,Math.floor(dayIndex/7));
  const previousSessions=verified.filter(s=>Date.parse(s.created)<start+elapsedWeeks*7*DAY).length;
  const scheduledBefore=Math.min(program.weeks*countDays,elapsedWeeks*countDays);
  return {status:progress.status,week:progress.week,totalWeeks:program.weeks,
   daysPerWeek:countDays,completed:verified.length,weekCompleted:current.length,
   weekTarget:countDays,planned:countDays*program.weeks,
   previousWeeksCompleted:previousSessions,
   missedPriorSessions:Math.max(0,scheduledBefore-previousSessions),
   dueThisWeek:progress.status==='completed'?0:Math.max(0,countDays-current.length),
   nextSession:'Next workout follows completed logs; missed days never count as completed.'};
 }
 return Object.freeze({summary});
});
