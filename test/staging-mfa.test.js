import test from 'node:test';
import assert from 'node:assert/strict';
import { listTotp, enrollTotp, verifyTotp } from '../public/staging/mfa.js';
const id='11111111-1111-4111-8111-111111111111', challenge='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(80), upgraded='b'.repeat(80);
test('only verified TOTP factors from verified user are selectable',async()=>{
  const list=await listTotp(async(path,body,t,method)=>{
    assert.deepEqual([path,body,t,method],['user',null,token,'GET']);
    return {id,role:'authenticated',email_confirmed_at:'2026-01-01',factors:[
      {id,factor_type:'totp',status:'verified',friendly_name:'Test device'},
      {id,factor_type:'totp',status:'unverified'},{id,factor_type:'phone',status:'verified'}]};
  },token);
  assert.deepEqual(list,[{id,label:'Test device'}]);
  await assert.rejects(()=>listTotp(async()=>({id,role:'authenticated',is_anonymous:true}),token));
});
test('enrollment ignores provider SVG and returns only validated manual key',async()=>{
  const secret='ABCDEFGHIJKLMNOP';
  const factor=await enrollTotp(async(path,body,t)=>{
    assert.deepEqual([path,body,t],['factors',{factor_type:'totp',issuer:'QSwipe Staging'},token]);
    return {id,type:'totp',totp:{secret,qr_code:'ignored',uri:'ignored'}};
  },token);
  assert.deepEqual(factor,{id,secret});
  await assert.rejects(()=>enrollTotp(async()=>({id,type:'totp',totp:{secret:'bad'}}),token));
});
test('challenge then verify uses caller session and accepts only new provider access token',async()=>{
  const calls=[];
  const next=await verifyTotp(async(path,body,t)=>{calls.push([path,body,t]);return path.endsWith('/challenge')?{id:challenge}:{access_token:upgraded,refresh_token:'ignored'};},token,id,'123456');
  assert.equal(next,upgraded);
  assert.deepEqual(calls,[['factors/'+id+'/challenge',{},token],['factors/'+id+'/verify',{challenge_id:challenge,code:'123456'},token]]);
});
test('invalid code, factor, challenge, failed provider and unchanged session all fail closed',async()=>{
  let calls=0;const req=async()=>{calls++;return {id:challenge,access_token:token};};
  await assert.rejects(()=>verifyTotp(req,token,'invalid','123456'));await assert.rejects(()=>verifyTotp(req,token,id,'12345'));assert.equal(calls,0);
  await assert.rejects(()=>verifyTotp(async()=>({id:'bad'}),token,id,'123456'));
  await assert.rejects(()=>verifyTotp(async()=>{throw Error('provider denied');},token,id,'123456'));
  await assert.rejects(()=>verifyTotp(req,token,id,'123456'));
});
