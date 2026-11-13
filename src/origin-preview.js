import {ACESFilmicToneMapping, PerspectiveCamera, Scene, WebGLRenderer} from 'three';
import {ORIGIN_FOV, originDistance, originSphere} from './origin-sphere.js';
import {noiseGLSL} from './space-noise.js';
export {createPortalWarp} from './portal-warp.js';

// Uses the same sphere and camera as the app's entrance, in a transparent
// layer so the last stars from the explosion can fade underneath it.
export function mountOriginPreview(host, motion, {strength=1}={}) {
 const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.18;
 renderer.setClearColor(0,0);
 const scene=new Scene(),camera=new PerspectiveCamera(ORIGIN_FOV,1,.01,100);
 const sphere=originSphere(noiseGLSL,strength,true);
 scene.add(sphere);
 const canvas=renderer.domElement;
 const screen=host.closest('.birth-screen');
 host.append(canvas);

 let frame=0,last=0,startedAt;
 function draw(time){
  if(canvas.hidden)return;
  if(!motion.matches){
   startedAt ??= time;
   const elapsed=time-startedAt;
   sphere.material.uniforms.uTime.value=elapsed*.0007;
   sphere.rotation.y=elapsed*.000026;
  }
  renderer.render(scene,camera);
 }
 function resize(){
  const {clientWidth:width,clientHeight:height}=host;
  if(!width||!height)return;
  camera.aspect=width/height;
  camera.position.z=originDistance(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2.5,Math.sqrt(1_650_000/(width*height))));
  renderer.setSize(width,height,false);
  draw(performance.now());
 }
 function animate(time){
  frame=requestAnimationFrame(animate);
  if(!document.hidden&&!motion.matches&&(!screen||screen.matches('[data-stage="bang"], [data-chat]'))&&time-last>=32){
   last=time;
   draw(time);
  }
 }
 function loseContext(event){event.preventDefault();canvas.hidden=true; host.removeAttribute('data-webgl');}
 function restoreContext(){canvas.hidden=false;resize();host.dataset.webgl='';}
 canvas.addEventListener('webglcontextlost',loseContext);
 canvas.addEventListener('webglcontextrestored',restoreContext);
 const observer=new ResizeObserver(resize);
 observer.observe(host);
 resize();
 host.dataset.webgl='';
 frame=requestAnimationFrame(animate);
 return ()=>{
  cancelAnimationFrame(frame);observer.disconnect();
  sphere.geometry.dispose();sphere.material.dispose();
  canvas.removeEventListener('webglcontextlost',loseContext);
  canvas.removeEventListener('webglcontextrestored',restoreContext);
  renderer.dispose();renderer.forceContextLoss();canvas.remove();
 };
}
