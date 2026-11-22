'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

test('owner changes drop stale photo reads and legacy rows remain unassigned',async()=>{
 const app=fs.readFileSync('body-progress.js','utf8');
 const start=app.indexOf('function photoDb(){'),end=app.indexOf('const scopedPhoto=',start);
 assert.ok(start>=0&&end>start);
 const nodes=[];
 const makeElement=()=>({children:[],append(...items){this.children.push(...items)},dataset:{}});
 const list={append(node){nodes.push(node)},replaceChildren(){nodes.length=0}};
 const reads=[];
 const context={
  window:{},Blob,URL:{createObjectURL:blob=>blob.id,revokeObjectURL(){}},
  document:{getElementById:id=>id==='mlcPhotoList'?list:null,createElement:makeElement},
  photoAction:()=>new Promise(resolve=>reads.push(resolve))
 };
 vm.runInNewContext(app.slice(0,start)+app.slice(end),context);
 const photos=context.window.MLC2BodyProgress;
 const guest=photos.renderPhotos();
 photos.setOwner('member');
 const blob=new Blob(['test']);
 const rows=[
  {id:'legacy',day:'2026-11-22',data:blob},
  {id:'guest',ownerId:null,day:'2026-11-22',data:blob},
  {id:'member',ownerId:'member',day:'2026-11-22',data:blob},
  {id:'other',ownerId:'other',day:'2026-11-22',data:blob}
 ];
 reads[1](rows);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.length,1);
 const [rendered]=nodes;
 assert.equal(rendered.children[1].children[1].dataset.photoExport,'member');
 reads[0](rows);await guest;
 assert.deepEqual(nodes,[rendered]);
});
