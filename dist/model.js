export const MODES={full:{label:'余裕がある日',icon:'☀',color:'#9474f5',description:'じっくり、自分の目標に向き合う'},busy:{label:'忙しい日',icon:'◐',color:'#624bb5',description:'大切なことを、少しだけ'},rest:{label:'休む日',icon:'☾',color:'#342950',description:'立ち止まる時間も、成長の一部'},none:{label:'何もしなかった日',icon:'—',color:'#293043',description:'そんな日があっても、大丈夫'}};
export const dateKey=(d=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(d);
export function shiftDate(key,n){const d=new Date(key+'T12:00:00+09:00');d.setUTCDate(d.getUTCDate()+n);return dateKey(d)}
export function weekStart(key){const day=new Date(key+'T12:00:00+09:00').getUTCDay();return shiftDate(key,-((day+6)%7))}
export function seed(){return {version:1,nodes:[{id:'root',parentId:null,name:'自分らしく、豊かに生きる'},{id:'dev',parentId:'root',name:'つくる力を育てる'},{id:'english',parentId:'root',name:'世界とつながる'},{id:'health',parentId:'root',name:'心と体を整える'},{id:'project',parentId:'dev',name:'個人開発を進める'},{id:'vocab',parentId:'english',name:'英単語を10個覚える'},{id:'shadow',parentId:'english',name:'シャドーイング'},{id:'walk',parentId:'health',name:'外の空気を吸って歩く'},{id:'read',parentId:'health',name:'好きな本を読む'}],settings:{project:{priority:0,type:'continuous',status:'active',modes:['full','busy']},vocab:{priority:1,type:'continuous',status:'active',modes:['full','busy']},shadow:{priority:1,type:'continuous',status:'active',modes:['full']},walk:{priority:1,type:'continuous',status:'active',modes:['full','rest']},read:{priority:2,type:'continuous',status:'active',modes:['full','rest']}},records:{},logs:{},reviews:{},pending:[]}}
export const leaves=s=>s.nodes.filter(n=>n.parentId&&!s.nodes.some(c=>c.parentId===n.id));
export function nodeKind(s,id){const n=s.nodes.find(n=>n.id===id);if(!n?.parentId)return 'goal';if(n.kind==='goal'||n.kind==='action')return n.kind;return s.settings[id]&&!s.nodes.some(c=>c.parentId===id)?'action':'goal'}
export function descendants(s,id){const out=new Set([id]);let size;do{size=out.size;s.nodes.forEach(n=>{if(out.has(n.parentId))out.add(n.id)})}while(size!==out.size);return out}
export function moveNode(s,id,parentId){const n=s.nodes.find(n=>n.id===id);if(!n?.parentId||!s.nodes.some(n=>n.id===parentId)||descendants(s,id).has(parentId))throw Error('自分自身や子孫へは移動できません');n.parentId=parentId}
export function deleteNode(s,id){if(!s.nodes.find(n=>n.id===id)?.parentId)throw Error('根は削除できません');const ids=descendants(s,id);s.nodes=s.nodes.filter(n=>!ids.has(n.id));ids.forEach(id=>delete s.settings[id]);s.pending=s.pending.filter(p=>!ids.has(p.id))}
export function setting(s,id){return s.settings[id]||{priority:1,type:'continuous',status:'active',modes:['full']}}
export function applyPending(s,key){s.pending=s.pending.filter(p=>{if(p.effective<=key){if(s.nodes.some(n=>n.id===p.id))s.settings[p.id]={...p.setting,...(s.settings[p.id]?.measurement?{measurement:s.settings[p.id].measurement}:{})};return false}return true})}
export function taskLevel(a){return a.modes.includes('rest')?'rest':a.modes.includes('busy')?'busy':'full'}
export function modesForLevel(level){return level==='rest'?['full','busy','rest']:level==='busy'?['full','busy']:['full']}
export function includesMode(a,mode){return modesForLevel(taskLevel(a)).includes(mode)}
export function plan(s,mode){return leaves(s).filter(n=>{const a=setting(s,n.id);return n.kind!=='goal'&&!isEventTask(a)&&a.status==='active'&&includesMode(a,mode)}).sort((a,b)=>setting(s,a.id).priority-setting(s,b.id).priority)}
export function toggleLog(s,key,n){s.logs[key]??={};if(s.logs[key][n.id]){delete s.logs[key][n.id];return}const a=setting(s,n.id);s.logs[key][n.id]={name:n.name,setting:structuredClone(a),goalPath:ancestry(s,n.id),recordedAt:new Date().toISOString()};if(a.type==='once')s.settings[n.id]={...a,status:'completed'}}
export function ancestry(s,id){const path=[];let n=s.nodes.find(n=>n.id===id);while(n){path.unshift(n.name);n=s.nodes.find(p=>p.id===n.parentId)}return path}
export function stats(s,start,end){const counts={full:0,busy:0,rest:0,none:0};Object.entries(s.records).forEach(([k,r])=>{if(k>=start&&k<=end&&counts[r.mode]!==undefined)counts[r.mode]++});const logs=Object.entries(s.logs).filter(([k])=>k>=start&&k<=end).flatMap(([,v])=>Object.values(v));return {counts,days:Object.values(counts).reduce((a,b)=>a+b,0),logs}}
export function validate(s){if(!s||s.version!==1||!Array.isArray(s.nodes)||!s.settings||!s.records||!s.logs||!s.reviews||!Array.isArray(s.pending))throw Error('対応していないデータ形式です');if(s.nodes.length<1||s.nodes.length>1000||s.nodes.filter(n=>n.parentId===null).length!==1||new Set(s.nodes.map(n=>n.id)).size!==s.nodes.length)throw Error('木の構造が正しくありません');for(const n of s.nodes){if(typeof n.id!=='string'||typeof n.name!=='string'||!n.name.trim())throw Error('目標の形式が正しくありません');const seen=new Set([n.id]);let p=n.parentId;while(p!==null){if(seen.has(p))throw Error('木が循環しています');seen.add(p);const parent=s.nodes.find(x=>x.id===p);if(!parent)throw Error('親目標が見つかりません');p=parent.parentId}}const check=a=>{if(!a||![0,1,2].includes(a.priority)||!['continuous','once'].includes(a.type)||!['active','paused','completed'].includes(a.status)||!Array.isArray(a.modes)||a.modes.some(m=>!['full','busy','rest'].includes(m)))throw Error('行動設定が正しくありません');if(a.measurement)validateMeasurement(a.measurement);if(isEventTask(a))validateEventDate(a.eventDate)};Object.values(s.settings).forEach(check);s.pending.forEach(p=>{check(p.setting);if(typeof p.id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.effective))throw Error('予約設定が正しくありません')});for(const [k,r] of Object.entries(s.records)){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!MODES[r.mode])throw Error('記録が正しくありません');if(r.quantityMenu){if(!Array.isArray(r.quantityMenu)||r.quantityMenu.length>1000)throw Error('モードの量の設定が正しくありません');for(const item of r.quantityMenu){if(!item||typeof item.id!=='string'||typeof item.name!=='string'||!Array.isArray(item.goalIds)||!item.goalIds.every(x=>typeof x==='string')||!Array.isArray(item.goalPath)||!item.goalPath.every(x=>typeof x==='string'))throw Error('モードの履歴が正しくありません');check(item.setting)}}if(r.quantityExcluded&&(!Array.isArray(r.quantityExcluded)||!r.quantityExcluded.every(x=>typeof x==='string')))throw Error('記録の調整が正しくありません')}for(const [k,logs] of Object.entries(s.logs)){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!logs||typeof logs!=='object'||Object.values(logs).some(l=>!l||typeof l.name!=='string'))throw Error('実行記録が正しくありません');for(const l of Object.values(logs)){if(l.quantity){const q=l.quantity,u=unitInfo(q.measurement);if(!Number.isFinite(q.amount)||q.amount<=0||q.amount>1000000||!Number.isFinite(q.base)||Math.abs(q.base-rounded(q.amount*u.factor))>0.000001)throw Error('量の記録が正しくありません')}if(l.goalIds&&(!Array.isArray(l.goalIds)||l.goalIds.some(id=>typeof id!=='string')))throw Error('目標の履歴が正しくありません')}}return s}

export const UNITS={pages:{label:'ページ',dimension:'pages',factor:1},hours:{label:'時間',dimension:'time',factor:60},minutes:{label:'分',dimension:'time',factor:1},count:{label:'回',dimension:'count',factor:1},questions:{label:'問',dimension:'questions',factor:1},words:{label:'単語',dimension:'words',factor:1},items:{label:'個',dimension:'items',factor:1}};
export const rounded=n=>Math.round((n+Number.EPSILON)*1e6)/1e6;
export function measurement(s,id){return setting(s,id).measurement||{unit:'count',weeklyTarget:null}}
export function validateMeasurement(m){if(m?.dailyAmount!=null&&(!Number.isFinite(m.dailyAmount)||m.dailyAmount<.001||m.dailyAmount>1000000))throw Error('タスクの量は0.001以上で入力してください');if(!m||(!Object.hasOwn(UNITS,m.unit)&&m.unit!=='custom'))throw Error('記録する単位を選んでください');if(m.unit==='custom'&&(typeof m.customUnit!=='string'||!m.customUnit.trim()||m.customUnit.trim().length>12))throw Error('単位は1〜12文字で入力してください');for(const [key,label] of [['weeklyTarget','週'],['monthlyTarget','月']]){const target=m[key];if(target!=null&&(!Number.isFinite(target)||target<=0||target>1000000))throw Error(label+'の目標量は0より大きい数にしてください')}return m}
export function unitInfo(m){validateMeasurement(m);if(Object.hasOwn(UNITS,m.unit))return UNITS[m.unit];const label=m.customUnit.trim(),known=Object.values(UNITS).find(u=>u.label===label);return known||{label,dimension:'custom:'+label,factor:1}}
export function validDateKey(key){if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key))return false;const d=new Date(key+'T12:00:00+09:00');return Number.isFinite(d.getTime())&&dateKey(d)===key}
export function goalIds(s,id){const path=[];let n=s.nodes.find(n=>n.id===id);while(n){path.unshift(n.id);n=s.nodes.find(p=>p.id===n.parentId)}return path}
export function setQuantity(s,key,id,amount,todayKey=dateKey()){
 if(!validDateKey(key)||key>todayKey)throw Error('今日以前の日付を選んでください');if(!Number.isFinite(amount)||amount<0.001||amount>1000000)throw Error('取り組んだ量を0より大きい数で入力してください');
 const old=s.logs[key]?.[id],node=s.nodes.find(n=>n.id===id);if(isEventTask(setting(s,id))&&!old?.quantity)throw Error('イベントは完了を記録してください');if(!node||((node.kind==='goal'||!leaves(s).some(n=>n.id===id))&&!old?.quantity))throw Error('葉っぱの行動を選んでください');
 const a=setting(s,id),m=old?.quantity?old.quantity.measurement:measurement(s,id),u=unitInfo(m);
 s.logs[key]??={};s.logs[key][id]={name:old?.name||node.name,setting:old?.setting||structuredClone(a),goalPath:old?.goalPath||ancestry(s,id),goalIds:old?.goalIds||goalIds(s,id),recordedAt:old?.recordedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),source:'manual',...(old?.eventCompleted?{eventCompleted:true}:{}),quantity:{amount:rounded(amount),measurement:structuredClone(m),base:rounded(amount*u.factor)}};
 if(s.records[key]?.quantityExcluded)s.records[key].quantityExcluded=s.records[key].quantityExcluded.filter(x=>x!==id);if(a.type==='once'&&!isEventTask(a))s.settings[id]={...a,status:'completed'};return s.logs[key][id];
}
export function removeQuantity(s,key,id){if(s.records[key]?.quantityMenu){s.records[key].quantityExcluded=[...new Set([...(s.records[key].quantityExcluded||[]),id])]}if(s.logs[key]){const log=s.logs[key][id];if(log?.eventCompleted)delete log.quantity;else delete s.logs[key][id];if(!Object.keys(s.logs[key]).length)delete s.logs[key]}}
export function quantitySummary(s,start,end,scope='all',includeConfigured=true,period='week'){
 const targetKey=period==='month'?'monthlyTarget':'weeklyTarget';
 const currentIds=scope==='all'?null:descendants(s,scope),rows=new Map(),groups=new Map(),entries=[];let unknown=0;
 const inScope=(id,log)=>scope==='all'||(Array.isArray(log.goalIds)?log.goalIds.includes(scope):currentIds.has(id));
 const rowFor=(id,name,u)=>{const key=id+'\u0000'+u.dimension;if(!rows.has(key))rows.set(key,{key,id,name,dimension:u.dimension,unit:u.dimension==='time'?'時間':u.label,amount:0,target:null,byDate:{},deleted:!s.nodes.some(n=>n.id===id)});return rows.get(key)};
 for(const [date,logs] of Object.entries(s.logs).sort(([a],[b])=>a.localeCompare(b))){if(date<start||date>end)continue;for(const [id,log] of Object.entries(logs)){if(!inScope(id,log))continue;if(!log.quantity){if(!log.eventCompleted)unknown++;continue}const q=log.quantity,u=unitInfo(q.measurement),factor=u.dimension==='time'?60:1,value=rounded(q.base/factor),row=rowFor(id,log.name,u);
  row.amount=rounded(row.amount+value);row.byDate[date]=rounded((row.byDate[date]||0)+value);row.target=q.measurement[targetKey]==null?null:rounded(q.measurement[targetKey]*u.factor/factor);row.hasTarget=q.measurement.weeklyTarget!=null||q.measurement.monthlyTarget!=null;
  entries.push({date,id,name:log.name,amount:q.amount,unit:u.label,value,dimension:u.dimension,source:log.source||'manual',goalIds:log.goalIds||goalIds(s,id),goalPath:log.goalPath||ancestry(s,id)});
 }}
 if(includeConfigured)for(const n of leaves(s)){if(n.kind==='goal')continue;if(currentIds&&!currentIds.has(n.id))continue;const a=setting(s,n.id);if(!a.measurement||isEventTask(a))continue;const m=measurement(s,n.id),u=unitInfo(m),row=rowFor(n.id,n.name,u);row.name=n.name;row.target=m[targetKey]==null?null:rounded(m[targetKey]*u.factor/(u.dimension==='time'?60:1));row.hasTarget=m.weeklyTarget!=null||m.monthlyTarget!=null}
 for(const row of rows.values()){if(!groups.has(row.dimension))groups.set(row.dimension,{dimension:row.dimension,unit:row.unit,total:0,byDate:{}});const g=groups.get(row.dimension);g.total=rounded(g.total+row.amount);for(const [k,v] of Object.entries(row.byDate))g.byDate[k]=rounded((g.byDate[k]||0)+v)}
 return {groups:[...groups.values()],rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja')),entries,unknown};
}

export function fixedMenu(s){return leaves(s).filter(n=>n.kind!=='goal').map(n=>({id:n.id,name:n.name,goalPath:ancestry(s,n.id),goalIds:goalIds(s,n.id),setting:structuredClone(setting(s,n.id))}))}
export function modeItems(menu,mode){return menu.filter(item=>{const a=item.setting,m=a.measurement;return !isEventTask(a)&&a.status==='active'&&includesMode(a,mode)&&m&&Number.isFinite(m.dailyAmount)&&m.dailyAmount>=.001})}
export function modeTotals(s,mode){const items=modeItems(fixedMenu(s),mode),groups=new Map();for(const item of items){const m=item.setting.measurement,u=unitInfo(m);if(!groups.has(u.dimension))groups.set(u.dimension,{dimension:u.dimension,unit:u.dimension==='time'?'時間':u.label,total:0});const g=groups.get(u.dimension);g.total=rounded(g.total+m.dailyAmount*u.factor/(u.dimension==='time'?60:1))}return {count:items.length,groups:[...groups.values()]}}
export function applyMode(s,key,mode,todayKey=dateKey()){
 if(!validDateKey(key)||key>todayKey||!Object.hasOwn(MODES,mode))throw Error('モードと今日以前の日付を選んでください');
 const previous=s.records[key]||{},menu=key===todayKey||!previous.quantityMenu?fixedMenu(s):previous.quantityMenu,excluded=previous.quantityExcluded||[];
 for(const [id,log] of Object.entries(s.logs[key]||{}))if(log.source==='mode')delete s.logs[key][id];
 s.logs[key]??={};let applied=0;
 for(const item of modeItems(menu,mode)){
  if(excluded.includes(item.id)||s.logs[key][item.id]?.quantity)continue;
  const m=item.setting.measurement,u=unitInfo(m);
  s.logs[key][item.id]={name:item.name,setting:structuredClone(item.setting),goalPath:[...item.goalPath],goalIds:[...item.goalIds],recordedAt:new Date().toISOString(),source:'mode',appliedMode:mode,quantity:{amount:m.dailyAmount,measurement:structuredClone(m),base:rounded(m.dailyAmount*u.factor)}};applied++;
 }
 if(!Object.keys(s.logs[key]).length)delete s.logs[key];
 s.records[key]={...previous,mode,quantityMenu:structuredClone(menu),quantityExcluded:[...excluded],quantityAppliedAt:new Date().toISOString()};return applied;
}
export function clearMode(s,key){for(const [id,log] of Object.entries(s.logs[key]||{}))if(log.source==='mode')delete s.logs[key][id];if(s.logs[key]&&!Object.keys(s.logs[key]).length)delete s.logs[key];delete s.records[key]}

// Missing daily records and explicit `none` share one display/statistics category.
export function recordMode(s,key){return s.records[key]?.mode||'none'}
export function modeDistribution(s,start,end,todayKey=dateKey()){const counts={full:0,busy:0,rest:0,none:0};let days=0;const last=end<todayKey?end:todayKey;if(!validDateKey(start)||!validDateKey(last))return {counts,days};for(let key=start;key<=last;key=shiftDate(key,1)){counts[recordMode(s,key)]++;days++}return {counts,days}}

export function isEventTask(action){return Object.hasOwn(action,'eventDate')}
export function validateEventDate(date){
 if(date!==''&&!validDateKey(date))throw Error('イベントの日付を確認してください');
}
export function eventCompletionDate(s,id){
 return Object.keys(s.logs).find(date=>s.logs[date][id]?.eventCompleted);
}
export function recordEventCompletion(s,id,date,todayKey=dateKey()){
 const node=s.nodes.find(n=>n.id===id),action=setting(s,id);
 if(!node||nodeKind(s,id)!=='action'||!isEventTask(action))throw Error('イベントを選んでください');
 if(!validDateKey(date)||date>todayKey)throw Error('今日以前の日付を選んでください');
 if(eventCompletionDate(s,id))return;
 s.logs[date]??={};
 const existing=s.logs[date][id];
 s.logs[date][id]=existing?{...existing,source:'manual',eventCompleted:true}:{
  name:node.name,setting:structuredClone(action),goalPath:ancestry(s,id),
  goalIds:goalIds(s,id),recordedAt:new Date().toISOString(),source:'manual',eventCompleted:true
 };
 s.settings[id]={...action,status:'completed'};
}
export function undoEventCompletion(s,id){
 const date=eventCompletionDate(s,id);
 if(!date)return;
 const log=s.logs[date][id];
 if(log.quantity)delete log.eventCompleted;
 else delete s.logs[date][id];
 if(!Object.keys(s.logs[date]).length)delete s.logs[date];
 const action=setting(s,id);
 if(isEventTask(action))s.settings[id]={...action,status:'active'};
}
