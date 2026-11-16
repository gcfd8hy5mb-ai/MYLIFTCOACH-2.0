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
 // Check the complete original library is present and searchable on mobile.
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="library"]').click();
 await page.locator('#library').waitFor({state:'visible'});
 assert.ok(await page.locator('#libraryResultsCount').innerText().then(x=>Number(x.split(' ')[0])>=341));
 await page.locator('#exerciseSearch').fill('Wide-Stance Pendulum Squat');
 assert.match(await page.locator('#libraryGrid').innerText(),/Wide-Stance Pendulum Squat/);
 await page.locator('#libraryGrid details summary').first().click();
 assert.match(await page.locator('#libraryGrid').innerText(),/wider stance/);
 await page.locator('#exerciseSearch').fill('');
 await page.locator('#libraryEquipment').selectOption('Cable');
 assert.match(await page.locator('#libraryGrid').innerText(),/Cable/);
 await page.locator('#libraryEquipment').selectOption('');
 // Exercise new device-only features and their persisted records.
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="manage"]').click();
 await page.locator('#customWorkoutName').fill('My test routine');
 await page.locator('#customExerciseSearch').fill('Plate-Loaded Incline Chest Press');
 await page.locator('#customExerciseOptions input[value="plate-loaded-incline-press"]').check();
 await page.locator('#customExerciseSearch').fill('Machine Chest Press');
 await page.locator('#customExerciseOptions input[value="chest-press"]').check();
 assert.match(await page.locator('#customExerciseCount').innerText(),/2 selected/);
 await page.locator('#customWorkoutForm button[type="submit"]').click();
 assert.match(await page.locator('#customWorkoutList').innerText(),/My test routine/);
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-custom-plans-v1'))[0].ids.includes('plate-loaded-incline-press')),'Imported ID must persist in a custom plan');

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
 // Mocks all new 2.0 RPCs; no production Supabase writes.
 // Real people must confirm before upload or restore; the test explicitly accepts.
 page.on('dialog',dialog=>dialog.accept());
 const cloudSaved=new Map();let commits=0,failNextCommit=false;const triedOpIds=[];
 await page.route('**/rest/v1/rpc/mlc2_v1_*',async route=>{
  const url=new URL(route.request().url()),body=route.request().postDataJSON();
  const owner='user-a';
  if(url.pathname.endsWith('mlc2_v1_list_sessions')){
   const rows=[...cloudSaved.values()].filter(x=>x.type==='session'&&x.id>body.p_after_id).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,body.p_limit);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});return;
  }
  if(url.pathname.endsWith('mlc2_v1_read')){
   const row=cloudSaved.get(body.p_type+':'+body.p_record_id)||null;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(row)});return;
  }
  if(url.pathname.endsWith('mlc2_v1_commit')){
   commits++;
   triedOpIds.push(body.p_op_id);
   if(failNextCommit){
    failNextCommit=false;
    await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Temporary service outage"}'});return;
   }
   const id=body.p_record_id,key=body.p_type+':'+id;
   if(cloudSaved.has(key)){await route.fulfill({status:409,contentType:'application/json',body:'{"code":"PT409","message":"MLC2_REVISION_CONFLICT"}'});return}
   cloudSaved.set(key,{owner,type:body.p_type,id,revision:1,deleted:false,payload:body.p_payload});
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({owner,opId:body.p_op_id,revision:1})});return;
  }
  await route.fulfill({status:404,body:'{}'});
 });
 let fakeOwner='user-a',failAuth=false,refreshCalls=0,recoveryCalls=0,logoutCalls=0;
 await page.route('**/auth/v1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/recover')){
   recoveryCalls++;
   await route.fulfill({status:200,contentType:'application/json',body:'{}'});return;
  }
  if(url.pathname.endsWith('/logout')){
   logoutCalls++;
   await route.fulfill({status:204,body:''});return;
  }
  if(url.pathname.endsWith('/token')){
   const body=route.request().postDataJSON();
   if(url.searchParams.get('grant_type')==='refresh_token'){
    refreshCalls++;
    const who=String(body?.refresh_token||'').includes('user-b')?'user-b':'user-a';
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     access_token:'test-token-'+who+'-refreshed',refresh_token:'test-refresh-'+who,
     expires_in:3600,token_type:'bearer',user:{id:who,email:who==='user-a'?'a@example.test':'b@example.test'}
    })});return;
   }
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
 assert.match(await page.locator('#cloudSyncStatus').innerText(),/Sign in to enable automatic workout sync/i);
 await page.locator('#authAction').click();
 // Original-app style forgot-password flow uses same verified PRISM Auth endpoint.
 await page.locator('#forgotPassword').click();
 await page.locator('#resetPasswordForm input[name="email"]').fill('a@example.test');
 await page.locator('#resetPasswordSubmit').click();
 await page.waitForFunction(()=>document.getElementById('resetPasswordStatus')?.textContent.includes('recovery link'));
 assert.equal(recoveryCalls,1);
 await page.locator('#resetBackToLogin').click();
 await page.locator('#loginForm input[name="email"]').fill('a@example.test');
 await page.locator('#loginForm input[name="password"]').fill('test-password');
 await page.locator('#loginSubmit').click();
 await page.locator('#home').waitFor({state:'visible'});
 await page.locator('#heroStart').click();
 await page.locator('[data-addset="chest-press"]').click();
 await page.locator('#finishWorkout').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),1);
 await page.waitForFunction(()=>document.getElementById('autoSyncStatus').textContent.includes('Up to date'));
 assert.equal(commits,1,'Completed signed-in session uploads automatically');
 assert.equal(cloudSaved.size,1);
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 assert.match(await page.locator('#syncHealth').innerText(),/0 pending uploads · Last verified:/);
 await page.locator('#authAction').click(); // server logout + local isolation
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('Not signed in'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-auth-session-v1')),null);
 assert.equal(logoutCalls,1);
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
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('Not signed in'));
 await page.locator('#authAction').click();
 await page.locator('#loginForm input[name="email"]').fill('a@example.test');
 await page.locator('#loginForm input[name="password"]').fill('test-password');
 await page.locator('#loginSubmit').click();
 await page.locator('#home').waitFor({state:'visible'});
 await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('mlc2-auth-session-v1')).user.id==='user-a'}catch{return false}});
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),1);
 // After a cold reload the original-style persistent session should be verified.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('a@example.test'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-auth-session-v1')!==null),true);
 // Force expiry to test refresh-token rotation without re-entering password.
 await page.evaluate(()=>{const k='mlc2-auth-session-v1',a=JSON.parse(localStorage.getItem(k));a.expires_at=1;localStorage.setItem(k,JSON.stringify(a))});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('a@example.test'));
 assert.equal(refreshCalls,1);
 failAuth=true; // Reopen while authentication endpoint is temporarily unavailable.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#home').waitFor({state:'visible'});
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 await page.waitForTimeout(1400);
 const authDiagnostic=await page.evaluate(()=>({
  status:document.getElementById('cloudSyncStatus').textContent,
  identity:document.getElementById('accountIdentity').textContent,
  stored:!!localStorage.getItem('mlc2-auth-session-v1'),
  pill:document.getElementById('backendStatus').textContent
 }));
 console.log('Offline auth diagnostic:',JSON.stringify(authDiagnostic));
 assert.equal(authDiagnostic.stored,true,'Transient auth failure should not delete tokens');
 assert.doesNotMatch(authDiagnostic.identity,/a@example.test/,'Unverified account must not expose scoped data');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')!==null),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-auth-session-v1')!==null),true);
 await mobile.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 assert.match(await page.locator('#connectivityStatus').innerText(),/Offline/);
 failAuth=false;
 await mobile.setOffline(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('a@example.test'));
 assert.match(await page.locator('#cloudSyncStatus').innerText(),/Automatic workout sync/i);

 await page.locator('#cloudUploadSessions').click();
 await page.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('1 already saved'));
 const cloudDiagnostic=await page.locator('#cloudActionStatus').innerText();
 console.log('Manual cloud upload diagnostic:',cloudDiagnostic,'RPC commits:',commits);
 assert.equal(commits,1,'Manual upload must not duplicate automatic sync');
 assert.equal(cloudSaved.size,1);
 await page.locator('#cloudUploadSessions').click();
 await page.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('1 already saved'));
 assert.equal(commits,1,'Already uploaded workout must not be uploaded twice');
 // Simulate a fresh device that has no local workout history (test account only).
 await page.evaluate(()=>localStorage.removeItem('mlc2-demo-workouts-v1:user:user-a'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('accountIdentity').textContent.includes('a@example.test'));
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 await page.locator('#cloudRestoreSessions').click();
 await page.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('Restored 1'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),1);
 assert.equal(commits,1,'Recovery must not create new cloud writes');

 // An offline workout is saved to the device and queued without cloud calls.
 await mobile.setOffline(true);
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="workouts"]').click();
 // Select Upper Body A explicitly; the dynamic Today card may rotate to legs
 // after the previous completed workout, so chest-press may not be present there.
 await page.locator('#workoutGrid [data-workout="upper-a"]').click();
 await page.locator('[data-exercise-card="chest-press"] [data-weight]').fill('80');
 await page.locator('[data-exercise-card="chest-press"] [data-reps]').fill('8');
 await page.locator('[data-addset="chest-press"]').click();
 await page.locator('#finishWorkout').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),2);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-sync-journal-v1:user-a')||'{}').items.filter(x=>x.status==='queued').length),1);
 assert.equal(commits,1,'Offline completion must not attempt cloud writes');
 await mobile.setOffline(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>document.getElementById('autoSyncStatus').textContent.includes('Up to date'));
 assert.equal(commits,2,'A queued offline workout should upload exactly once');
 assert.equal(cloudSaved.size,2);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-sync-journal-v1:user-a')||'{}').items.length),0);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('autoSyncStatus').textContent.includes('Up to date'));
 assert.equal(commits,2,'Reload must not duplicate cloud workouts');

 assert.match(await page.locator('#syncHealth').innerText(),/0 pending uploads/);
 // A temporary server outage must preserve the exact operation ID and all sets.
 failNextCommit=true;
 await page.locator('#homeMenuBtn').click();
 await page.locator('#sidebar [data-page="workouts"]').click();
 await page.locator('#workoutGrid [data-workout="upper-a"]').click();
 await page.locator('[data-exercise-card="chest-press"] [data-weight]').fill('90');
 await page.locator('[data-exercise-card="chest-press"] [data-reps]').fill('7');
 await page.locator('[data-addset="chest-press"]').click();
 await page.locator('#finishWorkout').click();
 await page.waitForFunction(()=>document.getElementById('autoSyncStatus').textContent.includes('retry scheduled'));
 const failedOp=triedOpIds.at(-1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-sync-journal-v1:user-a')).items.length),1);
 assert.equal(cloudSaved.size,2,'Failed upload must not mark workout as cloud-saved');
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>document.getElementById('autoSyncStatus').textContent.includes('Up to date'));
 assert.equal(triedOpIds.at(-1),failedOp,'Retry must keep the same operation ID');
 assert.equal(cloudSaved.size,3);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-sync-journal-v1:user-a')).items.length),0);

 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();


 await page.locator('#backupPreview').click();
 // Export is read-only and never includes credentials.
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')!==null),true);
 // Explicit backup of five non-session categories: original PRISM records untouched.
 await page.evaluate(()=>{
  const owner=':user:user-a';
  const records={
   'mlc2-custom-plans-v1':[{id:'custom-alpha',title:'Strength Day',ids:['chest-press'],kind:'Custom',description:'Safe test'}],
   'mlc2-measurements-v1':[{id:'m-alpha',day:'2026-11-15',values:{waist:34}}],
   'mlc2-local-daily-v1':[{id:'t-alpha',day:'2026-11-15',type:'water',value:300}],
   'mlc2-food-log-v1':[{id:'food-alpha',name:'Breakfast',day:'2026-11-15',calories:300,protein:20,carbs:35,fat:8}],
   'mlc2-food-goals-v1':{calories:2300,protein:140}
  };
  for(const [key,value] of Object.entries(records))localStorage.setItem(key+owner,JSON.stringify(value));
 });
 await page.locator('#backupOtherData').click();
 await page.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('Other data backup:'));
 assert.equal(cloudSaved.size,8,'Five auxiliary categories should back up separately from three workouts');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-custom-plans-v1:user:user-a'))[0].id),'custom-alpha');
 await page.locator('#backupOtherData').click();
 await page.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('5 unchanged/empty'));
 assert.equal(cloudSaved.size,8,'Repeat other-data backup must never duplicate a record');
 // Saved-app update checker detects newer HTML without forcing a reload.
 await page.evaluate(()=>{
  const marker=document.createElement('div');
  marker.id='previewRevision';marker.textContent='PREVIEW FIX 15';
  document.body.appendChild(marker);
 });
 await page.route('**/index.html?update-check=*',async route=>{
  await route.fulfill({status:200,contentType:'text/html',body:'<html><body>PREVIEW FIX 16</body></html>'});
 });
 const priorUrl=page.url();
 await page.locator('#checkPreviewUpdate').click();
 await page.waitForFunction(()=>document.getElementById('previewUpdateStatus').textContent.includes('Fix 16 is available'));
 assert.equal(page.url(),priorUrl,'Preview update check must not interrupt the current screen');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-food-goals-v1:user:user-a')).protein),140);

 // Update opening must be blocked while there is an unfinished active workout.
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="workouts"]').click();
 await page.locator('#workoutGrid [data-workout="upper-a"]').click();
 await page.locator('[data-exercise-card="chest-press"] [data-weight]').fill('70');
 await page.locator('[data-exercise-card="chest-press"] [data-reps]').fill('9');
 await page.locator('[data-addset="chest-press"]').click();
 const draftBeforeUpdate=await page.evaluate(()=>localStorage.getItem('mlc2-active-session-v1:user-a'));
 await page.locator('#closeModal').click();
 await page.locator('#menuBtn').click();
 await page.locator('#sidebar [data-page="settings"]').click();
 await page.locator('#checkPreviewUpdate').click();
 assert.equal(page.url(),priorUrl,'Never leave app while a workout is active');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mlc2-active-session-v1:user-a')),draftBeforeUpdate,'Update must not change the saved workout draft');

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
 // This desktop context has independent browser storage and no workout data.
 // Same account credentials must show remote history as recoverable, then
 // restore only after confirmation, without removing anything from iPhone.
 await desk.route('**/auth/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/token')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    access_token:'desktop-test-a',refresh_token:'desktop-refresh-a',expires_in:3600,
    user:{id:'user-a',email:'a@example.test'}
   })});return;
  }
  if(path.endsWith('/user')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'user-a',email:'a@example.test'})});return;
  }
  await route.fulfill({status:401,body:'{}'});
 });
 await desk.route('**/rest/v1/rpc/mlc2_v1_*',async route=>{
  const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
  if(path.endsWith('mlc2_v1_list_sessions')){
   const rows=[...cloudSaved.values()].filter(x=>x.type==='session'&&x.id>body.p_after_id).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,body.p_limit);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});return;
  }
  if(path.endsWith('mlc2_v1_read')){
   const row=cloudSaved.get(body.p_type+':'+body.p_record_id)||null;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(row)});return;
  }
  throw Error('Second-device recovery attempted an unexpected cloud write');
 });
 desk.on('dialog',dialog=>dialog.accept());
 await desk.locator('#sidebar [data-page="settings"]').click();
 await desk.locator('#authAction').click();
 await desk.locator('#loginForm input[name="email"]').fill('a@example.test');
 await desk.locator('#loginForm input[name="password"]').fill('test-password');
 await desk.locator('#loginSubmit').click();
 await desk.waitForFunction(()=>document.getElementById('autoSyncStatus').textContent.includes('cloud workouts available'));
 assert.equal(await desk.evaluate(()=>localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')),null,'Second device must not auto-import remote history');
 await desk.locator('#sidebar [data-page="settings"]').click();
 await desk.locator('#cloudRestoreSessions').click();
 await desk.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('Restored 3'));
 assert.equal(await desk.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),3);
 assert.equal(commits,9,'Five additional categories should upload once and recovery should upload nothing');
 await desk.locator('#recoverOtherData').click();
 await desk.waitForFunction(()=>document.getElementById('cloudActionStatus').textContent.includes('Recovered Custom workouts'));
 assert.equal(await desk.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-measurements-v1:user:user-a'))[0].id),'m-alpha');
 assert.equal(await desk.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-food-goals-v1:user:user-a')).calories),2300);
 assert.equal(await desk.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-local-daily-v1:user:user-a'))[0].value),300);
 assert.equal(commits,9,'Auxiliary recovery should be read-only');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1:user:user-a')||'[]').length),3,'Original device must retain its data');
 assert.deepEqual(errors,[], 'JavaScript page errors detected');
 console.log('PASS: mobile Home/sidebar/calendar/timer/custom-plans/measurements/nutrition and desktop Home/Workouts');
 await desktop.close();await mobile.close();
}finally{await browser.close()}
