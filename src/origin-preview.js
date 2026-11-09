import {ACESFilmicToneMapping, PerspectiveCamera, Scene, Vector2, WebGLRenderer} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ORIGIN_FOV, originDistance, originSphere} from './origin-sphere.js';
import {noiseGLSL} from './space-noise.js';

// Uses the same sphere and camera as the app's entrance, in a transparent
// layer so the last stars from the explosion can fade underneath it.
export function mountOriginPreview(host, motion) {
 const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.18;
 renderer.setClearColor(0,0);
 const scene=new Scene(),camera=new PerspectiveCamera(ORIGIN_FOV,1,.01,100);
 const sphere=originSphere(noiseGLSL);
 scene.add(sphere);
 const composer=new EffectComposer(renderer);
 composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new Vector2(800,600),innerWidth<600?.42:.65,.65,.82);
 const output=new OutputPass();
 composer.addPass(bloom);
 composer.addPass(output);
 host.append(renderer.domElement);

 let frame=0,last=0;
 function draw(time){
  if(!motion.matches){
   sphere.material.uniforms.uTime.value=time*.001;
   sphere.rotation.y=time*.000045;
  }
  composer.render();
 }
 function resize(){
  if(!host.clientWidth||!host.clientHeight)return;
  camera.aspect=host.clientWidth/host.clientHeight;
  camera.position.z=originDistance(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth,host.clientHeight,false);
  composer.setSize(host.clientWidth,host.clientHeight);
  draw(performance.now());
 }
 function animate(time){
  frame=requestAnimationFrame(animate);
  if(!document.hidden&&!motion.matches&&host.parentElement?.closest('.birth-screen')?.matches('[data-forming], [data-stage=name], [data-stage=confirm]')&&time-last>=40){last=time;draw(time)}
 }
 const observer=new ResizeObserver(resize);
 observer.observe(host);
 resize();
 frame=requestAnimationFrame(animate);
 return ()=>{
  cancelAnimationFrame(frame);observer.disconnect();
  sphere.geometry.dispose();sphere.material.dispose();
  bloom.dispose();output.dispose();composer.dispose();
  renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
 };
}
