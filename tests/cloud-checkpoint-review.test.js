/* Synthetic, offline checkpoint drift regression tests. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const checkpoint=require(path.resolve(__dirname,'../cloud-checkpoint-review.js'));
const archive=require(path.resolve(__dirname,'../cloud-migration-readiness.js'));
const tables=['sources','sessions'];
const source=(rows,createdAt='2026-11-18T12:00:00.000Z',owner='owner-1')=>
 JSON.stringify({format:'MYLIFTCOACH-original-account-cloud-archive',version:1,
  accountId:owner,createdAt,tableCount:tables.length,recordCount:rows.length,
  counts:Object.fromEntries(tables.map(t=>[t,rows.filter(r=>r.table===t).length])),
  records:rows});
const row=(id,payload,revision=1,owner='owner-1')=>({table:'sessions',row:{
 id,user_id:owner,source_key:'workoutHistoryV52',payload,revision}});
const inspect=(before,after)=>checkpoint.inspect({baselineText:before,currentText:after,ownerId:'owner-1',
 tables,archiveInspector:archive.inspectArchive});
const early=source([row('session-a',{sets:1})]);
const date='2026-11-19T12:00:00.000Z';
const stable=inspect(early,source([row('session-a',{sets:1})],date));
assert.equal(stable.changes.unchanged,1);
assert.equal(stable.checkpointCompatible,true);
assert.equal(stable.canWrite,false);
const updated=inspect(early,source([row('session-a',{sets:2},2),row('session-b',{sets:1})],date));
assert.equal(updated.changes.changed,1);
assert.equal(updated.changes.added,1);
assert.equal(updated.cloudChanged,true);
const deleteCase=inspect(early,source([],date));
assert.equal(deleteCase.changes.deleted,1);
assert.equal(deleteCase.checkpointCompatible,false);
const anomaly=inspect(early,source([row('session-a',{sets:2},1)],date));
assert.equal(anomaly.changes.revisionAnomalies,1);
assert.equal(anomaly.checkpointCompatible,false);
const reversed=inspect(source([row('session-a',{sets:2},3)]),source([row('session-a',{sets:2},2)],date));
assert.equal(reversed.changes.revisionAnomalies,1);
const invalid=inspect(early,source([row('session-a',{sets:1},null)],date));
assert.equal(invalid.changes.invalidRevision,1);
assert.throws(()=>inspect(early,source([row('session-a',{sets:1})], '2026-11-18T10:00:00.000Z')),/newer/);
assert.throws(()=>inspect(early,source([],date,'owner-2')),/different account/);
const keysOnly=updated.review;
assert.equal(JSON.stringify(keysOnly).includes('"payload"'),false);
assert.equal(checkpoint.stable({a:1,b:2}),checkpoint.stable({b:2,a:1}));
console.log('MYLIFTCOACH cloud checkpoint drift: PASS — revisions, deletion, drift, identity, no writes');