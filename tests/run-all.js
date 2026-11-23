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
 'coach-live-workout.test.cjs',
 'coach-autonomous-proposal.test.cjs',
 'coach-live-handoff.test.cjs',
 'coach-autonomous-preferences.test.cjs',
 'calorie-goal-estimate.test.cjs',
 'goal-program-calendar.test.cjs',
 'goal-program-adherence.test.cjs',
 'goal-program-source.test.cjs',
 'program-rotation-scope.test.cjs',
 'home-program-priority.test.cjs',
 'combined-coach-panels.test.cjs',
 'coach-consistent-history.test.cjs',
 'today-program-labels.test.cjs',
 'coach-periodization.test.cjs',
 'replacement-media-merge.test.cjs',
 'coach-program-cloud-backup.test.cjs',
 'coach-catalog-coverage.test.cjs',
 'custom-home-priority.test.cjs',
 'custom-builder-redesign.test.cjs',
 'optional-custom-targets.test.cjs',
 'custom-schedule-cloud-integration.test.cjs',
 'custom-builder-weekday-scheduling.test.cjs',
 'full-week-program-builder.test.cjs',
 'home-weekly-next-session.test.cjs',
 'active-workout-ux.test.cjs',
 'workout-auth-ux-fix.test.cjs',
 'mobile-header-cleanup.test.cjs',
 'more-page.test.cjs',
 'marble-text-readability.test.cjs',
 'compact-workouts.test.cjs',
 'cloud-archive.test.js',
 'cloud-migration-readiness.test.js',
 'cloud-checkpoint-review.test.js',
 'cloud-original-history.test.js',
 'cloud-live-history.test.js',
 'post-workout-media.test.js',
 'legacy-media-review.test.js',
 'weekly-schedule.test.js',
 'sync-journal.test.cjs',
 'supabase-transport.test.cjs',
 'aux-data.test.cjs',
 'completed-workout-bridge.test.cjs',
 'account-workout-store.test.cjs',
 'verified-auth.test.cjs',
 'cloud-session-inspection.test.cjs',
 'account-recovery.test.cjs',
 'account-draft-store.test.cjs',
 'automatic-workouts.test.cjs',
 'concurrent-workout-sync.test.cjs',
 'resume-workout-cta.test.cjs',
 'auxiliary-cloud.test.cjs',
 'auxiliary-revision.test.cjs',
 'auxiliary-preferences.test.cjs',
 'account-custom-scoping.test.cjs',
 'body-photo-owner.test.cjs',
 'beta-access.test.cjs',
 'beta-live-refresh.test.cjs',
 'auth-persistence-iphone.test.cjs',
 'refresh-session.test.cjs',
 'exercise-visuals-344.test.cjs',
 'active-exercise-guide.test.cjs',
 'exercise-instruction-coverage.test.cjs',
 'exercise-instruction-depth.test.cjs',
 'workout-card-images.test.cjs',
 'progress-real-volume.test.cjs',
 'progress-compact.test.cjs',
 'progress-weekly-summary.test.cjs',
 'coach-plan-preview.test.cjs',
 'coach-program-builder.test.cjs',
 'coach-save-custom.test.cjs',
 'coach-weekly-schedule.test.cjs',
 'workout-simulation.test.cjs',
 'workout-simulation-integration.test.cjs',
 'offline-shell.test.cjs',
 'account-write-lock.test.cjs'
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
