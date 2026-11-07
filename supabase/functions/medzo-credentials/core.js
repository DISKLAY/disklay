/*
 * Credential service core, deliberately not an HTTP handler or deployed function.
 * The adapter must reserve usernames atomically, store passwords through a vetted
 * authentication provider, and enforce rate limits using a trusted client identity.
 * Linking Telegram, issuing Medzo sessions and password recovery are separate work.
 */
(function (root) {
  'use strict';
  const encoder=new TextEncoder();
  function username(input) {
    if(typeof input!=='string')return null;
    const value=input.trim().toLowerCase();
    return /^[a-z0-9_]{4,32}$/.test(value)?value:null;
  }
  function nickname(input) {
    if(typeof input!=='string')return null;
    const value=input.trim().normalize('NFC');
    return value.length>=1 && value.length<=48 && !/[\u0000-\u001f\u007f]/.test(value)?value:null;
  }
  function password(input) {
    if(typeof input!=='string')return false;
    const length=encoder.encode(input).length;
    return Array.from(input).length>=10 && length<=72;
  }
  function create({accounts,provider,limiter}) {
    if(!accounts||!provider||!limiter||typeof limiter.allow!=='function')throw new Error('missing_adapters');
    async function register(input,context) {
      const login=username(input?.username),name=nickname(input?.nickname),secret=input?.password;
      if(!login||!name||!password(secret))return {ok:false,error:'invalid_input'};
      try {if(!await limiter.allow('register',login,context))return {ok:false,error:'rate_limited'};} catch (_) {return {ok:false,error:'unavailable'};}
      // reserve() must atomically prevent both concurrent and pre-existing names.
      let reservation;try {reservation=await accounts.reserve(login,name);} catch (_) {return {ok:false,error:'unavailable'};}
      if(!reservation)return {ok:false,error:'username_taken'};
      let identity=null;
      try {
        // The provider is responsible for secure password storage and a random,
        // non-deliverable internal identifier; never use a real person's email.
        identity=await provider.create({password:secret,nickname:name,email:reservation.email});
        if(!identity||typeof identity.id!=='string'||!identity.id)throw new Error('invalid_identity');
        await accounts.complete(reservation,identity,name);
        return {ok:true};
      } catch (error) {
        // A definitive provider rejection cannot have created an identity.
        // Ambiguous timeouts remain reserved to avoid deleting a real account.
        if(!identity&&error?.definitive===true&&typeof accounts.release==='function'){
          try{await accounts.release(reservation);}catch(_){}
        }
        // A provider/database timeout can occur after the operation committed.
        // Retain the reservation and identity for explicit reconciliation;
        // deleting either here could destroy a successfully-created account.
        return {ok:false,error:'unavailable'};
      }
    }
    async function login(input,context) {
      const login=username(input?.username),secret=input?.password;
      if(!login||typeof secret!=='string'||encoder.encode(secret).length>72)return {ok:false,error:'invalid_credentials'};
      try {if(!await limiter.allow('login',login,context))return {ok:false,error:'rate_limited'};} catch (_) {return {ok:false,error:'unavailable'};}
      try {
        const account=await accounts.find(login);
        // The provider must perform a comparable dummy verification for unknown
        // users rather than short-circuiting. It decides whether login succeeded.
        const result=await provider.authenticate(account||null,secret);
        if(!account||!result||!result.ok||!result.identity||result.identity.id!==account.id)return {ok:false,error:'invalid_credentials'};
        return {ok:true,identity:{id:account.id,accountId:account.accountId}};
      } catch (_) {return {ok:false,error:'unavailable'};}
    }
    return {register,login};
  }
  const api={username,nickname,password,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoCredentialsCore=api;
})(typeof window!=='undefined'?window:globalThis);
