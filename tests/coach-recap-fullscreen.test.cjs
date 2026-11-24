'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'coach-recap-fullscreen.css'),'utf8');
const worker=fs.readFileSync(path.join(root,'offline-worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('iPhone Coach recap stylesheet is loaded by the actual offline shell',()=>{
 assert.match(html,/href="\.\/coach-recap-fullscreen\.css\?v=1"/);
 assert.match(worker,/const cacheName = prefix \+ '73'/);
 assert.match(app,/if\(betaView\(\)\.mode==='pro'\)openModal\(liveCoachRecap\(proposed\)\)/);
});
test('styling applies to the recap alone and fills the viewport, including safe areas',()=>{
 assert.match(css,/@media\s*\(max-width:\s*760px\)/);
 assert.match(css,/#modal:has\(#modalContent > \.live-coach-box\)/);
 assert.match(css,/height:\s*100dvh\s*!important/);
 assert.match(css,/max-height:\s*none\s*!important/);
 assert.match(css,/border-radius:\s*0\s*!important/);
 assert.match(css,/overflow-y:\s*auto\s*!important/);
 assert.match(css,/env\(safe-area-inset-top\)/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
});
test('close button visible and existing approved visual assets retained',()=>{
 assert.match(css,/#closeModal\s*\{/);
 assert.match(css,/position:\s*fixed\s*!important/);
 assert.match(css,/approved-vertical-marble-sharp\.webp/);
 assert.match(css,/#e6c286/);
 assert.doesNotMatch(css,/localStorage|supabase|fetch\(/);
});
