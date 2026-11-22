'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const home=fs.readFileSync('home-rebuild.css','utf8');
const workouts=fs.readFileSync('compact-workouts.css','utf8');
test('Home and Workouts show approved exercise thumbnails without requiring an exercise guide',()=>{
 assert.ok(source.includes('preview-exercise-picture'));
 assert.ok(source.includes('workout-compact-illustration'));
 assert.ok(source.includes("const approved=approvedThumbnail(e)"));
 assert.ok(source.includes("const imageExercise=(p.ids||[]).map(id=>libraryExercises().find(e=>e.id===id)).find(e=>e&&approvedThumbnail(e))"));
 assert.ok(source.includes("wireWorkoutPreviewImages($('todayExercises'))"));
 assert.ok(source.includes("wireWorkoutPreviewImages($('workoutGrid'))"));
 assert.ok(source.includes('data-workout=')&&source.includes('escapeHTML(p.id)'));
});
test('Only approved and safe image paths can be used',()=>{
 const start=source.indexOf('function approvedThumbnail(e){');
 const end=source.indexOf('function approvedFullImage(e){');
 assert.ok(start>=0&&end>start);
 const approvedThumbnail=vm.runInNewContext(source.slice(start,end)+';approvedThumbnail',{});
 const valid={demonstration:{status:'approved',thumbnail:'assets/exercise-demonstrations/press-thumb.webp'}};
 assert.equal(approvedThumbnail(valid),'assets/exercise-demonstrations/press-thumb.webp');
 assert.equal(approvedThumbnail({demonstration:{status:'withheld',thumbnail:valid.demonstration.thumbnail}}),'');
 assert.equal(approvedThumbnail({demonstration:{status:'approved',thumbnail:'https://example.org/attack.webp'}}),'');
});
test('Preview image loading failures switch to the existing original approved placeholder',()=>{
 const start=source.indexOf('function wireWorkoutPreviewImages(root){');
 const end=source.indexOf('function renderHome(){',start);
 assert.ok(start>=0&&end>start);
 const image={_src:'./assets/exercise-demonstrations/missing.webp',alt:'',events:{},
  getAttribute(key){return key==='src'?this._src:null},
  set src(value){this._src=value},get src(){return this._src},
  addEventListener(name,cb){this.events[name]=cb}};
 const root={querySelectorAll:()=>[image]};
 vm.runInNewContext(source.slice(start,end)+';wireWorkoutPreviewImages(root);',{root});
 image.events.error();
 assert.equal(image.src,'./assets/image-coming-approved.webp');
 assert.equal(image.alt,'Exercise artwork temporarily unavailable');
});
test('New image styles are scoped to the approved teal/gold Home and Workouts screens',()=>{
 assert.ok(home.includes('#home .preview-exercise-picture'));
 assert.ok(home.includes('object-fit:contain'));
 assert.ok(workouts.includes('#workouts .workout-compact-illustration'));
 assert.ok(workouts.includes('object-fit:contain'));
 assert.ok(!/\b(localStorage|sessionStorage|fetch|supabase)\b/.test(source.slice(source.indexOf('function wireWorkoutPreviewImages'),source.indexOf('function unfinishedDraftFor('))));
});
