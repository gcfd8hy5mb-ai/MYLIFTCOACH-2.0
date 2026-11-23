'use strict';

(() => {
 const $ = id => document.getElementById(id);
 const catalog = window.MLC2_EXERCISE_CATALOG;
 const simulation = window.MLC2Simulation;
 function render(){
  const sessions = simulation.view([]);
  const result = window.MLC2SimulationAudit.audit(sessions,catalog,window.MLC2Progress,window.MLC2ProgressWeekly,window.MLC2Coach);
  $('simulationStatus').textContent = sessions.length
   ? 'SIMULATED TEST DATA · '+sessions.length+' workouts · '+result.summary.sets+' sets'
   : 'No simulated test data loaded.';
  window.MLC2SimulationAudit.render($('simulationAudit'),result);
  $('simulationHistory').replaceChildren(...sessions.map(session=>{
   const row=document.createElement('li');
   row.textContent=session.created.slice(0,10)+' · '+session.title+' · '+window.MLC2Progress.volumeTotal(session.sets).toLocaleString()+' lb';
   return row;
  }));
 }
 for(const id of ['simulation30','simulation90']){
  $(id).addEventListener('click',event=>{
   try{simulation.start(catalog,null,Number(event.currentTarget.dataset.days));render()}
   catch(error){$('simulationStatus').textContent=error.message}
  });
 }
 $('simulationClear').addEventListener('click',()=>{simulation.clear();render()});
})();
