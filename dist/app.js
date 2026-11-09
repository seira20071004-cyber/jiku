import {mountOnboarding,onboardingDraft} from './onboarding.js';
import {createDemoUniverse} from './demo.js';
import {taskSettingsFields,extraMetricFields,eventPanel,presetPanel,modePickerContent,recordPanel,weeklyPanel,numberText,hoursText} from './quantity-view.js';
import {createUniverse} from './universe.js';
import {UNIVERSE_ORIGIN,LEVELS,nodePath,nodeDepth,visibleChildren,canPlace,freshUniverse,migrateUniverse,completeUniverse,reorderNode,shouldPromptDailyMode,writeGoal,statisticsGoals,statisticsScope,boundedMonth} from './universe-model.js';
import {MODES,dateKey,shiftDate,weekStart,seed,leaves,descendants,moveNode,deleteNode,setting,applyPending,plan,toggleLog,ancestry,stats,validate,measurement,unitInfo,setTaskRecord,removeQuantity,quantitySummary,validDateKey,applyMode,clearMode,modesForLevel,nodeKind,recordMode,modeDistribution,isEventTask,eventCompletionDate,recordEventCompletion,undoEventCompletion} from './model.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let account=null;
try{const response=await fetch('/api/session',{cache:'no-store'});if(response.headers.get('content-type')?.includes('application/json')){const result=await response.json();if(result.mode==='google'){if(!response.ok||!result.user?.id){location.replace('/');throw Error('Authentication required')}account=result.user}}}catch(error){if(error.message==='Authentication required')throw error}
const demoMode=new URLSearchParams(location.search).get('demo')==='1';
const personalStorageKey=account?'jiku-v1:'+account.id:'jiku-v1';
const storageKey=demoMode?personalStorageKey+':demo-v2':personalStorageKey;
let needsLegacyImport=false,storageLocked=false;let state;try{const raw=localStorage.getItem(storageKey);needsLegacyImport=!demoMode&&!!account&&!raw&&!!localStorage.getItem('jiku-v1');state=raw?validate(JSON.parse(raw)):(demoMode?createDemoUniverse(dateKey()):freshUniverse());if(raw&&!state.universe){localStorage.setItem(storageKey+':before-universe',raw);state=migrateUniverse(state)}}catch{storageLocked=true;state=state||freshUniverse();setTimeout(()=>toast('保存データを保護しています。設定からバックアップを確認してください。'),300)}
let treeScene=null,treeView=null,showGoalLabels=true,statsTab='quantity',quantityScope='all',statsWeek=weekStart(dateKey()),statsMonth=dateKey().slice(0,7),quantityDimension=null;
let view='tree',today=dateKey(),selected=today,month=today.slice(0,7),focus=null,zoom=1,pan={x:0,y:0};
function save(){if(storageLocked){toast('元の保存データを保護しています。バックアップを確認してください。');return false}try{localStorage.setItem(storageKey,JSON.stringify(state));return true}catch{toast('保存できませんでした。設定からバックアップを保存してください。');return false}}
applyPending(state,today);if(state.universe?.onboarded)save();
const icon=(name)=>({home:'⌂',tree:'✧',calendar:'▦',stats:'◴',settings:'⚙'}[name]);
const names={tree:'自分の宇宙',stats:'統計'};
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
function modal(html){const d=$('#dialog');d.innerHTML=html;d.showModal();d.querySelector('[autofocus]')?.focus()}
function close(){$('#dialog').close()}
function heading(k,title,sub,extra=''){return `<div class="page-heading"><div><div class="eyebrow">${k}</div><h1>${title}</h1><p>${sub}</p></div>${extra}</div>`}
function accountAvatar(){const picture=account?.picture;return `<span class="google-account-fallback" aria-hidden="true">G</span>${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer" data-account-photo>`:''}`}
function render(){const birthActive=onboardingScene||onboardingPreview||!storageLocked&&!state.universe?.onboarded;
 document.body.classList.toggle('birth-active',Boolean(birthActive));
 if(birthActive){if(treeScene){treeScene.dispose();treeScene=null}if(!onboardingScene)showOnboarding();return}
 if(treeScene){treeView=treeScene.getView();treeScene.dispose();treeScene=null}const latest=dateKey();if(today!==latest){if(statsMonth===today.slice(0,7))statsMonth=latest.slice(0,7);if(statsWeek===weekStart(today))statsWeek=weekStart(latest);today=latest;selected=today;applyPending(state,today);save()}$('#app').innerHTML=`<main class="workspace view-${view}"><header class="topbar"><a class="brand" href="#tree" aria-label="jiku 自分の宇宙">jiku<span>●</span></a>${demoMode?'<div class="demo-toolbar"><span>検証用</span><button data-do="test-demo-mode">モードを試す</button><button data-do="exit-demo">戻る ↗</button></div>':''}<button class="avatar" data-do="settings" aria-label="Googleアカウントと設定" title="Googleアカウントと設定">${accountAvatar()}</button></header><div class="content">${({tree:treePage,stats:statsPage}[view])()}</div></main><nav class="bottom-nav" aria-label="メインメニュー">${Object.entries(names).map(([k,v])=>`<button class="nav ${view===k?'active':''}" data-view="${k}" ${view===k?'aria-current="page"':''}><span aria-hidden="true">${icon(k)}</span><strong>${v}</strong></button>`).join('')}</nav>`;bindTree()}
function modeCards(key){const current=state.records[key]?.mode;return `<div class="mode-grid">${Object.entries(MODES).filter(([k])=>k!=='none').map(([k,m])=>`<button class="mode-card ${current===k?'selected':''} ${k}" data-mode="${k}" data-date="${key}"><span class="mode-icon">${m.icon}</span><span><strong>${m.label}</strong><small>${m.description}</small></span><span class="radio">${current===k?'✓':''}</span></button>`).join('')}</div>`}
function actionRow(n,key){const a=setting(state,n.id),done=!!state.logs[key]?.[n.id];return `<div class="action-row ${done?'done':''}"><button class="check ${done?'checked':''}" data-check="${esc(n.id)}" data-date="${key}" aria-label="${esc(n.name)}の実行記録" aria-pressed="${done}">${done?'✓':''}</button><div class="action-copy"><strong>${esc(n.name)}</strong><small>${esc(ancestry(state,n.id).slice(1,-1).join(' / ')||'自分の宇宙')}</small></div><span class="priority p${a.priority}">${['高','中','低'][a.priority]}</span><button class="edit-action" data-edit="${esc(n.id)}" aria-label="${esc(n.name)}を編集">⋯</button></div>`}
let universeOutside=true,navigating=false,onboardingScene=null;
let onboardingPreview=new URLSearchParams(location.search).get('preview')==='welcome';
const onboardingKey=storageKey+':onboarding-draft';
function currentSpace(){return state.nodes.find(n=>n.id===focus)||state.nodes.find(n=>n.parentId===null)}
function spaceTrail(){
 const path=nodePath(state,currentSpace().id);
 return path.map((node,depth)=>{
  const level=LEVELS[Math.min(depth,4)],current=depth===path.length-1;
  return `<button data-space-enter="${esc(node.id)}" title="${esc(node.name)}" aria-label="${level}：${esc(node.name)}" ${current?'aria-current="location"':''}>${level}</button>`;
 }).join('<span aria-hidden="true">›</span>');
}
function showUniverseOrigin(){return universeOutside&&!onboardingPreview&&state.universe?.onboarded}
function spaceHUD(){if(showUniverseOrigin())return '<p class="universe-origin-caption" aria-hidden="true">タップして、宇宙の中へ</p>';const n=currentSpace(),depth=nodeDepth(state,n.id),children=visibleChildren(state,n.id);return `<div class="universe-topline"><nav class="space-breadcrumb" aria-label="現在地">${spaceTrail()}</nav><button class="space-map-trigger" data-do="space-map"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M8 5v3m-5 3V8h10v3"/><circle cx="8" cy="3.5" r="1.5"/><circle cx="3" cy="12.5" r="1.5"/><circle cx="13" cy="12.5" r="1.5"/></svg> 地図</button></div><div class="space-heading"><h1><button class="space-edit-title" data-edit-title="${esc(n.id)}" title="ダブルタップで編集" aria-label="${esc(n.name)}。ダブルタップで編集">${esc(n.name)}</button></h1></div><div class="space-primary-tools">${n.parentId?`<button data-space-enter="${esc(n.parentId)}" class="space-back">← <span>ひとつ上へ</span></button>`:`<button data-space-enter="${UNIVERSE_ORIGIN}" class="space-back">← <span>宇宙の外へ</span></button>`}${depth<4&&nodeKind(state,n.id)==='goal'?`<button class="space-add" data-space-add="${esc(n.id)}">＋ ${LEVELS[depth+1]}を追加</button>`:''}</div>${!children.length&&n.parentId?`<div class="space-empty"><button class="space-detail-button" data-space-detail="${esc(n.id)}">この目標・タスクの詳細 ↗</button></div>`:''}${depth>=4&&children.length?`<div class="space-legacy"><p>以前の5階層を超える目標は、元の構造とIDのまま保護しています。</p>${children.map(c=>`<button data-legacy-detail="${esc(c.id)}">${esc(c.name)} →</button>`).join('')}</div>`:''}`}
function treePage(){return `<section class="universe-scene full-panel ${showUniverseOrigin()?'at-origin':''}" id="goal-tree" aria-label="自分の宇宙"><div class="universe-stage"></div><div class="space-travel-veil"></div><div class="universe-hud">${spaceHUD()}</div></section>`}
async function enterSpace(id){
 if(navigating)return;
 const toOrigin=id===UNIVERSE_ORIGIN,fromOrigin=showUniverseOrigin();
 if(toOrigin&&fromOrigin)return;
 const target=toOrigin?state.nodes.find(n=>!n.parentId):state.nodes.find(n=>n.id===id);
 if(!target)return;
 const depth=nodeDepth(state,target.id),old=currentSpace();
 if(depth>4){legacyDetail(id);return}
 if(!fromOrigin&&!toOrigin&&old.id===id){treeScene?.reset();return}
 const direction=toOrigin?-1:fromOrigin||depth>nodeDepth(state,old.id)?1:-1;
 navigating=true;
 try{
  if(treeScene&&!await treeScene.navigate(id,direction))return;
  universeOutside=toOrigin;focus=target.id;
  $('#goal-tree')?.classList.toggle('at-origin',toOrigin);
  const hud=$('.universe-hud');
  if(hud){hud.innerHTML=spaceHUD();const trail=hud.querySelector('.space-breadcrumb');if(trail)trail.scrollLeft=trail.scrollWidth;}
  if(!treeScene)render();
  if(depth===4||(nodeKind(state,id)==='action'&&isEventTask(setting(state,id))))spaceDetail(id);
  else if(fromOrigin)promptDailyMode();
 }finally{navigating=false}
}
function spaceDetail(id){const n=state.nodes.find(n=>n.id===id);if(!n)return;if(nodeKind(state,id)==='action'&&isEventTask(setting(state,id))){modal(eventPanel(state,id,today,today));return}const hasChildren=visibleChildren(state,id).length>0,a=setting(state,id),m=measurement(state,id),level=a.modes.includes('rest')?'rest':a.modes.includes('busy')?'busy':'full';modal(`<div class="dialog-title"><div><div class="eyebrow">${esc(ancestry(state,id).slice(0,-1).join(' / '))}</div><h2>${esc(n.name)}</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${n.description?`<p class="space-description">${esc(n.description)}</p>`:''}${!hasChildren&&nodeKind(state,id)==='action'?`<div class="space-action-metadata"><span>${MODES[level].icon} ${MODES[level].label}から</span>${m.dailyAmount?`<span>固定量 ${numberText(m.dailyAmount)}${esc(unitInfo(m).label)}</span>`:''}</div>`:''}<div class="space-detail-links"><button data-edit="${esc(id)}">目標を編集 <span>→</span></button>${!hasChildren&&nodeKind(state,id)==='action'?`<button data-open-preset="${esc(id)}">固定量・モードを設定 <span>→</span></button>`:''}<button data-space-stats="${esc(id)}">この目標の統計 <span>→</span></button>${!hasChildren&&nodeKind(state,id)==='action'?`<button data-record-leaf="${esc(id)}">今日の記録を調整 <span>→</span></button>`:''}</div>`)}
function legacyDetail(id){const n=state.nodes.find(n=>n.id===id);if(!n)return;const hasChildren=visibleChildren(state,id).length>0,a=setting(state,id),m=measurement(state,id),level=a.modes.includes('rest')?'rest':a.modes.includes('busy')?'busy':'full';modal(`<div class="dialog-title"><h2>${esc(n.name)}</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><p class="footnote">以前の階層です。履歴と親子関係は保持しています。新しい目標は5階層以内に作成できます。</p>${!hasChildren&&nodeKind(state,id)==='action'?`<div class="space-action-metadata"><span>${MODES[level].icon} ${MODES[level].label}から</span>${m.dailyAmount?`<span>固定量 ${numberText(m.dailyAmount)}${esc(unitInfo(m).label)}</span>`:''}</div>`:''}<div class="space-detail-links"><button data-edit="${esc(id)}">目標を編集 →</button>${!visibleChildren(state,id).length?`<button data-open-preset="${esc(id)}">タスク設定 →</button>`:''}${visibleChildren(state,id).map(c=>`<button data-legacy-detail="${esc(c.id)}">${esc(c.name)} →</button>`).join('')}</div>`)}
function spaceList(){modal(`<div class="dialog-title"><h2>この場所の目標</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="space-detail-links">${visibleChildren(state,currentSpace().id).map(n=>`<div class="space-list-row"><button data-space-go="${esc(n.id)}">${esc(n.name)} <span>↗</span></button><button data-space-reorder="${esc(n.id)}" data-direction="-1" aria-label="${esc(n.name)}を前へ">↑</button><button data-space-reorder="${esc(n.id)}" data-direction="1" aria-label="${esc(n.name)}を後へ">↓</button><button data-edit="${esc(n.id)}" aria-label="${esc(n.name)}を編集">···</button></div>`).join('')||'<p class="muted">まだ下位目標はありません。</p>'}</div>`)}
function showOnboarding(){
 const preview=onboardingPreview;
 let saved;
 try{if(!preview)saved=JSON.parse(localStorage.getItem(onboardingKey))}catch{}
 onboardingScene=mountOnboarding($('#app'),{
  welcome:preview,preview,initial:onboardingDraft(saved,preview?null:state.universe),
  onDraft:preview?null:draft=>{try{localStorage.setItem(onboardingKey,JSON.stringify(draft))}catch{}},
  onBirth:preview?name=>name:commitUniverseBirth,
  onExplore:()=>{
   if(preview){endOnboardingPreview();return}
   onboardingScene?.dispose();onboardingScene=null;
   view='tree';focus=null;universeOutside=false;
   history.replaceState(null,'','#tree');
   render();promptDailyMode();
  },
  onClose:preview?endOnboardingPreview:null,
  onSettings:preview?null:settings
 });
}
function commitUniverseBirth(name){
 const commit=()=>{
  const raw=localStorage.getItem(storageKey);
  const latest=raw?migrateUniverse(validate(JSON.parse(raw))):structuredClone(state);
  if(!latest.universe.onboarded){
   completeUniverse(latest,name);
   localStorage.setItem(storageKey,JSON.stringify(latest));
  }
  state=latest;
  try{localStorage.removeItem(onboardingKey)}catch{}
  return latest.nodes.find(node=>node.parentId===null).name;
 };
 return navigator.locks?.request?navigator.locks.request(onboardingKey,commit):commit();
}
function previewOnboarding(){
 close();onboardingScene?.dispose();onboardingScene=null;onboardingPreview=true;view='tree';
 const url=new URL(location.href);url.searchParams.set('preview','welcome');url.hash='tree';
 history.replaceState(null,'',url);render();
}
function endOnboardingPreview(){
 onboardingScene?.dispose();onboardingScene=null;onboardingPreview=false;
 const url=new URL(location.href);url.searchParams.delete('preview');history.replaceState(null,'',url);
 render();
}
function promptDailyMode(){if(view==='tree'&&showUniverseOrigin())return;if(!onboardingScene&&shouldPromptDailyMode(state,today)){state.universe.lastModePrompt=today;save();modePicker()}}
function calendarPage(){if(month>today.slice(0,7))month=today.slice(0,7);const [y,m]=month.split('-').map(Number),first=`${month}-01`,offset=(new Date(first+'T12:00:00+09:00').getUTCDay()+6)%7,num=new Date(Date.UTC(y,m,0)).getUTCDate(),weeks=Math.ceil((num+offset)/7);return `<section class="calendar-card cosmic-calendar" aria-label="活動カレンダー"><div class="month-heading"><div><span class="calendar-year">${y}</span><h1>${m}<small>月</small></h1></div><div><button class="round-button" data-month="-1" aria-label="前の月">‹</button><button class="text-button" data-do="today">今月に戻る</button></div></div><div class="calendar-grid" style="--weeks:${weeks}">${['月','火','水','木','金','土','日'].map(d=>`<span class="day-label">${d}</span>`).join('')}${'<div class="calendar-blank"></div>'.repeat(offset)}${Array.from({length:num},(_,i)=>{const k=`${month}-${String(i+1).padStart(2,'0')}`,mode=recordMode(state,k),activity=Object.values(state.logs[k]||{}).some(l=>l.quantity||l.eventCompleted),event=scheduledEvents(k).length>0;return `<button class="day-cell mode-${mode} ${selected===k?'selected':''} ${k===today?'today':''}" data-select-date="${k}" aria-label="${m}月${i+1}日 ${k>today?'これからの日':MODES[mode].label}${activity?'・タスクの記録あり':''}${event?'・イベントの予定あり':''}" ${k>today&&!event?'disabled':''}><span>${i+1}</span>${k<=today?`<i>${MODES[mode].icon}</i>`:''}${activity?'<b class="quantity-calendar-dot"></b>':''}${event?'<b class="event-calendar-dot"></b>':''}</button>`}).join('')}</div><div class="calendar-mode-legend">${['none','rest','busy','full'].map(k=>`<span class="mode-${k}"><i></i>${MODES[k].label}</span>`).join('')}</div><button class="text-button calendar-rhythm-link" data-do="show-rhythm">モードの割合を見る ↗</button></section>`}
function scheduledEvents(date){
 return state.nodes.filter(n=>setting(state,n.id).eventDate===date&&nodeKind(state,n.id)==='action'&&!eventCompletionDate(state,n.id));
}
function dayEditor(key){selected=key;const summary=quantitySummary(state,key,key,statsTab==='calendar'?'all':quantityScope,false);const scheduled=scheduledEvents(key),completed=Object.entries(state.logs[key]||{}).filter(([,log])=>log.eventCompleted);
 const tasks=new Map();
 for(const entry of summary.entries){
  if(!tasks.has(entry.id))tasks.set(entry.id,[]);
  tasks.get(entry.id).push(entry);
 }
 const events=scheduled.length||completed.length?`<section class="day-events"><h3>イベント</h3>
 ${scheduled.map(n=>`<button class="text-button" data-space-detail="${esc(n.id)}">${esc(n.name)} · 予定 →</button>`).join('')}
 ${completed.map(([id,log])=>isEventTask(setting(state,id))&&nodeKind(state,id)==='action'
  ?`<button class="text-button" data-space-detail="${esc(id)}">${esc(log.name)} · 完了 →</button>`
  :`<p>${esc(log.name)} · 完了</p>`).join('')}</section>`:'';
 modal(`<div class="dialog-title"><h2>${Number(key.slice(5,7))}月${Number(key.slice(8))}日</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${events}${key>today?'':`<section class="day-quantity"><div class="section-title"><h3>取り組んだ量</h3><button class="text-button" data-pick-leaf="${key}">＋ 記録する</button></div>${[...tasks.values()].map(metrics=>{
  const task=metrics[0],values=[...metrics].sort((a,b)=>Number(b.dimension==='time')-Number(a.dimension==='time'));
  return `<div class="day-quantity-row"><span>${esc(task.name)}</span><strong>${values.map(metric=>metric.dimension==='time'?hoursText(metric.value):numberText(metric.amount)+esc(metric.unit)).join(' · ')}</strong>${state.nodes.some(n=>n.id===task.id)?`<button class="text-button" data-record-leaf="${esc(task.id)}" data-log-date="${key}">編集</button>`:''}</div>`;
 }).join('')||'<p class="muted">量の記録はありません。</p>'}</section><details class="daily-mode-details"><summary>この日のモード</summary><div class="day-modes">${Object.entries(MODES).map(([k,m])=>`<button class="${recordMode(state,key)===k?'chosen':''}" data-mode="${k}" data-date="${key}"><span style="color:${m.color}">${m.icon}</span>${m.label}<i>${recordMode(state,key)===k?'✓':''}</i></button>`).join('')}</div></details>`}`)}
function rhythmPage(){const start=shiftDate(today,-29),s=modeDistribution(state,start,today,today),counts=s.counts;return `<section class="rhythm-panel full-panel" aria-label="日々のモードの割合"><h1>日々のモードの割合</h1><div class="distribution" role="img" aria-label="過去${s.days}日間のモードの割合">${s.days?Object.entries(counts).map(([k,c])=>`<div style="width:${c/s.days*100}%;background:${MODES[k].color}" title="${MODES[k].label}: ${c}日"></div>`).join(''):'<div style="width:100%;background:#eeede6"></div>'}</div><div class="rhythm-rows">${Object.entries(counts).map(([k,c])=>`<div class="distribution-row"><i style="background:${MODES[k].color}"></i><span>${MODES[k].label}</span><strong>${c}<small>日</small></strong><em>${s.days?Math.round(c/s.days*100):0}%</em></div>`).join('')}</div><p class="footnote">過去${s.days}日間。記録がない日は「何もしなかった日」に含めます。</p></section>`}
function statsPage(){quantityScope=statisticsScope(state,quantityScope);return `<section class="statistics-workspace weekly-workspace"><div class="statistics-toolbar"><div class="statistics-tabs" role="tablist" aria-label="統計の表示"><button role="tab" aria-selected="${statsTab==='quantity'}" data-stat-tab="quantity">週の記録</button><button role="tab" aria-selected="${statsTab==='monthly'}" data-stat-tab="monthly">月の記録</button><button role="tab" aria-selected="${statsTab==='calendar'}" data-stat-tab="calendar">カレンダー</button></div></div><div class="statistics-content ${statsTab==='calendar'?'calendar-content':'quantity-content'}">${statsTab==='calendar'?calendarPage():weeklyPanel(state,{week:statsWeek,scope:quantityScope,today,month:statsTab==='monthly'?statsMonth:undefined})}</div></section>`}
function showHierarchy(forStatistics){
 const root=state.nodes.find(n=>n.parentId===null);
 const activeId=forStatistics?(quantityScope==='all'?root.id:quantityScope):currentSpace().id;
 const activePath=new Set(nodePath(state,activeId).map(n=>n.id));
 const visible=forStatistics?[root,...statisticsGoals(state)]:state.nodes;
 const byId=new Map(state.nodes.map(n=>[n.id,n])),visibleIds=new Set(visible.map(n=>n.id));
 const children=new Map();
 for(const node of visible){
  let parent=node.parentId;
  while(parent&&!visibleIds.has(parent))parent=byId.get(parent)?.parentId;
  if(!parent)continue;
  if(!children.has(parent))children.set(parent,[]);
  children.get(parent).push(node);
 }
 for(const siblings of children.values())siblings.sort((a,b)=>(a.order||0)-(b.order||0));
 const marks=['◎','◉','✦','●','◌'];
 function branch(node,depth){
  const level=Math.min(depth,LEVELS.length-1),nested=children.get(node.id)||[];
  const expanded=depth===0||activePath.has(node.id),current=node.id===activeId;
  const action=forStatistics?'data-stats-goal':'data-space-go';
  const value=forStatistics&&depth===0?'all':node.id;
  const name=node.name;
  const task=nodeKind(state,node.id)==='action';
  return `<li class="hierarchy-branch">
   <div class="hierarchy-row ${current?'is-current':''}" data-level="${level}">
    <button class="hierarchy-pick" ${action}="${esc(value)}" ${current?'aria-current="true"':''}>
     <span class="hierarchy-mark" aria-hidden="true">${marks[level]}</span>
     <span class="hierarchy-level">${LEVELS[level]}</span>
     <span class="hierarchy-name">${esc(name)}${task?`<small>${isEventTask(setting(state,node.id))?'イベント':'タスク'}</small>`:''}</span>
     ${current?'<span class="hierarchy-current" aria-hidden="true">✓</span>':''}
    </button>
    ${nested.length?`<button class="hierarchy-expand" data-map-expand aria-expanded="${expanded}" aria-label="${esc(name)}の下位目標を表示"><span aria-hidden="true">${expanded?'⌄':'›'}</span><small aria-hidden="true">${nested.length}</small></button>`:''}
   </div>
   ${nested.length?`<ul class="hierarchy-children" ${expanded?'':'hidden'}>${nested.map(child=>branch(child,depth+1)).join('')}</ul>`:''}
  </li>`;
 }
 modal(`<div class="dialog-title"><h2>${forStatistics?'表示する目標':'宇宙の地図'}</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <p class="hierarchy-hint">${forStatistics?'右の矢印で枝を開き、集計する目標を選びます。':'右の矢印で枝を開き、行きたい天体を選びます。'}</p>
  <div class="hierarchy-legend" aria-label="宇宙の階層">${LEVELS.map((level,index)=>`<span data-level="${index}"><i aria-hidden="true">${marks[index]}</i>${level}</span>`).join('<b aria-hidden="true">›</b>')}</div>
  <ul class="hierarchy-tree" aria-label="${forStatistics?'目標の階層図':'宇宙の階層図'}">${branch(root,0)}</ul>`);
 if(activeId!==root.id)$('#dialog .hierarchy-pick[aria-current]')?.scrollIntoView({block:'nearest'});
}

function leafPanel(id,key=today){
 if(!state.nodes.some(n=>n.id===id))return;
 const useEvent=isEventTask(setting(state,id))&&!state.logs[key]?.[id]?.quantity;
 modal(useEvent?eventPanel(state,id,key,today):recordPanel(state,id,key,today));
}
function openNode(id){enterSpace(id)}
function openPreset(id){if(nodeKind(state,id)!=='action'||!state.nodes.find(n=>n.id===id)?.description?.trim()){editor(id);return}modal(presetPanel(state,id))}
function modePicker(){modal(modePickerContent(state,today))}
function readExtraSettings(form){
 const event=form.elements.namedItem('task-format')?.value==='event';
 return [...form.querySelectorAll('[data-extra-metric]')].map(card=>{
  const value=name=>card.querySelector(`[name="${name}"]`).value;
  const amount=name=>value(name)?Number(value(name)):null;
  return {
   unit:value('extra-unit'),customUnit:value('extra-custom-unit').trim(),
   dailyAmount:amount('extra-daily'),
   weeklyTarget:event?null:amount('extra-weekly'),
   monthlyTarget:event?null:amount('extra-monthly')
  };
 });
}
function readTaskSettings(form){
 const data=new FormData(form),event=data.get('task-format')==='event';
 const amount=name=>data.get(name)?Number(data.get(name)):null;
 const measurement={
  unit:'minutes',dailyAmount:amount(event?'event-minutes':'daily-minutes'),
  weeklyTarget:amount('weekly-minutes'),monthlyTarget:amount('monthly-minutes'),
  extras:readExtraSettings(form)
 };
 return event?{eventDate:String(data.get('event-date')||''),measurement}:{measurement,mode:data.get('task-level')};
}
function syncTaskFormat(form){
 const event=form.elements.namedItem('task-format')?.value==='event';
 for(const fields of form.querySelectorAll('[data-routine-fields],[data-event-fields],[data-extra-targets]')){
  const hidden=fields.hasAttribute('data-event-fields')?!event:event;
  fields.hidden=fields.disabled=hidden;
 }
}
function readExtraAmounts(data){
 return data.getAll('record-extra').map(value=>value===''?null:Number(value));
}
function refreshTodayMode(){if(state.records[today]?.mode)applyMode(state,today,state.records[today].mode,today)}
function chooseLeaf(key){const available=leaves(state).filter(n=>nodeKind(state,n.id)==='action'&&!isEventTask(setting(state,n.id))).filter(n=>quantityScope==='all'||descendants(state,quantityScope).has(n.id));modal(`<div class="dialog-title"><h2>タスクを選ぶ</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="record-leaf-picker">${available.map(n=>`<button data-record-leaf="${esc(n.id)}" data-log-date="${key}"><span>♧</span>${esc(n.name)}<i>＋</i></button>`).join('')||'<p class="muted">この目標にはタスクがありません。</p>'}</div>`)}
let addParent=null,creationDraft=null;
function chooseCreationType(parent){addParent=parent;const depth=nodeDepth(state,parent)+1;if(depth>4){toast('目標は宇宙から衛星までの5階層です');return}const label=LEVELS[depth];modal(`<div class="dialog-title"><h2>${label}を追加</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="creation-type-options"><button data-create-kind="goal"><span class="creation-type-icon">✧</span><strong>目標</strong><small>達成したいこと。<br>あとから細かく分解できます。</small><span class="creation-type-arrow">→</span></button><button data-create-kind="action"><span class="creation-type-icon">✓</span><strong>タスク</strong><small>繰り返すタスクや、一度きりのイベント。</small><span class="creation-type-arrow">→</span></button></div>`)}

function editor(id,creationKind=null){const isNew=id==='new',parent=addParent||currentSpace().id,n=isNew?{name:'',description:'',parentId:parent}:state.nodes.find(n=>n.id===id);if(!n)return;if(isNew&&!['goal','action'].includes(creationKind)){chooseCreationType(parent);return}const a=setting(state,id),isRoot=!isNew&&!n.parentId,blocked=isNew?new Set():descendants(state,id),hasChildren=!isNew&&visibleChildren(state,id).length>0,kind=isNew?creationKind:nodeKind(state,id),depth=isNew?nodeDepth(state,parent)+1:nodeDepth(state,id);if(isNew&&depth>4){toast('目標は宇宙から衛星までの5階層です');return}modal(`<form id="node-form" data-id="${esc(id)}"><div class="dialog-title"><div><div class="eyebrow">${LEVELS[Math.min(depth,4)]}</div><h2>${isNew?(kind==='action'?'タスクを設定':'目標を設定'):isRoot?'宇宙を編集':'目標・タスクを編集'}</h2></div><button type="button" data-do="close" class="round-button" aria-label="閉じる">×</button></div>${isNew?`<input type="hidden" name="node-kind" value="${kind}"><button type="button" class="creation-type-back" data-create-back>← タイプを選び直す</button>`:!isRoot?`<fieldset class="goal-kind-picker"><legend>目標／タスク</legend><label><input type="radio" name="node-kind" value="goal" ${kind==='goal'?'checked':''} required><span><strong>目標</strong><small>さらに分解していくもの</small></span></label><label><input type="radio" name="node-kind" value="action" ${kind==='action'?'checked':''} ${hasChildren?'disabled':''} required><span><strong>タスク</strong><small>実際に取り組むタスク</small></span></label></fieldset>`:''}<label>名前<input autofocus required maxlength="80" name="name" value="${esc(n.name)}" placeholder="目指したいことを、自分の言葉で"></label><label><span data-purpose-label>${kind==='action'?'このタスクにした理由':'この目標にした目的'}</span><textarea name="description" required maxlength="1000" rows="2" placeholder="取り組む理由を、自分の言葉で">${esc(n.description||'')}</textarea></label>${!isRoot?`<input type="hidden" name="parent" value="${esc(n.parentId)}"><div class="goal-parent-context"><span>つながる${LEVELS[Math.min(4,nodeDepth(state,n.parentId))]||'上位目標'}</span><strong>${esc(state.nodes.find(p=>p.id===n.parentId)?.name||'')}</strong></div>`:''}<fieldset class="goal-action-fields" ${kind==='action'?'':'hidden disabled'}>${taskSettingsFields(state,id)}</fieldset>${depth===1?`<details class="cosmic-advanced-settings"><summary>詳細設定</summary><label>ブラックホールの名前<input name="symbol-name" maxlength="80" value="${esc(n.symbolName||n.name)}" placeholder="省略すると銀河名になります"></label></details>`:''}${hasChildren?'<p class="footnote">下位目標があるため、目標として扱います。</p>':''}<div class="dialog-actions">${!isNew&&!isRoot?`<button type="button" class="danger text-button" data-delete="${esc(id)}">削除</button>`:''}${!isNew?`<button type="button" class="text-button" data-space-stats="${esc(id)}">統計を見る</button>`:''}<button class="primary" type="submit">${isNew?'誕生させる':'保存する'}</button></div></form>`);if(isNew&&creationDraft){
 const form=$('#node-form');
 for(const [key,value] of Object.entries(creationDraft)){
  if(key==='node-kind'||key==='extras')continue;
  const input=form.elements.namedItem(key);
  if(input&&input.type!=='radio')input.value=value;
 }
 const list=form.querySelector('[data-extra-list]');
 if(list)list.innerHTML=(creationDraft.extras||[]).map(metric=>extraMetricFields(metric)).join('');
 syncTaskFormat(form);
}}
function review(){const ws=weekStart(today),end=shiftDate(ws,6),s=stats(state,ws,end),r=state.reviews[ws]||{},effective=shiftDate(ws,7);modal(`<form id="review-form"><div class="dialog-title"><div><div class="eyebrow">WEEKLY REFLECTION</div><h2>今週の自分と、話そう。</h2></div><button type="button" data-do="close" class="round-button" aria-label="閉じる">×</button></div><p class="muted">${ws.replaceAll('-','/')} — ${end.replaceAll('-','/')}</p><div class="review-summary">${Object.entries(s.counts).map(([k,c])=>`<div><span style="color:${MODES[k].color}">${MODES[k].icon}</span><strong>${c}日</strong><small>${MODES[k].label}</small></div>`).join('')}</div><h3>今週、取り組んだタスク</h3><p class="muted">${s.logs.length} 回の実行記録</p>${Object.entries(s.logs.reduce((o,l)=>(o[l.name]=(o[l.name]||0)+1,o),{})).map(([n,c])=>`<p class="review-log">♧ ${esc(n)} <b>${c}回</b></p>`).join('')}<label>無理があったこと・気づいたこと<textarea name="note" rows="3" placeholder="今週の自分に、どんな言葉をかけたい？">${esc(r.note||'')}</textarea></label><label>来週、大切にしたいこと<textarea name="next" rows="2" placeholder="小さく、具体的な一歩を書いてみよう。">${esc(r.next||'')}</textarea></label><h3>来週のタスクプラン</h3><p class="footnote">${effective.replaceAll('-','/')}（月）から反映。過去の記録はそのまま残ります。</p>${leaves(state).filter(n=>nodeKind(state,n.id)==='action').map(n=>{const a=state.pending.find(p=>p.id===n.id&&p.effective===effective)?.setting||setting(state,n.id);return `<fieldset class="review-setting" data-review-node="${esc(n.id)}"><legend>${esc(n.name)}</legend>${taskLevelFields(a,'review-level-'+n.id)}</fieldset>`}).join('')}<div class="dialog-actions"><button class="primary">レビューを保存</button></div></form>`)}
function switchDemo(enabled){const url=new URL(location.href);if(enabled)url.searchParams.set('demo','1');else url.searchParams.delete('demo');url.searchParams.delete('preview');location.assign(url)}
function settings(){modal(`<div class="dialog-title"><div><div class="eyebrow">YOUR OWN UNIVERSE</div><h2>設定・バックアップ</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${account?`<div class="account-info"><div class="account-profile-photo">${accountAvatar()}</div><strong>${esc(account.name)}</strong><p>${esc(account.email)}</p>${!account.picture?'<a class="text-button" href="/api/auth/google">Googleのプロフィール画像を取得</a>':''}<form method="post" action="/api/auth/logout" data-native-submit><button class="text-button" type="submit">ログアウト</button></form></div>`:''}<p>データはこの端末・ブラウザ内に保存されます。端末間での同期はありません。ブラウザのデータを消す前にバックアップしてください。</p><button class="text-button" data-do="open-demo">検証用の宇宙を開く →</button><br><button class="text-button" data-do="preview-onboarding">初めて開いたときの画面を見る →</button><br><button class="text-button" data-do="review">今週を振り返る →</button><div class="settings-actions"><button class="primary" data-do="export">↓ バックアップを書き出す</button><label class="import-button">↑ バックアップを読み込む<input type="file" id="import" accept="application/json,.json"></label></div><p class="footnote">読み込み時は現在のデータを置き換えます。先に現在のバックアップを保存することをおすすめします。日付は日本時間、週の始まりは月曜日です。</p><hr><p class="muted">jiku v1.0 · 自分の軸を、日々のタスクへ。</p>`)}
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-do],[data-view],[data-day],[data-focus]');if(!b)return;const d=b.dataset;
 if(b.hasAttribute('data-map-expand')){
  const branches=b.closest('.hierarchy-branch').querySelector(':scope > .hierarchy-children');
  branches.hidden=!branches.hidden;
  b.setAttribute('aria-expanded',String(!branches.hidden));
  b.firstElementChild.textContent=branches.hidden?'›':'⌄';
  return;
 }
 if(d.editTitle&&e.detail===0){editor(d.editTitle);return}
 if(d.undoEvent){
  const previous=structuredClone(state);undoEventCompletion(state,d.undoEvent);
  if(!save()){state=previous;return}
  close();render();toast('イベントの完了を取り消しました');return;
 }
 if(b.hasAttribute('data-add-extra')){
  const form=b.closest('form'),list=form.querySelector('[data-extra-list]');
  if(list.children.length>=12){toast('追加できる単位は12種類までです');return}
  list.insertAdjacentHTML('beforeend',extraMetricFields({},form.elements.namedItem('task-format').value==='event'));
  list.lastElementChild.querySelector('select').focus();
  return;
 }
 if(b.hasAttribute('data-remove-extra')){b.closest('[data-extra-metric]').remove();return}
 if(d.spaceEnter){enterSpace(d.spaceEnter);return}if(d.spaceGo){close();enterSpace(d.spaceGo);return}if(d.legacyDetail){legacyDetail(d.legacyDetail);return}if(d.spaceAdd){creationDraft=null;chooseCreationType(d.spaceAdd);return}if(d.createKind){editor('new',d.createKind);return}if(b.hasAttribute('data-create-back')){const form=b.closest('form');creationDraft={...creationDraft,...Object.fromEntries(new FormData(form)),extras:readExtraSettings(form)};chooseCreationType(addParent||currentSpace().id);return}if(d.spaceDetail){spaceDetail(d.spaceDetail);return}if(d.spaceStats){quantityScope=d.spaceStats;statsTab='quantity';view='stats';location.hash='stats';close();render();return}if(d.spaceReorder){reorderNode(state,d.spaceReorder,Number(d.direction));save();render();spaceList();return}if(d.openPreset)openPreset(d.openPreset);if(b.hasAttribute('data-configure-leaves')){close();view='tree';location.hash='tree';render();toast('タスクを押して、タスクの固定量を設定してください')}if(d.recordLeaf)leafPanel(d.recordLeaf,d.logDate||today);if(d.pickLeaf)chooseLeaf(d.pickLeaf);if(d.quantityDay)dayEditor(d.quantityDay);if(d.quantityPeriod){
  const offset=Number(d.quantityPeriod);
  if(statsTab==='monthly')statsMonth=boundedMonth(statsMonth,offset,today);
  else{const next=shiftDate(statsWeek,offset*7);if(next<=weekStart(today))statsWeek=next}
  render();
 }if(d.statsGoal){quantityScope=statisticsScope(state,d.statsGoal);close();render()}if(b.hasAttribute('data-reset-period')){if(statsTab==='monthly')statsMonth=today.slice(0,7);else statsWeek=weekStart(today);render()}if(d.quantityDimension){quantityDimension=d.quantityDimension;render()}if(d.addQuantity){const input=$('#quantity-form [name=record-minutes]');if(input)input.value=String(Math.round(((Number(input.value)||0)+Number(d.addQuantity))*1000000)/1000000)}if(d.removeQuantity){modal(`<h2>この日の量の記録を削除しますか？</h2><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button class="primary danger-bg" data-confirm-remove-quantity="${esc(d.removeQuantity)}" data-log-date="${d.logDate}">削除する</button></div>`)}if(d.confirmRemoveQuantity){removeQuantity(state,d.logDate,d.confirmRemoveQuantity);save();close();render();toast('この日の記録を削除しました')}if(b.hasAttribute('data-scroll-tree')){$('#goal-tree')?.scrollIntoView({behavior:'smooth',block:'start'})}if(d.statTab){statsTab=d.statTab;render()}if(d.view){view=d.view;location.hash=view;render();window.scrollTo(0,0)}if(d.mode){try{const count=applyMode(state,d.date,d.mode,today);save();render();close();toast(count?`${count}個のタスクの固定量を反映しました`:'モードを保存しました')}catch(error){toast(error.message)}}if(d.check){const n=state.nodes.find(n=>n.id===d.check);if(n){toggleLog(state,d.date,n);save();render()}}if(d.edit){addParent=null;editor(d.edit);if(b.hasAttribute('data-quantity-settings'))$('#node-form [name=quantity-unit]')?.focus()}if(d.selectDate){selected=d.selectDate;render();dayEditor(selected)}if(d.day){selected=d.day;month=selected.slice(0,7);view='stats';statsTab='calendar';render()}if(d.month){month=boundedMonth(month,Number(d.month),today);render()}if(d.focus){focus=d.focus;treeView=null;treeScene?.dispose();treeScene=null;zoom=1;pan={x:0,y:0};close();render()}if(d.delete){const id=d.delete,n=state.nodes.find(n=>n.id===id),count=descendants(state,id).size;modal(`<h2>「${esc(n.name)}」を削除しますか？</h2><p>子孫を含め ${count} 個の目標を削除します。過去の実行記録は残ります。</p><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button class="primary danger-bg" data-confirm-delete="${esc(id)}">削除する</button></div>`)}if(d.confirmDelete){deleteNode(state,d.confirmDelete);focus=null;treeScene?.dispose();treeScene=null;treeView=null;save();close();render();toast('目標を削除しました')}if(d.do)({close,settings,review,'open-demo':()=>switchDemo(true),'exit-demo':()=>switchDemo(false),'test-demo-mode':modePicker,'choose-stats-goal':()=>showHierarchy(true),'space-map':()=>showHierarchy(false),'preview-onboarding':previewOnboarding,'space-list':spaceList,'quick-actions':()=>chooseLeaf(today),'show-rhythm':()=>modal(`<div class="dialog-title"><h2>モードの割合</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${rhythmPage()}`),'today-mode':modePicker,'labels':()=>{showGoalLabels=!showGoalLabels;applyLabelVisibility();b.setAttribute('aria-pressed',String(showGoalLabels))},'zoom-in':()=>{if(treeScene)treeScene.zoom(1.25);else{zoom=Math.min(2.5,zoom+.2);render()}},'zoom-out':()=>{if(treeScene)treeScene.zoom(.8);else{zoom=Math.max(.4,zoom-.2);render()}},'reset-tree':()=>{if(focus){focus=null;treeScene?.dispose();treeScene=null;treeView=null;render()}else if(treeScene)treeScene.reset();else{zoom=1;pan={x:0,y:0};render()}},today:()=>{month=today.slice(0,7);selected=today;render()},'clear-record':()=>{clearMode(state,selected);save();render();close();toast('モードを未記録に戻しました')},export:()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`jiku-${demoMode?'demo':'backup'}-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}[d.do])?.()});
let lastTitleTap;
document.addEventListener('pointerup',event=>{
 if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;
 const button=event.target.closest('[data-edit-title]');
 if(!button){lastTitleTap=null;return}
 const now=performance.now();
 if(lastTitleTap?.button===button&&now-lastTitleTap.time<=420){
  lastTitleTap=null;editor(button.dataset.editTitle);
 }else lastTitleTap={button,time:now};
});
document.addEventListener('dblclick',event=>{
 const button=event.target.closest('[data-edit-title]');
 if(button&&!$('#dialog').open)editor(button.dataset.editTitle);
});
document.addEventListener('error',e=>{if(e.target.matches?.('[data-account-photo]'))e.target.remove()},true);
document.addEventListener('submit',e=>{if(e.target.hasAttribute('data-native-submit'))return;e.preventDefault();if(e.target.id==='node-form'){const f=new FormData(e.target),id=e.target.dataset.id,previous=structuredClone(state);try{const kind=f.get('node-kind')||'goal',newId=writeGoal(state,{id,name:f.get('name'),purpose:f.get('description'),parentId:id==='new'?(addParent||currentSpace().id):state.nodes.find(n=>n.id===id)?.parentId,kind,...(kind==='action'?readTaskSettings(e.target):{}),symbolName:f.has('symbol-name')?f.get('symbol-name'):undefined});refreshTodayMode();if(!save()){state=previous;return}close();render();if(id==='new')treeScene?.birth(newId);toast(id==='new'?'新しい天体が誕生しました':'目標を更新しました')}catch(err){state=previous;toast(err.message)}}if(e.target.id==='preset-form'){
 const id=e.target.dataset.id,node=state.nodes.find(n=>n.id===id),previous=structuredClone(state);
 if(!node)return;
 try{
  writeGoal(state,{id,name:node.name,purpose:node.description,parentId:node.parentId,kind:'action',...readTaskSettings(e.target)});
  refreshTodayMode();if(!save()){state=previous;return}
  close();render();toast('タスクの設定を保存しました');
 }catch(error){state=previous;toast(error.message)}
}if(e.target.id==='event-form'){
 const previous=structuredClone(state),id=e.target.dataset.id;
 try{
  const data=new FormData(e.target);
  recordEventCompletion(state,id,data.get('event-completed-date'),today,Number(data.get('record-minutes')),readExtraAmounts(data));
  if(!save()){state=previous;return}
  close();render();toast('イベントの完了を記録しました');
 }catch(error){state=previous;toast(error.message)}
}if(e.target.id==='quantity-form'){
 const data=new FormData(e.target),previous=structuredClone(state);
 try{
  setTaskRecord(state,data.get('record-date'),e.target.dataset.id,Number(data.get('record-minutes')),readExtraAmounts(data),today);
  if(!save()){state=previous;return}
  close();render();toast('取り組んだ時間を記録しました');
 }catch(error){state=previous;toast(error.message)}
}if(e.target.id==='review-form'){const ws=weekStart(today),effective=shiftDate(ws,7),f=new FormData(e.target);state.reviews[ws]={note:f.get('note'),next:f.get('next'),savedAt:new Date().toISOString()};e.target.querySelectorAll('[data-review-node]').forEach(el=>{const id=el.dataset.reviewNode;state.pending=state.pending.filter(p=>!(p.id===id&&p.effective===effective));state.pending.push({id,effective,setting:{...setting(state,id),modes:modesForLevel(el.querySelector('input:checked').value)}})});save();close();render();toast('レビューを保存しました。タスク設定は来週から反映します。')}});
document.addEventListener('change',async e=>{if(e.target.name==='node-kind'){
 const form=e.target.closest('form'),box=form.querySelector('.goal-action-fields'),active=e.target.value==='action';
 box.hidden=box.disabled=!active;
 form.querySelector('[data-purpose-label]').textContent=active?'このタスクにした理由':'この目標にした目的';
 }if(e.target.name==='task-format')syncTaskFormat(e.target.closest('form'));if(e.target.id==='quantity-scope'){quantityScope=e.target.value;render()}if(e.target.name==='extra-unit'){
 const custom=e.target.closest('[data-extra-metric]').querySelector('[data-extra-custom]');
 const input=custom.querySelector('input'),isCustom=e.target.value==='custom';
 custom.hidden=input.disabled=!isCustom;
 input.required=isCustom;
 }if(e.target.name==='record-date'&&validDateKey(e.target.value)&&e.target.value<=today){leafPanel(e.target.closest('form').dataset.id,e.target.value)}if(e.target.id==='import'&&e.target.files[0]){try{const f=e.target.files[0];if(f.size>10*1024*1024)throw Error('10MB以下のバックアップを選んでください');const next=validate(JSON.parse(await f.text()));modal(`<h2>バックアップを読み込みますか？</h2><p>${next.nodes.length} 個の目標を読み込み、現在のデータを置き換えます。</p><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button id="confirm-import" class="primary">置き換える</button></div>`);$('#confirm-import').onclick=()=>{state=migrateUniverse(next);onboardingScene?.dispose();onboardingScene=null;storageLocked=false;focus=null;applyPending(state,today);focus=null;save();close();render();toast('バックアップを読み込みました')}}catch(err){toast('読み込めませんでした：'+err.message)}}});
function bindTree(){const host=$('.universe-stage');if(!host)return;try{treeScene=createUniverse(host,{nodes:state.nodes,current:showUniverseOrigin()?UNIVERSE_ORIGIN:currentSpace().id,onSelect:openNode,onZoom:value=>{const label=$('[data-zoom-label]');if(label)label.textContent=value+'%'}})}catch(error){if(showUniverseOrigin()){host.innerHTML=`<button class="universe-origin-fallback" data-space-enter="${esc(currentSpace().id)}" aria-label="宇宙に入る"></button>`;return}host.innerHTML=`<div class="universe-fallback"><p>この端末では、目標一覧で宇宙を探索できます。</p>${visibleChildren(state,currentSpace().id).map(n=>`<button data-space-enter="${esc(n.id)}">✧ ${esc(n.name)} →</button>`).join('')}</div>`}}
function applyLabelVisibility(){}
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
window.addEventListener('hashchange',()=>{const raw=location.hash.slice(1),h=raw==='home'?'tree':raw==='calendar'?'stats':raw;if(raw==='calendar')statsTab='calendar';if(names[h]&&(view!==h||raw==='calendar')){view=h;render()}});window.addEventListener('focus',()=>{if(dateKey()!==today){render();promptDailyMode()}});if(names[location.hash.slice(1)])view=location.hash.slice(1);if(location.hash==='#home')history.replaceState(null,'','#tree');if(location.hash==='#calendar'){view='stats';statsTab='calendar';history.replaceState(null,'','#stats')}render();if(!onboardingPreview&&needsLegacyImport)offerLegacyImport();else promptDailyMode();

function offerLegacyImport(){modal(`<div class="dialog-title"><h2>以前の記録を引き継ぎますか？</h2></div><p>このブラウザでGoogleログイン前に使っていた記録が残っています。現在ログインしているあなたのアカウントへコピーできます。</p><p class="footnote">元の記録はそのまま残ります。</p><div class="dialog-actions"><button class="text-button" data-do="close">新しく始める</button><button id="copy-legacy" class="primary">記録を引き継ぐ</button></div>`);$('#copy-legacy').onclick=()=>{try{const old=localStorage.getItem('jiku-v1');localStorage.setItem(storageKey+':before-universe',old);state=migrateUniverse(validate(JSON.parse(old)));onboardingScene?.dispose();onboardingScene=null;applyPending(state,today);save();close();render();toast('以前の記録を引き継ぎました');promptDailyMode()}catch{toast('以前の記録を読み込めませんでした。バックアップから読み込んでください。')}}}
