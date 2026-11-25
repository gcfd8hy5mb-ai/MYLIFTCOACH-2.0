'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Signup=require('../sync/account-signup.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('registration validation accepts optional name and normalized email',()=>{
 const a=Signup.validate({name:'  Alex  ',email:'  EXAMPLE@Example.com ',password:'secure-password-123',confirmPassword:'secure-password-123'});
 assert.equal(a.fullName,'Alex');assert.equal(a.email,'example@example.com');
 assert.throws(()=>Signup.validate({name:'',email:'broken',password:'password123',confirmPassword:'password123'}),/valid email/);
 assert.throws(()=>Signup.validate({name:'',email:'a@example.com',password:'short',confirmPassword:'short'}),/8/);
 assert.throws(()=>Signup.validate({name:'',email:'a@example.com',password:'password123',confirmPassword:'wrong'}),/match/);
});
test('registration calls existing Supabase auth signup with only safe profile metadata',async()=>{
 let request;
 const outcome=await Signup.register({name:'Sam',email:'SAM@example.com',password:'strong-password-456',confirmPassword:'strong-password-456'},async(...args)=>{
  request=args;return {user:{id:'unconfirmed'}};
 });
 assert.equal(request[0],'signup');
 assert.deepEqual(request[1],{email:'sam@example.com',password:'strong-password-456',data:{full_name:'Sam'}});
 assert.deepEqual(outcome,{kind:'confirmation',email:'sam@example.com'});
});
test('registration never treats user-only email confirmation as an authenticated session',async()=>{
 const outcome=await Signup.register({email:'new@example.com',password:'strong-password-456',confirmPassword:'strong-password-456'},async()=>({user:{id:'uuid'},access_token:'token'}));
 assert.equal(outcome.kind,'confirmation');
});
test('confirmed signups may pass a complete token pair to the existing verification boundary',async()=>{
 const pair={access_token:'access',refresh_token:'refresh',user:{id:'account-uuid'}};
 const result=await Signup.register({email:'new@example.com',password:'strong-password-456',confirmPassword:'strong-password-456'},async()=>pair);
 assert.equal(result.kind,'session');
 assert.equal(result.session,pair);
});
test('static signup links preserve existing sign-in and iPhone offline shell',()=>{
 const app=read('app.js'),html=read('index.html'),worker=read('offline-worker.js');
 for(const id of ['welcomeSignUp','authCreateAction'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/sync\/account-signup\.js\?v=2/);
 assert.match(html,/app\.js\?v=55/);
 assert.match(worker,/app\.js\?v=55/);
 assert.match(app,/function openSignUp\(\)/);
 assert.match(app,/MLC2Signup\.register\(/);
 assert.match(app,/authRequest\('token\?grant_type=password'/);
 assert.match(app,/authRequest\('user',null,response.access_token,'GET'\)/);
 assert.doesNotMatch(app,/service_role/);
});

test('password recovery links strip credentials from the installed URL before opening the reset form',()=>{
 const vm=require('node:vm');
 const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
 const handler=source.slice(source.indexOf('function handlePasswordResetLink(){'),source.indexOf('function openSignIn(){'));
 const calls=[];
 const context={URLSearchParams,location:{hash:'#access_token=fixture&refresh_token=ignored&type=recovery',pathname:'/workout-tracker/',search:'?app=myliftcoach'},
  history:{state:null,replaceState:(_state,_title,url)=>calls.push(url)},openPasswordReset:token=>calls.push(token)};
 assert.equal(vm.runInNewContext(handler+';handlePasswordResetLink()',context),true);
 assert.deepEqual(calls,['/workout-tracker/?app=myliftcoach','fixture']);
 assert.match(source,/authRequest\('recover\?redirect_to='/);
 assert.match(source,/authRequest\('user',\{password\},token,'PUT'\)/);
});
