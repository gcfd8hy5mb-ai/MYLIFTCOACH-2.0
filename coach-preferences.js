/* MYLIFTCOACH 2.0 — owner-scoped local Coach preferences.
 * Distinct from billing entitlements and completed workout history.
 * Missing/corrupt state falls back safely; never claims another user's settings.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CoachPreferences=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BASE='mlc2-auto-coach-preferences-v1';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 const DEFAULT=Object.freeze({goal:'balanced',days:4,equipment:'Any'});
 const GOALS=['balanced','strength','muscle'];
 const EQUIPMENT=['Any','Machine','Dumbbell','Bodyweight','Cable','Barbell'];
 function key(owner=null){if(owner===null)return BASE;if(!OWNER.test(owner))throw Error('Invalid Coach preference owner');return BASE+':user:'+owner}
 function valid(x){return !!x&&!Array.isArray(x)&&typeof x==='object'&&GOALS.includes(x.goal)&&[3,4,5].includes(x.days)&&EQUIPMENT.includes(x.equipment)}
 function read(storage,owner=null){
  try{const raw=storage.getItem(key(owner));if(raw===null)return {...DEFAULT};
   if(raw.length>2048)return {...DEFAULT};
   const parsed=JSON.parse(raw);
   return valid(parsed)?{goal:parsed.goal,days:parsed.days,equipment:parsed.equipment}:{...DEFAULT};
  }catch{return {...DEFAULT}}
 }
 function save(storage,owner,preferences){
  if(!valid(preferences))throw Error('Invalid Coach preferences');
  const payload=JSON.stringify({goal:preferences.goal,days:preferences.days,equipment:preferences.equipment});
  storage.setItem(key(owner),payload);
  if(storage.getItem(key(owner))!==payload)throw Error('Coach preferences did not persist');
  return read(storage,owner);
 }
 return Object.freeze({BASE,DEFAULT,GOALS,EQUIPMENT,key,read,save});
});
