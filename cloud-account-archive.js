/* Original account recovery archive — authenticated GET ONLY.
   Exports source cloud records without altering, merging, or persisting them in 2.0.
   Explicit user action is required to download the archive. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CloudArchive=api;
})(globalThis,function(){
'use strict';
const MAX_ROWS_PER_TABLE=5000, PAGE=500, MAX_SERIALIZED=30*1024*1024;
const format='MYLIFTCOACH-original-account-cloud-archive';
function permitted(url){return typeof url==='string'&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)}
function validateTables(tables){
 if(!Array.isArray(tables)||!tables.length||new Set(tables).size!==tables.length||
  tables.some(t=>typeof t!=='string'||!/^[a-z][a-z0-9_]*$/.test(t)))throw Error('Unrecognized original account table configuration');
 return [...tables];
}
async function collect({url,publishableKey,token,userId,tables,fetcher,makeUrl}){
 if(!permitted(url)||typeof publishableKey!=='string'||!publishableKey||
  typeof token!=='string'||!token||typeof userId!=='string'||!userId)throw Error('Authenticated account required');
 const allowed=validateTables(tables),base=url.replace(/\/$/,'');
 if(typeof fetcher!=='function'||typeof makeUrl!=='function')throw Error('Read-only transport unavailable');
 const headers={apikey:publishableKey,Authorization:'Bearer '+token,Accept:'application/json'};
 const auth=await fetcher(base+'/auth/v1/user',{method:'GET',cache:'no-store',headers});
 if(!auth?.ok)throw Error('Account verification failed; no archive created');
 const user=await auth.json();
 if(!user||user.id!==userId)throw Error('Authenticated user does not match requested account');
 const records=[],counts=Object.create(null);
 for(const table of allowed){
  const rows=[];
  for(let offset=0;;offset+=PAGE){
   if(offset>=MAX_ROWS_PER_TABLE)throw Error('Account table exceeds archival limit: '+table+'; no partial archive downloaded');
   const endpoint=makeUrl(base+'/rest/v1/prism_account_'+table);
   endpoint.searchParams.set('user_id','eq.'+userId);
   endpoint.searchParams.set('select','*');
   endpoint.searchParams.set('order','id');
   endpoint.searchParams.set('limit',String(PAGE));
   endpoint.searchParams.set('offset',String(offset));
   const res=await fetcher(endpoint.toString(),{method:'GET',cache:'no-store',headers});
   if(!res?.ok)throw Error('Account table '+table+' could not be read; no partial archive downloaded');
   const page=await res.json();
   if(!Array.isArray(page)||page.length>PAGE||page.some(r=>!r||r.user_id!==userId||typeof r.id!=='string'))
    throw Error('Cloud ownership or row integrity check failed; no archive downloaded');
   rows.push(...page);
   if(page.length<PAGE)break;
  }
  counts[table]=rows.length;
  for(const row of rows)records.push({table,row});
 }
 return {format,version:1,accountId:userId,createdAt:new Date().toISOString(),tableCount:allowed.length,
  recordCount:records.length,counts,records};
}
function serialize(archive){
 if(!archive||archive.format!==format||archive.version!==1||
  typeof archive.accountId!=='string'||!Array.isArray(archive.records)||
  !Array.isArray(Object.keys(archive.counts||{})))throw Error('Invalid original account archive');
 if(archive.records.some(x=>!x||typeof x.table!=='string'||x.row?.user_id!==archive.accountId))
  throw Error('Original cloud archive contains a mismatched owner');
 const contents=JSON.stringify(archive);
 if(contents.length>MAX_SERIALIZED)throw Error('Archive exceeds 30 MB; download cancelled');
 return contents;
}
function download(archive,doc,URLApi,BlobClass,release){
 const contents=serialize(archive);
 const blob=new BlobClass([contents],{type:'application/json'});
 const href=URLApi.createObjectURL(blob);
 const link=doc.createElement('a');
 link.href=href;
 link.download='MYLIFTCOACH-original-cloud-'+archive.createdAt.slice(0,10)+'.json';
 doc.body.appendChild(link);
 try{link.click()}finally{link.remove();release(()=>URLApi.revokeObjectURL(href))}
 return {records:archive.recordCount,bytes:blob.size,tables:archive.tableCount};
}
return Object.freeze({format,collect,serialize,download,validateTables});
});