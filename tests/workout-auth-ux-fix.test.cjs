'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('app.js'),html=read('index.html'),css=read('workout-auth-ux-fix.css');
test('Login opens the auth-specific fullscreen modal without changing workout modal',()=>{
 assert.match(app,/function openSignIn\(\)/);
 assert.match(app,/\$\('modal'\)\.classList\.add\('auth-fullscreen'\)/);
 assert.match(app,/function closeModal\(\).*?classList\.remove\('auth-fullscreen'\)/);
 assert.match(app,/function openWorkout\(id\)\{\s*\$\('modal'\)\.classList\.remove\('auth-fullscreen'\)/);
 assert.match(css,/#modal\.auth-fullscreen/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/max-height:100dvh!important/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(css,/font-size:16px!important/);
 assert.match(css,/#modal\.auth-fullscreen\s*\{[\s\S]*?approved-vertical-marble-sharp\.webp/);
 assert.match(css,/background-size:cover!important/);
 assert.match(css,/rgba\(4,45,51,\.30\)/);
 assert.doesNotMatch(css,/background:linear-gradient\(155deg,#0c484c/);
});
test('workout cards, selection actions and weekly schedule share dark teal styling',()=>{
 for(const selector of ['#workouts .workout-card','#workouts .custom-plan-actions button','#workouts .mlc-weekly-schedule-grid select']){
  assert.ok(css.includes(selector),'missing dark styling for '+selector);
 }
 assert.ok(css.includes('background:#042b31!important'));
 assert.ok(css.includes('color:#f6e7c9!important'));
 assert.ok(html.includes('workout-auth-ux-fix.css?v=2'));
 assert.ok(html.includes('app.js?v=16'));
});
test('login fix preserves verified Supabase sign-in workflow and workout cloud upload',()=>{
 assert.match(app,/authRequest\('token\?grant_type=password'/);
 assert.match(app,/authRequest\('user',null,response.access_token,'GET'\)/);
 assert.match(app,/queueWorkoutForSync\(entry\)/);
 assert.match(app,/window\.MLC2SessionDraft\?\.save\(activeDraftStore,activePlan,session.sets\)/);
});
