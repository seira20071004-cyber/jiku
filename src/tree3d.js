import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {treeLayout} from './tree-layout.js';

export function createTree(host,{nodes,focus,onSelect,view,onZoom}){
 const scene=new T.Scene();scene.fog=new T.Fog('#eff1e7',30,65);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor('#f3f3e9',0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.domElement.className='tree-webgl';renderer.domElement.setAttribute('aria-label','回転・ズームできる3Dの目標の木');host.prepend(renderer.domElement);
 const labels=document.createElement('div');labels.className='tree-label-layer';host.append(labels);
 const camera=new T.PerspectiveCamera(36,1,.1,90),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=true;controls.minPolarAngle=.35;controls.maxPolarAngle=Math.PI*.49;controls.rotateSpeed=.55;controls.zoomSpeed=.8;controls.panSpeed=.65;
 const layout=treeLayout(nodes,focus),map=new Map(layout.nodes.map(n=>[n.id,n])),height=layout.height;
 scene.add(new T.HemisphereLight('#fff8dc','#778c73',2.2));const sun=new T.DirectionalLight('#fff1cd',3.0);sun.position.set(-3,9,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-7;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;sun.shadow.radius=4;scene.add(sun);
 const rim=new T.DirectionalLight('#dce9d5',2);rim.position.set(4,6,-4);scene.add(rim);
 const tree=new T.Group();scene.add(tree);
 const wood=new T.MeshStandardMaterial({color:'#81644c',roughness:.94});
 const groundMat=new T.MeshStandardMaterial({color:'#c8d2ad',roughness:1});
 const ground=new T.Mesh(new T.CylinderGeometry(3.7,3.52,.22,80),groundMat);ground.position.y=-.12;ground.receiveShadow=true;ground.castShadow=true;scene.add(ground);
 const edge=new T.Mesh(new T.CylinderGeometry(3.53,3.40,.12,80),new T.MeshStandardMaterial({color:'#c0b99c',roughness:1}));edge.position.y=-.29;scene.add(edge);
 const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:'#73816a',opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.36;floor.receiveShadow=true;scene.add(floor);
 function branch(points,radius,endRadius){const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:new T.Vector3(...p)));const g=new T.TubeGeometry(curve,18,radius,9,false),pos=g.attributes.position;
  for(let i=0;i<=18;i++){const c=curve.getPointAt(i/18),scale=T.MathUtils.lerp(1,endRadius/radius,i/18);for(let j=0;j<=9;j++){const index=i*10+j;pos.setXYZ(index,c.x+(pos.getX(index)-c.x)*scale,c.y+(pos.getY(index)-c.y)*scale,c.z+(pos.getZ(index)-c.z)*scale)}}g.computeVertexNormals();const mesh=new T.Mesh(g,wood);mesh.castShadow=true;mesh.receiveShadow=true;tree.add(mesh);return mesh;
 }
 branch([[0,.02,0],[-.17,.65,.04],[.08,1.28,-.03],[0,1.8,0]],.28,.15);
 // Roots and a few small, unobtrusive stones make the tree feel planted.
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;branch([[0,.22,0],[Math.cos(a)*.4,.07,Math.sin(a)*.4],[Math.cos(a)*(.9+i%2*.2),.015,Math.sin(a)*(.9+i%2*.2)]],.10,.018)}
 const stoneGeo=new T.DodecahedronGeometry(1,1),stoneMat=new T.MeshStandardMaterial({color:'#b6baa7',roughness:1});
 for(let i=0;i<8;i++){const a=i*2.399+1.1,r=2.2+Math.sin(i)*.45,stone=new T.Mesh(stoneGeo,stoneMat);stone.position.set(Math.cos(a)*r,.04,Math.sin(a)*r);stone.scale.set(.09+i%3*.025,.05+i%2*.035,.1);stone.rotation.set(i*.3,i,.2);stone.castShadow=true;stone.receiveShadow=true;scene.add(stone)}
 for(const [aid,bid] of layout.edges){const a=map.get(aid),b=map.get(bid),start=a.depth===0?[0,1.65,0]:a.position,end=b.position;const radius=a.depth===0?.17:Math.max(.035,.14/(a.depth+.3));branch([start,[start[0]*.75+end[0]*.25,start[1]+(end[1]-start[1])*.58,start[2]*.7+end[2]*.3],[start[0]*.3+end[0]*.7,end[1]-.28,end[2]*.9],end],radius,b.leaf?.025:radius*.57)}
 const leafGeo=new T.BufferGeometry(),verts=[],indices=[];
 for(let i=0;i<=10;i++){const t=i/10,w=Math.sin(Math.PI*t)*.155;for(const side of [-1,0,1])verts.push(w*side,(t-.5)*.52,Math.sin(Math.PI*t)*.045*(1-Math.abs(side)))}
 for(let i=0;i<10;i++)for(let j=0;j<2;j++){const a=i*3+j,b=a+3;indices.push(a,b,a+1,b,b+1,a+1)}
 leafGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));leafGeo.setIndex(indices);leafGeo.computeVertexNormals();
 const leafMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.86,metalness:0,side:T.DoubleSide});
 const tips=layout.nodes.filter(n=>n.leaf&&n.depth>0),perTip=Math.max(8,Math.min(72,Math.floor(1000/Math.max(1,tips.length)))),leafCount=tips.length*perTip;
 const foliage=new T.InstancedMesh(leafGeo,leafMat,leafCount),matrix=new T.Object3D(),color=new T.Color();foliage.castShadow=true;foliage.receiveShadow=true;foliage.instanceMatrix.setUsage(T.DynamicDrawUsage);tree.add(foliage);
 let index=0;const leaves=[],pickables=[];
 function rng(seed){let s=seed||1;return()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296}}
 // Every decorative leaf is a separate 3D shape, spread along fine twigs.
 for(const tip of tips){const rand=rng(tip.seed),base=new T.Vector3(...tip.position);for(let twig=0;twig<6;twig++){const angle=twig*2.399+tip.seed%7,end=base.clone().add(new T.Vector3(Math.cos(angle)*(.65+rand()*.35),.18+rand()*.5,Math.sin(angle)*(.5+rand()*.25)));branch([base,base.clone().lerp(end,.6).add(new T.Vector3(0,.13,0)),end],.018,.004)}
  for(let j=0;j<perTip;j++){const a=j*2.399+rand()*.35,r=Math.sqrt(rand()),elevation=rand()*2-1,ring=Math.sqrt(1-elevation*elevation),x=base.x+Math.cos(a)*r*ring*1.0,y=base.y+.35+elevation*r*.85,z=base.z+Math.sin(a)*r*ring*.85;
   const size=.75+rand()*.65,rot=[-.85+rand()*1.7,rand()*Math.PI*2,-1.4+rand()*2.8];matrix.position.set(x,y,z);matrix.rotation.set(...rot);matrix.scale.setScalar(size);matrix.updateMatrix();foliage.setMatrixAt(index,matrix.matrix);color.setHSL(.24+rand()*.065,.30+rand()*.16,.29+rand()*.20);foliage.setColorAt(index,color);leaves.push({x,y,z,size,rot,phase:rand()*6});index++}
  const actionLeaf=new T.Mesh(leafGeo,new T.MeshStandardMaterial({color:'#d6bd71',roughness:.6,metalness:.08}));actionLeaf.scale.setScalar(2.0);actionLeaf.position.copy(base).add(new T.Vector3(.10,.37,.40));actionLeaf.rotation.set(.1,.25,-.55);actionLeaf.castShadow=true;actionLeaf.userData.id=tip.id;tree.add(actionLeaf);pickables.push(actionLeaf);
 }
 const grassGeo=new T.ConeGeometry(.018,.18,3),grassMat=new T.MeshStandardMaterial({color:'#8da773',roughness:1}),grass=new T.InstancedMesh(grassGeo,grassMat,240),rand=rng(427);
 for(let i=0;i<240;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*3.3;matrix.position.set(Math.cos(a)*r,.04,Math.sin(a)*r);matrix.rotation.set((rand()-.5)*.3,rand()*6,(rand()-.5)*.3);matrix.scale.set(1,.4+rand(),1);matrix.updateMatrix();grass.setMatrixAt(i,matrix.matrix)}grass.receiveShadow=true;scene.add(grass);
 const anchors=[];
 for(const n of layout.nodes){const button=document.createElement('button');button.className='goal-label '+(n.depth===0?'root-label':n.leaf?'action-label':'branch-label');button.textContent=n.name;button.title=n.name;button.setAttribute('aria-label',n.name+(n.leaf&&n.depth>0?'の固定量を設定':'を編集'));button.addEventListener('click',()=>onSelect(n.id));labels.append(button);const p=new T.Vector3(...n.position);p.y+=n.depth===0?-.13:n.leaf?.87:.09;anchors.push({button,p,node:n})}
 let width=1,h=1,lastAspect=0,fitDistance=12,disposed=false,frame=0,lastTime=0,initial=true,desiredDistance=null;
 function fit(){const aspect=width/h,span=Math.max(8.6,...layout.nodes.map(n=>Math.abs(n.position[0])*2+1.9));fitDistance=Math.max(height*1.7,span/Math.max(.3,aspect)*.65)/Math.tan(T.MathUtils.degToRad(36/2))*.64;fitDistance=Math.max(13.5,fitDistance);controls.minDistance=3;controls.maxDistance=fitDistance*2;controls.target.set(0,height*.55+.15,0);camera.position.copy(controls.target).add(new T.Vector3(.45,.25,1).normalize().multiplyScalar(fitDistance));camera.near=.1;camera.far=100;camera.updateProjectionMatrix();controls.update();desiredDistance=null}
 function resize(){width=host.clientWidth;h=host.clientHeight;if(!width||!h)return;renderer.setSize(width,h,false);camera.aspect=width/h;camera.updateProjectionMatrix();if(!initial&&Math.abs(width/h-lastAspect)>.18)fit();lastAspect=width/h;if(initial){fit();if(view&&Math.abs((view.aspect||width/h)-width/h)<.18){camera.position.fromArray(view.camera);controls.target.fromArray(view.target);controls.update()}initial=false}}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
 const raycaster=new T.Raycaster(),pointer=new T.Vector2();let down=null;
 const start=e=>{down={x:e.clientX,y:e.clientY}},end=e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return}down=null;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables)[0];if(hit)onSelect(hit.object.userData.id)};
 renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',end);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function animate(time){if(disposed)return;frame=requestAnimationFrame(animate);if(document.hidden||time-lastTime<33)return;lastTime=time;
  if(desiredDistance!==null){const direction=camera.position.clone().sub(controls.target),distance=direction.length(),next=T.MathUtils.lerp(distance,desiredDistance,.15);camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(next));if(Math.abs(next-desiredDistance)<.01)desiredDistance=null}
  controls.update();
  if(!reduce){for(let i=0;i<leaves.length;i++){const l=leaves[i];matrix.position.set(l.x+Math.sin(time*.0007+l.phase)*.018,l.y,l.z);matrix.rotation.set(l.rot[0]+Math.sin(time*.001+l.phase)*.055,l.rot[1],l.rot[2]);matrix.scale.setScalar(l.size);matrix.updateMatrix();foliage.setMatrixAt(i,matrix.matrix)}foliage.instanceMatrix.needsUpdate=true}
  const used=[];for(const {button,p,node} of [...anchors].sort((a,b)=>Number(b.node.leaf)-Number(a.node.leaf))){const projected=p.clone().project(camera);let x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*h,visible=projected.z<1&&x>-30&&x<width+30&&y>10&&y<h-10;const w=Math.min(170,button.offsetWidth||100);x=Math.max(w/2+12,Math.min(width-w/2-12,x));if(visible){for(let tries=0;tries<5&&used.some(r=>Math.abs(x-r.x)<(w+r.w)/2+4&&Math.abs(y-r.y)<32);tries++)y+=36;if(y>h-34)visible=false;else used.push({x,y,w})}button.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;button.style.visibility=visible?'visible':'hidden';}
  onZoom?.(Math.round(fitDistance/camera.position.distanceTo(controls.target)*100));renderer.render(scene,camera)
 }
 frame=requestAnimationFrame(animate);
 return {zoom(factor){desiredDistance=T.MathUtils.clamp(camera.position.distanceTo(controls.target)/factor,controls.minDistance,controls.maxDistance)},reset(){fit()},getView(){return {camera:camera.position.toArray(),target:controls.target.toArray(),aspect:width/h}},dispose(){disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',end);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o.shadow?.map)o.shadow.map.dispose()});renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();labels.remove()}};
}
