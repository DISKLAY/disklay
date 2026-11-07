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
    return Array.from(input).length>=10 && length<=256;
  }
  function create({accounts,provider,limiter}) {
    if(!accounts||!provider||!limiter||typeof limiter.allow!=='function')throw new Error('missing_adapters');
    async function register(input,context) {
      const login=username(input?.username),name=nickname(input?.nickname),secret=input?.password;
      if(!login||!name||!password(secret))return {ok:false,error:'invalid_input'};
      if(!await limiter.allow('register',login,context))return {ok:false,error:'rate_limited'};
      // reserve() must atomically prevent both concurrent and pre-existing names.
      const reservation=await accounts.reserve(login);
      if(!reservation)return {ok:false,error:'username_taken'};
      let identity=null;
      try {
        // The provider is responsible for secure password storage and a random,
        // non-deliverable internal identifier; never use a real person's email.
        identity=await provider.create({password:secret,nickname:name});
        if(!identity||typeof identity.id!=='string'||!identity.id)throw new Error('invalid_identity');
        await accounts.complete(reservation,identity.id,name);
        return {ok:true};
      } catch (_) {
        // Compensate a failed bind without concealing a failed deletion. The
        // adapter must retain the reservation for later cleanup if it fails.
        let cleaned=!identity;
        if(identity){try{await provider.remove(identity.id);cleaned=true;}catch(_){cleaned=false;}}
        if(cleaned){try{await accounts.release(reservation);}catch(_){/* retained for cleanup */}}
        return {ok:false,error:'unavailable'};
      }
    }
    async function login(input,context) {
      const login=username(input?.username),secret=input?.password;
      if(!login||typeof secret!=='string'||encoder.encode(secret).length>256)return {ok:false,error:'invalid_credentials'};
      if(!await limiter.allow('login',login,context))return {ok:false,error:'rate_limited'};
      try {
        const account=await accounts.find(login);
        // The provider must perform a comparable dummy verification for unknown
        // users rather than short-circuiting. It decides whether login succeeded.
        const result=await provider.authenticate(account||null,secret);
        if(!account||!result||!result.ok)return {ok:false,error:'invalid_credentials'};
        return {ok:true,identity:result.identity};
      } catch (_) {return {ok:false,error:'unavailable'};}
    }
    return {register,login};
  }
  const api={username,nickname,password,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoCredentialsCore=api;
})(typeof window!=='undefined'?window:globalThis);
