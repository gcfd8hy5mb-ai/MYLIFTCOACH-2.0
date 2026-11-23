/* MYLIFTCOACH 2.0 — account signup validation. No passwords or tokens are persisted here. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2Signup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function validate({name,email,password,confirmPassword}){
  const fullName=String(name||'').trim();
  const address=String(email||'').trim().toLowerCase();
  if(fullName.length>80)throw Error('Name must be 80 characters or fewer.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.length>254)
   throw Error('Enter a valid email address.');
  if(typeof password!=='string'||password.length<8||password.length>128)
   throw Error('Password must contain 8–128 characters.');
  if(password!==confirmPassword)throw Error('Passwords do not match.');
  return {email:address,password,fullName};
 }
 async function register(inputs,authRequest){
  const values=validate(inputs);
  if(typeof authRequest!=='function')throw Error('Account service unavailable.');
  const response=await authRequest('signup',{
   email:values.email,password:values.password,
   data:values.fullName?{full_name:values.fullName}:{}
  });
  // Confirmed-email projects return a user but no session. Never treat that as signed in.
  if(response&&response.access_token&&response.refresh_token&&response.user?.id)
   return {kind:'session',session:response};
  return {kind:'confirmation',email:values.email};
 }
 return Object.freeze({validate,register});
});
