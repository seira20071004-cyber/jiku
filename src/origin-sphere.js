import {AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, SphereGeometry} from 'three';

export const ORIGIN_FOV=42;
export const ORIGIN_RADIUS=3.2;
export const originDistance=aspect=>Math.max(24,19/Math.max(.2,aspect));

// A glass-like shell with interference bands over slowly moving clouds of light.
export function originSphere(noise) {
 const geometry=new SphereGeometry(ORIGIN_RADIUS,80,56);
 const material=new ShaderMaterial({
  uniforms:{uTime:{value:0}},
  vertexShader:`
   varying vec3 vSurface,vNormal,vView;
   void main(){
    vec4 eye=modelViewMatrix*vec4(position,1.);
    vSurface=normalize(position);vNormal=normalize(normalMatrix*normal);vView=-eye.xyz;
    gl_Position=projectionMatrix*eye;
   }`,
  fragmentShader:`
   varying vec3 vSurface,vNormal,vView;
   uniform float uTime;
   ${noise}
   vec3 spectrum(float x){return .52+.48*cos(6.28318*(x+vec3(.04,.71,.43)));}
   void main(){
    vec3 n=normalize(vNormal),s=normalize(vSurface),viewDir=normalize(vView);
    float t=uTime*.04;
    float facing=max(0.,dot(n,viewDir));
    vec3 p=s*2.55+vec3(t*.13,-t*.18,t*.08);
    vec3 warp=vec3(fbm(p+1.3),fbm(p+7.1),fbm(p+13.7));
    float clouds=fbm(p+2.3*warp);
    float veil=sin(s.y*15.+s.x*4.+clouds*18.+sin(s.x*5.+t)*2.);
    float ribbons=pow(.5+.5*veil,5.)*smoothstep(.27,.72,clouds);
    float tint=.52+s.x*.23+s.y*.21+clouds*.65+(.8-facing)*.27+sin(t*.4)*.13;
    vec3 color=spectrum(tint);
    float upper=max(0.,dot(n,normalize(vec3(-.65,.88,.7))));
    vec3 interior=vec3(.003,.006,.022)+color*(.022+.16*pow(clouds,2.)+.17*ribbons);
    float glass=pow(1.-facing,2.8);
    float edge=pow(1.-facing,12.);
    vec3 thin=spectrum(tint+.24+glass*.21);
    vec3 light=interior*(.65+upper*.55)+thin*(glass*.38+edge*.55);
    float glint=pow(max(0.,dot(n,normalize(vec3(-.44,.68,.82)))),34.);
    light+=vec3(.54,.72,1.)*glint*.48;
    float speck=noise(s*290.);
    light+=spectrum(tint+.37)*pow(speck,35.)*.6*(.45+ribbons);
    gl_FragColor=vec4(light,1.);
   }`
 });
 const sphere=new Mesh(geometry,material);
 sphere.userData.spin=.045;
 return sphere;
}

// A thin halo follows the edge of the sphere. Later stages reveal wider,
// broken bands of light without changing the size of the sphere itself.
export function originAura(noise,strength,time) {
 const material=new ShaderMaterial({
  transparent:true,depthWrite:false,blending:AdditiveBlending,
  uniforms:{uTime:time,uGrowth:{value:strength}},
  vertexShader:`
   varying vec2 vAura;
   void main(){
    vAura=(uv-.5)*2.;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
   }`,
  fragmentShader:`
   uniform float uTime,uGrowth;
   varying vec2 vAura;
   ${noise}
   void main(){
    vec2 p=vAura*1.8;
    float radius=length(p),a=atan(p.y,p.x),t=uTime*.2;
    vec2 flow=vec2(cos(a),sin(a));
    float cloud=fbm(vec3(flow*3.,radius*7.+t*.4));
    float edge=smoothstep(.96,1.025,radius);
    float width=.045+.27*pow(uGrowth,.75);
    float reach=radius-1.;
    float haze=exp(-max(0.,reach)/width);
    float waves=.55+.45*sin(a*4.+t+cloud*8.);
    float filaments=pow(.5+.5*sin(reach*(64.-uGrowth*23.)-cloud*9.+sin(a*6.)*1.4-t),4.);
    float ribbons=haze*(.11+.28*waves+.26*filaments)*edge;
    float streams=pow(max(0.,cloud-.28)*1.6,1.8)*haze*smoothstep(.23,1.,uGrowth);
    vec3 violet=vec3(.55,.22,1.0),blue=vec3(.20,.68,1.0),gold=vec3(1.,.56,.23);
    vec3 light=mix(violet,blue,smoothstep(-.8,.9,sin(a*2.+t*.38)));
    light=mix(light,gold,smoothstep(.67,1.,uGrowth)*smoothstep(.22,.88,cos(a-.58+cloud*2.)));
    float alpha=(ribbons+streams*.5)*(.27+.73*uGrowth)*(1.-smoothstep(1.58,1.8,radius));
    gl_FragColor=vec4(light,alpha);
   }`
 });
 const size=ORIGIN_RADIUS*3.6;
 const aura=new Mesh(new PlaneGeometry(size,size),material);
 aura.position.z=-.11;
 return aura;
}
