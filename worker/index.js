import {googleConfig,authRoute,session,loginPage,googlePicture} from './auth.js';
const PUBLIC_ASSETS=new Set([
 '/onboarding.css','/onboarding.js','/onboarding-sky.js','/origin-framing.js','/origin-preview.js',
 '/manifest.webmanifest','/icons/jiku.svg','/icons/jiku-180.png','/icons/jiku-192.png','/icons/jiku-512.png'
]);
// ASSET_MAP is embedded at build time. Authentication runs before serving assets.
export default {async fetch(request,env){
 const u=new URL(request.url);let c;
 try{c=googleConfig(env);if(!c)throw Error('Authentication required')}catch{return new Response('Googleログインの設定が未完了です。管理者にお問い合わせください。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})}
 if(c){
  if(u.origin!==c.origin)return new Response(null,{status:421});
  const auth=await authRoute(request,c);if(auth)return auth;
  const user=await session(request,c);
  if(u.pathname==='/api/session')return Response.json(user?{mode:'google',user:{id:user.sub,email:user.email,name:user.name,picture:googlePicture(user.picture)}}:{mode:'google',user:null},{status:user?200:401,headers:{'Cache-Control':'no-store'}});
  if(!user&&!PUBLIC_ASSETS.has(u.pathname)){if(u.pathname==='/'||u.pathname==='/index.html')return new Response(loginPage(u.searchParams.get('login')),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});return new Response(null,{status:401,headers:{'Cache-Control':'no-store'}})}
 }else if(u.pathname==='/api/session')return Response.json({mode:'local'},{headers:{'Cache-Control':'no-store'}});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 const path=u.pathname==='/'?'/index.html':u.pathname;const asset=Object.hasOwn(ASSET_MAP,path)?ASSET_MAP[path]:null;if(!asset)return new Response('Not found',{status:404});
 const body=request.method==='HEAD'?null:asset.type==='image/png'?Uint8Array.from(atob(asset.body),byte=>byte.charCodeAt(0)):asset.body;
 return new Response(body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}};
