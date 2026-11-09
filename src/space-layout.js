import {sceneLayout} from '../dist/universe-model.js';

const CHILD_SCALE=.43;

// A body has one position and size whether seen from its parent or up close.
export function createSpaceLayout(nodes,width,height,limit){
 const root=nodes.find(node=>node.parentId===null),childrenByParent=new Map();
 for(const node of nodes){
  if(!childrenByParent.has(node.parentId))childrenByParent.set(node.parentId,[]);
  childrenByParent.get(node.parentId).push(node);
 }
 for(const children of childrenByParent.values())children.sort((a,b)=>(a.order||0)-(b.order||0));
 const portrait=width/height<.85,columns=portrait?2:3,ringSize=portrait?4:7;
 const frames=new Map();
 function place(node,depth,x,y,z,scale){
  const children=depth<4?(childrenByParent.get(node.id)||[]):[];
  const visible=children.slice(0,limit);
  const rings=Math.ceil(visible.length/ringSize);
  const localDistance=Math.max(portrait?32:25,
   depth?((rings-1)*3.3+7)*2.1:((portrait?9:12)/Math.max(.35,width/height))*1.5,
   Math.ceil(visible.length/columns)*10);
  frames.set(node.id,{node,depth,x,y,z,scale,distance:localDistance*scale,visible,rings});
  const layout=sceneLayout(visible,width,height);
  for(const [i,child] of children.entries()){
   const index=i%limit,page=Math.floor(i/limit),spot=layout[index];
   let dx=spot.x,dy=spot.y-page*limit*3,dz=spot.z;
   if(depth===0){
    dz=(index%3-1)*3.8;
    const perspective=(localDistance-dz)/localDistance;
    dx*=perspective;dy*=perspective;
   }else{
    const ring=Math.floor(i/ringSize),count=Math.min(ringSize,children.length-ring*ringSize);
    const angle=(i%ringSize)/count*Math.PI*2+.32,radius=5+ring*3.3;
    dx=Math.cos(angle)*radius;dy=Math.sin(angle)*radius*.72;
   }
   place(child,depth+1,x+dx*scale,y+dy*scale,z+dz*scale,scale*CHILD_SCALE);
  }
 }
 place(root,0,0,0,0,1);
 return frames;
}

export function spaceRoute(frames,from,to){
 const ancestors=new Set();
 for(let frame=frames.get(from);frame;frame=frames.get(frame.node.parentId))ancestors.add(frame.node.id);
 const down=[];
 let joint=frames.get(to);
 while(joint&&!ancestors.has(joint.node.id)){down.push(joint.node.id);joint=frames.get(joint.node.parentId)}
 if(!joint)return [];
 const up=[];
 for(let frame=frames.get(from);frame.node.id!==joint.node.id;){
  frame=frames.get(frame.node.parentId);
  up.push(frame.node.id);
 }
 return [...up,...down.reverse()];
}
