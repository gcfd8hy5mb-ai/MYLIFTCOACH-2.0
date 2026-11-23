'use strict';

const {verifyHosted}=require('./recovery-rehearsal.cjs');
const baseUrl='https://kirlpjflaoriiusfamsk.supabase.co';
const uuid=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/;

async function runExistingPair(env,fetcher=fetch){
 const key=env.MLC2_HOSTED_PUBLISHABLE_KEY||'';
 const pair=['A','B'].map(label=>({
  owner:(env[`MLC2_SYNTHETIC_${label}_UUID`]||'').toLowerCase(),
  email:env[`MYLIFTCOACH_TEST_${label}_EMAIL`],
  password:env[`MYLIFTCOACH_TEST_${label}_PASSWORD`]
 }));
 if(!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)||
    pair.some(({owner,email,password})=>!uuid.test(owner)||!email?.trim()||!password)||
    pair[0].owner===pair[1].owner||pair[0].email.trim().toLowerCase()===pair[1].email.trim().toLowerCase()){
  throw Error('Configure the publishable key and two distinct, verified synthetic account identities and credentials');
 }

 const accounts=[];
 for(const {owner,email,password} of pair){
  let session;
  try{
   const response=await fetcher(baseUrl+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({email,password}),redirect:'error',signal:AbortSignal.timeout(10000)
   });
   if(response.ok)session=await response.json();
  }catch{}
  if(typeof session?.access_token!=='string'||!session.access_token||session.user?.id!==owner||
     session.user.app_metadata?.mlc2_synthetic_recovery!==true){
   throw Error('Synthetic sign-in failed or returned an unapproved identity');
  }
  accounts.push({owner,accessToken:session.access_token});
 }

 try{
  return await verifyHosted({baseUrl,key,accounts,fetcher});
 }catch{
  throw Error('Hosted recovery checks failed after synthetic sign-in');
 }
}

if(require.main===module){
 runExistingPair(process.env).then(result=>console.log(JSON.stringify(result))).catch(error=>{
  console.error(error.message);
  process.exitCode=1;
 });
}

module.exports={runExistingPair};
