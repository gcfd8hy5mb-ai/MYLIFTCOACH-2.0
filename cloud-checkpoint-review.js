/* MYLIFTCOACH 2.0 original account revision-checkpoint inspection.
   Two independently verified original cloud archives; never a write authorization.
   Snapshot comparisons are metadata only: no payloads are rendered or uploaded. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CheckpointReview=api;
})(globalThis,function(){
'use strict';
const key=r=>r.table+':'+r.id;
function stable(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
function content(row){return stable({source_key:row.source_key??null,payload:row.payload??null,
 parent_id:row.parent_id??null,slot:row.slot??null,position:row.position??null})}
function inspect({baselineText,currentText,ownerId,tables,archiveInspector}){
 if(!archiveInspector||typeof archiveInspector!=='function')throw Error('Cloud archive inspector is missing');
 const before=archiveInspector(baselineText,ownerId,tables),after=archiveInspector(currentText,ownerId,tables);
 if(before.owner!==after.owner||before.owner!==ownerId)throw Error('Archive account ownership mismatch');
 const older=JSON.parse(baselineText),newer=JSON.parse(currentText);
 const priorTime=Date.parse(older.createdAt),newTime=Date.parse(newer.createdAt);
 if(!Number.isFinite(priorTime)||!Number.isFinite(newTime)||newTime<=priorTime)
  throw Error('Current archive must be a newer, dated account snapshot');
 const oldRows=new Map(before.records.map(r=>[key(r),r]));
 const nowRows=new Map(after.records.map(r=>[key(r),r]));
 const changes={unchanged:0,added:0,changed:0,deleted:0,invalidRevision:0,revisionAnomalies:0};
 const review=[];
 for(const [id,old] of oldRows){
  const next=nowRows.get(id);
  if(!next){changes.deleted++;review.push({id,kind:'deleted'});continue}
  const a=old.revision,b=next.revision;
  if(!Number.isSafeInteger(a)||a<1||!Number.isSafeInteger(b)||b<1){
   changes.invalidRevision++;review.push({id,kind:'invalid-revision'});continue
  }
  const different=content(old)!==content(next);
  if(b<a||(different&&b===a)){changes.revisionAnomalies++;review.push({id,kind:'revision-anomaly'});continue}
  if(different){changes.changed++;review.push({id,kind:'changed'});continue}
  changes.unchanged++;
 }
 for(const [id,row] of nowRows)if(!oldRows.has(id)){
  if(!Number.isSafeInteger(row.revision)||row.revision<1){changes.invalidRevision++;review.push({id,kind:'invalid-revision'});}
  else {changes.added++;review.push({id,kind:'added'})}
 }
 const clean=changes.deleted===0&&changes.invalidRevision===0&&changes.revisionAnomalies===0;
 return Object.freeze({ownerVerified:true,baselineTime:older.createdAt,currentTime:newer.createdAt,
  baselineRows:before.recordCount,currentRows:after.recordCount,changes,review,
  cloudChanged:changes.changed>0||changes.added>0||changes.deleted>0,
  checkpointCompatible:clean,canWrite:false,canMerge:false,
  blockers:['A comparison of two exported snapshots is not an atomic server checkpoint',
   'Real-time revision checks and owner-scoped write/rollback tests are still required',
   '2.0 workout IDs and original numeric IDs are not yet safely mapped']});
}
return Object.freeze({inspect,content,stable});
});