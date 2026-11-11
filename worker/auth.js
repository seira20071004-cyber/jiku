// Google OAuth authorization-code flow; only the server handles client secrets.
const encoder=new TextEncoder();
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unbase64=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
const now=()=>Math.floor(Date.now()/1000);
export function googleConfig(env){
  if(env.JIKU_AUTH_MODE!=='google')return null;
  const origin=new URL(env.JIKU_AUTH_ORIGIN||'');
  const local=['localhost','127.0.0.1'].includes(origin.hostname);
  if(origin.origin!==env.JIKU_AUTH_ORIGIN||(!local&&origin.protocol!=='https:')||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||(env.JIKU_SESSION_SECRET||'').length<32||!env.JIKU_ALLOWED_EMAILS)throw Error('Google authentication is not configured');
  const allowedEmails = [env.JIKU_ALLOWED_EMAILS, env.JIKU_ADDITIONAL_ALLOWED_EMAILS ?? '']
    .flatMap(list => list.split(','))
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  return {origin:origin.origin,secure:origin.protocol==='https:',clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,secret:env.JIKU_SESSION_SECRET,allowedEmails,redirectUri:origin.origin+'/api/auth/google/callback'};
}
const cookieName=(kind,c)=>(c.secure?'__Host-':'')+'jiku-'+kind;
const cookie=(request,name)=>request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
function setCookie(kind,value,age,c){return `${cookieName(kind,c)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${c.secure?'; Secure':''}`}
async function key(c){return crypto.subtle.importKey('raw',encoder.encode(c.secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function sign(value,kind,c){const payload=base64url(encoder.encode(JSON.stringify(value))),signature=await crypto.subtle.sign('HMAC',await key(c),encoder.encode(kind+'.'+payload));return payload+'.'+base64url(signature)}
export async function readSigned(request,kind,c){try{const raw=cookie(request,cookieName(kind,c));if(!raw||raw.length>4096||!/^[-\w]+\.[-\w]{43}$/.test(raw))return null;const [payload,sig]=raw.split('.');if(!await crypto.subtle.verify('HMAC',await key(c),unbase64(sig),encoder.encode(kind+'.'+payload)))return null;const value=JSON.parse(new TextDecoder().decode(unbase64(payload)));return Number.isInteger(value.exp)&&value.exp>now()?value:null}catch{return null}}
function redirect(url,cookies=[]){const h=new Headers({Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});cookies.forEach(c=>h.append('Set-Cookie',c));return new Response(null,{status:303,headers:h})}
export function googlePicture(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='lh3.googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com'))&&u.href.length<1000?u.href:null}catch{return null}}
export async function session(request,c){const s=await readSigned(request,'session',c);return s&&typeof s.sub==='string'&&typeof s.email==='string'&&c.allowedEmails.includes(s.email)?s:null}
export async function authRoute(request,c,fetcher=fetch){const u=new URL(request.url),p=u.pathname;
  if(p==='/api/auth/google'){
    if(request.method!=='GET')return new Response(null,{status:405});
    const state=random(),verifier=random(),challenge=base64url(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))),url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
    return redirect(url.href,[setCookie('flow',await sign({state,verifier,onboarding:u.searchParams.get('onboarding')==='1',exp:now()+600},'flow',c),600,c)]);
  }
  if(p==='/api/auth/google/callback'){
    if(request.method!=='GET')return new Response(null,{status:405});
    const f=await readSigned(request,'flow',c),code=u.searchParams.get('code');
    const clear=setCookie('flow','',0,c),resume=f?.onboarding===true;
    const loginError=reason=>redirect(c.origin+'/?login='+reason+(resume?'&onboarding=resume':''),[clear]);
    const fail=stage=>{console.error('Google login failed',{stage});return loginError('retry')};
    if(!f||typeof f.verifier!=='string'||f.state!==u.searchParams.get('state')||!code||u.searchParams.has('error'))return fail(!f?(cookie(request,cookieName('flow',c))?'flow-signature':'flow-cookie'):'flow-state');
    let stage='token-fetch';try{
      const t=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),body:new URLSearchParams({code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri,grant_type:'authorization_code',code_verifier:f.verifier})});
      if(!t.ok){let category='unknown';try{const result=await t.json();if(['invalid_client','invalid_grant','invalid_request','unauthorized_client'].includes(result.error))category=result.error}catch{}return fail('token:'+category)}const tokens=await t.json();if(typeof tokens.access_token!=='string')return fail('token-format');stage='profile-fetch';
      const r=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},redirect:'manual',signal:AbortSignal.timeout(10000)});if(!r.ok)return fail('profile-status:'+r.status);
      const profile=await r.json();if(typeof profile.sub!=='string'||!profile.sub||typeof profile.email!=='string'||profile.email_verified!==true)return fail('profile-format');
      const email=profile.email.toLowerCase();if(!c.allowedEmails.includes(email))return loginError('denied');
      return redirect(c.origin+(resume?'/?onboarding=resume#tree':'/#tree'),[clear,setCookie('session',await sign({sub:profile.sub,email,picture:googlePicture(profile.picture),name:typeof profile.name==='string'?profile.name.slice(0,100):email,exp:now()+604800},'session',c),604800,c)]);
    }catch(error){console.error('Google login exception',{stage,name:error?.name});return fail(stage)}
  }
  if(p==='/api/auth/logout'){
    if(request.method!=='POST')return new Response(null,{status:405});if(request.headers.get('origin')!==c.origin)return new Response(null,{status:403});
    return redirect(c.origin+'/',[setCookie('session','',0,c),setCookie('flow','',0,c)]);
  }
  return null;
}
export function loginPage(error=''){
 const message=error==='denied'?'このGoogleアカウントには利用が許可されていません。':error==='retry'?'ログインを完了できませんでした。もう一度お試しください。':'';
 return `<!doctype html>
<html lang="ja">
<head>
 <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
 <meta name="theme-color" content="#050612"><title>Jiku | ログイン</title>
 <link rel="manifest" href="/manifest.webmanifest">
 <link rel="apple-touch-icon" sizes="180x180" href="/icons/jiku-180.png">
 <meta name="apple-mobile-web-app-title" content="Jiku">
 <link rel="icon" type="image/svg+xml" href="/icons/jiku.svg">
 <link rel="stylesheet" href="/onboarding.css">
</head>
<body class="birth-page">
  <main class="birth-screen" data-stage="welcome" data-choosing aria-label="Jiku ログイン">
   <div class="birth-sky" aria-hidden="true"><div class="birth-haze"></div></div>
   <header class="birth-header">
    <span class="birth-wordmark">Jiku<span>●</span></span>
   </header>
   <div class="birth-content">
    <div class="birth-conversation">
     <div class="birth-turn birth-welcome-card">
      <h1>Jikuへようこそ。</h1>
      <p>あなたの目標達成をサポートします。</p>
     </div>
    </div>
    <div class="birth-controls">
     <p class="birth-login-instruction">まずはログインしてください。</p>
     <a class="birth-primary" href="/api/auth/google" target="_top">Googleでログイン <span aria-hidden="true">→</span></a>
     ${message?`<p class="birth-error" role="alert">${message}</p>`:''}
    </div>
   </div>
  </main>
</body>
</html>`;
}
