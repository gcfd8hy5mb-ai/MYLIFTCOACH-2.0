/* MYLIFTCOACH 2.0 simulated workout history — preview-only, memory-only.
 * These records must never enter persisted workouts, drafts, sync queues, or account stores.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2Simulation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 let simulated=null,daysLoaded=0;
 function generate(catalog,plan,days=30,now=new Date()){
  if(![30,90].includes(days))throw Error('Unsupported simulation range');
  const valid=Array.isArray(catalog)?catalog.filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&e.group!=='Cardio'):[];
  const lookup=new Map(valid.map(e=>[e.id,e]));
  const primary=(Array.isArray(plan?.ids)?plan.ids:[]).map(id=>lookup.get(id)).filter(Boolean).slice(0,5);
  const extras=valid.filter(e=>!primary.some(p=>p.id===e.id)).slice(0,10);
  const pool=[...primary,...extras];
  if(pool.length<3)throw Error('At least three catalog exercises are needed for simulation');
  const end=new Date(now);
  if(!Number.isFinite(end.getTime()))throw Error('Invalid simulation date');
  const records=[];
  // Three weekly sessions on different weekdays with measurable progression.
  for(let offset=days-1;offset>=0;offset--){
   const trainingDay=(days-1-offset)%7;
   if(![0,2,4].includes(trainingDay))continue;
   const date=new Date(end.getTime());
   date.setUTCDate(date.getUTCDate()-offset);
   date.setUTCHours(12,0,0,0);
   if(date.getTime()>end.getTime())date.setUTCHours(8,0,0,0);
   if(date.getTime()>end.getTime())continue;
   const index=records.length,week=Math.floor(index/3),isPrimary=index%2===0;
   const chosen=isPrimary&&primary.length>=3?primary:pool.slice((index%3)*2,(index%3)*2+5);
   const moves=chosen.length>=3?chosen:pool.slice(0,5);
   const sets=[];
   for(let j=0;j<Math.min(5,moves.length);j++){
    const e=moves[j],base=30+(j%4)*12.5+(e.group==='Legs'?45:0);
    const load=Math.min(350,base+Math.floor(week/2)*2.5);
    for(let set=0;set<3;set++)sets.push({exerciseId:e.id,weight:load,reps:8+((index+j+set)%4)});
   }
   records.push({id:'simulation-'+days+'-'+index,created:date.toISOString(),title:isPrimary?(String(plan?.title||'Practice Workout')+' · SIMULATED'):'Simulated Training Day '+(index%3+1),planId:isPrimary?String(plan?.id||'simulation-plan'):'simulation-alternate',sets,simulated:true});
  }
  return records.reverse();
 }
 function start(catalog,plan,days,now=new Date()){
  const next=generate(catalog,plan,days,now);
  if(!next.length)throw Error('No test sessions generated');
  simulated=next;daysLoaded=days;
  return {sessions:next.length,days};
 }
 function clear(){simulated=null;daysLoaded=0}
 function active(){return Array.isArray(simulated)}
 function status(){return {active:active(),days:daysLoaded,sessions:simulated?.length||0}}
 function view(real){return active()?simulated:Array.isArray(real)?real:[]}
 return Object.freeze({generate,start,clear,active,status,view});
});
