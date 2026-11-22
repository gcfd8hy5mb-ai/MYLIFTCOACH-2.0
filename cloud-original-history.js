/* Read-only original cloud history viewer for MYLIFTCOACH 2.0.
   All data stays in memory, and is never mixed into 2.0 practice sessions.
   Requires an owner-matched archive already exported from the original account. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CloudHistory=api;
})(globalThis,function(){
'use strict';
const MAX_SESSIONS=10000,MAX_EXERCISES=100,MAX_SETS=100;
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function parseList(value,name){
 if(value===undefined)return [];
 if(typeof value!=='string')throw Error(name+' must be encoded as original JSON');
 let list;try{list=JSON.parse(value)}catch{throw Error(name+' contains malformed original JSON')}
 if(!Array.isArray(list))throw Error(name+' has an unexpected original record shape');
 return list;
}
function open({archiveText,ownerId,tables,inspector,storageModel}){
 if(!ownerId||typeof inspector!=='function'||!storageModel||typeof storageModel.restoreSnapshot!=='function')
  throw Error('Authenticated account and original model are required');
 const checked=inspector(archiveText,ownerId,tables);
 const restored=storageModel.restoreSnapshot(checked.records);
 const history=parseList(restored.workoutHistoryV52,'Original workout history');
 const workouts=parseList(restored.customWorkoutsV5,'Original custom workouts');
 if(history.length>MAX_SESSIONS||workouts.length>1000)throw Error('Original account history is too large to display safely');
 const sessions=history.map((s,index)=>{
  if(!isObject(s)||!Array.isArray(s.exercises)||s.exercises.length>MAX_EXERCISES)
   throw Error('Malformed original session at row '+(index+1));
  return {
   id:String(s.id??'').slice(0,100),
   title:String(s.workoutTitle||s.title||'Workout').slice(0,120),
   date:String(s.date||s.created||'').slice(0,40),
   exercises:s.exercises.map((e,ix)=>{
    if(!isObject(e)||!Array.isArray(e.sets)||e.sets.length>MAX_SETS)
     throw Error('Malformed exercise in original session '+(index+1)+'/'+(ix+1));
    return {
     id:String(e.id||'').slice(0,100),name:String(e.name||e.id||'Exercise').slice(0,130),
     sets:e.sets.filter(set=>set&&typeof set==='object'&&!Array.isArray(set)&&
       Number.isFinite(Number(set.weight))&&Number(set.weight)>=0&&Number(set.weight)<=1500&&
       Number.isInteger(Number(set.reps))&&Number(set.reps)>=1&&Number(set.reps)<=100)
      .map(set=>({weight:Number(set.weight),reps:Number(set.reps)}))
    };
   })
  };
 });
 const plans=workouts.map((p,index)=>{
  if(!isObject(p)||!Array.isArray(p.exercises)||p.exercises.length>100)
   throw Error('Malformed original workout at row '+(index+1));
  return {id:String(p.id??'').slice(0,100),name:String(p.name||p.title||'Custom workout').slice(0,120),exerciseCount:p.exercises.length};
 });
 return Object.freeze({
  owner:checked.owner,archivedRows:checked.recordCount,sessionCount:sessions.length,planCount:plans.length,
  setCount:sessions.reduce((a,s)=>a+s.exercises.reduce((n,e)=>n+e.sets.length,0),0),
  sessions,plans,readOnly:true,cloudWrites:false
 });
}
function render(target,view,doc){
 if(!target)return;
 target.replaceChildren();
 const header=doc.createElement('p');
 header.textContent='Original cloud archive · '+view.sessionCount+' sessions · '+view.setCount+' sets · '+view.planCount+' custom workouts. Read only; not 2.0 history.';
 target.append(header);
 for(const s of view.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,80)){
  const details=doc.createElement('details');
  details.className='history-entry';
  const summary=doc.createElement('summary');
  const title=doc.createElement('strong');title.textContent=s.title;
  const date=doc.createElement('small');date.textContent=(s.date||'Undated').slice(0,25)+' · '+s.exercises.length+' movements';
  summary.append(title,date);details.append(summary);
  for(const e of s.exercises){
   const row=doc.createElement('div');row.className='history-exercise';
   const name=doc.createElement('b');name.textContent=e.name;
   const count=doc.createElement('small');
   count.textContent=e.sets.map(t=>t.weight+' lb × '+t.reps+' reps').join(' · ');
   row.append(name,count);details.append(row);
  }
  target.append(details);
 }
 if(view.sessionCount>80){
  const note=doc.createElement('p');note.textContent='Showing 80 most recent archive sessions. All records remain in your downloaded archive.';target.append(note);
 }
}
return Object.freeze({open,render});
});