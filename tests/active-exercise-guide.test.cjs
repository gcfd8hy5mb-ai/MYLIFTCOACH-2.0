'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('interactive guide scripts parse and are included after application',()=>{
 const js=read('active-exercise-guide.js');
 assert.doesNotThrow(()=>new vm.Script(js));
 const html=read('index.html');
 assert.ok(html.includes('active-exercise-guide.css'));
 assert.ok(html.includes('active-exercise-guide.js'));
 assert.ok(html.indexOf('app.js?v=15')<html.indexOf('active-exercise-guide.js'));
});
test('guide attaches to dynamically created workout modal without touching tracking',()=>{
 const js=read('active-exercise-guide.js');
 assert.ok(js.includes("document.getElementById('modalContent')"));
 assert.ok(js.includes("document.getElementById('workoutLog')"));
 assert.ok(js.includes('observer.observe(modalContent,{childList:true,subtree:true})'));
 assert.ok(js.includes("if(card.querySelector('.mlc-guide-wrap'))continue"));
 assert.ok(js.includes("other.hidden=true"));
 assert.ok(js.includes("aria-expanded"));
 assert.ok(js.includes("lastTrigger?.focus()"));
 assert.ok(!/\b(localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|supabase)\b/.test(js));
});
test('approved images and IMAGE COMING placeholder have correct behavior',()=>{
 const js=read('active-exercise-guide.js'),css=read('active-exercise-guide.css');
 assert.ok(js.includes('assets/image-coming-approved.webp'));
 assert.ok(js.includes('demo?.status===\'approved\''));
 assert.ok(js.includes('View Full Guide'));
 assert.ok(js.includes('How to Perform'));
 assert.ok(js.includes('Common Mistakes'));
 assert.ok(css.includes('mlc-guide-thumb-frame'));
 assert.ok(css.includes('height:200%'));
 assert.ok(css.includes('mlc-guide-overlay'));
});
