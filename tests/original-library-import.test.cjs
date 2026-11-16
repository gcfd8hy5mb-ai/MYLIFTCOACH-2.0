'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {build}=require('../imports/build-exercise-catalog.cjs');
test('original exercise library extensions safely extract as pure validated metadata',()=>{
 const {entries,counts}=build();
 assert.equal(counts.length,5);
 assert.ok(entries.length>=250&&entries.length<=400);
 assert.equal(new Set(entries.map(x=>x.id)).size,entries.length);
 assert.ok(entries.some(x=>x.id==='incline-machine-chest-press'));
 assert.ok(entries.some(x=>x.id==='barbell-bench-press'));
 assert.ok(entries.some(x=>x.id==='plate-loaded-incline-press'));
 const pendulum=entries.find(x=>x.id==='pendulum-squat-wide');
 assert.equal(pendulum.equipment,'Machine');
 assert.match(pendulum.how,/wider stance/);
 assert.ok(entries.every(x=>x.id&&x.name&&x.muscle&&x.how));
});
test('legacy DOM installers and styles are not loaded into 2.0 approved design',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.equal(html.includes('imports/source'),false);
 assert.equal(html.includes('liftova-library.js'),false);
});
