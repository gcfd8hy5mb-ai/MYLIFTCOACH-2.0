/* Exercise source-review regression; never approve or import candidates. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const review=require(path.join(root,'legacy-media-review.js'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'media/legacy-source-audit.json'),'utf8'));
const code=fs.readFileSync(path.join(root,'exercise-catalog-344.js'),'utf8');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(code,ctx);
const catalog=ctx.window.MLC2_EXERCISE_CATALOG;
const report=review.inspect(catalog);
assert.equal(report.total,14);
assert.equal(report.unmatched,0);
assert.equal(report.approved,0);
assert.equal(manifest.assets.length,14);
for(const asset of manifest.assets){
 const match=report.items.find(x=>x.id===asset.exerciseId);
 assert.ok(match,'verified source must map to an exercise ID');
 assert.equal(match.blob,asset.sourceBlobSha);
 assert.equal(match.status,'approval-pending');
 assert.equal(match.previewUrl,'https://gcfd8hy5mb-ai.github.io/workout-tracker/'+asset.sourcePath);
 const exercise=catalog.find(x=>x.id===asset.exerciseId);
 assert.notEqual(exercise.demonstration?.status,'approved','unreviewed source cannot count as approved demonstration');
}
const spy=[];
const node=tag=>({tag,children:[],textContent:'',addEventListener:()=>{},append(...children){this.children.push(...children)},
 remove(){},set className(s){this._className=s},get className(){return this._className}});
const dom={createElement:node};
const rootElement={children:[],replaceChildren(){this.children=[]},append(...children){this.children.push(...children)}};
const rendered=review.render(rootElement,catalog,dom);
assert.equal(rendered.total,14);
assert.equal(rootElement.children.length,3);
assert.equal(rootElement.children[2].children.length,14);
const sample=rootElement.children[2].children[0];
assert.equal(sample.children.filter(x=>x.tag==='img').length,1);
assert.equal(sample.children.find(x=>x.tag==='a').rel,'noopener noreferrer');
assert.throws(()=>review.inspect(catalog,[review.CANDIDATES[0],review.CANDIDATES[0]]),/invalid/);
assert.throws(()=>review.inspect(catalog,[{...review.CANDIDATES[0],path:'https://unsafe.example/pic.png'}]),/invalid/);
console.log('MYLIFTCOACH media review: PASS — 14 original IDs, no approvals, safe source previews');
