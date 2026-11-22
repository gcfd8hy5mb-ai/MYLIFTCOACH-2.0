'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Beta=require('../beta-access.js');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf(" $('betaAccessSelect').addEventListener('change',");
const end=app.indexOf(" $('autoWorkoutSyncNow').addEventListener(",start);
assert.ok(start>=0&&end>start,'Beta switching handler must remain in Settings');
const handler=app.slice(start,end);
test('Guest Free/Pro switches refresh Home and Today on the same screen',()=>{
 const marker="preview enabled for this browser session";
 assert.ok(handler.includes(marker));
 assert.match(handler,/renderHome\(\);renderWorkouts\(\);renderCoach\(\)/);
});
test('Verified Free/Pro switch re-fetches using refreshed account token',()=>{
 assert.match(handler,/currentSession=await sessionRefresh\.sessionFor\(selectedOwner\)/);
 assert.match(handler,/authRequest\('user',null,currentSession\.access_token,'GET'\)/);
 assert.match(handler,/current\.user_metadata\?\.\[window\.MLC2BetaAccess\.FIELD\]!==requested/);
 assert.match(handler,/epoch!==authEpoch\|\|current\?\.id!==selectedOwner/);
 assert.match(handler,/renderHome\(\);renderWorkouts\(\);renderCoach\(\)/);
});
test('Beta switching never clears saved workout history, drafts or custom workouts',()=>{
 assert.doesNotMatch(handler,/MLC2AccountWorkouts\.save|MLC2SessionDraft\.clear|removeItem\(|MLC2Custom\.delete/);
});
test('Free and Pro remain preview capabilities and never imply paid access',()=>{
 const owner={id:'member-a',user_metadata:{[Beta.FIELD]:'pro'}};
 assert.equal(Beta.resolve(owner).paidSubscription,false);
 assert.equal(Beta.resolve({...owner,user_metadata:{[Beta.FIELD]:'free'}}).mode,'free');
});
