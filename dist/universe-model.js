import {nodeKind,setting,modesForLevel,validateMeasurement,isEventTask,validateEventDate,eventCompletionDate,validateDuration,unitInfo,rounded,dateKey,recordMode,validDateKey} from './model.js';
// Navigation and editing rules are independent of the visual scene and historic logs.
export const UNIVERSE_ORIGIN='@universe-origin';
export const LEVELS=['宇宙','銀河','恒星系','惑星','衛星'];
export function nodePath(s,id){const path=[],seen=new Set();let n=s.nodes.find(n=>n.id===id);while(n&&!seen.has(n.id)){seen.add(n.id);path.unshift(n);n=s.nodes.find(p=>p.id===n.parentId)}return path}
export const nodeDepth=(s,id)=>nodePath(s,id).length-1;
export function visibleChildren(s,id){return s.nodes.filter(n=>n.parentId===id).sort((a,b)=>(a.order||0)-(b.order||0))}
export function canPlace(s,id,parentId){const parent=s.nodes.find(n=>n.id===parentId);if(!parent||nodeKind(s,parentId)==='action')return false;const branch=s.nodes.find(n=>n.id===id);if(!branch)return nodeDepth(s,parentId)<4;const seen=new Set();function height(n){if(seen.has(n.id))return Infinity;seen.add(n.id);const children=s.nodes.filter(c=>c.parentId===n.id);return children.length?1+Math.max(...children.map(height)):0}if(nodePath(s,parentId).some(n=>n.id===id))return false;return nodeDepth(s,parentId)+1+height(branch)<=4}
export function freshUniverse(){return {version:1,nodes:[{id:'root',parentId:null,name:'自分が望む人生を実現する'}],settings:{},records:{},logs:{},reviews:{},pending:[],universe:{version:1,onboarded:false,step:'welcome'}}}
export function migrateUniverse(s){if(s.universe?.version===1)return s;return {...s,universe:{version:1,onboarded:true,migratedAt:new Date().toISOString(),legacyDeep:s.nodes.some(n=>nodeDepth(s,n.id)>4)}}}
export function completeUniverse(s,name,galaxyName){
 const root=s.nodes.find(n=>n.parentId===null);
 let galaxy=s.nodes.find(n=>n.parentId===root.id);
 if(s.universe?.onboarded)return galaxy?.id??root.id;
 const title=name.trim(),firstGalaxy=galaxyName?.trim();
 if(!title||galaxyName!==undefined&&!firstGalaxy)throw Error('名前を入力してください');
 root.name=title.slice(0,80);
 if(firstGalaxy&&!galaxy){
  const label=firstGalaxy.slice(0,80);
  galaxy={id:crypto.randomUUID(),parentId:root.id,name:label,symbolName:label};
  s.nodes.push(galaxy);
 }
 s.universe={...s.universe,version:1,onboarded:true};
 delete s.universe.step;
 delete s.universe.draftName;
 return galaxy?.id??root.id;
}
const growthDays=[2,3,5,7,10,14,21,30,45,66];
const growthNames=[
 '生まれたて','最初の銀河','ほのかな光','光の輪','星の息吹','星雲の芽吹き',
 '星雲のゆらぎ','星雲の広がり','深まるオーラ','光の潮流','銀河の輝き','光彩の宇宙'
];
export function universeGrowth(s,today=dateKey()){
 const root=s.nodes.find(node=>node.parentId===null);
 const hasGalaxy=s.nodes.some(node=>node.parentId===root.id);
 const dates=new Set([...Object.keys(s.records),...Object.keys(s.logs)]);
 let days=0;
 for(const day of dates){
  if(day<=today&&validDateKey(day)&&(recordMode(s,day)!=='none'||Object.keys(s.logs[day]||{}).length))days++;
 }
 const milestone=growthDays.findIndex(threshold=>days<threshold);
 const level=hasGalaxy?(milestone===-1?growthDays.length+1:milestone+1):0;
 return {level,days,strength:level/(growthNames.length-1),name:growthNames[level],nextDay:hasGalaxy&&milestone!==-1?growthDays[milestone]:null};
}
export function reorderNode(s,id,direction){const node=s.nodes.find(n=>n.id===id);if(!node)return;const siblings=visibleChildren(s,node.parentId),index=siblings.findIndex(n=>n.id===id),next=index+direction;if(next<0||next>=siblings.length)return;[siblings[index],siblings[next]]=[siblings[next],siblings[index]];siblings.forEach((n,i)=>n.order=i)}
export function sceneLayout(nodes,width=1000,height=700){const portrait=width/height<.85,spacingX=portrait?7.0:8.4,spacingY=portrait?6.4:6.7,columns=portrait?2:3;return nodes.map((n,i)=>{const row=Math.floor(i/columns),col=i%columns,count=Math.min(columns,nodes.length-row*columns);return {id:n.id,x:(col-(count-1)/2)*spacingX+(row%2?.55:-.55),y:((Math.ceil(nodes.length/columns)-1)/2-row)*spacingY,z:Math.sin(i*1.7)*.6}})}

export function shouldPromptDailyMode(s,day){return s.universe?.onboarded===true&&!s.records[day]&&s.universe.lastModePrompt!==day}

export function writeGoal(s,{id='new',name,purpose,parentId,kind='goal',measurement,mode='full',eventDate,symbolName}){
 name=String(name||'').trim();purpose=String(purpose||'').trim();if(!name||name.length>80)throw Error('名前を1〜80文字で入力してください');if(!purpose||purpose.length>1000)throw Error(kind==='action'?'上位目標につながる理由を入力してください':'この目標にした目的を入力してください');if(!['goal','action'].includes(kind))throw Error('目標かタスクを選んでください');
 const n=s.nodes.find(n=>n.id===id),isNew=id==='new';if(!isNew&&!n)throw Error('目標が見つかりません');const isRoot=!isNew&&n.parentId===null;
 if(!isRoot){if(!parentId||!s.nodes.some(p=>p.id===parentId))throw Error('つながっている上位目標を選んでください');if((isNew||parentId!==n.parentId)&&!canPlace(s,id,parentId))throw Error('上位目標を確認してください。宇宙から衛星までの5階層以内で、目標につなげられます。')}
 if(kind==='action'){
  if(isRoot||(!isNew&&s.nodes.some(c=>c.parentId===id)))throw Error('下位目標のあるものは目標として保存してください');
  validateMeasurement(measurement);
  if(unitInfo(measurement).dimension!=='time')throw Error('取り組む時間を入力してください');
  validateDuration(measurement.dailyAmount);
  if(measurement.extras?.some(metric=>metric.dailyAmount==null))throw Error('追加で記録する量を入力してください');
  if(eventDate!==undefined)validateEventDate(eventDate);
  else{
   if(measurement.totalTarget==null&&measurement.weeklyTarget==null&&measurement.monthlyTarget==null)throw Error('全体または1週間の目標時間を入力してください');
   if(!['rest','busy','full'].includes(mode))throw Error('タスクのモードを選んでください');
  }
 }
 const target=isNew?{id:crypto.randomUUID(),parentId,name}:n;target.name=name;target.description=purpose;target.kind=isRoot?'goal':kind;if(!isRoot)target.parentId=parentId;if(symbolName!==undefined)target.symbolName=String(symbolName||name).trim().slice(0,80);if(isNew)s.nodes.push(target);
 if(kind==='action'){
  const previous=setting(s,target.id);
  const base={...previous};delete base.eventDate;delete base.measurement;
  const changedFormat=isEventTask(previous)!==(eventDate!==undefined);
  if(changedFormat)s.pending=s.pending.filter(item=>item.id!==target.id);
  s.settings[target.id]=eventDate!==undefined
   ?{...base,type:'once',eventDate,measurement:structuredClone(measurement),modes:[],status:eventCompletionDate(s,target.id)?'completed':'active'}
   :{...base,...(changedFormat?{type:'continuous',status:'active'}:{}),measurement:structuredClone(measurement),modes:modesForLevel(mode)};
 }
 return target.id;
}

export function statisticsGoals(s){return s.nodes.filter(n=>n.parentId!==null&&nodeKind(s,n.id)==='goal').sort((a,b)=>nodePath(s,a.id).map(n=>n.name).join('/').localeCompare(nodePath(s,b.id).map(n=>n.name).join('/'),'ja'))}
export function statisticsScope(s,id){if(id==='all')return 'all';const path=nodePath(s,id);for(let i=path.length-1;i>0;i--)if(nodeKind(s,path[i].id)==='goal')return path[i].id;return 'all'}
export function boundedMonth(month,offset,today){const [y,m]=month.split('-').map(Number),date=new Date(Date.UTC(y,m-1+offset,1)),next=`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;return next>today.slice(0,7)?today.slice(0,7):next}
export function weeklyTaskSections(s,summary,scope='all'){
 if(scope!=='all')return [{id:scope,name:s.nodes.find(n=>n.id===scope)?.name||'選んだ目標',rows:summary.rows}];
 const sections=new Map(),rowMap=new Map(summary.rows.map(r=>[r.id+'\0'+r.dimension,r])),seen=new Set();
 function sectionFor(ids,path){const nested=ids.length>2||path.length>2,key=nested?(ids[1]||'legacy:'+path[1]):'all',name=nested?(s.nodes.find(n=>n.id===ids[1])?.name||path[1]||'以前の目標'):'宇宙のタスク';if(!sections.has(key))sections.set(key,{id:key,name,rows:[],map:new Map()});return sections.get(key)}
 for(const entry of summary.entries){const key=entry.id+'\0'+entry.dimension,source=rowMap.get(key);if(!source)continue;const group=sectionFor(entry.goalIds||[],entry.goalPath||[]);if(!group.map.has(key)){const row={...source,amount:0};group.map.set(key,row);group.rows.push(row)}const row=group.map.get(key);row.amount=Math.round((row.amount+entry.value)*1000000)/1000000;seen.add(key)}
 for(const row of summary.rows){const key=row.id+'\0'+row.dimension;if(seen.has(key))continue;const path=nodePath(s,row.id),group=sectionFor(path.map(n=>n.id),path.map(n=>n.name));group.rows.push(row)}
 return [...sections.values()].map(({map,...group})=>group)
}

export function weeklyAchievement(amount,target){if(!Number.isFinite(target)||target<=0||!Number.isFinite(amount)||amount<0)return null;const percent=Math.round(amount/target*100);return {percent,bar:Math.min(100,percent),complete:amount>=target}}

export function timeGoalProgress(rows){
 const targets=rows.filter(row=>row.dimension==='time'&&Number.isFinite(row.target)&&row.target>0);
 const actual=rounded(targets.reduce((sum,row)=>sum+row.amount,0));
 const target=rounded(targets.reduce((sum,row)=>sum+row.target,0));
 return {actual,target,count:targets.length,achievement:weeklyAchievement(actual,target)};
}
