import {nodeKind,setting,modesForLevel,validateMeasurement} from './model.js';
// Navigation and editing rules are independent of the visual scene and historic logs.
export const LEVELS=['宇宙','銀河','恒星系','惑星','衛星'];
export function nodePath(s,id){const path=[],seen=new Set();let n=s.nodes.find(n=>n.id===id);while(n&&!seen.has(n.id)){seen.add(n.id);path.unshift(n);n=s.nodes.find(p=>p.id===n.parentId)}return path}
export const nodeDepth=(s,id)=>nodePath(s,id).length-1;
export function visibleChildren(s,id){return s.nodes.filter(n=>n.parentId===id).sort((a,b)=>(a.order||0)-(b.order||0))}
export function canPlace(s,id,parentId){const parent=s.nodes.find(n=>n.id===parentId);if(!parent||nodeKind(s,parentId)==='action')return false;const branch=s.nodes.find(n=>n.id===id);if(!branch)return nodeDepth(s,parentId)<4;const seen=new Set();function height(n){if(seen.has(n.id))return Infinity;seen.add(n.id);const children=s.nodes.filter(c=>c.parentId===n.id);return children.length?1+Math.max(...children.map(height)):0}if(nodePath(s,parentId).some(n=>n.id===id))return false;return nodeDepth(s,parentId)+1+height(branch)<=4}
export function freshUniverse(){return {version:1,nodes:[{id:'root',parentId:null,name:'自分が望む人生を実現する'}],settings:{},records:{},logs:{},reviews:{},pending:[],universe:{version:1,onboarded:false,step:'welcome'}}}
export function migrateUniverse(s){if(s.universe?.version===1)return s;return {...s,universe:{version:1,onboarded:true,migratedAt:new Date().toISOString(),legacyDeep:s.nodes.some(n=>nodeDepth(s,n.id)>4)}}}
export function completeUniverse(s,name,galaxyName){const root=s.nodes.find(n=>n.parentId===null);if(!name.trim()||!galaxyName.trim())throw Error('名前を入力してください');root.name=name.trim().slice(0,80);let galaxy=s.nodes.find(n=>n.parentId===root.id);if(!galaxy){galaxy={id:crypto.randomUUID(),parentId:root.id,name:galaxyName.trim().slice(0,80),symbolName:galaxyName.trim().slice(0,80)};s.nodes.push(galaxy)}s.universe={version:1,onboarded:true};return galaxy.id}
export function reorderNode(s,id,direction){const node=s.nodes.find(n=>n.id===id);if(!node)return;const siblings=visibleChildren(s,node.parentId),index=siblings.findIndex(n=>n.id===id),next=index+direction;if(next<0||next>=siblings.length)return;[siblings[index],siblings[next]]=[siblings[next],siblings[index]];siblings.forEach((n,i)=>n.order=i)}
export function sceneLayout(nodes,width=1000,height=700){const portrait=width/height<.85,spacingX=portrait?7.0:8.4,spacingY=portrait?6.4:6.7,columns=portrait?2:3;return nodes.map((n,i)=>{const row=Math.floor(i/columns),col=i%columns,count=Math.min(columns,nodes.length-row*columns);return {id:n.id,x:(col-(count-1)/2)*spacingX+(row%2?.55:-.55),y:((Math.ceil(nodes.length/columns)-1)/2-row)*spacingY,z:Math.sin(i*1.7)*.6}})}

export function shouldPromptDailyMode(s,day){return s.universe?.onboarded===true&&!s.records[day]&&s.universe.lastModePrompt!==day}

export function writeGoal(s,{id='new',name,purpose,parentId,kind='goal',measurement,mode='full',symbolName}){
 name=String(name||'').trim();purpose=String(purpose||'').trim();if(!name||name.length>80)throw Error('名前を1〜80文字で入力してください');if(!purpose||purpose.length>1000)throw Error('この目標にした目的を入力してください');if(!['goal','action'].includes(kind))throw Error('目標かタスクを選んでください');
 const n=s.nodes.find(n=>n.id===id),isNew=id==='new';if(!isNew&&!n)throw Error('目標が見つかりません');const isRoot=!isNew&&n.parentId===null;
 if(!isRoot){if(!parentId||!s.nodes.some(p=>p.id===parentId))throw Error('つながっている上位目標を選んでください');if((isNew||parentId!==n.parentId)&&!canPlace(s,id,parentId))throw Error('上位目標を確認してください。宇宙から衛星までの5階層以内で、目標につなげられます。')}
 if(kind==='action'){if(isRoot||(!isNew&&s.nodes.some(c=>c.parentId===id)))throw Error('下位目標のあるものは目標として保存してください');validateMeasurement(measurement);if(measurement.dailyAmount==null)throw Error('タスク量を入力してください');if(!['rest','busy','full'].includes(mode))throw Error('タスクのモードを選んでください')}
 const target=isNew?{id:crypto.randomUUID(),parentId,name}:n;target.name=name;target.description=purpose;target.kind=isRoot?'goal':kind;if(!isRoot)target.parentId=parentId;if(symbolName!==undefined)target.symbolName=String(symbolName||name).trim().slice(0,80);if(isNew)s.nodes.push(target);
 if(kind==='action')s.settings[target.id]={...setting(s,target.id),measurement:structuredClone(measurement),modes:modesForLevel(mode)};return target.id;
}
