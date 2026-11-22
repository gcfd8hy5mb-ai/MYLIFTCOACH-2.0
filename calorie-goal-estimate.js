/* MYLIFTCOACH 2.0 — optional estimated goal calories, never a food diary.
   Mifflin-St Jeor estimate, not an individually measured energy requirement. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CalorieGoal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PREFIX='mlc2-estimated-calorie-goal-v1';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 const ACTIVITY={sedentary:1.2,light:1.375,moderate:1.55,active:1.725};
 const GOALS=['strength','bulk','maintain','cut'];
 function key(owner=null){if(owner===null)return PREFIX;if(!OWNER.test(owner))throw Error('Invalid account');return PREFIX+':user:'+owner}
 function validate(p){
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Enter your profile');
  const age=Number(p.age),weight=Number(p.weightKg),height=Number(p.heightCm);
  if(!Number.isFinite(age)||age<18||age>100||!Number.isFinite(weight)||weight<30||weight>400||
     !Number.isFinite(height)||height<120||height>230||
     !['male','female'].includes(p.sex)||!Object.hasOwn(ACTIVITY,p.activity)||!GOALS.includes(p.goal))
   throw Error('Check age, weight, height, calculation sex, activity, and goal');
  return {age,weightKg:weight,heightCm:height,sex:p.sex,activity:p.activity,goal:p.goal};
 }
 function heightCmFromFeetInches(feet,inches){
  const ft=Number(feet),inch=Number(inches);
  if(String(inches??'').trim()===''||!Number.isInteger(ft)||ft<3||ft>7||!Number.isInteger(inch)||inch<0||inch>11)
   throw Error('Enter height as feet and inches (0–11 inches)');
  const cm=(ft*12+inch)*2.54;
  if(cm<120||cm>230)throw Error('Enter a height between 120 and 230 cm');
  return cm;
 }
 function feetInchesFromCm(cm){
  if(!Number.isFinite(Number(cm))||Number(cm)<120||Number(cm)>230)
   throw Error('Saved height is invalid');
  const totalInches=Math.min(Math.floor(230/2.54),Math.max(Math.ceil(120/2.54),Math.round(Number(cm)/2.54)));
  return {feet:Math.floor(totalInches/12),inches:totalInches%12};
 }
 function estimate(profile){
  const p=validate(profile);
  const bmr=10*p.weightKg+6.25*p.heightCm-5*p.age+(p.sex==='male'?5:-161);
  const maintenance=bmr*ACTIVITY[p.activity];
  // Strength: no forced bulk; gradual changes are user-confirmed.
  const adjustment={strength:0,bulk:250,maintain:0,cut:-300}[p.goal];
  const target=maintenance+adjustment;
  return {maintenance:Math.round(maintenance/25)*25,target:Math.round(target/25)*25,
   adjustment,goal:p.goal,method:'Mifflin-St Jeor',needsReview:target<1200};
 }
 function read(storage,owner=null){
  try{const value=storage.getItem(key(owner));if(!value||value.length>2048)return null;return validate(JSON.parse(value))}
  catch{return null}
 }
 function save(storage,owner,profile){
  const p=validate(profile),payload=JSON.stringify(p),k=key(owner);
  storage.setItem(k,payload);
  if(storage.getItem(k)!==payload)throw Error('Calorie profile did not persist');
  return p;
 }
 return Object.freeze({ACTIVITY,GOALS,key,validate,estimate,read,save,heightCmFromFeetInches,feetInchesFromCm});
});