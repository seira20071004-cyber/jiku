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
  return {origin:origin.origin,secure:origin.protocol==='https:',clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,secret:env.JIKU_SESSION_SECRET,allowedEmails:env.JIKU_ALLOWED_EMAILS.split(',').map(s=>s.trim().toLowerCase()),redirectUri:origin.origin+'/api/auth/google/callback'};
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
    return redirect(url.href,[setCookie('flow',await sign({state,verifier,exp:now()+600},'flow',c),600,c)]);
  }
  if(p==='/api/auth/google/callback'){
    const clear=setCookie('flow','',0,c),fail=(stage)=>{console.error('Google login failed',{stage});return redirect(c.origin+'/?login=retry',[clear])};
    if(request.method!=='GET')return new Response(null,{status:405});
    const f=await readSigned(request,'flow',c),code=u.searchParams.get('code');
    if(!f||typeof f.verifier!=='string'||f.state!==u.searchParams.get('state')||!code||u.searchParams.has('error'))return fail(!f?(cookie(request,cookieName('flow',c))?'flow-signature':'flow-cookie'):'flow-state');
    let stage='token-fetch';try{
      const t=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),body:new URLSearchParams({code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri,grant_type:'authorization_code',code_verifier:f.verifier})});
      if(!t.ok){let category='unknown';try{const result=await t.json();if(['invalid_client','invalid_grant','invalid_request','unauthorized_client'].includes(result.error))category=result.error}catch{}return fail('token:'+category)}const tokens=await t.json();if(typeof tokens.access_token!=='string')return fail('token-format');stage='profile-fetch';
      const r=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},redirect:'manual',signal:AbortSignal.timeout(10000)});if(!r.ok)return fail('profile-status:'+r.status);
      const profile=await r.json();if(typeof profile.sub!=='string'||!profile.sub||typeof profile.email!=='string'||profile.email_verified!==true)return fail('profile-format');
      const email=profile.email.toLowerCase();if(!c.allowedEmails.includes(email))return redirect(c.origin+'/?login=denied',[clear]);
      return redirect(c.origin+'/#tree',[clear,setCookie('session',await sign({sub:profile.sub,email,picture:googlePicture(profile.picture),name:typeof profile.name==='string'?profile.name.slice(0,100):email,exp:now()+604800},'session',c),604800,c)]);
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
 return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>jiku | ログイン</title><style>body{margin:0;background:#f7f8f2;color:#293d31;font-family:system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center}main{width:min(360px,calc(100vw - 80px));text-align:center;padding:38px 24px;border:1px solid #e7e9df;border-radius:18px;background:#fffefa}.brand{font:54px Georgia;margin:0 0 30px}.brand span{color:#91a678}h1{font:23px Georgia;line-height:1.7}p{font-size:12px;color:#8b957e;line-height:2}a{margin:30px 0;display:flex;align-items:center;justify-content:center;gap:14px;padding:14px;background:white;color:#293d31;text-decoration:none;border:1px solid #d7ddce;border-radius:8px;font-size:14px}a span{font:bold 22px Arial;color:#4285f4}.error{color:#a16c50}small{font-size:10px;color:#98a18e}</style><main><div class="brand">jiku<span>●</span></div><h1>自分の軸を、<br>日々の行動へ。</h1><p>あなたの木と、小さな一歩を育てよう。</p>${message?`<p class="error" role="alert">${message}</p>`:''}<a href="/api/auth/google" target="_top"><span>G</span>Googleでログイン</a><small>データはこのブラウザでアカウント別に保存されます。</small></main></html>`;
}
