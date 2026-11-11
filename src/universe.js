import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {UNIVERSE_ORIGIN,LEVELS} from '../dist/universe-model.js';
import {ORIGIN_FOV, ORIGIN_RADIUS, originAura, originDistance, originSphere} from './origin-sphere.js';
import {noiseGLSL} from './space-noise.js';
import {createPortalWarp} from './portal-warp.js';
export {mountOriginPreview} from './origin-preview.js';
import {createSpaceLayout,spaceObservation,spaceRoute,STAR_RADIUS} from './space-layout.js';
const palettes=['#a9bfff','#e8bb90','#a4ddd5','#c9a8ef','#e2a9bc','#a6c8ed'];
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
function random(seed){let s=seed||1;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.08,'rgba(255,250,237,.95)');g.addColorStop(.22,'rgba(210,220,255,.3)');g.addColorStop(.5,'rgba(160,180,255,.06)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)}
export function createUniverse(host,{nodes,current,onSelect,onReady,onZoom,quality='auto',auraStrength=0}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,small=innerWidth<600,low=quality==='low'||(navigator.hardwareConcurrency||8)<=4;
 const renderer=new T.WebGLRenderer({antialias:!small,alpha:false,powerPreference:'default'});renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:small?1.35:1.65));renderer.setClearColor('#030611');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.domElement.className='universe-webgl';renderer.domElement.setAttribute('aria-label','光と星雲で描く、自分の宇宙');host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(ORIGIN_FOV,1,.01,360);camera.position.set(0,0,30);
 const composer=new EffectComposer(renderer);const renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);const bloom=new UnrealBloomPass(new T.Vector2(800,600),low?.42:.65,.65,.82);composer.addPass(bloom);composer.addPass(new OutputPass());
 const glow=glowTexture(),labels=document.createElement('div');labels.className='universe-labels';host.append(labels);const bg=new T.Group();scene.add(bg);
 const nebula=new T.Mesh(new T.PlaneGeometry(440,300),new T.ShaderMaterial({depthWrite:false,uniforms:{uTime:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;${noiseGLSL}void main(){vec2 uv=vUv;vec3 p=vec3(uv*5.,.8);float n=fbm(p+fbm(p*1.7));float ridge=pow(max(0.,1.-abs(uv.y-.48+sin(uv.x*4.)*.15)*2.8),3.);float dust=pow(n,2.8)*ridge;vec3 c=vec3(.007,.012,.035)+mix(vec3(.09,.07,.24),vec3(.045,.16,.23),uv.x)*dust*1.3;float cloud=fbm(p*2.+4.);c+=vec3(.2,.09,.15)*pow(cloud,4.)*ridge*.42;gl_FragColor=vec4(c,1.);}`}));nebula.position.z=-65;bg.add(nebula);
 const rand=random(9938);
 function points(positions,colors,sizes){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('size',new T.Float32BufferAttribute(sizes,1));const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uPixel:{value:renderer.getPixelRatio()},uFade:{value:1}},vertexShader:`attribute float size;attribute vec3 color;varying vec3 vColor;uniform float uPixel;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*uPixel*(45./-mv.z),.7,22.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vColor;uniform float uFade;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.);gl_FragColor=vec4(vColor,a*uFade);}`});return new T.Points(geo,mat)}
 function halo(parent,color,size,opacity=.4){const sprite=new T.Sprite(new T.SpriteMaterial({map:glow,color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));sprite.scale.set(size,size,1);parent.add(sprite);return sprite}
 const animated=new Set();
 function galaxyParticles(seed,count,distant){
  const rng=random(seed),positions=[],colors=[],sizes=[];
  const base=new T.Color(palettes[seed%palettes.length]);
  const warm=new T.Color('#ffe3b2'),blue=new T.Color('#899bff'),arms=2+seed%3;
  for(let i=0;i<count;i++){
   const radius=Math.pow(rng(),.8)*3.2;
   const twist=radius*(1.1+(seed%5)*.13);
   const angle=i%arms*Math.PI*2/arms+twist+(rng()-.5)*(distant?.18+radius*.13:.4+radius*.3);
   const spread=(rng()-.5)*(.15+radius*.15);
   const y=(rng()-.5)*(.08+radius*.12),z=Math.sin(angle)*radius+(rng()-.5)*radius*.14;
   const color=radius<.65?warm.clone():base.clone().lerp(blue,rng()*.5);
   color.multiplyScalar(.55+rng()*.85);
   const size=.65+rng()*1.65;
   if(!distant&&radius<.53)continue;
   positions.push(Math.cos(angle)*radius+spread,y,z);
   colors.push(color.r,color.g,color.b);sizes.push(size);
  }
  return {positions,colors,sizes,base};
 }
 function blackHole(){
  const group=new T.Group();
  const core=new T.Mesh(new T.SphereGeometry(.25,36,24),new T.MeshBasicMaterial({color:'#02030a'}));
  group.add(core);
  const rim=new T.Mesh(new T.RingGeometry(.249,.269,72),new T.MeshBasicMaterial({
   color:'#ffda9a',transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending
  }));
  rim.position.z=.12;group.add(rim);
  const disk=new T.Mesh(new T.RingGeometry(.255,.87,100,4),new T.ShaderMaterial({
   transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
   vertexShader:`varying vec2 vDisk;void main(){vDisk=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`varying vec2 vDisk;
    void main(){
     float r=length(vDisk),a=atan(vDisk.y,vDisk.x);
     float edge=smoothstep(.255,.32,r)*(1.-smoothstep(.38,.87,r));
     float bands=.62+.38*sin(r*42.+sin(a*2.+r*8.)*1.4);
     float bright=.68+.32*cos(a-.45);
     vec3 light=mix(vec3(.57,.24,.11),vec3(1.9,1.28,.71),1.-smoothstep(.28,.64,r));
     gl_FragColor=vec4(light,edge*bands*bright*.86);
    }`
  }));
  disk.rotation.set(1.08,0,-.26);group.add(disk);
  halo(group,'#ffd193',1.6,.24);
  return group;
 }
 function galaxy(seed,size=1){
  const group=new T.Group(),count=low?1000:small?1800:3300;
  const {positions,colors,sizes,base}=galaxyParticles(seed,count,false);
  const spiral=points(positions,colors,sizes);
  spiral.rotation.set(.98+(seed%3)*.13,0,(seed%7)*.18);
  spiral.userData.spin=.025;animated.add(spiral);
  group.add(spiral,blackHole());
  group.scale.setScalar(size);
  halo(group,base,7,.13);
  return group;
 }
 let galaxyField=null;
 function createGalaxyField(){
  const group=new T.Group(),rng=random(61722);
  const specs=[
   {z:-17,spacing:16,scale:1.14,light:.49},
   {z:-35,spacing:20,scale:1.18,light:.56},
   {z:-64,spacing:24,scale:1.31,light:.61},
   {z:-104,spacing:29,scale:1.42,light:.57}
  ];
  const vertex=new T.Vector3(),transform=new T.Object3D(),columns=5,rows=4;
  const layers=specs.map((layer,layerIndex)=>{
   const positions=[],colors=[],sizes=[];
   for(let i=0;i<columns*rows;i++){
    const seed=770+layerIndex*641+i*19;
    const x=(i%columns+.15+rng()*.7)*layer.spacing;
    const y=(Math.floor(i/columns)+.15+rng()*.7)*layer.spacing;
    const z=(rng()-.5)*9;
    transform.position.set(x,y,z);
    transform.rotation.set(.72+rng()*.6,rng()*.3,rng()*Math.PI*2);
    transform.scale.setScalar(layer.scale*(.61+rng()*.68));
    transform.updateMatrix();
    const dust=galaxyParticles(seed,low?165:270,true);
    for(let j=0;j<dust.sizes.length;j++){
     const k=j*3;vertex.fromArray(dust.positions,k).applyMatrix4(transform.matrix);
     positions.push(vertex.x,vertex.y,vertex.z);
     colors.push(dust.colors[k]*layer.light,dust.colors[k+1]*layer.light,dust.colors[k+2]*layer.light);
     sizes.push(dust.sizes[j]);
    }
    positions.push(x,y,z);colors.push(.38,.30,.26);sizes.push(2.8);
   }
   const cloud=points(positions,colors,sizes);
   group.add(cloud);
   return {kind:'galaxies',z:layer.z,w:columns*layer.spacing,h:rows*layer.spacing,clouds:[cloud],key:''};
  });
  function starLayer(z,w,h,count,kind){
   const positions=[],colors=[],sizes=[],tint=new T.Color();
   for(let i=0;i<count;i++){
    positions.push(rng()*w,rng()*h,(rng()-.5)*10);
    const bright=rng();
    tint.setHSL(.54+rng()*.24,.15+rng()*.3,.48+bright*.38).multiplyScalar(.38+bright*.52);
    colors.push(tint.r,tint.g,tint.b);
    sizes.push(bright>.94?2.05:.65+rng()*.7);
   }
   const cloud=points(positions,colors,sizes);
   group.add(cloud);
   return {kind,z,w,h,clouds:[cloud],key:''};
  }
  layers.push(starLayer(-12,76,62,low?155:260,'near-stars'));
  layers.push(starLayer(-43,100,86,low?360:600,'deep-stars'));
  layers.push(starLayer(-94,150,132,low?530:900,'deep-stars'));
  bg.add(group);
  return {group,layers};
 }
 function setGalaxyBackdrop(starAmount){
  if(!galaxyField)galaxyField=createGalaxyField();
  for(const layer of galaxyField.layers){
   const amount=layer.kind==='galaxies'?1-starAmount:layer.kind==='deep-stars'?starAmount:1;
   layer.clouds[0].material.uniforms.uFade.value=amount;
   if(amount===0){
    for(const cloud of layer.clouds)cloud.visible=false;
    layer.key='';
   }
  }
 }
 function updateGalaxyBackdrop(){
  if(!bg.visible||!galaxyField?.group.visible)return;
  const x=camera.position.x-bg.position.x,y=camera.position.y-bg.position.y;
  const fovScale=Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const skyHeight=(camera.position.z-nebula.position.z)*fovScale;
  nebula.position.x=x;nebula.position.y=y;
  nebula.scale.set(Math.max(1,skyHeight*camera.aspect/210),Math.max(1,skyHeight/140),1);
  for(const layer of galaxyField.layers){
   if(!layer.clouds[0].material.uniforms.uFade.value)continue;
   // A margin keeps a galaxy visible even when its center sits just outside the view.
   const halfHeight=(camera.position.z-layer.z+10)*fovScale,halfWidth=halfHeight*camera.aspect;
   const left=Math.floor((x-halfWidth-6)/layer.w),right=Math.floor((x+halfWidth+6)/layer.w);
   const bottom=Math.floor((y-halfHeight-6)/layer.h),top=Math.floor((y+halfHeight+6)/layer.h);
   const key=[left,right,bottom,top].join(':');
   if(layer.key===key)continue;
   layer.key=key;
   let visible=0;
   for(let column=left;column<=right;column++)for(let row=bottom;row<=top;row++){
    let cloud=layer.clouds[visible++];
    if(!cloud){
     const template=layer.clouds[0];
     cloud=new T.Points(template.geometry,template.material);
     galaxyField.group.add(cloud);layer.clouds.push(cloud);
    }
    cloud.position.set(column*layer.w,row*layer.h,layer.z);
    cloud.visible=true;
   }
   for(let i=visible;i<layer.clouds.length;i++)layer.clouds[i].visible=false;
  }
 }
 function star(seed,radius=.8){const g=new T.Group(),col=palettes[seed%palettes.length],sphere=new T.Mesh(new T.SphereGeometry(radius,40,28),new T.ShaderMaterial({uniforms:{uTime:{value:0},uColor:{value:new T.Color(col)}},vertexShader:`varying vec3 vPos;varying vec3 vNormal;void main(){vPos=position;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;uniform vec3 uColor;varying vec3 vPos;varying vec3 vNormal;${noiseGLSL}void main(){float n=fbm(vPos*8.+vec3(uTime*.03));float rim=pow(1.-max(0.,vNormal.z),2.);gl_FragColor=vec4(uColor*(1.35+n*.6)+vec3(.35)*rim,1.);}`}));g.add(sphere);halo(g,col,radius*9,.65);halo(g,'#fff5dd',radius*3.3,.8);g.userData.spin=.035;animated.add(g);return g}
 function planet(seed,radius=1,withRings=true){const g=new T.Group(),r=random(seed),kind=seed%5,col=new T.Color(palettes[seed%palettes.length]);const body=new T.Mesh(new T.SphereGeometry(radius,56,40),new T.ShaderMaterial({uniforms:{uTime:{value:0},uColor:{value:col},uKind:{value:kind},uSeed:{value:r()*50}},vertexShader:`varying vec3 vNormal;varying vec3 vPos;void main(){vNormal=normalize(normalMatrix*normal);vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime,uKind,uSeed;uniform vec3 uColor;varying vec3 vNormal;varying vec3 vPos;${noiseGLSL}void main(){vec3 p=vPos*2.3+vec3(uSeed,0.,uTime*.008);float n=fbm(p*2.);float bands=sin(p.y*17.+n*5.)*.5+.5;vec3 land=mix(vec3(.035,.13,.22),uColor*.72,smoothstep(.42,.6,n));if(uKind>2.5)land=mix(uColor*.23,uColor,bands*.65+n*.35);if(uKind<.5)land=mix(vec3(.16,.25,.28),vec3(.5,.7,.73),n);float light=max(.0,dot(normalize(vNormal),normalize(vec3(-.7,.7,1.))));float rim=pow(1.-max(vNormal.z,0.),3.);vec3 clouds=vec3(1.)*smoothstep(.63,.76,fbm(p*3.3));vec3 c=(land+clouds*.35)*(.12+light*.95)+uColor*rim*.36;gl_FragColor=vec4(c,1.);}`}));g.add(body);const atmosphere=new T.Mesh(new T.SphereGeometry(radius*1.045,40,24),new T.ShaderMaterial({transparent:true,blending:T.AdditiveBlending,depthWrite:false,uniforms:{uColor:{value:col}},vertexShader:`varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vN;uniform vec3 uColor;void main(){float a=pow(1.-max(0.,vN.z),3.5);gl_FragColor=vec4(uColor*.7,a*.5);}`}));g.add(atmosphere);if(withRings&&seed%3===0){const ring=new T.Mesh(new T.RingGeometry(radius*1.4,radius*2,96),new T.MeshBasicMaterial({color:col,side:T.DoubleSide,transparent:true,opacity:.23,depthWrite:false}));ring.rotation.x=1.16;g.add(ring)}g.userData.spin=.025;animated.add(body);return g}
 function orbit(radius,color='#a0a9cf',opacity=.13){const pts=Array.from({length:129},(_,i)=>{const a=i/128*Math.PI*2;return new T.Vector3(Math.cos(a)*radius,Math.sin(a)*radius*.65,-.8)});return new T.LineLoop(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color,transparent:true,opacity}))}
 let burstCloud=null,burstStart=0,burstVelocities=[];
 let portalWarp;
 const active=new T.Group();
 scene.add(active);
 let width=1,height=1,baseDistance=30,disposed=false,raf=0,last=0;
 let tween=null,pendingResolve=null,transitioning=false,currentNode=current,frames;
 let scenery;
 let anchors=[],pickables=[];
 const bodies=new Map(),orbitGroups=new Map();
 const root=nodes.find(node=>node.parentId===null);
 const center=new T.Vector3();
 function cleanup(group){
  const geometries=new Set(),materials=new Set();
  group.traverse(object=>{
   if(object.geometry)geometries.add(object.geometry);
   if(object.material)for(const material of [object.material].flat())materials.add(material);
   animated.delete(object);
  });
  geometries.forEach(geometry=>geometry.dispose());
  materials.forEach(material=>material.dispose());
  group.removeFromParent();
 }
 function showScenery(){
  if(transitioning||disposed||scenery||currentNode===UNIVERSE_ORIGIN)return false;
  const frame=frames.get(currentNode),{node,depth}=frame;
  const parent=frames.get(node.parentId)?.node;
  const view=new T.Scene();
  const eye=new T.PerspectiveCamera(ORIGIN_FOV,camera.aspect,.05,150);
  const sky=new T.Mesh(nebula.geometry.clone(),nebula.material.clone());
  sky.position.z=-85;
  view.add(sky);

  const rng=random(hash(node.id)),positions=[],colors=[],sizes=[];
  const tint=new T.Color();
  for(let i=0;i<(low?280:540);i++){
   positions.push((rng()-.5)*145,(rng()-.5)*85,-40-rng()*36);
   tint.set(palettes[i%palettes.length]).multiplyScalar(.18+rng()*.45);
   colors.push(tint.r,tint.g,tint.b);sizes.push(.55+rng()*1.6);
  }
  view.add(points(positions,colors,sizes));
  if(depth>=3){
   const target=depth===3?star(hash(parent.id),.95):planet(hash(parent.id),2.4);
   target.position.set(0,1.7,-20);
   view.add(target);
   const horizon=planet(hash(node.id),1,false);
   horizon.scale.setScalar(12);
   horizon.position.set(0,-12.9,-9);
   view.add(horizon);
  }else if(depth===2){
   const sun=star(hash(node.id),1.9);
   sun.position.set(0,.7,-16);
   view.add(sun);
   const path=orbit(5.2,'#b6c3f1',.25);
   path.position.copy(sun.position);path.rotation.x=-.45;view.add(path);
  }else if(depth===1){
   const core=galaxy(hash(node.id),2);
   core.position.set(0,-.8,-24);view.add(core);
  }else{
   const galaxies=frame.visible.slice(0,4);
   const offsets=[[0,1,-28],[-5,-3,-38],[5,3,-42],[5,-4,-44]];
   galaxies.forEach((child,index)=>{
    const cluster=galaxy(hash(child.id),index===0?1.35:.8);
    cluster.position.set(...offsets[index]);view.add(cluster);
   });
  }
  scenery={view,eye};
  renderPass.scene=view;renderPass.camera=eye;
  labels.hidden=true;labels.inert=true;
  return true;
 }
 function hideScenery(){
  if(!scenery)return;
  cleanup(scenery.view);
  scenery=null;
  renderPass.scene=scene;renderPass.camera=camera;
  labels.hidden=false;labels.inert=false;
 }
 function prepareFade(object){
  const materials=new Set();
  object.traverse(child=>{if(child.material)for(const material of [child.material].flat())materials.add(material)});
  return [...materials].map(material=>{
   const {opacity,transparent,depthWrite}=material;
   if(material.isShaderMaterial){
    material.uniforms.uTravelFade={value:1};
    material.fragmentShader='uniform float uTravelFade;\n'+material.fragmentShader.replace(/}\s*$/,'gl_FragColor.a*=uTravelFade;}');
   }
   return {material,opacity,transparent,depthWrite};
  });
 }
 function fade(entity,value){
  if(entity.alpha===value)return;
  entity.alpha=value;entity.object.visible=value>0;
  for(const item of entity.materials){
   const {material}=item;
   if(material.isShaderMaterial)material.uniforms.uTravelFade.value=value;
   else material.opacity=item.opacity*value;
   const transparent=item.transparent||value<1;
   if(transparent!==material.transparent){material.transparent=transparent;material.needsUpdate=true}
   material.depthWrite=item.depthWrite&&value===1;
  }
 }
 function body(id){
  if(bodies.has(id))return bodies.get(id);
  const frame=frames.get(id),seed=hash(id),scale=frames.get(frame.node.parentId).scale;
  const object=frame.depth===1?galaxy(seed,.84):frame.depth===2?star(seed,STAR_RADIUS):planet(seed,frame.depth===3?.75:.46);
  object.scale.multiplyScalar(scale);
  object.position.set(frame.x,frame.y,frame.z);active.add(object);
  const hit=new T.Mesh(new T.SphereGeometry((frame.depth===1?2.3:1.4)*scale,12,8),new T.MeshBasicMaterial({visible:false}));
  hit.position.copy(object.position);hit.userData.id=id;active.add(hit);
  const entity={object,hit,materials:prepareFade(object),alpha:1,scale:object.scale.x};
  bodies.set(id,entity);return entity;
 }
 function rings(id){
  const frame=frames.get(id);
  if(!frame?.depth||!frame.rings)return null;
  if(orbitGroups.has(id))return orbitGroups.get(id);
  const object=new T.Group();
  object.position.set(frame.x,frame.y,frame.z);
  object.scale.setScalar(frame.scale);
  for(let i=0;i<frame.rings;i++)object.add(orbit(frame.orbitRadius+i*3.3));
  active.add(object);
  const entity={object,materials:prepareFade(object),alpha:1};
  orbitGroups.set(id,entity);return entity;
 }
 function visibleIds(id){
  const frame=frames.get(id);
  const context=frame.depth>=3?[frame.node.parentId]:[];
  return new Set([...(frame.depth?[id]:[]),...context,...frame.visible.map(node=>node.id)]);
 }
 function clearObjects(){
  for(const object of [...active.children])cleanup(object);
  bodies.clear();orbitGroups.clear();
 }
 function setLabels(id){
  labels.replaceChildren();anchors=[];pickables=[];
  const frame=frames.get(id);
  const roles=[
   ...(frame.depth?[{node:frame.node,role:'current'}]:[]),
   ...(frame.depth>=3?[{node:frames.get(frame.node.parentId).node,role:'parent'}]:[]),
   ...frame.visible.map(node=>({node,role:'child'}))
  ];
  for(const {node,role} of roles){
   const target=frames.get(node.id),entity=body(node.id);
   const current=role==='current',level=LEVELS[target.depth];
   const label=document.createElement(current?'span':'button');
   label.className='celestial-label';label.dataset.level=level;label.dataset.role=role;
   label.textContent=node.name;label.title=level+' · '+node.name;
   if(current)label.setAttribute('aria-hidden','true'); // The same name is in the heading.
   else{
    label.setAttribute('aria-label',node.name+(role==='parent'?'へ戻る':'に近づく'));
    label.addEventListener('click',()=>{if(!transitioning)onSelect(node.id)});
    pickables.push(entity.hit);
   }
   const scale=frames.get(node.parentId).scale;
   const clearance=[0,2.1,STAR_RADIUS,.92,.58][target.depth]*scale;
   anchors.push({button:label,position:entity.object.position.clone(),clearance});
   labels.append(label);
  }
 }
 function settle(id,labelsReady=false){
  const visible=visibleIds(id);
  for(const [bodyId,entity] of bodies)if(!visible.has(bodyId)){
   cleanup(entity.object);cleanup(entity.hit);bodies.delete(bodyId);
  }
  for(const [frameId,entity] of orbitGroups)if(frameId!==id){
   cleanup(entity.object);orbitGroups.delete(frameId);
  }
  for(const bodyId of visible)fade(body(bodyId),1);
  const orbits=rings(id);if(orbits)fade(orbits,1);
  currentNode=id;
  if(!labelsReady)setLabels(id);
 }
 function fill(id){
  clearObjects();
  currentNode=id;
  const atOrigin=id===UNIVERSE_ORIGIN;
  bg.visible=!atOrigin;renderer.setClearColor(atOrigin?'#000000':'#030611');
  if(atOrigin){
   labels.replaceChildren();pickables=[];anchors=[];
   const sphere=originSphere(noiseGLSL,1);active.add(sphere);animated.add(sphere);
   if(auraStrength>0)active.add(originAura(noiseGLSL,auraStrength,sphere.material.uniforms.uTime));
   sphere.userData.id=root.id;pickables.push(sphere);
   const button=document.createElement('button');button.className='universe-origin-hit';button.setAttribute('aria-label','宇宙に入る');
   button.addEventListener('click',()=>{if(!transitioning)onSelect(root.id)});
   labels.append(button);anchors.push({button,mesh:sphere,position:sphere.position.clone(),id:root.id,origin:true});
   center.set(0,0,0);
   baseDistance=originDistance(width/height);
  }else{
   const frame=frames.get(id)||frames.get(root.id);
   const observation=spaceObservation(frames,frame.node.id,camera.aspect,camera.fov);
   settle(frame.node.id);
   center.set(observation.x,observation.y,observation.z);baseDistance=observation.distance;
   setGalaxyBackdrop(Number(frame.depth>=2));
  }
  camera.position.copy(center).add(new T.Vector3(0,0,baseDistance));camera.lookAt(center);
 }
 const smooth=value=>{const t=T.MathUtils.clamp(value,0,1);return t*t*(3-2*t)};
 function animateTravel(duration,draw){
  const startTime=performance.now();
  return new Promise(resolve=>{
   pendingResolve=resolve;
   tween=time=>{
    const raw=duration?Math.min(1,(time-startTime)/duration):1;
    draw(raw);
    if(raw===1){tween=null;pendingResolve=null;resolve(true)}
   };
  });
 }
 function portalTravel(id,direction){
  const start=camera.position.clone(),entering=direction>0;
  const duration=reduced?0:entering?3400:2750;
  const crossing=.68;
  if(!reduced&&portalWarp===undefined)portalWarp=createPortalWarp(host,low);
  return animateTravel(duration,raw=>{
   if(raw<crossing){
    const destination=new T.Vector3(0,0,entering?3.24:baseDistance*1.65);
    const approach=entering?Math.pow(raw/crossing,1.6):Math.min(1,smooth(raw)/.7);
    camera.position.lerpVectors(start,destination,approach);
    labels.style.opacity=String(1-smooth(raw/.34));
   }else{
    if(currentNode!==id)fill(id);
    const progress=(raw-crossing)/(1-crossing);
    const ease=entering?smooth(progress):1-Math.pow(1-progress,3);
    camera.position.z=center.z+T.MathUtils.lerp(entering?baseDistance*1.55:baseDistance*.6,baseDistance,ease);
    labels.style.opacity=String(progress);
   }
   const cover=smooth((raw-.53)/.15)*(1-smooth((raw-.73)/.24));
   host.style.setProperty('--portal-cover',String(cover));
   portalWarp?.draw(raw,width,height);
  });
 }
 async function approach(id,routeLength){
  const before=visibleIds(currentNode),after=visibleIds(id);
  const frame=frames.get(id),from=frames.get(currentNode),movingIn=frame.depth>from.depth;
  const observation=spaceObservation(frames,id,camera.aspect,camera.fov);
  const start=camera.position.clone();
  const destination=new T.Vector3(observation.x,observation.y,observation.z+observation.distance);
  if(movingIn&&frame.depth<3)destination.z=Math.min(destination.z,frame.z+Math.max(frame.distance*.48,(start.z-frame.z)*.86));
  const incoming=[...after].filter(bodyId=>!before.has(bodyId)).map(body);
  const outgoing=[...before].filter(bodyId=>!after.has(bodyId)).map(body);
  const fromRings=rings(currentNode),toRings=rings(id);
  if(fromRings)outgoing.push(fromRings);
  if(toRings)incoming.push(toRings);
  incoming.forEach(entity=>fade(entity,0));
  const duration=reduced?0:routeLength>1?730:movingIn?1300:1080;
  let labelsReady=false;
  const arrived=await animateTravel(duration,raw=>{
   const lateral=movingIn?smooth(raw/.86):smooth((raw-.1)/.9);
   camera.position.set(T.MathUtils.lerp(start.x,destination.x,lateral),T.MathUtils.lerp(start.y,destination.y,lateral),T.MathUtils.lerp(start.z,destination.z,smooth(raw)));
   const reveal=smooth((raw-.28)/.66),recede=1-smooth((raw-.16)/.7);
   if((from.depth>=2)!==(frame.depth>=2)){
    setGalaxyBackdrop(T.MathUtils.lerp(Number(from.depth>=2),Number(frame.depth>=2),smooth(raw)));
   }
   incoming.forEach(entity=>fade(entity,reveal));
   outgoing.forEach(entity=>fade(entity,recede));
   if(raw>=.4&&!labelsReady){setLabels(id);labelsReady=true}
   labels.style.opacity=String(labelsReady?smooth((raw-.48)/.52):1-smooth(raw/.33));
  });
  if(!arrived)return false;
  center.set(observation.x,observation.y,observation.z);baseDistance=observation.distance;
  settle(id,labelsReady);
  return true;
 }
 async function navigate(id,direction=1){
  if(transitioning||disposed||scenery)return false;
  transitioning=true;labels.inert=true;host.classList.add('in-transit');
  try{
   if(id===UNIVERSE_ORIGIN||currentNode===UNIVERSE_ORIGIN)return await portalTravel(id,direction);
   const route=spaceRoute(frames,currentNode,id);
   for(const step of route)if(!await approach(step,route.length))return false;
   return true;
  }finally{
   transitioning=false;labels.inert=false;labels.style.opacity='1';
   portalWarp?.hide();host.classList.remove('in-transit');host.style.removeProperty('--portal-cover');
  }
 }
 function resize(){width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(scenery){scenery.eye.aspect=camera.aspect;scenery.eye.updateProjectionMatrix()}if(currentNode===UNIVERSE_ORIGIN&&!transitioning){baseDistance=originDistance(camera.aspect);camera.position.z=baseDistance}}
 function rebuildLayout(){
  frames=createSpaceLayout(nodes,width,height,small?12:24);
  fill(currentNode);
 }
 const ro=new ResizeObserver(()=>{
  const old=width/height;resize();
  if(Math.abs(old-width/height)>.15&&!transitioning)rebuildLayout();
 });
 resize();rebuildLayout();ro.observe(host);
 const ray=new T.Raycaster(),pointer=new T.Vector2(),pointers=new Map();let down=null,pinch=null;
 function downEvent(e){if(transitioning||scenery||currentNode===UNIVERSE_ORIGIN)return;renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);down={x:e.clientX,y:e.clientY,camera:camera.position.clone()};if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])}}
 function moveEvent(e){if(transitioning||!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinch){zoomTo((camera.position.z-center.z)*pinch/d);pinch=d}}else{const ratio=(camera.position.z-center.z)/height*.8;camera.position.x-=(e.clientX-old[0])*ratio;camera.position.y+=(e.clientY-old[1])*ratio}}
 function upEvent(e){pointers.delete(e.pointerId);pinch=null;if(!down||transitioning)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(pickables)[0];if(hit)onSelect(hit.object.userData.id)}down=null}
 function zoomTo(distance){camera.position.z=center.z+T.MathUtils.clamp(distance,baseDistance*.45,baseDistance*2)}
 function wheel(e){e.preventDefault();if(!transitioning&&!scenery&&currentNode!==UNIVERSE_ORIGIN)zoomTo((camera.position.z-center.z)*(1+e.deltaY*.001))}
 renderer.domElement.addEventListener('pointerdown',downEvent);renderer.domElement.addEventListener('pointermove',moveEvent);renderer.domElement.addEventListener('pointerup',upEvent);renderer.domElement.addEventListener('pointercancel',upEvent);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
 function positionLabels(){
  const used=[],slope=Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const detail=host.parentElement?.querySelector('.space-detail-button');
  if(detail){
   const area=host.getBoundingClientRect(),box=detail.getBoundingClientRect();
   if(box.width&&box.height)used.push({x:box.left-area.left+box.width/2,y:box.top-area.top,w:box.width,h:box.height});
  }
  for(const anchor of anchors){
   const projected=anchor.position.clone().project(camera);
   const screenX=(projected.x*.5+.5)*width,screenY=(-projected.y*.5+.5)*height;
   const label=anchor.button;
   if(anchor.origin){
    const diameter=Math.min(width*.85,height*ORIGIN_RADIUS/(slope*camera.position.z));
    label.style.width=label.style.height=diameter+'px';
    label.style.transform=`translate(${screenX}px,${screenY}px) translate(-50%,-50%)`;
    continue;
   }
   const w=label.offsetWidth||130,h=label.offsetHeight||44;
   const x=T.MathUtils.clamp(screenX,w/2+8,width-w/2-8);
   const depth=camera.position.z-anchor.position.z;
   const gap=depth>0?anchor.clearance*height/(2*slope*depth)+8:0;
   const minY=76,maxY=height-h-57;
   const below=screenY+gap,above=screenY-gap-h;
   const fits=y=>y>=minY&&y<=maxY&&!used.some(other=>
    Math.abs(x-other.x)<(w+other.w)/2+5&&y<other.y+other.h+4&&y+h>other.y-4);
   const candidates=[below,above,T.MathUtils.clamp(below,minY,maxY),T.MathUtils.clamp(above,minY,maxY)];
   for(let step=1;step<=3;step++)candidates.push(below+step*(h+5),above-step*(h+5));
   const y=candidates.find(fits);
   const visible=projected.z<1&&projected.z>-1&&Math.abs(projected.x)<1+w/width
    &&screenY+gap>=0&&screenY-gap<=height&&y!==undefined;
   label.style.visibility=visible?'visible':'hidden';
   if(!visible)continue;
   used.push({x,y,w,h});
   label.style.transform=`translate(${x}px,${y}px) translate(-50%,0)`;
  }
 }
 function animate(time){if(disposed)return;raf=requestAnimationFrame(animate);if(document.hidden||time-last<(low?42:32))return;const dt=Math.min(.05,(time-last)/1000);last=time;if(!reduced){for(const o of animated){o.rotation.y+=(o.userData.spin||.02)*dt;const u=o.material?.uniforms;if(u?.uTime)u.uTime.value=time*.001;if(o.userData.birth){const f=Math.min(1,(time-o.userData.birth)/1400);o.scale.setScalar((o.userData.finalScale||1)*(.01+.99*(1-Math.pow(1-f,3))));if(f===1)delete o.userData.birth}}}
 if(burstCloud){const age=(time-burstStart)/1000,arr=burstCloud.geometry.attributes.position;for(let i=0;i<arr.count;i++)arr.setXYZ(i,burstVelocities[i*3]*age,burstVelocities[i*3+1]*age,burstVelocities[i*3+2]*age);arr.needsUpdate=true;burstCloud.material.uniforms.uFade.value=Math.max(0,1-age/4.5);if(age>4.5){cleanup(burstCloud);burstCloud=null}}
 if(scenery){composer.render();return}
 if(tween)tween(time);bg.position.x=-camera.position.x*.08;bg.position.y=-camera.position.y*.08;updateGalaxyBackdrop();camera.updateMatrixWorld();positionLabels();onZoom?.(Math.round(baseDistance/(camera.position.z-center.z)*100));composer.render()}
 raf=requestAnimationFrame(animate);
 return {navigate,showScenery,hideScenery,
  zoom(factor){if(!transitioning)zoomTo((camera.position.z-center.z)/factor)},
  reset(){camera.position.copy(center);camera.position.z+=baseDistance},
  birth(id){
   const entity=bodies.get(id);
   if(!entity||reduced)return;
   entity.object.userData.finalScale=entity.scale;
   entity.object.userData.birth=performance.now();
   entity.object.scale.setScalar(entity.scale*.01);
   animated.add(entity.object);
  },
  burst(){if(reduced)return;const p=[],c=[],sizes=[],r=random(824);burstVelocities=[];for(let i=0;i<(low?350:750);i++){p.push(0,0,0);const a=r()*Math.PI*2,v=2+r()*13;burstVelocities.push(Math.cos(a)*v,Math.sin(a)*v,(r()-.5)*v);const col=new T.Color(palettes[i%palettes.length]);c.push(col.r,col.g,col.b);sizes.push(1+r()*2)}burstCloud=points(p,c,sizes);scene.add(burstCloud);burstStart=performance.now()},getView(){return null},dispose(){pendingResolve?.(false);pendingResolve=null;disposed=true;cancelAnimationFrame(raf);ro.disconnect();for(const [k,fn] of [['pointerdown',downEvent],['pointermove',moveEvent],['pointerup',upEvent],['pointercancel',upEvent],['wheel',wheel]])renderer.domElement.removeEventListener(k,fn);hideScenery();cleanup(active);cleanup(bg);portalWarp?.dispose();if(burstCloud)cleanup(burstCloud);glow.dispose();composer.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();labels.remove()}};
}
