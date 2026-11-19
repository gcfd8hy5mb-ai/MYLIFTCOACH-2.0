/* MYLIFTCOACH 2.0: explicit, read-only cloud compatibility check.
   No account data is downloaded or stored; only per-user record counts are returned.
   Never writes to Supabase or touches legacy storage. */
(function(){
'use strict';
const TABLES=[
 ['Workouts','prism_account_workouts'],['Sessions','prism_account_sessions'],
 ['Saved sets','prism_account_sets'],['Measurements','prism_account_measurements'],
 ['Coach actions','prism_account_coach_actions'],['Photos','prism_account_photos']
];
async function check({baseUrl,publishableKey,token,userId,fetcher=fetch}){
 if(typeof baseUrl!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(baseUrl)||!publishableKey||!token||!userId)throw new Error('Verified account credentials are required.');
 const origin=baseUrl.replace(/\/$/,'');
 const headers={apikey:publishableKey,Authorization:'Bearer '+token,'Accept':'application/json'};
 // Validate the token against Auth, never trust a user id supplied by the UI alone.
 const who=await fetcher(origin+'/auth/v1/user',{method:'GET',headers,cache:'no-store'});
 if(!who.ok)throw new Error('Account verification failed ('+who.status+'). Please sign in again.');
 const user=await who.json();
 if(user?.id!==userId)throw new Error('Authenticated account does not match the requested owner.');
 const output=[];
 for(const [label,table] of TABLES){
  const query=new URL(origin+'/rest/v1/'+table);
  query.searchParams.set('select','user_id');
  query.searchParams.set('user_id','eq.'+userId);
  query.searchParams.set('limit','1');
  const response=await fetcher(query.toString(),{
   method:'GET',headers:{...headers,Prefer:'count=exact'},cache:'no-store'
  });
  if(!response.ok){output.push({label,status:'unavailable',code:response.status});continue}
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.some(row=>row.user_id!==userId))throw new Error('Account ownership verification failed for '+label+'.');
  const contentRange=response.headers.get('content-range')||'';
  const match=contentRange.match(/\/(\d+)$/);
  output.push({label,status:match?'counted':'accessible',count:match?Number(match[1]):null});
 }
 return {userId,rows:output,readOnly:true};
}
function render(root,report){
 if(!root)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 root.innerHTML='<p>Authenticated user confirmed. No records were imported, uploaded or modified.</p>'+
 report.rows.map(r=>'<div class="mlc-cloud-audit-row"><strong>'+esc(r.label)+'</strong><span>'+
 (r.status==='counted'?r.count+' records':r.status==='accessible'?'Accessible (count unknown)':'Unavailable ('+r.code+')')+
 '</span></div>').join('');
}
window.MLC2CloudAudit={check,render,TABLES};
})();
