import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {dispatchReminders,pushRoute} from '../worker/push.js';

test('設定した日本時間以降に朝と夕方をそれぞれ一度だけ送る',async t=>{
 const database=new DatabaseSync(':memory:');
 t.after(()=>database.close());
 for(const migration of ['0000_push_reminders','0001_reminder_times']){
  database.exec(readFileSync(new URL('../drizzle/'+migration+'.sql',import.meta.url),'utf8'));
 }
 const DB={prepare(sql){
  const stmt=database.prepare(sql);
  return {bind(...values){return {
   all:async ()=>({results:stmt.all(...values)}),
   first:async ()=>stmt.get(...values),
   run:async ()=>({meta:stmt.run(...values)})
  };}};
 }};
 const receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const signer=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const asBase64=value=>Buffer.from(value).toString('base64url');
 const env={DB,JIKU_PUSH_PRIVATE_KEY:JSON.stringify(await crypto.subtle.exportKey('jwk',signer.privateKey)),
  JIKU_PUSH_PUBLIC_KEY:asBase64(await crypto.subtle.exportKey('raw',signer.publicKey))};
 const origin='https://example.com';
 const subscription={endpoint:'https://web.push.apple.com/ready',keys:{
  p256dh:asBase64(await crypto.subtle.exportKey('raw',receiver.publicKey)),
  auth:asBase64(new Uint8Array(16))
 }};
 t.mock.method(globalThis,'fetch',async (url,options)=>{
  assert.equal(url,subscription.endpoint);
  assert.equal(options.headers['Content-Encoding'],'aes128gcm');
  assert(options.body.length>100);
  return new Response(null,{status:201});
 });
 function subscribe(user,body){
  return pushRoute(new Request(origin+'/api/push/subscribe',{method:'POST',headers:{Origin:origin},
   body:JSON.stringify({...subscription,test:false,...body})}),env,origin,{sub:user});
 }
 assert.equal((await subscribe('owner',{times:{wake:425,evening:1095}})).status,200);
 assert.equal((await subscribe('stranger',{times:{wake:420,evening:1080}})).status,409);
 assert.equal((await subscribe('owner',{times:{wake:1440,evening:1080}})).status,400);
 const send=iso=>dispatchReminders(env,origin,new Date(iso));
 assert.equal((await send('2026-11-13T22:04:00Z')).sent,0);
 assert.equal((await send('2026-11-13T22:07:00Z')).sent,1);
 assert.equal((await send('2026-11-13T22:12:00Z')).sent,0);
 assert.equal((await send('2026-11-14T09:14:00Z')).sent,0);
 assert.equal((await send('2026-11-14T09:17:00Z')).sent,1);
 assert.equal((await send('2026-11-14T09:22:00Z')).sent,0);
 assert.equal((await send('2026-11-14T22:07:00Z')).sent,1);
 assert.equal(fetch.mock.callCount(),3);
 assert.deepEqual({...database.prepare('SELECT wake_minute, evening_minute FROM jiku_push').get()},
  {wake_minute:425,evening_minute:1095});
});
