/* MYLIFTCOACH 2.0 — optional fixed-duration program workout source.
 * Read-only workout selection, never changes the user's manual workout, schedule,
 * custom routines, or history. Program source is device-local and owner-scoped.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2ProgramSource=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PREFIX='mlc2-goal-program-source-v1';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 const MODES=['custom','generated','mixed'];
 const CUSTOM=/^custom-[a-zA-Z0-9_-]{1,100}$/;
 function key(owner=null){if(owner===null)return PREFIX;if(!OWNER.test(owner))throw Error('Invalid account');return PREFIX+':user:'+owner}
 function signature(program){return program&&['strength','bulk','maintain','cut'].includes(program.goal)&&[6,8,12].includes(program.weeks)&&
  /^\d{4}-\d{2}-\d{2}$/.test(program.startDate||'')?
  [program.startDate,program.goal,program.weeks].join(':'):null}
 function valid(data){return data&&typeof data==='object'&&!Array.isArray(data)&&MODES.includes(data.mode)&&
   (data.customId===''||CUSTOM.test(data.customId))&&typeof data.signature==='string'&&data.signature.length<90}
 function read(storage,owner,program){
  const sig=signature(program);if(!sig)return null;
  try{const raw=storage.getItem(key(owner));if(!raw||raw.length>600)return null;
   const data=JSON.parse(raw);return valid(data)&&data.signature===sig?
    {mode:data.mode,customId:data.customId,signature:data.signature}:null;
  }catch{return null}
 }
 function save(storage,owner,program,{mode,customId=''}){
  const sig=signature(program),data={mode,customId,signature:sig};
  if(!sig||!valid(data))throw Error('Select a valid program workout source');
  const name=key(owner),payload=JSON.stringify(data);
  storage.setItem(name,payload);
  if(storage.getItem(name)!==payload)throw Error('Workout source was not retained');
  return data;
 }
 function choose({source,customPlans=[],generated=null,completed=0}={}){
  const candidates=Array.isArray(customPlans)?customPlans.filter(p=>CUSTOM.test(p?.id||'')&&Array.isArray(p.ids)&&p.ids.length):[];
  const count=Number.isSafeInteger(completed)&&completed>=0?completed:0;
  const selected=candidates.find(p=>p.id===source?.customId);
  // A pinned routine must never silently resolve to a different custom routine.
  const custom=source?.customId?(selected||null):(candidates[count%candidates.length]||null);
  const generatedValid=generated&&Array.isArray(generated.ids)&&generated.ids.length?generated:null;
  if(source?.mode==='custom')return custom?{...custom,programSource:'custom'}:null;
  if(source?.mode==='mixed'){
   const primary=count%2===0?custom:generatedValid,secondary=count%2===0?generatedValid:custom;
   const pick=primary||secondary;
   return pick?{...pick,programSource:pick===custom?'custom':'generated'}:null;
  }
  return generatedValid?{...generatedValid,programSource:'generated'}:null;
 }
 return Object.freeze({PREFIX,MODES,key,signature,read,save,choose});
});