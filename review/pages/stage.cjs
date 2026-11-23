'use strict';
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const production='https://kirlpjflaoriiusfamsk.supabase.co';
function stage(source,destination,{backend='',key=''}={}){
 if(Boolean(backend)!==Boolean(key))throw Error('Set both isolated test backend values or leave both blank');
 if(backend&&(!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(backend)||backend===production||
    !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)))
  throw Error('Only an independent Supabase project and publishable key are allowed');
 const read=file=>fs.readFileSync(path.join(source,file),'utf8');
 const original=read('app.js');
 const urlDeclaration=/^const BACKEND='[^']+';$/m,keyDeclaration=/^const PUBLIC_KEY='([^']+)';$/m;
 const originalUrl=original.match(urlDeclaration)?.[0],originalKey=original.match(keyDeclaration)?.[1];
 if(originalUrl!==`const BACKEND='${production}';`||!originalKey||key===originalKey)
  throw Error('Cannot verify the candidate production backend exclusion');
 const csp=[
  "default-src 'self'","script-src 'self'","object-src 'none'","base-uri 'none'","form-action 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com","img-src 'self' data: blob:",
  "connect-src "+(backend||"'none'")
 ].join('; ');
 const html=read('index.html');
 if(!html.includes('<head>')||/http-equiv="Content-Security-Policy"/i.test(html))
  throw Error('Candidate head changed; review acceptance CSP injection');
 const references=[...html.matchAll(/(?:src|href)="\.\/([\w./-]+\.(?:js|css|webmanifest|webp|jpg|png|svg))(?:\?v=\d+)?"/g)]
  .map(match=>match[1]);
 const files=new Set([...references,'offline-worker.js']);
 if(!files.has('app.js')||!files.has('app.webmanifest')||!files.has('offline-shell.js'))
  throw Error('Candidate shell references are incomplete');

 const inputs=[...files].sort();
 for(const name of inputs){
  if(name.split('/').some(part=>part==='..')||!fs.statSync(path.join(source,name)).isFile())
   throw Error('Invalid acceptance asset: '+name);
 }
 const target=path.resolve(destination),project=path.resolve(source);
 const relative=path.relative(project,target);
 if(!relative.startsWith('..'+path.sep)||fs.existsSync(target))
  throw Error('Use a new output directory outside the source tree');
 fs.mkdirSync(target,{recursive:true});
 const output=name=>path.join(target,name);
 for(const name of inputs){
  fs.mkdirSync(path.dirname(output(name)),{recursive:true});
  fs.copyFileSync(path.join(source,name),output(name));
 }
 fs.cpSync(path.join(source,'assets'),output('assets'),{recursive:true});
 fs.writeFileSync(output('index.html'),html.replace('<head>',`<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`));
 fs.writeFileSync(output('app.js'),original
  .replace(urlDeclaration,`const BACKEND='${backend||'https://acceptance.invalid'}';`)
  .replace(keyDeclaration,`const PUBLIC_KEY='${key}';`));
 const digest=createHash('sha256').update(backend+'\0'+key).update(html);
 for(const name of inputs)digest.update(name+'\0').update(fs.readFileSync(path.join(source,name)));
 const marker=digest.digest('hex').slice(0,12);
 const worker=read('offline-worker.js'),cacheLine=/^const cacheName = prefix \+ '[0-9]+';$/m;
 if(!cacheLine.test(worker))throw Error('Cannot distinguish acceptance worker cache versions');
 fs.writeFileSync(output('offline-worker.js'),worker.replace(cacheLine,`const cacheName = prefix + 'acceptance-${marker}';`));
 fs.writeFileSync(output('.nojekyll'),'');
 return {mode:backend?'isolated-test':'offline',files:inputs.length};
}
if(require.main===module){
 const destination=process.argv[2];
 if(!destination)throw Error('Usage: node review/pages/stage.cjs <new-output-directory>');
 const result=stage(path.resolve(__dirname,'../..'),destination,
  {backend:process.env.MLC2_TEST_URL,key:process.env.MLC2_TEST_PUBLISHABLE_KEY});
 console.log('Prepared '+result.mode+' acceptance package with '+result.files+' shell inputs and the approved assets');
}
module.exports={stage};
