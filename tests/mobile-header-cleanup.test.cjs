'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=load('mobile-header-cleanup.css');
const html=load('index.html');
const app=load('app.js');
test('iPhone topbar is removed without changing desktop navigation',()=>{
 assert.match(css,/@media \(max-width:760px\)/);
 assert.match(css,/\.topbar\{[\s\S]*?display:none!important/);
 assert.ok(html.includes('mobile-header-cleanup.css?v=1'));
 assert.ok(html.includes('MYLIFTCOACH 2.0 · iPhone beta'));
});
test('mobile Settings stays reachable through fixed More bottom tab',()=>{
 assert.match(html,/<nav class="bottom-tabs"[^>]*>[\s\S]*?<button data-page="settings"[^>]*>[\s\S]*?<small>More<\/small>/);
 assert.match(app,/document\.querySelectorAll\('\[data-page\]'\)\.forEach\(el=>el\.addEventListener\('click',\(\)=>setPage\(el\.dataset\.page\)\)\)/);
 assert.match(css,/\.bottom-tabs\{[\s\S]*?position:fixed!important/);
 assert.match(css,/env\(safe-area-inset-top\)/);
});
test('login, cloud saving, and workout draft flow remain connected',()=>{
 assert.match(app,/function openSignIn\(\)/);
 assert.match(app,/queueWorkoutForSync\(entry\)/);
 assert.match(app,/window\.MLC2SessionDraft\.save\(draft,plan,next\)/);
});
