/* Standardize instruction content across identical exercise names.
   Preserve original IDs, demonstration mapping, sets, reps and workout plans.
   Do not synthesize or invent technique advice. */
(()=>{
'use strict';
const catalog=window.MLC2_EXERCISE_CATALOG;
if(!Array.isArray(catalog)||catalog.length!==344)return;
const groups=new Map();
for(const exercise of catalog){
 const key=String(exercise.name||'').trim().toLowerCase();
 if(!key)continue;
 if(!groups.has(key))groups.set(key,[]);
 groups.get(key).push(exercise);
}
const score=e=>(e.how?.length||0)+(e.tips?.length||0)*30+(e.mistakes?.length||0)*30+(e.equipment?.trim()?10:0);
for(const group of groups.values()){
 if(group.length<2)continue;
 const source=[...group].sort((a,b)=>score(b)-score(a))[0];
 if(!source.how?.trim()||!source.tips?.length||!source.mistakes?.length||!source.equipment?.trim())continue;
 for(const item of group){
  if(item===source)continue;
  item.how=source.how;
  item.cue=source.cue||source.how;
  item.tips=[...source.tips];
  item.mistakes=[...source.mistakes];
  item.equipment=source.equipment;
 }
}
})();
