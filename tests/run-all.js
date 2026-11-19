/* One-command offline MYLIFTCOACH 2.0 release-candidate regression runner.
   Run: node tests/run-all.js
   Uses only built-in Node APIs; requires no npm install, cloud login or paid API. */
'use strict';
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const tests=[
 'static-contract.test.js',
 'migration-regression.test.js',
 'coach-regression.test.js',
 'cloud-archive.test.js',
 'cloud-migration-readiness.test.js',
 'cloud-checkpoint-review.test.js',
 'cloud-original-history.test.js',
 'cloud-live-history.test.js',
 'post-workout-media.test.js',
 'legacy-media-review.test.js',
 'weekly-schedule.test.js'
];
for(const test of tests){
 console.log('Running '+test);
 try{
  execFileSync(process.execPath,[path.join(__dirname,test)],{stdio:'inherit',timeout:15000});
 }catch(error){
  console.error('FAIL: '+test);
  process.exitCode=1;
  break;
 }
}
if(!process.exitCode)console.log('MYLIFTCOACH offline release-candidate suite: PASS');
