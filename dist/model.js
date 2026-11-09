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
export function validate(s){if(!s||s.version!==1||!Array.isArray(s.nodes)||!s.settings||!s.records||!s.logs||!s.reviews||!Array.isArray(s.pending))throw Error('対応していないデータ形式です');if(s.nodes.length<1||s.nodes.length>1000||s.nodes.filter(n=>n.parentId===null).length!==1||new Set(s.nodes.map(n=>n.id)).size!==s.nodes.length)throw Error('木の構造が正しくありません');for(const n of s.nodes){if(typeof n.id!=='string'||typeof n.name!=='string'||!n.name.trim())throw Error('目標の形式が正しくありません');const seen=new Set([n.id]);let p=n.parentId;while(p!==null){if(seen.has(p))throw Error('木が循環しています');seen.add(p);const parent=s.nodes.find(x=>x.id===p);if(!parent)throw Error('親目標が見つかりません');p=parent.parentId}}const check=a=>{if(!a||![0,1,2].includes(a.priority)||!['continuous','once'].includes(a.type)||!['active','paused','completed'].includes(a.status)||!Array.isArray(a.modes)||a.modes.some(m=>!['full','busy','rest'].includes(m)))throw Error('行動設定が正しくありません');if(a.measurement)validateMeasurement(a.measurement);if(isEventTask(a))validateEventDate(a.eventDate)};Object.values(s.settings).forEach(check);s.pending.forEach(p=>{check(p.setting);if(typeof p.id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.effective))throw Error('予約設定が正しくありません')});for(const [k,r] of Object.entries(s.records)){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!MODES[r.mode])throw Error('記録が正しくありません');if(r.quantityMenu){if(!Array.isArray(r.quantityMenu)||r.quantityMenu.length>1000)throw Error('モードの量の設定が正しくありません');for(const item of r.quantityMenu){if(!item||typeof item.id!=='string'||typeof item.name!=='string'||!Array.isArray(item.goalIds)||!item.goalIds.every(x=>typeof x==='string')||!Array.isArray(item.goalPath)||!item.goalPath.every(x=>typeof x==='string'))throw Error('モードの履歴が正しくありません');check(item.setting)}}if(r.quantityExcluded&&(!Array.isArray(r.quantityExcluded)||!r.quantityExcluded.every(x=>typeof x==='string')))throw Error('記録の調整が正しくありません')}for(const [k,logs] of Object.entries(s.logs)){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!logs||typeof logs!=='object'||Object.values(logs).some(l=>!l||typeof l.name!=='string'))throw Error('実行記録が正しくありません');for(const l of Object.values(logs)){if(l.quantity){validateQuantityValue(l.quantity);validateExtraQuantities(l.quantity.extras)}if(l.eventMinutes!=null)validateDuration(l.eventMinutes);validateExtraQuantities(l.eventQuantities);if(l.goalIds&&(!Array.isArray(l.goalIds)||l.goalIds.some(id=>typeof id!=='string')))throw Error('目標の履歴が正しくありません')}}return s}

export const UNITS={pages:{label:'ページ',dimension:'pages',factor:1},hours:{label:'時間',dimension:'time',factor:60},minutes:{label:'分',dimension:'time',factor:1},count:{label:'回',dimension:'count',factor:1},questions:{label:'問',dimension:'questions',factor:1},words:{label:'単語',dimension:'words',factor:1},items:{label:'個',dimension:'items',factor:1}};
export const rounded=n=>Math.round((n+Number.EPSILON)*1e6)/1e6;
export function measurement(s,id){return setting(s,id).measurement||{unit:'count',weeklyTarget:null}}
export function validateMeasurement(m){if(m?.dailyAmount!=null&&(!Number.isFinite(m.dailyAmount)||m.dailyAmount<.001||m.dailyAmount>1000000))throw Error('タスクの量は0.001以上で入力してください');if(!m||(!Object.hasOwn(UNITS,m.unit)&&m.unit!=='custom'))throw Error('記録する単位を選んでください');if(m.unit==='custom'&&(typeof m.customUnit!=='string'||!m.customUnit.trim()||m.customUnit.trim().length>12))throw Error('単位は1〜12文字で入力してください');for(const [key,label] of [['weeklyTarget','週'],['monthlyTarget','月']]){const target=m[key];if(target!=null&&(!Number.isFinite(target)||target<=0||target>1000000))throw Error(label+'の目標量は0より大きい数にしてください')}if(m.extras!=null){
 if(!Array.isArray(m.extras)||m.extras.length>12)throw Error('追加の単位を確認してください');
 const dimensions=new Set();
 for(const extra of m.extras){
  if(!extra||extra.extras!=null)throw Error('追加の単位を確認してください');
  const {dimension}=unitInfo(extra);
  if(dimension==='time'||dimensions.has(dimension))throw Error('追加の単位は重複しない時間以外の単位を選んでください');
  dimensions.add(dimension);
 }
 }return m}
export function unitInfo(m){validateMeasurement(m);if(Object.hasOwn(UNITS,m.unit))return UNITS[m.unit];const label=m.customUnit.trim(),known=Object.values(UNITS).find(u=>u.label===label);return known||{label,dimension:'custom:'+label,factor:1}}
export function validDateKey(key){if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key))return false;const d=new Date(key+'T12:00:00+09:00');return Number.isFinite(d.getTime())&&dateKey(d)===key}
export function goalIds(s,id){const path=[];let n=s.nodes.find(n=>n.id===id);while(n){path.unshift(n.id);n=s.nodes.find(p=>p.id===n.parentId)}return path}
export function validateDuration(minutes){
 if(!Number.isFinite(minutes)||minutes<.001||minutes>1000000)throw Error('取り組む時間を分で入力してください');
}
export function timeMeasurement(m){
 const unit=unitInfo(m);
 if(unit.dimension!=='time')return {unit:'minutes',dailyAmount:null,weeklyTarget:null,monthlyTarget:null,extras:[m]};
 const convert=amount=>amount==null?null:rounded(amount*unit.factor);
 return {unit:'minutes',dailyAmount:convert(m.dailyAmount),weeklyTarget:convert(m.weeklyTarget),monthlyTarget:convert(m.monthlyTarget),extras:m.extras};
}
export function taskRecordFields(s,key,id){
 const old=s.logs[key]?.[id]?.quantity;
 const preset=timeMeasurement(setting(s,id).measurement||{unit:'minutes'});
 if(!old)return {...preset,extraAmounts:preset.extras?.map(metric=>metric.dailyAmount)};
 const time=timeMeasurement(old.measurement),hasTime=unitInfo(old.measurement).dimension==='time';
 const recorded=hasTime?(old.extras||[]):[old];
 const amounts=new Map(recorded.map(q=>[unitInfo(q.measurement).dimension,q.amount]));
 return {...time,dailyAmount:hasTime?old.base:null,extraAmounts:time.extras?.map(metric=>amounts.get(unitInfo(metric).dimension))};
}
function validateQuantityValue(quantity){
 const unit=unitInfo(quantity.measurement);
 if(!Number.isFinite(quantity.amount)||quantity.amount<=0||quantity.amount>1000000||
    !Number.isFinite(quantity.base)||Math.abs(quantity.base-rounded(quantity.amount*unit.factor))>.000001)throw Error('量の記録が正しくありません');
}
function quantityValue(m,amount){
 if(!Number.isFinite(amount)||amount<.001||amount>1000000)throw Error('取り組んだ量を0より大きい数で入力してください');
 return {amount:rounded(amount),measurement:structuredClone(m),base:rounded(rounded(amount)*unitInfo(m).factor)};
}
function validateExtraQuantities(quantities){
 if(quantities==null)return;
 if(!Array.isArray(quantities)||quantities.length>12)throw Error('追加の量の記録が正しくありません');
 const dimensions=new Set();
 for(const quantity of quantities){
  if(!quantity||quantity.extras!=null)throw Error('追加の量の記録が正しくありません');
  validateQuantityValue(quantity);
  const {dimension}=unitInfo(quantity.measurement);
  if(dimension==='time'||dimensions.has(dimension))throw Error('追加の量の記録が正しくありません');
  dimensions.add(dimension);
 }
}
function extraQuantities(metrics=[],amounts=metrics.map(metric=>metric.dailyAmount)){
 return metrics.flatMap((metric,index)=>amounts[index]==null?[]:[quantityValue(metric,amounts[index])]);
}
function taskQuantity(m,amount,extraAmounts){
 const quantity=quantityValue(m,amount);
 const extras=extraQuantities(m.extras,extraAmounts);
 if(extras.length)quantity.extras=extras;
 return quantity;
}
function writeQuantity(s,key,id,quantity,todayKey){
 if(!validDateKey(key)||key>todayKey)throw Error('今日以前の日付を選んでください');
 const old=s.logs[key]?.[id],node=s.nodes.find(n=>n.id===id),action=setting(s,id);
 if(isEventTask(action)&&!old?.quantity)throw Error('イベントは完了を記録してください');
 if(!node||((node.kind==='goal'||!leaves(s).some(n=>n.id===id))&&!old?.quantity))throw Error('葉っぱの行動を選んでください');
 s.logs[key]??={};
 s.logs[key][id]={
  name:old?.name||node.name,setting:old?.setting||structuredClone(action),
  goalPath:old?.goalPath||ancestry(s,id),goalIds:old?.goalIds||goalIds(s,id),
  recordedAt:old?.recordedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),source:'manual',
  ...(old?.eventCompleted?{eventCompleted:true,eventMinutes:old.eventMinutes,eventQuantities:old.eventQuantities}:{}),quantity
 };
 if(s.records[key]?.quantityExcluded)s.records[key].quantityExcluded=s.records[key].quantityExcluded.filter(x=>x!==id);
 if(action.type==='once'&&!isEventTask(action))s.settings[id]={...action,status:'completed'};
 return s.logs[key][id];
}
export function setQuantity(s,key,id,amount,todayKey=dateKey()){
 const old=s.logs[key]?.[id]?.quantity,quantity=quantityValue(old?.measurement||measurement(s,id),amount);
 if(old?.extras)quantity.extras=structuredClone(old.extras);
 return writeQuantity(s,key,id,quantity,todayKey);
}
export function setTaskRecord(s,key,id,minutes,extraAmounts,todayKey=dateKey()){
 validateDuration(minutes);
 const m=taskRecordFields(s,key,id);
 delete m.extraAmounts;
 delete m.dailyAmount;
 return writeQuantity(s,key,id,taskQuantity(m,minutes,extraAmounts||[]),todayKey);
}
export function removeQuantity(s,key,id){if(s.records[key]?.quantityMenu){s.records[key].quantityExcluded=[...new Set([...(s.records[key].quantityExcluded||[]),id])]}if(s.logs[key]){const log=s.logs[key][id];if(log?.eventCompleted)delete log.quantity;else delete s.logs[key][id];if(!Object.keys(s.logs[key]).length)delete s.logs[key]}}
export function quantitySummary(s,start,end,scope='all',includeConfigured=true,period='week'){
 const targetKey=period==='month'?'monthlyTarget':'weeklyTarget';
 const currentIds=scope==='all'?null:descendants(s,scope),rows=new Map(),groups=new Map(),entries=[];
 let unknown=0;
 const inScope=(id,log)=>scope==='all'||(Array.isArray(log.goalIds)?log.goalIds.includes(scope):currentIds.has(id));
 function rowFor(id,name,unit){
  const key=id+'\u0000'+unit.dimension;
  if(!rows.has(key))rows.set(key,{key,id,name,dimension:unit.dimension,unit:unit.dimension==='time'?'時間':unit.label,amount:0,target:null,byDate:{},deleted:!s.nodes.some(n=>n.id===id)});
  return rows.get(key);
 }
 function setTarget(row,m,unit){
  row.target=m[targetKey]==null?null:rounded(m[targetKey]*unit.factor/(unit.dimension==='time'?60:1));
  row.hasTarget=m.weeklyTarget!=null||m.monthlyTarget!=null;
 }
 for(const [date,logs] of Object.entries(s.logs).sort(([a],[b])=>a.localeCompare(b))){
  if(date<start||date>end)continue;
  for(const [id,log] of Object.entries(logs)){
   if(!inScope(id,log))continue;
   if(log.eventCompleted){
    if(log.eventMinutes)addToGroup('time','時間',{[date]:rounded(log.eventMinutes/60)});
    for(const q of log.eventQuantities||[]){
     const unit=unitInfo(q.measurement);
     addToGroup(unit.dimension,unit.label,{[date]:q.base});
    }
   }
   if(!log.quantity){if(!log.eventCompleted)unknown++;continue}
   for(const q of [log.quantity,...(log.quantity.extras||[])]){
    const unit=unitInfo(q.measurement),value=rounded(q.base/(unit.dimension==='time'?60:1));
    const row=rowFor(id,log.name,unit);
    row.amount=rounded(row.amount+value);
    row.byDate[date]=rounded((row.byDate[date]||0)+value);
    setTarget(row,q.measurement,unit);
    entries.push({date,id,name:log.name,amount:q.amount,unit:unit.label,value,dimension:unit.dimension,
     source:log.source||'manual',goalIds:log.goalIds||goalIds(s,id),goalPath:log.goalPath||ancestry(s,id)});
   }
  }
 }
 if(includeConfigured)for(const node of leaves(s)){
  const action=setting(s,node.id);
  if(node.kind==='goal'||(currentIds&&!currentIds.has(node.id))||!action.measurement||isEventTask(action))continue;
  for(const m of [action.measurement,...(action.measurement.extras||[])]){
   const unit=unitInfo(m),row=rowFor(node.id,node.name,unit);
   row.name=node.name;
   setTarget(row,m,unit);
  }
 }
 function addToGroup(dimension,unit,byDate){
  if(!groups.has(dimension))groups.set(dimension,{dimension,unit,total:0,byDate:{}});
  const group=groups.get(dimension);
  for(const [date,value] of Object.entries(byDate)){
   group.total=rounded(group.total+value);
   group.byDate[date]=rounded((group.byDate[date]||0)+value);
  }
 }
 for(const row of rows.values())addToGroup(row.dimension,row.unit,row.byDate);
 return {groups:[...groups.values()],rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja')),entries,unknown};
}

export function fixedMenu(s){return leaves(s).filter(n=>n.kind!=='goal').map(n=>({id:n.id,name:n.name,goalPath:ancestry(s,n.id),goalIds:goalIds(s,n.id),setting:structuredClone(setting(s,n.id))}))}
export function modeItems(menu,mode){return menu.filter(item=>{const a=item.setting,m=a.measurement;return !isEventTask(a)&&a.status==='active'&&includesMode(a,mode)&&m&&Number.isFinite(m.dailyAmount)&&m.dailyAmount>=.001})}
export function modeTotals(s,mode){
 const items=modeItems(fixedMenu(s),mode),groups=new Map();
 for(const item of items){
  const m=item.setting.measurement;
  for(const metric of [m,...(m.extras||[])].filter(metric=>metric.dailyAmount!=null)){
   const unit=unitInfo(metric),time=unit.dimension==='time';
   if(!groups.has(unit.dimension))groups.set(unit.dimension,{dimension:unit.dimension,unit:time?'時間':unit.label,total:0});
   const group=groups.get(unit.dimension);
   group.total=rounded(group.total+metric.dailyAmount*unit.factor/(time?60:1));
  }
 }
 return {count:items.length,groups:[...groups.values()]};
}
export function applyMode(s,key,mode,todayKey=dateKey()){
 if(!validDateKey(key)||key>todayKey||!Object.hasOwn(MODES,mode))throw Error('モードと今日以前の日付を選んでください');
 const previous=s.records[key]||{},menu=key===todayKey||!previous.quantityMenu?fixedMenu(s):previous.quantityMenu,excluded=previous.quantityExcluded||[];
 for(const [id,log] of Object.entries(s.logs[key]||{}))if(log.source==='mode')delete s.logs[key][id];
 s.logs[key]??={};let applied=0;
 for(const item of modeItems(menu,mode)){
  if(excluded.includes(item.id)||s.logs[key][item.id]?.quantity)continue;
  const m=item.setting.measurement;
  s.logs[key][item.id]={name:item.name,setting:structuredClone(item.setting),goalPath:[...item.goalPath],goalIds:[...item.goalIds],recordedAt:new Date().toISOString(),source:'mode',appliedMode:mode,quantity:taskQuantity(m,m.dailyAmount)};applied++;
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
export function recordEventCompletion(s,id,date,todayKey=dateKey(),minutes=timeMeasurement(measurement(s,id)).dailyAmount,extraAmounts){
 const node=s.nodes.find(n=>n.id===id),action=setting(s,id);
 if(!node||nodeKind(s,id)!=='action'||!isEventTask(action))throw Error('イベントを選んでください');
 if(!validDateKey(date)||date>todayKey)throw Error('今日以前の日付を選んでください');
 if(eventCompletionDate(s,id))return;
 validateDuration(minutes);
 const eventQuantities=extraQuantities(action.measurement?.extras,extraAmounts);
 const completion={eventCompleted:true,eventMinutes:rounded(minutes),eventQuantities};
 s.logs[date]??={};
 const existing=s.logs[date][id];
 s.logs[date][id]=existing?{...existing,source:'manual',...completion}:{
  name:node.name,setting:structuredClone(action),goalPath:ancestry(s,id),
  goalIds:goalIds(s,id),recordedAt:new Date().toISOString(),source:'manual',...completion
 };
 s.settings[id]={...action,status:'completed'};
}
export function undoEventCompletion(s,id){
 const date=eventCompletionDate(s,id);
 if(!date)return;
 const log=s.logs[date][id];
 if(log.quantity){delete log.eventCompleted;delete log.eventMinutes;delete log.eventQuantities}
 else delete s.logs[date][id];
 if(!Object.keys(s.logs[date]).length)delete s.logs[date];
 const action=setting(s,id);
 if(isEventTask(action))s.settings[id]={...action,status:'active'};
}
