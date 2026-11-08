// Tree positions are derived from the goal hierarchy. No presentation data is saved.
export function treeLayout(nodes,focus=null){
 const root=nodes.find(n=>n.id===focus)||nodes.find(n=>n.parentId===null);if(!root)return {nodes:[],edges:[],height:4};
 const children=new Map(nodes.map(n=>[n.id,[]]));for(const n of nodes)children.get(n.parentId)?.push(n);
 const result=[],edges=[];let slot=0;
 function visit(n,depth){const p={id:n.id,name:n.name,parentId:n.parentId,depth,leaf:!children.get(n.id)?.length,slot:0};result.push(p);const cs=(children.get(n.id)||[]).map(c=>visit(c,depth+1));if(cs.length){p.slot=cs.reduce((s,c)=>s+c.slot,0)/cs.length;cs.forEach(c=>edges.push([p.id,c.id]))}else p.slot=slot++;return p}
 visit(root,0);const maxDepth=Math.max(1,...result.map(n=>n.depth)),spread=Math.min(7,Math.max(3.3,slot*.84)),height=Math.min(8,3+maxDepth*.65);
 for(const n of result){const hash=[...n.id].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,17);n.position=n.depth===0?[0,.15,0]:[slot===1?0:(n.slot/(slot-1)-.5)*spread,1.25+(n.depth/maxDepth)*(height-1.25)+(n.leaf?.65*Math.cos((slot===1?0:n.slot/(slot-1)-.5)*Math.PI)-.25+Math.sin(n.slot*1.7)*.12:0),Math.sin(n.slot*2.1+.4)*.65+(n.depth%2?-.12:.22)];n.seed=hash}
 return {nodes:result,edges,height};
}
