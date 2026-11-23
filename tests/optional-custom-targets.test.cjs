'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function harness(){
 const store=new Map();
 const window={MLC2_EXERCISE_CATALOG:[{id:'a',name:'Chest Press',group:'Chest'},{id:'b',name:'Lat Pulldown',group:'Back'}]};
 const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 vm.runInNewContext(read('custom-workouts.js'),{window,localStorage:storage,console});
 return {app:window.MLC2Custom,store};
}
test('legacy custom workouts remain readable without optional values',()=>{
 const {app,store}=harness();
 store.set('mlc2-custom-plans-v1',JSON.stringify([{id:'custom-old',title:'Old',ids:['a','b']}]));
 const plan=app.allPlans([])[0];
 assert.equal(plan.id,'custom-old');
 assert.deepEqual(JSON.parse(JSON.stringify(plan.targets)),{});
});
test('only explicitly provided validated targets survive read and account switching',()=>{
 const {app,store}=harness();
 store.set('mlc2-custom-plans-v1:user:u1',JSON.stringify([{id:'custom-a',title:'A',ids:['a','b'],targets:{a:{sets:4,reps:10,weight:50,restSeconds:90},b:{weight:0},other:{sets:10}}}]));
 store.set('mlc2-custom-plans-v1:user:u2',JSON.stringify([{id:'custom-b',title:'B',ids:['a'],targets:{a:{sets:-1,reps:200,weight:25,restSeconds:10000}}}]));
 app.setOwner('u1');
 const first=app.allPlans([])[0];
 assert.deepEqual(JSON.parse(JSON.stringify(first.targets)),{a:{sets:4,reps:10,weight:50,restSeconds:90},b:{weight:0}});
 app.setOwner('u2');
 assert.deepEqual(JSON.parse(JSON.stringify(app.allPlans([])[0].targets)),{a:{weight:25}});
});
test('optional exercise inputs only appear inside chosen exercise and live log displays valid targets',()=>{
 const js=read('custom-workouts.js'),app=read('app.js'),css=read('custom-workouts.css'),html=read('index.html');
 assert.ok(html.includes('custom-workouts.css?v=5'));
 for(const field of ['sets','reps','weight','restSeconds'])assert.ok(js.includes("entry('"+field+"'"));
 assert.match(js,/details class="custom-target-details"/);
 assert.match(js,/Leave any field blank/);
 assert.match(js,/targets=normalizeTargets\(draftTargets,ids\)/);
 assert.match(app,/activePlan\.targets\?\.\[id\]/);
 assert.ok(app.includes('activePlan?.targets?.[exerciseId]?.restSeconds'));
 assert.match(css,/custom-target-fields/);
});
