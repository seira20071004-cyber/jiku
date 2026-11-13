import {mountOnboarding,onboardingDraft,pendingUniverse,clearPendingUniverse,resumeGuestDraft,saveGuestDraft,planetArt} from './onboarding.js';
import {createExampleDraft, exampleMap} from './example-map.js';
import {mapDiagram} from './mind-map.js';
import {createDemoUniverse} from './demo.js';
import {taskSettingsFields,extraMetricFields,eventPanel,presetPanel,modePickerContent,recordPanel,weeklyPanel,analysisChart,numberText,hoursText} from './quantity-view.js';
import {createUniverse} from './universe.js';
import {UNIVERSE_ORIGIN,LEVELS,nodePath,nodeDepth,visibleChildren,canPlace,freshUniverse,migrateUniverse,completeUniverse,reorderNode,writeGoal,boundedMonth,universeGrowth} from './universe-model.js';
import {MODES,dateKey,shiftDate,weekStart,seed,leaves,descendants,moveNode,deleteNode,setting,applyPending,plan,toggleLog,ancestry,stats,validate,measurement,unitInfo,setTaskRecord,removeQuantity,quantitySummary,validDateKey,applyMode,clearMode,modesForLevel,nodeKind,recordMode,modeDistribution,isEventTask,eventCompletionDate,recordEventCompletion,undoEventCompletion} from './model.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let account=null,googleSite=document.documentElement.dataset.auth==='google';
try{
 const response=await fetch('/api/session',{cache:'no-store'});
 if(response.headers.get('content-type')?.includes('application/json')){
  const result=await response.json();
  googleSite=googleSite||result.mode==='google';
  if(googleSite&&response.ok&&result.user?.id)account=result.user;
 }
}catch{}
const guest=googleSite&&!account;
const demoMode=new URLSearchParams(location.search).get('demo')==='1';
const personalStorageKey=guest?'jiku-guest':account?'jiku-v1:'+account.id:'jiku-v1';
const storageKey=demoMode?personalStorageKey+':demo-v2':personalStorageKey;
let needsLegacyImport=false,storageLocked=false;let state;try{const raw=guest?null:localStorage.getItem(storageKey);needsLegacyImport=!demoMode&&!!account&&!raw&&!!localStorage.getItem('jiku-v1');state=raw?validate(JSON.parse(raw)):(demoMode?createDemoUniverse(dateKey()):freshUniverse());if(raw&&!state.universe){localStorage.setItem(storageKey+':before-universe',raw);state=migrateUniverse(state)}}catch{storageLocked=true;state=state||freshUniverse();setTimeout(()=>toast('保存データを保護しています。設定からバックアップを確認してください。'),300)}
let treeScene=null,treeView=null,showGoalLabels=true,statsTab='calendar',statsWeeks=1,quantityScope='all';
let view='tree',today=dateKey(),selected=today,month=today.slice(0,7),focus=null,zoom=1,pan={x:0,y:0};
let guideSession=null,guideTimer,mapPreviewReturn=null,onboardingResume=null;
let mapSelection=null,mapEditing=false;
function save(){if(guideSession||mapPreviewReturn||guest)return true;if(storageLocked){toast('元の保存データを保護しています。バックアップを確認してください。');return false}try{localStorage.setItem(storageKey,JSON.stringify(state));return true}catch{toast('保存できませんでした。設定からバックアップを保存してください。');return false}}
applyPending(state,today);if(state.universe?.onboarded)save();
const icon=(name)=>({home:'⌂',tree:'✧',calendar:'▦',stats:'◴',settings:'⚙'}[name]);
const names={tree:'自分の宇宙',stats:'統計'};
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
function modal(html){const d=$('#dialog');d.innerHTML=html;d.showModal();d.querySelector('[autofocus]')?.focus()}
function close(){$('#dialog').close()}
function heading(k,title,sub,extra=''){return `<div class="page-heading"><div><div class="eyebrow">${k}</div><h1>${title}</h1><p>${sub}</p></div>${extra}</div>`}
function accountAvatar(){const picture=account?.picture;return `<span class="google-account-fallback" aria-hidden="true">G</span>${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer" data-account-photo>`:''}`}
function render(){clearTimeout(guideTimer);
 const birthActive=onboardingScene||onboardingPreview||
 (guest&&!guideSession&&!mapPreviewReturn)||(!storageLocked&&!state.universe?.onboarded);
 document.body.classList.toggle('birth-active',Boolean(birthActive));
 if(birthActive){if(treeScene){treeScene.dispose();treeScene=null}if(!onboardingScene)showOnboarding();return}
 if(treeScene){treeView=treeScene.getView();treeScene.dispose();treeScene=null}const latest=dateKey();if(today!==latest){today=latest;selected=today;applyPending(state,today);save()}
 const page=view==='stats'?statsPage():guideSession?treePage():mindMapPage();
 $('#app').innerHTML=`<main class="workspace view-${view}"><header class="topbar"><a class="brand" href="#tree" data-map-back aria-label="Jiku 自分の宇宙">Jiku<span>●</span></a>${mapPreviewReturn?'<div class="demo-toolbar"><button data-map-exit>プレビューを終了</button></div>':guideSession?.preview?'<div class="demo-toolbar"><button data-guide="dismiss">'+(guideSession.draft?'案内をスキップ':'プレビューを終了')+'</button></div>':demoMode?'<div class="demo-toolbar"><span>検証用</span><button data-do="test-demo-mode">モードを試す</button><button data-do="exit-demo">戻る ↗</button></div>':''}<button ${guideSession?'hidden':''} class="avatar" data-do="settings" aria-label="Googleアカウントと設定" title="Googleアカウントと設定">${accountAvatar()}</button></header><div class="content">${page}</div></main><nav class="bottom-nav" aria-label="メインメニュー" ${guideSession?'inert':''}>${Object.entries(names).map(([k,v])=>`<button class="nav ${view===k?'active':''}" data-view="${k}" ${view===k?'aria-current="page"':''}><span aria-hidden="true">${icon(k)}</span><strong>${v}</strong></button>`).join('')}</nav>`;bindTree();scheduleGuide()}
function modeCards(key){const current=state.records[key]?.mode;return `<div class="mode-grid">${Object.entries(MODES).filter(([k])=>k!=='none').map(([k,m])=>`<button class="mode-card ${current===k?'selected':''} ${k}" data-mode="${k}" data-date="${key}"><span class="mode-icon">${m.icon}</span><span><strong>${m.label}</strong><small>${m.description}</small></span><span class="radio">${current===k?'✓':''}</span></button>`).join('')}</div>`}
function actionRow(n,key){const a=setting(state,n.id),done=!!state.logs[key]?.[n.id];return `<div class="action-row ${done?'done':''}"><button class="check ${done?'checked':''}" data-check="${esc(n.id)}" data-date="${key}" aria-label="${esc(n.name)}の実行記録" aria-pressed="${done}">${done?'✓':''}</button><div class="action-copy"><strong>${esc(n.name)}</strong><small>${esc(ancestry(state,n.id).slice(1,-1).join(' / ')||'自分の宇宙')}</small></div><span class="priority p${a.priority}">${['高','中','低'][a.priority]}</span><button class="edit-action" data-edit="${esc(n.id)}" aria-label="${esc(n.name)}を編集">⋯</button></div>`}
let universeOutside=!state.universe?.firstSteps,navigating=false,onboardingScene=null;
let onboardingPreview=['welcome','map'].includes(new URLSearchParams(location.search).get('preview'));
const onboardingKey=storageKey+':onboarding-draft';
const authReturn=!!account&&!demoMode&&new URLSearchParams(location.search).get('onboarding')==='resume';
let guestHandoff=authReturn?pendingUniverse():null;
function finishOnboardingReturn(){
 if(!authReturn)return;
 clearPendingUniverse();
 guestHandoff=null;
 const url=new URL(location.href);url.searchParams.delete('onboarding');history.replaceState(null,'',url);
}
if(authReturn&&(state.universe?.onboarded||!guestHandoff))finishOnboardingReturn();
function currentSpace(){return state.nodes.find(n=>n.id===focus)||state.nodes.find(n=>n.parentId===null)}
function spaceTrail(){
 const path=nodePath(state,currentSpace().id);
 return path.map((node,depth)=>{
  const level=LEVELS[Math.min(depth,4)],current=depth===path.length-1;
  return `<button data-space-enter="${esc(node.id)}" title="${esc(node.name)}" aria-label="${level}：${esc(node.name)}" ${current?'aria-current="location"':''}>${level}</button>`;
 }).join('<span aria-hidden="true">›</span>');
}
function showUniverseOrigin(){return universeOutside&&!onboardingPreview&&state.universe?.onboarded}
function originGrowthHUD(){
 const {name,level,days,nextDay}=universeGrowth(state,today);
 const note=level===0?'最初の銀河を作ると、光が育ち始めます。':nextDay
  ?`記録 ${days}日 · 次の変化まであと ${nextDay-days}日`:`記録 ${days}日 · 最終段階`;
 return `<div class="universe-growth"><p>${name}</p><small>${note}</small></div>`;
}
function spaceHUD(){if(guideSession)return `<div class="space-heading guide-location"><h1>${esc(currentSpace().name)}</h1></div>`;if(showUniverseOrigin())return originGrowthHUD();const n=currentSpace(),depth=nodeDepth(state,n.id),children=visibleChildren(state,n.id);return `<div class="universe-topline"><nav class="space-breadcrumb" aria-label="現在地">${spaceTrail()}</nav><button class="space-map-trigger" data-map-back><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M8 5v3m-5 3V8h10v3"/><circle cx="8" cy="3.5" r="1.5"/><circle cx="3" cy="12.5" r="1.5"/><circle cx="13" cy="12.5" r="1.5"/></svg> 地図に戻る</button><button class="space-map-trigger space-vista-trigger" data-do="open-scenery">景色を見る</button></div><div class="space-heading"><h1><button class="space-edit-title" data-edit-title="${esc(n.id)}" title="ダブルタップで編集" aria-label="${esc(n.name)}。ダブルタップで編集">${esc(n.name)}</button></h1></div><div class="space-primary-tools">${n.parentId?`<button data-space-enter="${esc(n.parentId)}" class="space-back">← <span>ひとつ上へ</span></button>`:`<button data-space-enter="${UNIVERSE_ORIGIN}" class="space-back">← <span>宇宙の外へ</span></button>`}${depth<4&&nodeKind(state,n.id)==='goal'?`<button class="space-add" data-space-add="${esc(n.id)}">＋ ${LEVELS[depth+1]}を追加</button>`:''}</div>${!children.length&&n.parentId?`<div class="space-empty"><button class="space-detail-button" data-space-detail="${esc(n.id)}">この目標・タスクの詳細 ↗</button></div>`:''}${depth>=4&&children.length?`<div class="space-legacy"><p>以前の5階層を超える目標は、元の構造とIDのまま保護しています。</p>${children.map(c=>`<button data-legacy-detail="${esc(c.id)}">${esc(c.name)} →</button>`).join('')}</div>`:''}`}
const guideCopy={
 intro:['地図の４つの枝が、銀河になりました','健康、エンジニア、人間関係、英語。まずは「健康」の銀河に近づいてみましょう。',3000],
 galaxy:['銀河「健康」','健康の中には、体を動かすことと、睡眠や食事を整えること。地図の次の枝が恒星系として見えます。',2800],
 task:['「10分歩く」までたどり着きました','体を動かす習慣の中に、今日からできるタスクを置きました。',2800],
 finish:['マインドマップが宇宙になりました','このように、マインドマップを宇宙に反映できます。']
};

function guideHUD(){
 if(!guideSession)return '';
 const [title,detail]=guideCopy[guideSession.phase];
 const preview=guideSession.preview;
 return `<aside class="first-steps" aria-label="お手本チュートリアル">
  <div class="first-steps-top"><span class="first-steps-label">宇宙船で案内中</span>${!preview&&guideSession.phase!=='finish'?'<button type="button" class="text-button" data-guide="dismiss">スキップ</button>':''}</div>
  <div aria-live="polite"><h2>${title}</h2><p>${detail}</p></div>
  ${guideSession.phase==='finish'?`<button type="button" class="primary" data-guide="dismiss">${guideSession.draft?'自分のマインドマップをつくる':preview?'元の宇宙へ戻る':'自分の宇宙へ'} <span aria-hidden="true">→</span></button>`:''}
 </aside>`;
}

function startGuide(preview=false,draft=null){
 const sample=freshUniverse();
 const rootId=populateMappedUniverse(sample,createExampleDraft());
 const [{id:galaxyId}]=visibleChildren(sample,rootId);
 const [{id:goalId}]=visibleChildren(sample,galaxyId);
 guideSession={preview,draft,state,view,focus,universeOutside,phase:'intro',galaxyId,goalId};
 state=sample;
 view='tree';focus=null;universeOutside=false;
 if(preview&&!draft){
  const url=new URL(location.href);url.searchParams.set('preview','guide');url.hash='tree';
  history.replaceState(null,'',url);
 }
}

function scheduleGuide(){
 const guide=guideSession;
 const delay=guide&&guideCopy[guide.phase][2];
 if(!delay||view!=='tree')return;
 guideTimer=setTimeout(async()=>{
  if(guide!==guideSession)return;
  if(guide.phase==='intro'){
   await enterSpace(guide.galaxyId);
   if(guide!==guideSession)return;
   guide.phase='galaxy';
   render();
   return;
  }
  if(guide.phase==='galaxy'){
   await enterSpace(guide.goalId);
   if(guide!==guideSession)return;
   guide.phase='task';
   render();
   return;
  }
  guide.phase='finish';
  const card=$('.first-steps');
  if(card)card.outerHTML=guideHUD();
 },delay);
}

function dismissGuide(){
 const guide=guideSession;
 if(!guide)return;
 if(guide.draft){
  ({state,view,focus,universeOutside}=guide);
  guideSession=null;
  onboardingResume=guide.draft;
  onboardingPreview=guide.preview;
  render();
  return;
 }
 if(!guide.preview){
  const example=state;
  state=guide.state;
  guideSession=null;
  delete state.universe.firstSteps;
  if(!save()){
   state.universe.firstSteps=true;
   state=example;guideSession=guide;
   return;
  }
 }else{
  state=guide.state;guideSession=null;
  const url=new URL(location.href);url.searchParams.delete('preview');url.hash=guide.view;
  history.replaceState(null,'',url);
 }
 view=guide.view;focus=guide.focus;universeOutside=guide.universeOutside;
 render();
}

function treePage(){return `<section class="universe-scene full-panel ${showUniverseOrigin()?'at-origin':''}" id="goal-tree" aria-label="自分の宇宙">
 <div class="universe-stage"></div><div class="space-travel-veil"></div><div class="universe-hud">${spaceHUD()}${guideHUD()}</div>
 ${guideSession?'':'<button class="space-map-back" data-map-back>← マインドマップに戻る</button>'}
 ${guideSession?'<div class="guide-cockpit" aria-hidden="true"></div>':''}
 <section class="space-vista" aria-label="この場所の景色" hidden>
  <button class="space-back" data-do="close-scenery">← 景色を閉じる</button>
  <div class="space-vista-caption"><h2></h2><p></p></div>
 </section>
</section>`}
function openScenery(){
 const panel=$('.space-vista'),hud=$('.universe-hud');
 if(!panel||!hud||showUniverseOrigin()||navigating)return;
 if(!treeScene?.showScenery()){toast('この端末では景色を表示できません');return}
 const node=currentSpace(),depth=nodeDepth(state,node.id);
 const parent=state.nodes.find(item=>item.id===node.parentId);
 panel.querySelector('h2').textContent=depth===0?node.name:`${LEVELS[depth]}「${node.name}」から`;
 panel.querySelector('p').textContent=depth>=3?`${LEVELS[depth-1]}「${parent.name}」の方向`:
  ['宇宙の眺め','銀河の中心','恒星と軌道'][depth];
 hud.hidden=true;panel.hidden=false;
 panel.querySelector('button').focus({preventScroll:true});
}
function closeScenery(){
 const panel=$('.space-vista'),hud=$('.universe-hud');
 if(!panel||panel.hidden)return;
 treeScene?.hideScenery();
 panel.hidden=true;hud.hidden=false;
 hud.querySelector('[data-do="open-scenery"]')?.focus({preventScroll:true});
}
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
  if(hud){hud.innerHTML=spaceHUD()+guideHUD();const trail=hud.querySelector('.space-breadcrumb');if(trail)trail.scrollLeft=trail.scrollWidth;}
  if(!treeScene)render();
  if(depth===4||(nodeKind(state,id)==='action'&&isEventTask(setting(state,id))))spaceDetail(id);
 }finally{navigating=false}
}
function spaceDetail(id){const n=state.nodes.find(n=>n.id===id);if(!n)return;if(nodeKind(state,id)==='action'&&isEventTask(setting(state,id))){modal(eventPanel(state,id,today,today));return}const hasChildren=visibleChildren(state,id).length>0,a=setting(state,id),m=measurement(state,id),level=a.modes.includes('rest')?'rest':a.modes.includes('busy')?'busy':'full';modal(`<div class="dialog-title"><div><div class="eyebrow">${esc(ancestry(state,id).slice(0,-1).join(' / '))}</div><h2>${esc(n.name)}</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${n.description?`<p class="space-description">${esc(n.description)}</p>`:''}${!hasChildren&&nodeKind(state,id)==='action'?`<div class="space-action-metadata"><span>${MODES[level].icon} ${MODES[level].label}から</span>${m.dailyAmount?`<span>固定量 ${numberText(m.dailyAmount)}${esc(unitInfo(m).label)}</span>`:''}</div>`:''}<div class="space-detail-links"><button data-edit="${esc(id)}">目標を編集 <span>→</span></button>${!hasChildren&&nodeKind(state,id)==='action'?`<button data-open-preset="${esc(id)}">固定量・モードを設定 <span>→</span></button>`:''}<button data-space-stats="${esc(id)}">この目標の統計 <span>→</span></button>${!hasChildren&&nodeKind(state,id)==='action'?`<button data-record-leaf="${esc(id)}">今日の記録を調整 <span>→</span></button>`:''}</div>`)}
function legacyDetail(id){const n=state.nodes.find(n=>n.id===id);if(!n)return;const hasChildren=visibleChildren(state,id).length>0,a=setting(state,id),m=measurement(state,id),level=a.modes.includes('rest')?'rest':a.modes.includes('busy')?'busy':'full';modal(`<div class="dialog-title"><h2>${esc(n.name)}</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><p class="footnote">以前の階層です。履歴と親子関係は保持しています。新しい目標は5階層以内に作成できます。</p>${!hasChildren&&nodeKind(state,id)==='action'?`<div class="space-action-metadata"><span>${MODES[level].icon} ${MODES[level].label}から</span>${m.dailyAmount?`<span>固定量 ${numberText(m.dailyAmount)}${esc(unitInfo(m).label)}</span>`:''}</div>`:''}<div class="space-detail-links"><button data-edit="${esc(id)}">目標を編集 →</button>${!visibleChildren(state,id).length?`<button data-open-preset="${esc(id)}">タスク設定 →</button>`:''}${visibleChildren(state,id).map(c=>`<button data-legacy-detail="${esc(c.id)}">${esc(c.name)} →</button>`).join('')}</div>`)}
function spaceList(){modal(`<div class="dialog-title"><h2>この場所の目標</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="space-detail-links">${visibleChildren(state,currentSpace().id).map(n=>`<div class="space-list-row"><button data-space-go="${esc(n.id)}">${esc(n.name)} <span>↗</span></button><button data-space-reorder="${esc(n.id)}" data-direction="-1" aria-label="${esc(n.name)}を前へ">↑</button><button data-space-reorder="${esc(n.id)}" data-direction="1" aria-label="${esc(n.name)}を後へ">↓</button><button data-edit="${esc(n.id)}" aria-label="${esc(n.name)}を編集">···</button></div>`).join('')||'<p class="muted">まだ下位目標はありません。</p>'}</div>`)}
function showOnboarding(){
 const preview=onboardingPreview;
 const mapPreview=preview&&new URLSearchParams(location.search).get('preview')==='map';
 const resume=onboardingResume;
 onboardingResume=null;
 let saved;
 try{if(!preview)saved=JSON.parse(localStorage.getItem(onboardingKey))}catch{}
 const initial=resume||(preview?(mapPreview?{name:exampleMap.name,step:'confirm'}:null)
  :onboardingDraft(guest?resumeGuestDraft():saved||guestHandoff,state.universe));
 const loginResult=new URLSearchParams(location.search).get('login');
 const loginError=guest&&loginResult?(loginResult==='denied'?'このGoogleアカウントには利用が許可されていません。':'ログインを完了できませんでした。もう一度お試しください。'):null;
 onboardingScene=mountOnboarding($('#app'),{
  preview,previewStart:resume?.step||(mapPreview?'confirm':'gaze'),initial,
  loginAtEnd:guest||preview,loginError,
  onDraft:preview?null:draft=>{
   try{if(guest)saveGuestDraft(draft);else localStorage.setItem(onboardingKey,JSON.stringify(draft))}
   catch(error){if(guest&&draft.step==='login')throw error}
  },
  onSave:async map=>{
   if(preview){
    const generated=freshUniverse();
    populateMappedUniverse(generated,map);
    mapPreviewReturn={state,view,focus,universeOutside,mapSelection};
    state=generated;
    onboardingPreview=false;
   }else{
    await commitUniverseBirth(map);
    finishOnboardingReturn();
    history.replaceState(null,'','#tree');
   }
   onboardingScene?.dispose();onboardingScene=null;
   view='tree';focus=null;universeOutside=false;mapSelection=null;
   render();
  },
  renderStatistics:renderOnboardingStatistics,
  onClose:preview?endOnboardingPreview:null,
  onSettings:preview||guest?null:settings
 });
}
function populateMappedUniverse(target,map){
 completeUniverse(target,map.name);
 const root=target.nodes.find(node=>node.parentId===null);
 function addChildren(parent,parentId){
  for(const child of parent.children){
   const action=child.kind==='action';
   const id=writeGoal(target,{name:child.name,purpose:child.purpose||parent.name+'につなげる',parentId,kind:child.kind,
    ...(action?{measurement:{unit:'minutes',dailyAmount:child.daily,weeklyTarget:child.weekly},mode:child.mode||'rest'}:{})});
   if(!action)addChildren(child,id);
  }
 }
 addChildren(map,root.id);
 validate(target);
 return root.id;
}
function renderOnboardingStatistics(map,mode,period){
 const sample=freshUniverse(),date=dateKey();
 populateMappedUniverse(sample,map);
 if(mode)applyMode(sample,date,mode,date);
 if(period==='calendar')return calendarPage({source:sample,calendarMonth:date.slice(0,7),selectedDay:date,todayKey:date,readOnly:true});
 return weeklyPanel(sample,{
  week:weekStart(date),scope:'all',today:date,
  month:period==='quantity'?undefined:date.slice(0,7),quarter:period==='quarter',readOnly:true
 });
}
function commitUniverseBirth(map){
 const commit=()=>{
  const raw=localStorage.getItem(storageKey);
  const latest=raw?migrateUniverse(validate(JSON.parse(raw))):structuredClone(state);
  if(!latest.universe.onboarded){
   populateMappedUniverse(latest,map);
   localStorage.setItem(storageKey,JSON.stringify(latest));
  }
  state=latest;
  try{localStorage.removeItem(onboardingKey)}catch{}
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
function endMapPreview(){
 if(!mapPreviewReturn)return;
 ({state,view,focus,universeOutside,mapSelection}=mapPreviewReturn);
 mapPreviewReturn=null;
 const url=new URL(location.href);url.searchParams.delete('preview');url.hash=view;
 history.replaceState(null,'',url);
 render();
}
function calendarPage(options){
 if(!options&&month>today.slice(0,7))month=today.slice(0,7);
 const {source=state,calendarMonth=month,selectedDay=selected,todayKey=today,readOnly=false}=options||{};
 const [year,monthNumber]=calendarMonth.split('-').map(Number);
 const first=`${calendarMonth}-01`,offset=(new Date(first+'T12:00:00+09:00').getUTCDay()+6)%7;
 const count=new Date(Date.UTC(year,monthNumber,0)).getUTCDate(),weeks=Math.ceil((count+offset)/7);
 const days=Array.from({length:count},(_,i)=>{
  const day=i+1,key=`${calendarMonth}-${String(day).padStart(2,'0')}`,mode=recordMode(source,key);
  const activity=Object.values(source.logs[key]||{}).some(log=>log.quantity||log.eventCompleted);
  const event=!readOnly&&scheduledEvents(key).length>0;
  const label=`${monthNumber}月${day}日 ${key>todayKey?'これからの日':MODES[mode].label}${activity?'・タスクの記録あり':''}${event?'・イベントの予定あり':''}`;
  const classes=`day-cell mode-${mode} ${selectedDay===key?'selected':''} ${key===todayKey?'today':''}`;
  const contents=`<span>${day}</span>${key<=todayKey?`<i>${MODES[mode].icon}</i>`:''}${activity?'<b class="quantity-calendar-dot"></b>':''}${event?'<b class="event-calendar-dot"></b>':''}`;
  return readOnly?`<div class="${classes}" role="img" aria-label="${label}">${contents}</div>`:
   `<button class="${classes}" data-select-date="${key}" aria-label="${label}" ${key>todayKey&&!event?'disabled':''}>${contents}</button>`;
 }).join('');
 return `<section class="calendar-card cosmic-calendar" aria-label="活動カレンダー">
  <div class="month-heading"><div><span class="calendar-year">${year}</span><h1>${monthNumber}<small>月</small></h1></div>
  ${readOnly?'':'<div><button class="round-button" data-month="-1" aria-label="前の月">‹</button><button class="text-button" data-do="today">今月に戻る</button></div>'}</div>
  <div class="calendar-grid" style="--weeks:${weeks}">${['月','火','水','木','金','土','日'].map(day=>`<span class="day-label">${day}</span>`).join('')}
   ${'<div class="calendar-blank"></div>'.repeat(offset)}${days}
  </div>
  ${readOnly?`<div class="calendar-mode-legend">${['none','rest','busy','full'].map(key=>`<span class="mode-${key}"><i></i>${MODES[key].label}</span>`).join('')}</div>`:''}
 </section>`;
}
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
function calendarModeChart(){
 const [year,monthNumber]=month.split('-').map(Number);
 const lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
 const {counts,days}=modeDistribution(state,month+'-01',month+'-'+lastDay,today);
 const modes=['full','busy','rest','none'].map(key=>({key,count:counts[key]}));
 return `<section class="calendar-mode-card" aria-labelledby="calendar-mode-heading">
  <header><h2 id="calendar-mode-heading">モードの割合</h2><span>${monthNumber}月${month===today.slice(0,7)?' · 今日まで':''}</span></header>
  <div class="calendar-mode-content">
   <div class="calendar-mode-strip" aria-hidden="true">${modes.filter(mode=>mode.count).map(({key,count})=>
    `<i class="mode-${key}" style="flex:${count}"></i>`).join('')}</div>
   <ul>${modes.map(({key,count})=>`<li>
    <i class="mode-${key}" aria-hidden="true"></i><span>${MODES[key].label}</span>
    <span class="calendar-mode-count">${count}日</span><strong>${days?numberText(Math.round(count/days*1000)/10):0}%</strong>
   </li>`).join('')}</ul>
  </div>
 </section>`;
}
function reportScope(id){
 const node=state.nodes.find(node=>node.id===id);
 return node?.parentId&&!isEventTask(setting(state,id))?id:'all';
}
function analysisOptions(){
 const root=state.nodes.find(node=>node.parentId===null);
 function options(parent,depth){
  return visibleChildren(state,parent).map(node=>{
   if(isEventTask(setting(state,node.id)))return '';
   return `<option value="${esc(node.id)}" ${quantityScope===node.id?'selected':''}>${'　'.repeat(depth)}${esc(node.name)}</option>`+
    options(node.id,depth+1);
  }).join('');
 }
 return '<option value="all">すべての活動</option>'+options(root.id,0);
}
function statsPage(){
 quantityScope=reportScope(quantityScope);
 const tabs=[['calendar','カレンダー'],['graph','グラフ']];
 const calendar=statsTab==='calendar';
 const start=shiftDate(today,1-statsWeeks*7);
 const panel=calendar ? calendarPage()+calendarModeChart() : `
  <form class="stats-analysis-filters" aria-label="分析条件">
   <label>分析する期間<span><input name="stats-weeks" type="number" min="1" max="520" step="1" required value="${statsWeeks}">週間</span></label>
   <label>分析する項目<select name="stats-scope">${analysisOptions()}</select></label>
   <button class="primary" type="submit">分析する</button>
  </form>
  ${analysisChart(state,{start,end:today,scope:quantityScope})}`;
 return `<section class="statistics-workspace weekly-workspace stats-dashboard">
  <div class="statistics-toolbar"><div class="statistics-tabs" role="group" aria-label="統計の表示">
   ${tabs.map(([id,label])=>`<button type="button" aria-pressed="${statsTab===id}" data-stat-tab="${id}">${label}</button>`).join('')}
  </div></div>
  <div class="statistics-content ${calendar?'calendar-content':'quantity-content'}">${panel}</div>
 </section>`;
}
const hierarchyMarks=['◎','◉','✦','●','◌'];
function hierarchyTree(forStatistics){
 const root=state.nodes.find(n=>n.parentId===null);
 const activeId=forStatistics?(quantityScope==='all'?root.id:quantityScope):currentSpace().id;
 const activePath=new Set(nodePath(state,activeId).map(n=>n.id));
 const children=new Map();
 for(const node of state.nodes){
  const parent=node.parentId;
  if(!parent)continue;
  if(!children.has(parent))children.set(parent,[]);
  children.get(parent).push(node);
 }
 for(const siblings of children.values())siblings.sort((a,b)=>(a.order||0)-(b.order||0));
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
     <span class="hierarchy-mark" aria-hidden="true">${hierarchyMarks[level]}</span>
     <span class="hierarchy-level">${LEVELS[level]}</span>
     <span class="hierarchy-name">${esc(name)}${task?`<small>${isEventTask(setting(state,node.id))?'イベント':'タスク'}</small>`:''}</span>
     ${current?'<span class="hierarchy-current" aria-hidden="true">✓</span>':''}
    </button>
    ${nested.length?`<button class="hierarchy-expand" data-map-expand aria-expanded="${expanded}" aria-label="${esc(name)}の下位目標を表示"><span aria-hidden="true">${expanded?'⌄':'›'}</span><small aria-hidden="true">${nested.length}</small></button>`:''}
   </div>
   ${nested.length?`<ul class="hierarchy-children" ${expanded?'':'hidden'}>${nested.map(child=>branch(child,depth+1)).join('')}</ul>`:''}
  </li>`;
 }
 return `<ul class="hierarchy-tree" aria-label="${forStatistics?'目標の階層図':'宇宙の階層図'}">${branch(root,0)}</ul>`;
}
function showHierarchy(forStatistics){
 modal(`<div class="dialog-title"><h2>${forStatistics?'表示する目標':'宇宙の地図'}</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <p class="hierarchy-hint">${forStatistics?'右の矢印で枝を開き、集計する目標を選びます。':'右の矢印で枝を開き、行きたい天体を選びます。'}</p>
  <div class="hierarchy-legend" aria-label="宇宙の階層">${LEVELS.map((level,index)=>`<span data-level="${index}"><i aria-hidden="true">${hierarchyMarks[index]}</i>${level}</span>`).join('<b aria-hidden="true">›</b>')}</div>
  ${hierarchyTree(forStatistics)}`);
 $('#dialog .hierarchy-pick[aria-current]')?.scrollIntoView({block:'nearest'});
}

function selectedMapNode(){
 return state.nodes.find(node=>node.id===mapSelection)||state.nodes.find(node=>node.parentId===null);
}
function mapActions(){
 const node=selectedMapNode();
 return `<div class="mind-map-tools">
  ${nodeKind(state,node.id)==='action'?`<button data-space-detail="${esc(node.id)}">タスクの詳細</button>`:''}
  <button data-space-stats="${esc(node.id)}">レポートを見る</button>
  <button data-map-edit-mode aria-pressed="${mapEditing}">${mapEditing?'編集を終了':'編集'}</button>
 </div>`;
}
function personalMap(){
 const selected=selectedMapNode(),path=nodePath(state,selected.id),root=path[0];
 const galaxies=visibleChildren(state,root.id);
 const branchRoot=path[1];
 const tone=galaxies.findIndex(node=>node.id===branchRoot?.id)%4;
 const card=(node,depth,style='',overview=false)=>{
  const task=nodeKind(state,node.id)==='action',level=Math.min(depth,LEVELS.length-1);
  const label=task?(isEventTask(setting(state,node.id))?'イベント':'タスク'):'';
  return `<button class="map-node ${style}" data-map-select="${esc(node.id)}" ${node.id===selected.id?'aria-current="true"':''}
    ${overview?`aria-expanded="${node.id===branchRoot?.id}" aria-controls="home-map-branch"`:''}>
    <span aria-hidden="true">${hierarchyMarks[level]}</span>
    <span>${label?`<small>${label}</small>`:''}<strong>${esc(node.name)}</strong></span>
  </button>
  ${mapEditing?`<div class="map-inline-tools">
    <button data-edit="${esc(node.id)}" aria-label="${esc(node.name)}を編集">編集</button>
    ${depth<LEVELS.length-1&&!task?`<button data-space-add="${esc(node.id)}" aria-label="${esc(node.name)}に目標やタスクを追加">＋</button>`:''}
  </div>`:''}`;
 };
 const overview=mapDiagram(card(root,0,'map-root'),galaxies.map((node,index)=>({
  tone:index%4,card:card(node,1,'',true)
 })),{radial:true,label:'マインドマップ全体'});
 if(!branchRoot)return overview+'<div id="home-map-branch" hidden></div>';
 function branch(node,depth){
  const children=visibleChildren(state,node.id);
  const kind=nodeKind(state,node.id)==='action'?'task':'goal';
  return `<li class="map-branch-${kind}">
   ${card(node,depth,'map-branch-row')}
   ${children.length?`<ul>${children.map(child=>branch(child,depth+1)).join('')}</ul>`:''}
  </li>`;
 }
 const children=visibleChildren(state,branchRoot.id);
 return `${overview}<section id="home-map-branch" class="map-subview map-galaxy-view" aria-labelledby="home-map-branch-name" data-map-tone="${tone}">
  <header class="map-branch-header"><span aria-hidden="true">◉</span><h2 id="home-map-branch-name">${esc(branchRoot.name)}</h2></header>
  ${children.length?`<ul class="map-galaxy-tree">${children.map(node=>branch(node,2)).join('')}</ul>`:
   '<p class="map-galaxy-empty">まだ下位の目標やタスクはありません。</p>'}
 </section>`;
}
function mindMapPage(){
 const recorded=Boolean(state.records[today]?.mode);
 const growth=universeGrowth(state,today);
 return `<section class="mind-map" aria-labelledby="mind-map-title">
  <div class="home-universe">
   <div class="home-universe-art" role="img" aria-label="記録とともに育つ自分の星">${planetArt(growth.days)}</div>
   ${growth.days?`<span class="home-universe-days">これまでに ${growth.days} 日記録</span>`:''}
  </div>
  ${recorded?'':`<section class="mind-map-mode" aria-label="今日のモード">
   <h2>今日のモード</h2>
   <div class="map-mode-buttons">${['full','busy','rest'].map(key=>`<button data-mode="${key}" data-date="${today}"><span aria-hidden="true">${MODES[key].icon}</span> ${MODES[key].label}</button>`).join('')}</div>
  </section>`}
  <header class="mind-map-header"><h1 id="mind-map-title">マインドマップ</h1></header>
  <div class="mind-map-scroll">${personalMap()}</div>
  <footer class="mind-map-footer">${mapActions()}</footer>
 </section>`;
}

async function absorbModeButton(button) {
 const section=button.closest('.mind-map-mode');
 const planet=$('.home-universe-art .planet-globe');
 if(!section||!planet||matchMedia('(prefers-reduced-motion: reduce)').matches||!button.animate)return;
 const rect=button.getBoundingClientRect(),target=planet.getBoundingClientRect();
 const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 const dx=target.left+target.width/2-x,dy=target.top+target.height/2-y;
 const light=document.createElement('span');
 light.className='mode-absorption-light';
 light.setAttribute('aria-hidden','true');
 light.style.left=x+'px';
 light.style.top=y+'px';
 document.body.append(light);
 section.classList.add('is-absorbing');
 section.inert=true;
 try {
  await light.animate([
   {transform:'translate(-50%, -50%) scale(.5)',opacity:0},
   {transform:'translate(-50%, -50%) scale(1)',opacity:1,offset:.13},
   {transform:`translate(calc(-50% + ${dx*.35+32}px), calc(-50% + ${dy*.7}px)) scale(.85)`,opacity:1,offset:.62},
   {transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.1)`,opacity:0}
  ],{duration:440,easing:'ease-in'}).finished;
  await planet.animate([{filter:'brightness(1.8)'},{filter:'brightness(1)'}],{duration:160}).finished;
 } finally { light.remove(); }
}

async function recordModeChoice(button) {
 const {date,mode}=button.dataset;
 const previous=structuredClone(state);
 let count;
 try {
  count=applyMode(state,date,mode,today);
  if(!save()){state=previous;return}
 } catch(error) {
  state=previous;
  toast(error.message);
  return;
 }
 try { await absorbModeButton(button); } catch {}
 if(!button.isConnected)return;
 render();
 close();
 toast(count?`${count}個のタスクの固定量を反映しました`:'モードを保存しました');
}
function openMindMap(){
 if(guideSession||navigating)return;
 mapSelection=null;
 view='tree';
 if(location.hash!=='#tree')location.hash='tree';
 render();
 $('.mind-map [aria-current]')?.scrollIntoView({block:'nearest'});
}
function selectMapNode(button){
 const scroll=$('.mind-map-scroll');
 const fromOverview=button.closest('.map-diagram-overview');
 const wasExpanded=button.getAttribute('aria-expanded')==='true';
 const nodeId=button.dataset.mapSelect;
 mapSelection=wasExpanded?null:nodeId;
 const scrollTop=scroll.scrollTop;
 scroll.innerHTML=personalMap();
 $('.mind-map-footer').innerHTML=mapActions();
 scroll.scrollTop=scrollTop;
 const cards=Array.from(scroll.querySelectorAll('.map-node[data-map-select]'));
 cards.find(card=>card.dataset.mapSelect===nodeId)?.focus({preventScroll:true});
 if(fromOverview&&!wasExpanded){
  const heading=scroll.querySelector('#home-map-branch-name');
  heading?.scrollIntoView({block:'nearest'});
 }
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
function readExtraAmounts(data){
 return data.getAll('record-extra').map(value=>value===''?null:Number(value));
}
function refreshTodayMode(){if(state.records[today]?.mode)applyMode(state,today,state.records[today].mode,today)}
function chooseLeaf(key){const available=leaves(state).filter(n=>nodeKind(state,n.id)==='action'&&!isEventTask(setting(state,n.id))).filter(n=>statsTab==='calendar'||quantityScope==='all'||descendants(state,quantityScope).has(n.id));modal(`<div class="dialog-title"><h2>タスクを選ぶ</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="record-leaf-picker">${available.map(n=>`<button data-record-leaf="${esc(n.id)}" data-log-date="${key}"><span>♧</span>${esc(n.name)}<i>＋</i></button>`).join('')||'<p class="muted">この目標にはタスクがありません。</p>'}</div>`)}
let addParent=null,creationDraft=null;
function chooseCreationType(parent){addParent=parent;const depth=nodeDepth(state,parent)+1;if(depth>4){toast('目標は宇宙から衛星までの5階層です');return}const label=LEVELS[depth];modal(`<div class="dialog-title"><h2>${label}を追加</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="creation-type-options"><button data-create-kind="goal"><span class="creation-type-icon">✧</span><strong>目標</strong><small>達成したいこと。<br>あとから細かく分解できます。</small><span class="creation-type-arrow">→</span></button><button data-create-kind="action"><span class="creation-type-icon">✓</span><strong>タスク</strong><small>目標に向けて取り組む行動。</small><span class="creation-type-arrow">→</span></button></div>`)}

function editor(id,creationKind=null){const isNew=id==='new',parent=addParent||currentSpace().id,n=isNew?{name:'',description:'',parentId:parent}:state.nodes.find(n=>n.id===id);if(!n)return;if(isNew&&!['goal','action'].includes(creationKind)){chooseCreationType(parent);return}const a=setting(state,id),isRoot=!isNew&&!n.parentId,blocked=isNew?new Set():descendants(state,id),hasChildren=!isNew&&visibleChildren(state,id).length>0,kind=isNew?creationKind:nodeKind(state,id),depth=isNew?nodeDepth(state,parent)+1:nodeDepth(state,id);if(isNew&&depth>4){toast('目標は宇宙から衛星までの5階層です');return}modal(`<form id="node-form" data-id="${esc(id)}"><div class="dialog-title"><div><div class="eyebrow">${LEVELS[Math.min(depth,4)]}</div><h2>${isNew?(kind==='action'?'タスクを設定':'目標を設定'):isRoot?'宇宙を編集':'目標・タスクを編集'}</h2></div><button type="button" data-do="close" class="round-button" aria-label="閉じる">×</button></div>${isNew?`<input type="hidden" name="node-kind" value="${kind}"><button type="button" class="creation-type-back" data-create-back>← タイプを選び直す</button>`:!isRoot?`<fieldset class="goal-kind-picker"><legend>目標／タスク</legend><label><input type="radio" name="node-kind" value="goal" ${kind==='goal'?'checked':''} required><span><strong>目標</strong><small>さらに分解していくもの</small></span></label><label><input type="radio" name="node-kind" value="action" ${kind==='action'?'checked':''} ${hasChildren?'disabled':''} required><span><strong>タスク</strong><small>実際に取り組むタスク</small></span></label></fieldset>`:''}<label>名前<input autofocus required maxlength="80" name="name" value="${esc(n.name)}" placeholder="目指したいことを、自分の言葉で"></label><label><span data-purpose-label>${kind==='action'?'このタスクにした理由':'この目標にした目的'}</span><textarea name="description" required maxlength="1000" rows="2" placeholder="取り組む理由を、自分の言葉で">${esc(n.description||'')}</textarea></label>${!isRoot?`<input type="hidden" name="parent" value="${esc(n.parentId)}"><div class="goal-parent-context"><span>つながる${LEVELS[Math.min(4,nodeDepth(state,n.parentId))]||'上位目標'}</span><strong>${esc(state.nodes.find(p=>p.id===n.parentId)?.name||'')}</strong></div>`:''}<fieldset class="goal-action-fields" ${kind==='action'?'':'hidden disabled'}>${taskSettingsFields(state,id)}</fieldset>${depth===1?`<details class="cosmic-advanced-settings"><summary>詳細設定</summary><label>ブラックホールの名前<input name="symbol-name" maxlength="80" value="${esc(n.symbolName||n.name)}" placeholder="省略すると銀河名になります"></label></details>`:''}${hasChildren?'<p class="footnote">下位目標があるため、目標として扱います。</p>':''}<div class="dialog-actions">${!isNew&&!isRoot?`<button type="button" class="danger text-button" data-delete="${esc(id)}">削除</button>`:''}${!isNew?`<button type="button" class="text-button" data-space-stats="${esc(id)}">統計を見る</button>`:''}<button class="primary" type="submit">${isNew?'誕生させる':'保存する'}</button></div></form>`);if(isNew&&creationDraft){
 const form=$('#node-form');
 for(const [key,value] of Object.entries(creationDraft)){
  if(key==='node-kind'||key==='extras')continue;
  const input=form.elements.namedItem(key);
  if(input&&input.type!=='radio')input.value=value;
 }
 const list=form.querySelector('[data-extra-list]');
 if(list)list.innerHTML=(creationDraft.extras||[]).map(metric=>extraMetricFields(metric)).join('');
}}
function review(){const ws=weekStart(today),end=shiftDate(ws,6),s=stats(state,ws,end),r=state.reviews[ws]||{},effective=shiftDate(ws,7);modal(`<form id="review-form"><div class="dialog-title"><div><div class="eyebrow">WEEKLY REFLECTION</div><h2>今週の自分と、話そう。</h2></div><button type="button" data-do="close" class="round-button" aria-label="閉じる">×</button></div><p class="muted">${ws.replaceAll('-','/')} — ${end.replaceAll('-','/')}</p><div class="review-summary">${Object.entries(s.counts).map(([k,c])=>`<div><span style="color:${MODES[k].color}">${MODES[k].icon}</span><strong>${c}日</strong><small>${MODES[k].label}</small></div>`).join('')}</div><h3>今週、取り組んだタスク</h3><p class="muted">${s.logs.length} 回の実行記録</p>${Object.entries(s.logs.reduce((o,l)=>(o[l.name]=(o[l.name]||0)+1,o),{})).map(([n,c])=>`<p class="review-log">♧ ${esc(n)} <b>${c}回</b></p>`).join('')}<label>無理があったこと・気づいたこと<textarea name="note" rows="3" placeholder="今週の自分に、どんな言葉をかけたい？">${esc(r.note||'')}</textarea></label><label>来週、大切にしたいこと<textarea name="next" rows="2" placeholder="小さく、具体的な一歩を書いてみよう。">${esc(r.next||'')}</textarea></label><h3>来週のタスクプラン</h3><p class="footnote">${effective.replaceAll('-','/')}（月）から反映。過去の記録はそのまま残ります。</p>${leaves(state).filter(n=>nodeKind(state,n.id)==='action').map(n=>{const a=state.pending.find(p=>p.id===n.id&&p.effective===effective)?.setting||setting(state,n.id);return `<fieldset class="review-setting" data-review-node="${esc(n.id)}"><legend>${esc(n.name)}</legend>${taskLevelFields(a,'review-level-'+n.id)}</fieldset>`}).join('')}<div class="dialog-actions"><button class="primary">レビューを保存</button></div></form>`)}
function switchDemo(enabled){const url=new URL(location.href);if(enabled)url.searchParams.set('demo','1');else url.searchParams.delete('demo');url.searchParams.delete('preview');location.assign(url)}
function settings(){modal(`<div class="dialog-title"><div><div class="eyebrow">YOUR OWN UNIVERSE</div><h2>設定・バックアップ</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${account?`<div class="account-info"><div class="account-profile-photo">${accountAvatar()}</div><strong>${esc(account.name)}</strong><p>${esc(account.email)}</p>${!account.picture?'<a class="text-button" href="/api/auth/google">Googleのプロフィール画像を取得</a>':''}<form method="post" action="/api/auth/logout" data-native-submit><button class="text-button" type="submit">ログアウト</button></form></div>`:''}<p>データはこの端末・ブラウザ内に保存されます。端末間での同期はありません。ブラウザのデータを消す前にバックアップしてください。</p><button class="text-button" data-do="open-demo">検証用の宇宙を開く →</button><br><button class="text-button" data-do="preview-onboarding">初めて開いたときの画面を見る →</button><br><button class="text-button" data-do="review">今週を振り返る →</button><div class="settings-actions"><button class="primary" data-do="export">↓ バックアップを書き出す</button><label class="import-button">↑ バックアップを読み込む<input type="file" id="import" accept="application/json,.json"></label></div><p class="footnote">読み込み時は現在のデータを置き換えます。先に現在のバックアップを保存することをおすすめします。日付は日本時間、週の始まりは月曜日です。</p><hr><p class="muted">Jiku v1.0 · 自分の軸を、日々のタスクへ。</p>`)}
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-do],[data-view],[data-day],[data-focus],[data-map-back]');if(!b)return;const d=b.dataset;
 if(d.guide==='dismiss'){dismissGuide();return}
 if(b.hasAttribute('data-map-exit')){endMapPreview();return}
 if(b.hasAttribute('data-map-back')||d.view==='tree'){e.preventDefault();openMindMap();return}
 if(d.mapSelect){selectMapNode(b);return}
 if(b.hasAttribute('data-map-edit-mode')){
  mapEditing=!mapEditing;
  render();
  $('[data-map-edit-mode]')?.focus({preventScroll:true});
  $('.mind-map [aria-current]')?.scrollIntoView({block:'nearest'});
  return;
 }
 if(d.do==='open-scenery'){openScenery();return}
 if(d.do==='close-scenery'){closeScenery();return}
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
  list.insertAdjacentHTML('beforeend',extraMetricFields({},form.elements.namedItem('task-format')?.value==='event'));
  list.lastElementChild.querySelector('select').focus();
  return;
 }
 if(b.hasAttribute('data-remove-extra')){b.closest('[data-extra-metric]').remove();return}
 if(d.spaceEnter){enterSpace(d.spaceEnter);return}if(d.spaceGo){close();enterSpace(d.spaceGo);return}if(d.legacyDetail){legacyDetail(d.legacyDetail);return}if(d.spaceAdd){creationDraft=null;chooseCreationType(d.spaceAdd);return}if(d.createKind){editor('new',d.createKind);return}if(b.hasAttribute('data-create-back')){const form=b.closest('form');creationDraft={...creationDraft,...Object.fromEntries(new FormData(form)),extras:readExtraSettings(form)};chooseCreationType(addParent||currentSpace().id);return}if(d.spaceDetail){spaceDetail(d.spaceDetail);return}if(d.spaceStats){quantityScope=d.spaceStats;statsTab='graph';view='stats';location.hash='stats';close();render();return}if(d.spaceReorder){reorderNode(state,d.spaceReorder,Number(d.direction));save();render();spaceList();return}if(d.openPreset)openPreset(d.openPreset);if(b.hasAttribute('data-configure-leaves')){close();view='tree';location.hash='tree';render();toast('タスクを押して、タスクの固定量を設定してください')}if(d.recordLeaf)leafPanel(d.recordLeaf,d.logDate||today);if(d.pickLeaf)chooseLeaf(d.pickLeaf);if(d.quantityDay)dayEditor(d.quantityDay);if(d.addQuantity){const input=$('#quantity-form [name=record-minutes]');if(input)input.value=String(Math.round(((Number(input.value)||0)+Number(d.addQuantity))*1000000)/1000000)}if(d.removeQuantity){modal(`<h2>この日の量の記録を削除しますか？</h2><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button class="primary danger-bg" data-confirm-remove-quantity="${esc(d.removeQuantity)}" data-log-date="${d.logDate}">削除する</button></div>`)}if(d.confirmRemoveQuantity){removeQuantity(state,d.logDate,d.confirmRemoveQuantity);save();close();render();toast('この日の記録を削除しました')}if(b.hasAttribute('data-scroll-tree')){$('#goal-tree')?.scrollIntoView({behavior:'smooth',block:'start'})}if(d.statTab){
  statsTab=d.statTab;
  render();
  $(`[data-stat-tab="${statsTab}"]`)?.focus({preventScroll:true});
  return;
 }if(d.view){if(d.view==='stats')statsTab='calendar';view=d.view;location.hash=view;render();window.scrollTo(0,0)}if(d.mode){void recordModeChoice(b);return}if(d.check){const n=state.nodes.find(n=>n.id===d.check);if(n){toggleLog(state,d.date,n);save();render()}}if(d.edit){addParent=null;editor(d.edit);if(b.hasAttribute('data-quantity-settings'))$('#node-form [name=quantity-unit]')?.focus()}if(d.selectDate){selected=d.selectDate;render();dayEditor(selected)}if(d.day){selected=d.day;month=selected.slice(0,7);view='stats';statsTab='calendar';render()}if(d.month){month=boundedMonth(month,Number(d.month),today);render()}if(d.focus){focus=d.focus;treeView=null;treeScene?.dispose();treeScene=null;zoom=1;pan={x:0,y:0};close();render()}if(d.delete){const id=d.delete,n=state.nodes.find(n=>n.id===id),count=descendants(state,id).size;modal(`<h2>「${esc(n.name)}」を削除しますか？</h2><p>子孫を含め ${count} 個の目標を削除します。過去の実行記録は残ります。</p><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button class="primary danger-bg" data-confirm-delete="${esc(id)}">削除する</button></div>`)}if(d.confirmDelete){deleteNode(state,d.confirmDelete);focus=null;treeScene?.dispose();treeScene=null;treeView=null;save();close();render();toast('目標を削除しました')}if(d.do)({close,settings,review,'open-demo':()=>switchDemo(true),'exit-demo':()=>switchDemo(false),'test-demo-mode':modePicker,'space-map':()=>showHierarchy(false),'preview-onboarding':previewOnboarding,'space-list':spaceList,'quick-actions':()=>chooseLeaf(today),'today-mode':modePicker,'labels':()=>{showGoalLabels=!showGoalLabels;applyLabelVisibility();b.setAttribute('aria-pressed',String(showGoalLabels))},'zoom-in':()=>{if(treeScene)treeScene.zoom(1.25);else{zoom=Math.min(2.5,zoom+.2);render()}},'zoom-out':()=>{if(treeScene)treeScene.zoom(.8);else{zoom=Math.max(.4,zoom-.2);render()}},'reset-tree':()=>{if(focus){focus=null;treeScene?.dispose();treeScene=null;treeView=null;render()}else if(treeScene)treeScene.reset();else{zoom=1;pan={x:0,y:0};render()}},today:()=>{month=today.slice(0,7);selected=today;render()},'clear-record':()=>{clearMode(state,selected);save();render();close();toast('モードを未記録に戻しました')},export:()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`jiku-${demoMode?'demo':'backup'}-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}[d.do])?.()});
let lastTitleTap;
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!$('.space-vista')?.hidden)closeScenery();
});
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
document.addEventListener('submit',e=>{if(e.target.hasAttribute('data-native-submit'))return;e.preventDefault();
 if(e.target.matches('.stats-analysis-filters')){
  const filters=new FormData(e.target);
  statsWeeks=Number(filters.get('stats-weeks'));
  quantityScope=reportScope(filters.get('stats-scope'));
  render();
  $('.stats-analysis-filters button')?.focus({preventScroll:true});
  return;
 }
 if(e.target.id==='node-form'){const f=new FormData(e.target),id=e.target.dataset.id,previous=structuredClone(state);try{const kind=f.get('node-kind')||'goal',newId=writeGoal(state,{id,name:f.get('name'),purpose:f.get('description'),parentId:id==='new'?(addParent||currentSpace().id):state.nodes.find(n=>n.id===id)?.parentId,kind,...(kind==='action'?readTaskSettings(e.target):{}),symbolName:f.has('symbol-name')?f.get('symbol-name'):undefined});refreshTodayMode();if(!save()){state=previous;return}if(id==='new')mapSelection=newId;close();render();if(id==='new')treeScene?.birth(newId);toast(id==='new'?(universeGrowth(previous,today).level===0&&universeGrowth(state,today).level>0?'最初の銀河が誕生し、宇宙に光が灯りました':'新しい天体が誕生しました'):'目標を更新しました')}catch(err){state=previous;toast(err.message)}}if(e.target.id==='preset-form'){
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
 }if(e.target.name==='extra-unit'){
 const custom=e.target.closest('[data-extra-metric]').querySelector('[data-extra-custom]');
 const input=custom.querySelector('input'),isCustom=e.target.value==='custom';
 custom.hidden=input.disabled=!isCustom;
 input.required=isCustom;
 }if(e.target.name==='record-date'&&validDateKey(e.target.value)&&e.target.value<=today){leafPanel(e.target.closest('form').dataset.id,e.target.value)}if(e.target.id==='import'&&e.target.files[0]){try{const f=e.target.files[0];if(f.size>10*1024*1024)throw Error('10MB以下のバックアップを選んでください');const next=validate(JSON.parse(await f.text()));modal(`<h2>バックアップを読み込みますか？</h2><p>${next.nodes.length} 個の目標を読み込み、現在のデータを置き換えます。</p><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button id="confirm-import" class="primary">置き換える</button></div>`);$('#confirm-import').onclick=()=>{state=migrateUniverse(next);onboardingScene?.dispose();onboardingScene=null;storageLocked=false;focus=null;applyPending(state,today);focus=null;save();close();render();toast('バックアップを読み込みました')}}catch(err){toast('読み込めませんでした：'+err.message)}}});
function bindTree(){const host=$('.universe-stage');if(!host)return;try{treeScene=createUniverse(host,{nodes:state.nodes,auraStrength:universeGrowth(state,today).strength,current:showUniverseOrigin()?UNIVERSE_ORIGIN:currentSpace().id,onSelect:id=>{if(!guideSession)openNode(id)},onZoom:value=>{const label=$('[data-zoom-label]');if(label)label.textContent=value+'%'}})}catch(error){if(showUniverseOrigin()){host.innerHTML=`<button class="universe-origin-fallback" style="--fallback-growth:${universeGrowth(state,today).strength}" data-space-enter="${esc(currentSpace().id)}" aria-label="宇宙に入る"></button>`;return}host.innerHTML=`<div class="universe-fallback"><p>この端末では、目標一覧で宇宙を探索できます。</p>${visibleChildren(state,currentSpace().id).map(n=>`<button data-space-enter="${esc(n.id)}">✧ ${esc(n.name)} →</button>`).join('')}</div>`}}
function applyLabelVisibility(){}
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
window.addEventListener('hashchange',()=>{const raw=location.hash.slice(1),h=raw==='home'?'tree':raw==='calendar'?'stats':raw;if(raw==='calendar'||(h==='stats'&&view!=='stats'))statsTab='calendar';if(names[h]&&(view!==h||raw==='calendar')){view=h;render()}});window.addEventListener('focus',()=>{if(dateKey()!==today)render()});if(names[location.hash.slice(1)])view=location.hash.slice(1);if(location.hash==='#home')history.replaceState(null,'','#tree');if(location.hash==='#calendar'){view='stats';statsTab='calendar';history.replaceState(null,'','#stats')}if(new URLSearchParams(location.search).get('preview')==='guide')startGuide(true);
else if(!onboardingPreview&&!storageLocked&&!needsLegacyImport&&state.universe?.firstSteps)startGuide();
if(authReturn&&guestHandoff?.step==='login'&&guestHandoff.map&&!storageLocked){
 try{
  await commitUniverseBirth(guestHandoff.map);
  needsLegacyImport=false;
  finishOnboardingReturn();
 }catch{
  onboardingResume={...guestHandoff,step:'arrival'};
  setTimeout(()=>toast('宇宙を保存できませんでした。もう一度お試しください。'),0);
 }
}
render();if(!onboardingPreview&&!guideSession&&needsLegacyImport&&!guestHandoff?.map)offerLegacyImport();

function offerLegacyImport(){modal(`<div class="dialog-title"><h2>以前の記録を引き継ぎますか？</h2></div><p>このブラウザでGoogleログイン前に使っていた記録が残っています。現在ログインしているあなたのアカウントへコピーできます。</p><p class="footnote">元の記録はそのまま残ります。</p><div class="dialog-actions"><button class="text-button" data-do="close">新しく始める</button><button id="copy-legacy" class="primary">記録を引き継ぐ</button></div>`);$('#copy-legacy').onclick=()=>{try{const old=localStorage.getItem('jiku-v1');localStorage.setItem(storageKey+':before-universe',old);state=migrateUniverse(validate(JSON.parse(old)));finishOnboardingReturn();onboardingScene?.dispose();onboardingScene=null;applyPending(state,today);save();close();render();toast('以前の記録を引き継ぎました')}catch{toast('以前の記録を読み込めませんでした。バックアップから読み込んでください。')}}}
