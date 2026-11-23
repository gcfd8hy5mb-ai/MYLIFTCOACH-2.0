'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('custom workout editor uses an add-exercise search and editable order without changing stored routine data',()=>{
 const js=read('custom-workouts.js'),css=read('custom-workouts.css'),html=read('index.html');
 assert.ok(html.includes('custom-workouts.css?v=3'));
 for(const id of ['customName','customSelected','customSearch','customOptions','customMuscleFilters','mlc-custom-form'])assert.ok(js.includes(id));
 assert.ok(js.includes('data-custom-exercise'));
 assert.ok(js.includes('data-custom-remove'));
 assert.ok(js.includes('data-custom-up'));
 assert.ok(js.includes('data-custom-down'));
 assert.ok(js.includes("ids:[...selected]"));
 assert.ok(js.includes('persistPlans(next)'));
 assert.ok(js.includes('editorOwner!==owner'));
 assert.match(css,/\.custom-editor-dialog\{[\s\S]*background:#04252d!important/);
 assert.match(css,/\.custom-editor-filters button\[aria-pressed=true\]/);
});
