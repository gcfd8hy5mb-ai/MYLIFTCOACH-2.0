'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Store=require('../sync/auth-session-store.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const makeStorage=()=>{
 const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,
 setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
};
const validSession=()=>({access_token:'test-access-token-0123456789',
 refresh_token:'test-refresh-token-0123456789',
 expires_at:1890000000,user:{id:'01dd6900-ccda-4fd1-9c1a-123456789abc',email:'someone@example.com'}});
test('signed-in state persists across iPhone reload even when sessionStorage is fresh',()=>{
 const previous=makeStorage(),persistent=makeStorage(),session=validSession();
 assert.equal(Store.save(previous,persistent,session),true);
 const nextPage=makeStorage();
 assert.deepEqual(Store.read(nextPage,persistent),session);
});
test('explicit sign-out clears both session and persistent storage',()=>{
 const a=makeStorage(),b=makeStorage();Store.save(a,b,validSession());
 Store.clear(a,b);
 assert.equal(Store.read(a,b),null);
});
test('corrupt or foreign keys cannot create an authenticated session',()=>{
 const a=makeStorage(),b=makeStorage();
 b.setItem(Store.KEY,'{"access_token":"a","user":{"id":"bad"}}');
 assert.equal(Store.read(a,b),null);
 assert.throws(()=>Store.save(a,b,{user:{id:'wrong'}}),/Invalid/);
});
test('account session can be stored when sessionStorage is unavailable',()=>{
 const broken={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')},removeItem:()=>{throw Error('blocked')}};
 const persistent=makeStorage();
 assert.equal(Store.save(broken,persistent,validSession()),true);
 assert.equal(Store.read(broken,persistent).user.id,validSession().user.id);
 Store.clear(broken,persistent);
 assert.equal(Store.read(broken,persistent),null);
});
test('store never authorizes cloud access before Supabase user verification',()=>{
 assert.match(app,/const user=await authRequest\('user',null,candidate.access_token,'GET'\)/);
 assert.match(app,/if\(!user\?\.id\|\|user.id!==saved.user.id\)/);
 assert.match(app,/authStore.save\(sessionStorage,localStorage,candidate\);\s*auth=candidate;account=user;switchWorkoutOwner\(user.id\)/);
 assert.match(app,/if\(\[400,401,403\]\.includes\(err\?\.status\)\)/);
 assert.match(app,/authEpoch\+\+;saveAuth\(\{\.\.\.response,user:verified\}\);switchWorkoutOwner\(verified.id\)/);
});
test('old production auth key never used or overwritten',()=>{
 assert.equal(Store.KEY,'mlc2-auth-session-v1');
 assert.ok(!app.includes('sb-')||app.includes('sb_publishable_'));
 assert.match(app,/authStore.clear\(sessionStorage,localStorage\)/);
});
