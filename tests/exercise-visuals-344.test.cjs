'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function loadCatalog() {
  const window = {};
  const context = {window, console};
  for (const file of ['exercise-catalog-344.js','approved-visuals-manifest.js','exercise-visuals-344.js'])
    vm.runInNewContext(read(file), context, {filename:file});
  return window;
}
function webp(file) {
  const b = fs.readFileSync(path.join(root, file));
  assert.ok(b.length > 20, file + ' is too small');
  assert.equal(b.toString('ascii',0,4), 'RIFF', file);
  assert.equal(b.toString('ascii',8,12), 'WEBP', file);
  assert.equal(b.readUInt32LE(4) + 8, b.length, file + ' RIFF length mismatch');
}
test('all 344 exercise records have unique IDs and exactly 263 approved images', () => {
  const w = loadCatalog();
  assert.equal(w.MLC2_VISUALS_344_READY,true);
  assert.equal(w.MLC2_EXERCISE_CATALOG.length,344);
  assert.equal(new Set(w.MLC2_EXERCISE_CATALOG.map(e=>e.id)).size,344);
  assert.equal(w.MLC2_APPROVED_VISUALS.length,263);
  assert.equal(new Set(w.MLC2_APPROVED_VISUALS.map(e=>e.id)).size,263);
  assert.equal(w.MLC2_EXERCISE_CATALOG.filter(e=>e.demonstration.status==='approved').length,263);
  assert.equal(w.MLC2_EXERCISE_CATALOG.filter(e=>e.demonstration.status==='withheld').length,81);
});
test('every approved exercise maps to the correct image and thumbnail', () => {
  const w=loadCatalog();
  const approved=new Map(w.MLC2_APPROVED_VISUALS.map(e=>[e.id,e]));
  for (const e of w.MLC2_EXERCISE_CATALOG){
    const v=approved.get(e.id);
    if(v){
      assert.equal(e.demonstration.status,'approved',e.id);
      assert.equal(e.demonstration.image,v.image,e.id);
      assert.equal(e.demonstration.thumbnail,v.thumbnail,e.id);
    } else {
      assert.equal(e.demonstration.status,'withheld',e.id);
    }
  }
});
test('all 526 approved image files exist as well-formed WebP containers', () => {
  const w=loadCatalog();
  const paths=w.MLC2_APPROVED_VISUALS.flatMap(e=>[e.image,e.thumbnail]);
  assert.equal(paths.length,526);
  assert.equal(new Set(paths).size,526);
  for (const p of paths){
    assert.match(p,/^assets\/exercise-demonstrations\/[A-Za-z0-9._-]+\.webp$/);
    assert.ok(fs.existsSync(path.join(root,p)),'missing '+p);
    webp(p);
  }
});
test('the shared approved placeholder is a readable WebP',()=>{
  webp('assets/image-coming-approved.webp');
});
test('scripts load in the required order before app.js',()=>{
  const html=read('index.html');
  const files=['exercise-catalog-344.js','approved-visuals-manifest.js','exercise-visuals-344.js','app.js'];
  const positions=files.map(f=>html.indexOf('src="./'+f+'?'));
  assert.ok(positions.every(n=>n>=0),'missing or renamed image script');
  assert.ok(positions.every((n,i)=>i===0||n>positions[i-1]),'invalid script order');
});
test('library displays the approved dumbbell fallback without touching Coach/cloud code',()=>{
 const app=read('app.js');
 assert.ok(app.includes('assets/image-coming-approved.webp'),'shared placeholder not wired into library');
 assert.ok(app.includes('approvedThumbnail(e)'),'approved demonstration thumbnails missing');
 assert.ok(app.includes('img.remove(),{once:true}'),'missing-image fallback removed');
});

test('library reports approved and withheld demonstration totals without claiming missing artwork is approved',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.ok(html.includes('id="approvedMediaStatus"'));
 assert.ok(app.includes('window.MLC2_VISUALS_344_READY===true&&catalog.length===344'));
 assert.ok(app.includes("e.demonstration?.status==='approved'"));
 assert.ok(app.includes("e.demonstration?.status==='withheld'"));
 assert.ok(app.includes("Demonstration inventory not verified in this build"));
});

test('Library opens original full-size approved art on demand and protects against broken media',()=>{
 const app=read('app.js'),css=read('exercise-placeholders.css');
 assert.ok(app.includes('function approvedFullImage(e)'));
 assert.ok(app.includes("d.status!=='approved'"));
 assert.ok(app.includes('View approved exercise demonstration'));
 assert.ok(app.includes('data-library-full'));
 assert.ok(app.includes("img.addEventListener('error',()=>"));
 assert.ok(app.includes('feedback.hidden=false'));
 assert.ok(css.includes('#library .library-full-guide img'));
});
