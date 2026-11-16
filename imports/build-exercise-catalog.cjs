'use strict';
// Read-only extraction: original installers and DOM code are never evaluated.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const files=["exercise-library-expansion-v1.js","exercise-library-expansion-2.js","exercise-library-expansion-3.js","exercise-library-expansion-4.js","exercise-library-expansion-5.js"];
function arrayLiteral(source){
 const m=/\bconst\s+(?:additions|a)\s*=\s*\[/.exec(source);
 if(!m)throw Error('Original additions array absent');
 const start=m.index+m[0].lastIndexOf('[');
 let depth=0,quote='',escaped=false;
 for(let i=start;i<source.length;i++){
  const c=source[i];
  if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote='';continue}
  if(c==="'"||c==='"'||c==='\x60'){quote=c;continue}
  if(c==='[')depth++;
  else if(c===']'){depth--;if(depth===0)return source.slice(start,i+1)}
 }
 throw Error('Unterminated original additions array');
}
function build(){
 const entries=[],seen=new Set(),counts=[];
 for(const file of files){
  const raw=fs.readFileSync(path.join(__dirname,'source',file+'.txt'),'utf8');
  const x=(id,name,muscle,equipment,how)=>{
   // The original v5 'pendulum-squat-wide' call omitted its equipment
   // argument. Correct this one documented source typo without changing ID,
   // exercise name or original movement instructions.
   if(id==='pendulum-squat-wide'&&how===undefined&&typeof equipment==='string'){
    how=equipment;equipment='Machine';
   }
   return {id,name,muscle,equipment,how,tip:'Use controlled reps and a comfortable range of motion.',mistake:'Avoid rushing the movement or sacrificing form.'};
  };
  const rows=vm.runInNewContext('('+arrayLiteral(raw)+')',{x},{timeout:1500,contextCodeGeneration:{strings:false,wasm:false}});
  if(!Array.isArray(rows)||rows.length<10||rows.length>150)throw Error('Unexpected row count '+file);
  let added=0;
  for(const record of rows){
   const item=JSON.parse(JSON.stringify(record));
   if(typeof item.id!=='string'||!/^[-a-z0-9]{2,100}$/.test(item.id)||typeof item.name!=='string'||typeof item.muscle!=='string'||typeof item.how!=='string')throw Error('Invalid exercise record '+file);
   if(seen.has(item.id))continue;
   seen.add(item.id);entries.push(item);added++;
  }
  counts.push({file,rows:rows.length,newRecords:added});
 }
 return {entries,counts};
}
if(require.main===module){const a=build();console.log(JSON.stringify({total:a.entries.length,counts:a.counts},null,2))}
module.exports={build,arrayLiteral};
