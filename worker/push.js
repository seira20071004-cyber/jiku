const pushEncoder = new TextEncoder();
const reminderTitle = '今日、残りの時間はどのペースでいけそう？';
const githubIssuer = 'https://token.actions.githubusercontent.com';
const workflowRef = 'seira20071004-cyber/jiku/.github/workflows/jiku-reminder.yml@refs/heads/main';
const pushB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const pushBytes = value => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const pushJSON = value => pushB64(pushEncoder.encode(JSON.stringify(value)));
const concatPush = (...parts) => Uint8Array.from(parts.flatMap(part=>Array.from(part)));

function validPushSubscription(value){
 try{
  const u=new URL(value.endpoint);
  const known=u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||
   u.hostname==='updates.push.services.mozilla.com'||u.hostname==='push.services.mozilla.com';
  return known&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&u.href===value.endpoint&&
   u.pathname!=='/'&&value.endpoint.length<=2048&&pushBytes(value.keys.p256dh).length===65&&
   pushBytes(value.keys.auth).length===16;
 }catch{return false}
}
async function pushDerive(secret,salt,info,length){
 const key=await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));
}
async function encryptReminder(subscription,message){
 const receiver=pushBytes(subscription.keys.p256dh);
 const sender=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const publicKey=new Uint8Array(await crypto.subtle.exportKey('raw',sender.publicKey));
 const receiverKey=await crypto.subtle.importKey('raw',receiver,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:receiverKey},sender.privateKey,256);
 const ikm=await pushDerive(shared,pushBytes(subscription.keys.auth),
  concatPush(pushEncoder.encode('WebPush: info\0'),receiver,publicKey),32);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const [cek,iv]=await Promise.all([
  pushDerive(ikm,salt,pushEncoder.encode('Content-Encoding: aes128gcm\0'),16),
  pushDerive(ikm,salt,pushEncoder.encode('Content-Encoding: nonce\0'),12)
 ]);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,
  concatPush(pushEncoder.encode(JSON.stringify(message)),[2])));
 return concatPush(salt,[0,0,16,0,publicKey.length],publicKey,ciphertext);
}
async function sendReminder(subscription,env,origin,test=false){
 if(!validPushSubscription(subscription))return {ok:false,status:410};
 const audience=new URL(subscription.endpoint).origin;
 const key=await crypto.subtle.importKey('jwk',JSON.parse(env.JIKU_PUSH_PRIVATE_KEY),
  {name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const claims={aud:audience,exp:Math.floor(Date.now()/1000)+43200,sub:origin};
 const unsigned=pushJSON({typ:'JWT',alg:'ES256'})+'.'+pushJSON(claims);
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,pushEncoder.encode(unsigned));
 const body=await encryptReminder(subscription,test?{title:'Jikuのテスト通知',body:'通知を受け取れました。',test:true}:
  {title:'Jiku',body:reminderTitle});
 return fetch(subscription.endpoint,{method:'POST',redirect:'error',headers:{
  Authorization:'vapid t='+unsigned+'.'+pushB64(signature)+', k='+env.JIKU_PUSH_PUBLIC_KEY,
  'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:test?'90':'3600',Urgency:'normal'
 },body});
}
async function verifyReminderJob(request,origin){
 try{
  const parts=(request.headers.get('Authorization')||'').replace(/^Bearer /,'').split('.');
  if(parts.length!==3||parts.some(p=>!p||p.length>12000))return false;
  const [header,body,signature]=parts,decode=value=>JSON.parse(new TextDecoder().decode(pushBytes(value)));
  const h=decode(header),c=decode(body),now=Date.now()/1000;
  if(h.alg!=='RS256'||typeof h.kid!=='string'||c.iss!==githubIssuer||c.aud!==origin+'/api/push/dispatch'||
   !['schedule','workflow_dispatch'].includes(c.event_name)||c.workflow_ref!==workflowRef||
   c.ref!=='refs/heads/main'||!Number.isFinite(c.exp)||c.exp<=now||c.exp>now+900||
   !Number.isFinite(c.nbf)||c.nbf>now+5)return false;
  const response=await fetch(githubIssuer+'/.well-known/jwks',{redirect:'error'});
  if(!response.ok)return false;
  const jwk=(await response.json()).keys.find(key=>key.kid===h.kid&&key.kty==='RSA');
  if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,pushBytes(signature),pushEncoder.encode(header+'.'+body));
 }catch{return false}
}
async function dispatchReminders(env,origin){
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 if(hour<18||hour>=20)return {outsideWindow:true,sent:0};
 const {results}=await env.DB.prepare('SELECT endpoint, subscription FROM jiku_push WHERE delivery_day IS NOT ? LIMIT 100').bind(day).all();
 let sent=0,failed=0;
 for(const row of results){
  const claim=await env.DB.prepare('UPDATE jiku_push SET delivery_day=? WHERE endpoint=? AND delivery_day IS NOT ?')
   .bind(day,row.endpoint,day).run();
  if(!claim.meta.changes)continue;
  try{
   const response=await sendReminder(JSON.parse(row.subscription),env,origin);
   if(response.ok){sent++;continue}
   if([404,410].includes(response.status)){
    await env.DB.prepare('DELETE FROM jiku_push WHERE endpoint=?').bind(row.endpoint).run();
    continue;
   }
  }catch{}
  failed++;
  await env.DB.prepare('UPDATE jiku_push SET delivery_day=NULL WHERE endpoint=? AND delivery_day=?').bind(row.endpoint,day).run();
 }
 return {sent,failed};
}
export async function pushRoute(request,env,origin,user){
 const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 const path=new URL(request.url).pathname;
 const ready=Boolean(env.DB&&env.JIKU_PUSH_PUBLIC_KEY&&env.JIKU_PUSH_PRIVATE_KEY);
 if(path==='/api/push/dispatch'){
  if(request.method!=='POST')return response({},405);
  if(!await verifyReminderJob(request,origin))return response({},401);
  if(!ready)return response({},503);
  const result=await dispatchReminders(env,origin);
  return response(result,result.failed?502:200);
 }
 if(!user)return response({},401);
 if(path==='/api/push/config'&&request.method==='GET')return response({publicKey:ready?env.JIKU_PUSH_PUBLIC_KEY:null});
 if(request.method!=='POST'||request.headers.get('Origin')!==origin)return response({},403);
 if(!ready)return response({},503);
 let body;
 try{
  const raw=await request.text();
  if(raw.length>8192)return response({},413);
  body=JSON.parse(raw);
 }catch{return response({},400)}
 if(!body||typeof body!=='object')return response({},400);
 if(path==='/api/push/unsubscribe'&&typeof body.endpoint==='string'){
  await env.DB.prepare('DELETE FROM jiku_push WHERE endpoint=? AND owner=?').bind(body.endpoint,user.sub).run();
  return response({ok:true});
 }
 if(path!=='/api/push/subscribe'||!validPushSubscription(body))return response({},400);
 const existing=await env.DB.prepare('SELECT owner FROM jiku_push WHERE endpoint=?').bind(body.endpoint).first();
 if(existing&&existing.owner!==user.sub)return response({},409);
 const saved=await env.DB.prepare('INSERT INTO jiku_push (endpoint,owner,subscription) VALUES (?,?,?) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription WHERE owner=excluded.owner')
  .bind(body.endpoint,user.sub,JSON.stringify({endpoint:body.endpoint,keys:body.keys})).run();
 if(!saved.meta.changes)return response({},409);
 try{
  const test=await sendReminder(body,env,origin,true);
  if(test.ok)return response({ok:true,testSent:true});
  if([404,410].includes(test.status)){
   await env.DB.prepare('DELETE FROM jiku_push WHERE endpoint=? AND owner=?').bind(body.endpoint,user.sub).run();
   return response({expired:true},410);
  }
 }catch{}
 return response({ok:true,testSent:false});
}
