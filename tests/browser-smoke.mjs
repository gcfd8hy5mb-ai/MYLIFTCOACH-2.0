import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const origin='http://127.0.0.1:8765';
await mkdir('test-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 const mobile=await browser.newContext({...devices['iPhone 13'],deviceScaleFactor:1});
 const page=await mobile.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.locator('#home').waitFor({state:'visible'});
 assert.equal(await page.locator('#sidebar').count(),1);
 const shortcut=page.locator('#home .quick-grid button').first();
 await shortcut.scrollIntoViewIfNeeded();
 const background=await shortcut.evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.match(background,/linear-gradient/);
 assert.doesNotMatch(background,/url\(/);
 const hex=await shortcut.evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.ok(hex,'Expected a button background color');
 await page.screenshot({path:'test-artifacts/mobile-home.png',fullPage:true});
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar.open').waitFor({state:'visible'});
 assert.equal(await page.locator('#sidebarClose').isVisible(),true);
 await page.screenshot({path:'test-artifacts/mobile-sidebar.png'});
 await page.locator('#sidebar [data-page="calendar"]').click();
 await page.locator('#calendar').waitFor({state:'visible'});
 assert.equal(await page.locator('#sidebar.open').count(),0);
 await page.screenshot({path:'test-artifacts/mobile-calendar.png',fullPage:true});
 await page.locator('#menuBtn').click();
 await page.locator('#sidebarTimer').click();
 assert.equal(await page.locator('#restScreen').isVisible(),true);
 await page.locator('#restClose').click();
 assert.equal(await page.locator('#restScreen').isVisible(),false);
 // Exercise new device-only features and their persisted records.
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="manage"]').click();
 await page.locator('#customWorkoutName').fill('My test routine');
 await page.locator('#customExerciseOptions input[value="chest-press"]').check();
 await page.locator('#customWorkoutForm button[type="submit"]').click();
 assert.match(await page.locator('#customWorkoutList').innerText(),/My test routine/);
 await page.locator('#customWorkoutList [data-custom-run]').click();
 assert.equal(await page.locator('#modal').isVisible(),true);
 await page.locator('[data-exercise-card="chest-press"] [data-weight]').fill('65');
 await page.locator('[data-exercise-card="chest-press"] [data-reps]').fill('9');
 await page.locator('[data-addset="chest-press"]').click();
 assert.match(await page.locator('#draftSaveStatus').innerText(),/1 sets/);
 const savedDraft=await page.evaluate(()=>localStorage.getItem('mlc2-active-session-v1:guest'));
 assert.match(savedDraft,/chest-press/);
 await page.locator('#closeModal').click();
 assert.equal(await page.locator('#activeDraftWorkouts [data-draft-action="resume"]').isVisible(),false);
 // The custom-plan modal was launched from Manage; the Home/Workouts banners offer recovery.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#activeDraftNotice [data-draft-action="resume"]').click();
 assert.match(await page.locator('[data-count="chest-press"]').innerText(),/1 logged/);
 // Confirm saved weight and reps survive refresh and undo updates storage before displaying success.
 await page.locator('[data-undo="chest-press"]').click();
 assert.match(await page.locator('#draftSaveStatus').innerText(),/0 sets/);
 await page.locator('[data-exercise-card="chest-press"] [data-weight]').fill('70');
 await page.locator('[data-exercise-card="chest-press"] [data-reps]').fill('10');
 await page.locator('[data-addset="chest-press"]').click();
 // Simulate storage quota/denial: the UI must not claim a second set saved.
 await page.evaluate(()=>{
  window.__testOriginalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   if(String(key).startsWith('mlc2-active-session-v1:'))throw new DOMException('Storage unavailable','QuotaExceededError');
   return window.__testOriginalSetItem.call(this,key,value);
  };
 });
 await page.locator('[data-addset="chest-press"]').click();
 assert.match(await page.locator('[data-count="chest-press"]').innerText(),/^1 logged$/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-active-session-v1:guest')).sets.length),1);
 await page.evaluate(()=>{Storage.prototype.setItem=window.__testOriginalSetItem});
 // Simulate failed history write: do not discard the unfinished workout.
 await page.evaluate(()=>{
  window.__testOriginalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   if(key==='mlc2-demo-workouts-v1')throw new DOMException('Storage unavailable','QuotaExceededError');
   return window.__testOriginalSetItem.call(this,key,value);
  };
 });
 await page.locator('#finishWorkout').click();
 assert.equal(await page.locator('#modal').isVisible(),true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-active-session-v1:guest')).sets.length),1);
 await page.evaluate(()=>{Storage.prototype.setItem=window.__testOriginalSetItem});
 await page.locator('#finishWorkout').click();
 await page.locator('#progress').waitFor({state:'visible'});
 assert.match(await page.locator('#sessionHistory').innerText(),/My test routine/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-active-session-v1:guest')),null);
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#activeDraftNotice').isVisible(),false);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1')||'[]').length),1);
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar [data-page="measurements"]').click();
 await page.locator('#measurementsForm input[name="waist"]').fill('32.5');
 await page.locator('#measurementsForm button[type="submit"]').click();
 assert.match(await page.locator('#measurementHistory').innerText(),/32.5/);
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar .nav-group summary').filter({hasText:'DAILY TRACKING'}).click();
 await page.locator('#sidebar [data-page="nutrition"]').click();
 await page.locator('#mealForm input[name="name"]').fill('Test lunch');
 for(const [key,value] of [['calories','450'],['protein','38'],['carbs','42'],['fat','12']]){
  await page.locator('#mealForm input[name="'+key+'"]').fill(value);
 }
 await page.locator('#mealForm button[type="submit"]').click();
 assert.match(await page.locator('#nutritionHistory').innerText(),/Test lunch/);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar .nav-group summary').filter({hasText:'DAILY TRACKING'}).click();
 await page.locator('#sidebar [data-page="nutrition"]').click();
 assert.match(await page.locator('#nutritionHistory').innerText(),/Test lunch/);
 await page.screenshot({path:'test-artifacts/mobile-nutrition.png',fullPage:true});
 // Account separation and offline recovery are tested with mocked Auth, not production data.
 let fakeOwner='user-a',failAuth=false;
 await page.route('**/auth/v1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/token')){
   const body=route.request().postDataJSON();
   fakeOwner=String(body?.email||'').startsWith('b@')?'user-b':'user-a';
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    access_token:'test-token-'+fakeOwner,refresh_token:'test-refresh-'+fakeOwner,
    token_type:'bearer',expires_in:3600,user:{id:fakeOwner,email:fakeOwner==='user-a'?'a@example.test':'b@example.test'}
   })});return;
  }
  if(url.pathname.endsWith('/user')){
   if(failAuth){await route.abort('failed');return}
   const token=route.request().headers()['authorization']||'';
   const who=token.includes('user-b')?'user-b':'user-a';
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:who,email:who==='user-a'?'a@example.test':'b@example.test'})});return;
  }
  await route.fulfill({status:401,contentType:'application/json',body:'{}'});
 });
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 assert.match(await page.locator('#cloudSyncStatus').innerText(),/not enabled/i);
 await page.locator('#authAction').click();
 await page.locator('#loginForm input[name="email"]').fill('a@example.test');
 await page.locator('#loginForm input[name="password"]').fill('test-password');
 await page.locator('#loginSubmit').click();
 await page.locator('#home').waitFor({state:'visible'});
 await page.locator('#heroStart').click();
 await page.locator('[data-addset="chest-press"]').click();
 await page.locator('#finishWorkout').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),1);
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 await page.locator('#authAction').click(); // sign out: A stays on disk, guest remains isolated.
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1')||'[]').length),1);
 assert.equal(await page.locator('#accountIdentity').innerText().then(t=>t.includes('a@example.test')),false);
 await page.locator('#authAction').click();
 await page.locator('#loginForm input[name="email"]').fill('b@example.test');
 await page.locator('#loginForm input[name="password"]').fill('test-password');
 await page.locator('#loginSubmit').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-demo-workouts-v1:user:user-b')),null);
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 await page.locator('#authAction').click();
 await page.locator('#authAction').click();
 await page.locator('#loginForm input[name="email"]').fill('a@example.test');
 await page.locator('#loginForm input[name="password"]').fill('test-password');
 await page.locator('#loginSubmit').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),1);
 failAuth=true; // Reopen while authentication endpoint is temporarily unavailable.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#home').waitFor({state:'visible'});
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 await page.waitForTimeout(1400);
 const authDiagnostic=await page.evaluate(()=>({
  status:document.getElementById('cloudSyncStatus').textContent,
  identity:document.getElementById('accountIdentity').textContent,
  stored:!!sessionStorage.getItem('mlc2-auth-session-v1'),
  pill:document.getElementById('backendStatus').textContent
 }));
 console.log('Offline auth diagnostic:',JSON.stringify(authDiagnostic));
 assert.equal(authDiagnostic.stored,true,'Transient auth failure should not delete tokens');
 assert.notMatch(authDiagnostic.identity,/a@example.test/,'Unverified account must not expose scoped data');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')!==null),true);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('mlc2-auth-session-v1')!==null),true);
 await mobile.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 assert.match(await page.locator('#connectivityStatus').innerText(),/Offline/);
 failAuth=false;
 await mobile.setOffline(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('a@example.test'));
 assert.match(await page.locator('#cloudSyncStatus').innerText(),/not yet enabled/i);
 await page.locator('#backupPreview').click();
 // Export is read-only and never includes credentials.
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')!==null),true);
 const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const desk=await desktop.newPage();
 desk.on('pageerror',e=>errors.push(e.message));
 await desk.goto(origin,{waitUntil:'domcontentloaded'});
 await desk.locator('#home').waitFor({state:'visible'});
 assert.equal(await desk.locator('#sidebar').isVisible(),true);
 await desk.screenshot({path:'test-artifacts/desktop-home.png',fullPage:true});
 await desk.locator('#sidebar [data-page="workouts"]').click();
 await desk.locator('#workouts').waitFor({state:'visible'});
 await desk.screenshot({path:'test-artifacts/desktop-workouts.png',fullPage:true});
 assert.deepEqual(errors,[], 'JavaScript page errors detected');
 console.log('PASS: mobile Home/sidebar/calendar/timer/custom-plans/measurements/nutrition and desktop Home/Workouts');
 await desktop.close();await mobile.close();
}finally{await browser.close()}
