import {Mesh, ShaderMaterial, SphereGeometry} from 'three';

// A glass-like shell with interference bands over slowly moving clouds of light.
export function originSphere(noise) {
 const geometry=new SphereGeometry(3.2,80,56);
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
