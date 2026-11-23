'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('marble copy is readable with no new panels or altered fixed background',()=>{
 const html=read('index.html'),css=read('marble-text-readability.css');
 assert.ok(html.includes('marble-text-readability.css?v=1'));
 assert.ok(html.indexOf('more-page.css?v=2')<html.indexOf('marble-text-readability.css?v=1'));
 assert.match(css,/\.content \.page > \.page-heading/);
 assert.match(css,/#home \.safety-note/);
 assert.match(css,/#workouts \.workout-today-note/);
 assert.match(css,/radial-gradient/);
 assert.match(css,/text-shadow:/);
 assert.match(css,/color:var\(--mlc-marble-text\)!important/);
 assert.doesNotMatch(css,/background-attachment\s*:|\.modal-panel|\.workout-compact-card/);
});
