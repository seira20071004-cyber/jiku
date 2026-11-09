import {test} from 'node:test';import assert from 'node:assert/strict';
import {googleConfig,authRoute,readSigned,session,sign,googlePicture} from '../worker/auth.js';
const c=googleConfig({JIKU_AUTH_MODE:'google',JIKU_AUTH_ORIGIN:'https://jiku.example',GOOGLE_CLIENT_ID:'test-id',GOOGLE_CLIENT_SECRET:'test-secret',JIKU_SESSION_SECRET:'a'.repeat(40),JIKU_ALLOWED_EMAILS:'owner@example.com'});
const req=(path,token)=>new Request('https://jiku.example'+path,{headers:token?{Cookie:'__Host-jiku-flow='+token}:{}});
test('Googleモードは不足設定を拒否し、通常モードは認証追加なし',()=>{assert.equal(googleConfig({}),null);assert.throws(()=>googleConfig({JIKU_AUTH_MODE:'google'}))});
test('開始はPKCE S256と短命HttpOnly Cookieを使う',async()=>{const r=await authRoute(req('/api/auth/google'),c);assert.equal(r.status,303);const u=new URL(r.headers.get('location'));assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),'https://jiku.example/api/auth/google/callback');assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=600; Secure/)});
test('改ざん、期限切れ、種類違いの署名を拒否',async()=>{const value={state:'state',verifier:'verifier',exp:Math.floor(Date.now()/1000)+60},t=await sign(value,'flow',c);assert(await readSigned(req('/',t),'flow',c));assert.equal(await readSigned(req('/',t.slice(0,-4)+'abcd'),'flow',c),null);const expired=await sign({...value,exp:1},'flow',c);assert.equal(await readSigned(req('/',expired),'flow',c),null);assert.equal(await readSigned(req('/',await sign(value,'session',c)),'flow',c),null)});
test('state不一致はGoogleへトークンを送らない',async()=>{const t=await sign({state:'correct',verifier:'v',exp:Math.floor(Date.now()/1000)+60},'flow',c);let calls=0;const r=await authRoute(req('/api/auth/google/callback?state=wrong&code=123',t),c,async()=>{calls++;throw Error()});assert.equal(calls,0);assert.match(r.headers.get('location'),/login=retry/)});
test('認証済みプロフィールと許可メールのみセッションを発行',async()=>{const t=await sign({state:'correct',verifier:'v',exp:Math.floor(Date.now()/1000)+60},'flow',c);let calls=0;const r=await authRoute(req('/api/auth/google/callback?state=correct&code=123',t),c,async(url,options)=>{calls++;assert.equal(options.redirect,'manual');if(url.endsWith('/token')){assert.equal(options.body.get('code_verifier'),'v');return Response.json({access_token:'test-access'})}assert.equal(options.headers.Authorization,'Bearer test-access');return Response.json({sub:'google-id',email:'owner@example.com',email_verified:true,name:'Owner',picture:'https://lh3.googleusercontent.com/a/avatar'})});assert.equal(calls,2);assert.equal(r.headers.get('location'),'https://jiku.example/#tree');const cookies=r.headers.get('set-cookie'),token=cookies.match(/__Host-jiku-session=([^;]+)/)[1];const user=await session(new Request('https://jiku.example',{headers:{Cookie:'__Host-jiku-session='+token}}),c);assert.equal(user.sub,'google-id');assert.equal(user.email,'owner@example.com');assert.equal(user.picture,'https://lh3.googleusercontent.com/a/avatar')});
test('未許可アカウントはログインできない',async()=>{const t=await sign({state:'s',verifier:'v',exp:Math.floor(Date.now()/1000)+60},'flow',c);const r=await authRoute(req('/api/auth/google/callback?state=s&code=1',t),c,async url=>Response.json(url.endsWith('/token')?{access_token:'a'}:{sub:'other',email:'other@example.com',email_verified:true}));assert.match(r.headers.get('location'),/login=denied/);assert(!r.headers.get('set-cookie').includes('jiku-session='))});
test('ログアウトは同一オリジンPOSTのみ許可',async()=>{assert.equal((await authRoute(req('/api/auth/logout'),c)).status,405);assert.equal((await authRoute(new Request('https://jiku.example/api/auth/logout',{method:'POST',headers:{Origin:'https://other.example'}}),c)).status,403)});

test('公開Workerは認証設定なし・セッションなしでアプリを返さない',async()=>{
 const {default:worker}=await import('../dist/server/index.js');
 const env={JIKU_AUTH_MODE:'google',JIKU_AUTH_ORIGIN:'https://jiku.example',GOOGLE_CLIENT_ID:'test-id',GOOGLE_CLIENT_SECRET:'test-secret',JIKU_SESSION_SECRET:'a'.repeat(40),JIKU_ALLOWED_EMAILS:'owner@example.com'};
 assert.equal((await worker.fetch(req('/'),{})).status,503);
 assert.equal((await worker.fetch(req('/app.js'),env)).status,401);
 assert.equal((await worker.fetch(req('/model.js'),env)).status,401);assert.equal((await worker.fetch(req('/tree3d.js'),env)).status,401);
 assert.equal((await worker.fetch(req('/api/session'),env)).status,401);
 for(const name of ['onboarding.css','onboarding.js','onboarding-sky.js']){
  const asset=await worker.fetch(req('/'+name),env);assert.equal(asset.status,200);
 }
 assert.equal((await worker.fetch(req('/universe-model.js'),env)).status,401);
 const page=await worker.fetch(req('/'),env);assert.equal(page.status,200);assert.match(await page.text(),/Googleでログイン/);
 const token=await sign({sub:'owner-id',email:'owner@example.com',name:'Owner',exp:Math.floor(Date.now()/1000)+60},'session',c);
 const authed=new Request('https://jiku.example/app.js',{headers:{Cookie:'__Host-jiku-session='+token}});
 const js=await worker.fetch(authed,env);assert.equal(js.status,200);assert.match(await js.text(),/const storageKey/);
});

test('プロフィール画像はGoogleのHTTPS画像のみ許可し、古いセッションでも安全に省略できる',()=>{assert.equal(googlePicture(undefined),null);assert.equal(googlePicture('https://evil.example/avatar'),null);assert.equal(googlePicture('javascript:alert(1)'),null);assert.equal(googlePicture('https://lh3.googleusercontent.com/a/test'),'https://lh3.googleusercontent.com/a/test')});

test('宇宙作成からのGoogleログインは署名済みの開始情報でだけ再開する',async()=>{
 const start=await authRoute(req('/api/auth/google?onboarding=1'),c);
 const flow=start.headers.get('set-cookie').match(/__Host-jiku-flow=([^;]+)/)[1];
 const signed=await readSigned(req('/',flow),'flow',c);
 const fetcher=async url=>Response.json(url.endsWith('/token')?{access_token:'a'}:{sub:'owner-id',email:'owner@example.com',email_verified:true});
 const result=await authRoute(req('/api/auth/google/callback?code=1&state='+signed.state,flow),c,fetcher);
 assert.equal(result.headers.get('location'),'https://jiku.example/?onboarding=resume#tree');
 const canceled=await authRoute(req('/api/auth/google/callback?error=access_denied&state='+signed.state,flow),c,fetcher);
 assert.equal(canceled.headers.get('location'),'https://jiku.example/?login=retry&onboarding=resume');
});
