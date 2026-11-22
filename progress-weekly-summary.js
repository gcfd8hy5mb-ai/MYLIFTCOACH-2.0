/* MYLIFTCOACH 2.0 — read-only weekly Progress comparison.
   Derived from completed sessions in the current account only.
   Read-only calculation with no network access or changes to records. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2ProgressWeekly=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const isWeightedSet=set=>{
  if(!set||set.weight==null||set.reps==null||String(set.weight).trim()===''||String(set.reps).trim()==='')return false;
  const w=Number(set.weight),r=Number(set.reps);
  return Number.isFinite(w)&&w>0&&w<=1500&&Number.isInteger(r)&&r>0&&r<=100;
 };
 function monday(day){
  const d=new Date(day);
  if(!Number.isFinite(d.getTime()))return null;
  const utc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate()-(utc.getUTCDay()+6)%7);
  return utc.toISOString().slice(0,10);
 }
 function compare(sessions,now=new Date()){
  const current=monday(now);
  if(!current)return null;
  const previousDate=new Date(current+'T00:00:00Z');
  previousDate.setUTCDate(previousDate.getUTCDate()-7);
  const previous=previousDate.toISOString().slice(0,10);
  const nextDate=new Date(current+'T00:00:00Z');
  nextDate.setUTCDate(nextDate.getUTCDate()+7);
  const next=nextDate.toISOString().slice(0,10);
  const fresh=()=>({sessions:0,sets:0,weightedSets:0,volume:0});
  const thisWeek=fresh(),lastWeek=fresh();
  for(const session of Array.isArray(sessions)?sessions:[]){
   if(!session||!Array.isArray(session.sets))continue;
   const date=String(session.created||session.date||'');
   const stamp=Date.parse(date);
   if(!Number.isFinite(stamp)||stamp>new Date(now).getTime())continue;
   const week=monday(stamp);
   const row=week===current?thisWeek:week===previous?lastWeek:null;
   if(!row)continue;
   row.sessions++;
   row.sets+=session.sets.length;
   for(const set of session.sets)if(isWeightedSet(set)){
    row.weightedSets++;
    row.volume+=Number(set.weight)*Number(set.reps);
   }
  }
  return {current,previous,next,thisWeek,lastWeek};
 }
 function render(root,sessions,now=new Date()){
  if(!root)return;
  const data=compare(sessions,now);
  root.replaceChildren();
  if(!data)return;
  const intro=document.createElement('p');
  intro.className='progress-weekly-intro';
  intro.textContent='Completed 2.0 workouts only · weeks start Monday (UTC). No original-app records are combined.';
  root.append(intro);
  const grid=document.createElement('div');grid.className='progress-weekly-grid';
  for(const [label,period] of [['This week',data.thisWeek],['Last week',data.lastWeek]]){
   const card=document.createElement('div');card.className='progress-weekly-period';
   const heading=document.createElement('h4');heading.textContent=label;card.append(heading);
   for(const [title,value] of [['Sessions',String(period.sessions)],['Sets logged',String(period.sets)],['Weighted sets',String(period.weightedSets)],['Volume',Math.round(period.volume).toLocaleString()+' lb']]){
    const row=document.createElement('p');row.className='progress-weekly-line';
    const name=document.createElement('span');name.textContent=title;
    const amount=document.createElement('strong');amount.textContent=value;
    row.append(name,amount);card.append(row);
   }
   grid.append(card);
  }
  root.append(grid);
  const foot=document.createElement('p');foot.className='progress-weekly-note';
  foot.textContent='Volume is the total of completed positive-weight sets (weight × reps). Cardio and unweighted sets count toward logged sets, not pounds lifted.';
  root.append(foot);
 }
 return Object.freeze({monday,compare,render});
});
