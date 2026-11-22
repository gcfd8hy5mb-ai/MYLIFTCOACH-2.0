/* MYLIFTCOACH 2.0 — fixed-duration goal program calendar.
 * Isolated, owner-scoped, local-first. No completed workouts or cloud records are altered.
 * Calendar weeks use UTC date boundaries to avoid daylight-saving jumps.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2GoalProgram=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PREFIX='mlc2-goal-program-v1';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 const GOALS=['strength','bulk','maintain','cut'];
 const DURATIONS=[6,8,12];
 const DAY=86400000;
 function key(owner=null){if(owner===null)return PREFIX;if(!OWNER.test(owner))throw Error('Invalid goal program account');return PREFIX+':user:'+owner}
 function dateOnly(date){
  const d=date instanceof Date?date:new Date(date);
  if(!Number.isFinite(d.getTime()))throw Error('Invalid program date');
  return d.toISOString().slice(0,10);
 }
 function utcDay(value){
  if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))throw Error('Invalid program start date');
  const t=Date.parse(value+'T00:00:00.000Z');
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value)throw Error('Invalid calendar date');
  return t;
 }
 function valid(p){
  return !!p&&typeof p==='object'&&!Array.isArray(p)&&GOALS.includes(p.goal)&&DURATIONS.includes(p.weeks)&&
   typeof p.startDate==='string'&&(()=>{try{utcDay(p.startDate);return true}catch{return false}})();
 }
 function read(storage,owner=null){
  try{const s=storage.getItem(key(owner));if(!s||s.length>512)return null;
   const p=JSON.parse(s);return valid(p)?{goal:p.goal,weeks:p.weeks,startDate:p.startDate}:null
  }catch{return null}
 }
 function start(storage,owner,{goal,weeks},now=new Date()){
  const startDate=dateOnly(now),program={goal,weeks:Number(weeks),startDate};
  if(!valid(program))throw Error('Choose a valid goal and 6, 8 or 12 weeks');
  const k=key(owner),payload=JSON.stringify(program);
  storage.setItem(k,payload);
  if(storage.getItem(k)!==payload)throw Error('Goal program could not be saved');
  return program;
 }
 function progress(program,now=new Date()){
  if(!valid(program))return null;
  const elapsed=Math.floor((utcDay(dateOnly(now))-utcDay(program.startDate))/DAY);
  const finished=elapsed>=program.weeks*7;
  const week=elapsed<0?1:Math.min(program.weeks,Math.floor(elapsed/7)+1);
  const phase=week<=Math.max(1,Math.floor(program.weeks/3))?'Foundation':
   week<=Math.max(2,Math.ceil(program.weeks*2/3))?'Build':'Consolidate';
  return {week,totalWeeks:program.weeks,daysElapsed:Math.max(0,elapsed),daysRemaining:Math.max(0,program.weeks*7-Math.max(0,elapsed)),
   percent:Math.max(0,Math.min(100,Math.round(Math.max(0,elapsed)/(program.weeks*7)*100))),phase,
   status:elapsed<0?'upcoming':finished?'completed':'active',
   endDate:new Date(utcDay(program.startDate)+program.weeks*7*DAY).toISOString().slice(0,10)};
 }
 return Object.freeze({PREFIX,GOALS,DURATIONS,key,read,start,progress});
});