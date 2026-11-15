import {facilityCosts,storageHours,starFriends,starWorldSnapshot,developStar} from './star-world.js';
import {planningPrompt,jsonTemplate,previewMapImport} from './map-import.js';
import {createBirthMusic} from './birth-music.js?v=3';
import {mountOnboarding,onboardingDraft,pendingUniverse,clearPendingUniverse,resumeGuestDraft,saveGuestDraft,planetArt} from './onboarding.js';
import {createExampleDraft, exampleMap} from './example-map.js';
import {mapDiagram} from './mind-map.js';
import {createDemoUniverse} from './demo.js';
import {taskSettingsFields,extraMetricFields,eventPanel,modePickerContent,recordPanel,weeklyPanel,analysisChart,analysisPeriodLabel,numberText,hoursText} from './quantity-view.js';
import {createUniverse} from './universe.js';
import {UNIVERSE_ORIGIN,LEVELS,nodePath,nodeDepth,visibleChildren,canPlace,freshUniverse,migrateUniverse,completeUniverse,reorderNode,writeGoal,boundedMonth,universeGrowth,featureDays,featureProgress,canConfirmMap} from './universe-model.js';
import {MODES,dateKey,shiftDate,weekStart,seed,leaves,descendants,moveNode,deleteNode,setting,applyPending,plan,toggleLog,ancestry,stats,validate,measurement,unitInfo,setTaskRecord,removeQuantity,quantitySummary,validDateKey,paceForDeadline,applyMode,clearMode,modesForLevel,nodeKind,recordMode,modeDistribution,isEventTask,eventCompletionDate,recordEventCompletion,undoEventCompletion,catchupTasks,saveCatchupPromise,saveEveningPlan,completeEveningPlan,modeItems} from './model.js';
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
const reminderPreferenceKey=personalStorageKey+':reminder-times';
const morningSelectionKey=storageKey+':morning-task';
const endTimeLabels=Object.freeze({student:'授業や学校の予定は、普段何時ごろ終わりますか？',worker:'仕事は、普段何時ごろ終わりますか？',other:'日中の予定は、普段何時ごろ終わりますか？'});
let needsLegacyImport=false,storageLocked=false;let state;try{const raw=guest&&!demoMode?null:localStorage.getItem(storageKey);needsLegacyImport=!demoMode&&!!account&&!raw&&!!localStorage.getItem('jiku-v1');state=raw?validate(JSON.parse(raw)):(demoMode?createDemoUniverse(dateKey()):freshUniverse());if(raw&&!state.universe){localStorage.setItem(storageKey+':before-universe',raw);state=migrateUniverse(state)}}catch{storageLocked=true;state=state||freshUniverse();setTimeout(()=>toast('保存データを保護しています。設定からバックアップを確認してください。'),300)}
if(demoMode)state.universe.mapConfirmed=true;
let treeScene=null,treeView=null,showGoalLabels=true,statsTab='calendar',statsWeeks=4,quantityScope='all',analysisStarted=false;
let view='tree',today=dateKey(),selected=today,month=today.slice(0,7),focus=null,zoom=1,pan={x:0,y:0};
let guideSession=null,guideTimer,mapPreviewReturn=null,onboardingResume=null;
let mapSelection=null,mapEditing=false;
let starWorldTimer;
function save(){if(guideSession||mapPreviewReturn||(guest&&!demoMode))return true;if(storageLocked){toast('元の保存データを保護しています。バックアップを確認してください。');return false}try{localStorage.setItem(storageKey,JSON.stringify(state));return true}catch{toast('保存できませんでした。設定からバックアップを保存してください。');return false}}
const icon=name=>({tree:'✧',stats:'◴',projects:'☄',catchup:'↗'}[name]);
const names={tree:'ホーム',stats:'統計',projects:'プロジェクト',catchup:'遅れを取り戻す'};
function featureUnlocked(feature){
 const {confirmed,days}=featureProgress(state,today);
 return confirmed&&days>=featureDays[feature];
}
function explainFeatureLock(feature){
 const {confirmed,days}=featureProgress(state,today);
 const label=feature==='gacha'?'宇宙エネルギーのガチャ':names[feature];
 toast(confirmed?`${label}はあと${Math.max(0,featureDays[feature]-days)}日の記録で解放されます。`:
  'ホームでマインドマップを確認し、「この内容で始める」を押してください。');
}
const appAudio=createBirthMusic();
let appAudioOn=false,appAudioChanging=false;
let inUnderworld=false,underworldAudioStarted=false;
function syncAudioButton(){
 const button=$('[data-do="app-audio"]');
 button?.setAttribute('aria-pressed',String(appAudioOn));
 if(button)button.textContent=appAudioOn?'♪':'♫';
}
async function toggleAppAudio(){
 if(!appAudio||appAudioChanging)return;
 appAudioChanging=true;
 try{
  appAudioOn=await appAudio.toggle();
  syncAudioButton();
 }finally{appAudioChanging=false;}
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
const splitSizes={analysis:33,editor:33};
const splitMin=20,splitMax=75;
function panelDivider(kind,label,controls){
 return `<div class="panel-divider" data-panel-divider="${kind}" role="separator" tabindex="0"
  aria-label="${label}" aria-orientation="horizontal" aria-controls="${controls}"
  aria-valuemin="${splitMin}" aria-valuemax="${splitMax}" aria-valuenow="${splitSizes[kind]}"></div>`;
}
function bindPanelDivider(divider){
 if(!divider)return;
 const kind=divider.dataset.panelDivider;
 const layout=divider.parentElement;
 const setSize=value=>{
  const size=Math.round(Math.max(splitMin,Math.min(splitMax,value)));
  splitSizes[kind]=size;
  layout.style.setProperty('--map-share',size+'fr');
  layout.style.setProperty('--detail-share',(100-size)+'fr');
  divider.setAttribute('aria-valuenow',size);
  divider.setAttribute('aria-valuetext','マインドマップの高さ '+size+'%');
 };
 setSize(splitSizes[kind]);
 let drag=null;
 divider.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag)return;
  const height=layout.firstElementChild.offsetHeight+layout.lastElementChild.offsetHeight;
  if(!height)return;
  drag={id:event.pointerId,y:event.clientY,height,size:splitSizes[kind]};
  divider.setPointerCapture(event.pointerId);
  divider.focus({preventScroll:true});
 });
 divider.addEventListener('pointermove',event=>{
  if(drag?.id===event.pointerId)setSize(drag.size+(event.clientY-drag.y)*100/drag.height);
 });
 divider.addEventListener('lostpointercapture',()=>{drag=null;});
 divider.addEventListener('keydown',event=>{
  const values={ArrowUp:splitSizes[kind]-5,ArrowDown:splitSizes[kind]+5,Home:splitMin,End:splitMax};
  if(!Object.hasOwn(values,event.key))return;
  event.preventDefault();
  setSize(values[event.key]);
 });
}
function modal(html,{mapId=null,addition=null}={}){
 const dialog=$('#dialog');
 dialog.classList.toggle('map-editor-dialog',Boolean(mapId));
 dialog.innerHTML=mapId?`<div class="map-editor-topbar">
  <button type="button" class="text-button map-edit-exit" data-do="close">← 編集を閉じる</button>
 </div><div class="map-editor-layout">
  <section class="map-editor-preview" id="editor-map-pane" aria-label="編集中のマインドマップ"
   ${addition?`data-add-parent="${esc(mapId)}" data-add-kind="${esc(addition)}"`:''}>${personalMap({selection:mapId,preview:true,addition:addition&&{parent:mapId,kind:addition}})}</section>
  ${panelDivider('editor','マインドマップと編集欄の高さを調節','editor-map-pane editor-fields-pane')}
  <section class="map-editor-fields" id="editor-fields-pane">${html}</section>
 </div>`:html;
 if(!dialog.open)dialog.showModal();
 if(mapId){
  bindPanelDivider(dialog.querySelector('[data-panel-divider="editor"]'));
  const preview=dialog.querySelector('.map-editor-preview');
  const card=preview.querySelector('.map-insertion')||preview.querySelector('[aria-current="true"]');
  if(card)preview.scrollTop=Math.max(0,card.getBoundingClientRect().top-preview.getBoundingClientRect().top-16);
 }else dialog.querySelector('[autofocus]')?.focus();
}
function close(){$('#dialog').close()}
function heading(k,title,sub,extra=''){return `<div class="page-heading"><div><div class="eyebrow">${k}</div><h1>${title}</h1><p>${sub}</p></div>${extra}</div>`}
function accountAvatar(){const picture=account?.picture;return `<span class="google-account-fallback" aria-hidden="true">G</span>${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer" data-account-photo>`:''}`}
function render(){clearTimeout(guideTimer);clearInterval(starWorldTimer);
 const birthActive=onboardingScene||onboardingPreview||
 (guest&&!demoMode&&!guideSession&&!mapPreviewReturn)||(!storageLocked&&!state.universe?.onboarded);
 document.body.classList.toggle('birth-active',Boolean(birthActive));
 if(birthActive){if(appAudioOn&&!appAudioChanging)void toggleAppAudio();if(treeScene){treeScene.dispose();treeScene=null}if(!onboardingScene)showOnboarding();return}
 if(treeScene){treeView=treeScene.getView();treeScene.dispose();treeScene=null}const latest=dateKey();if(today!==latest){today=latest;selected=today;applyPending(state,today);save()}
 if(!guideSession&&Object.hasOwn(featureDays,view)&&!featureUnlocked(view)){
  view='tree';
  const url=new URL(location.href);url.hash='tree';
  history.replaceState(null,'',url);
 }
 if(view!=='catchup'&&inUnderworld)leaveUnderworld();
 const progress=featureProgress(state,today);
 const editingHome=view==='tree'&&mapEditing&&!guideSession;
 const analyzing=view==='stats'&&statsTab==='graph'&&analysisStarted&&!guideSession;
 const page=guideSession?treePage():{tree:mindMapPage,stats:statsPage,projects:projectsPage,catchup:catchupPage,star:starWorldPage}[view]();
 $('#app').innerHTML=`<main class="workspace view-${view}${editingHome?' is-map-editing':''}${analyzing?' is-analyzing':''}"><header class="topbar">${editingHome?
 '<button type="button" class="text-button map-edit-exit" data-map-edit-mode>← 編集を閉じる</button>':
 '<a class="brand" href="#tree" data-map-back aria-label="Jiku ホーム">Jiku<span>●</span></a>'}${mapPreviewReturn?'<div class="demo-toolbar"><button data-map-exit>プレビューを終了</button></div>':guideSession?.preview?'<div class="demo-toolbar"><button data-guide="dismiss">'+(guideSession.draft?'案内をスキップ':'プレビューを終了')+'</button></div>':demoMode?'<div class="demo-toolbar"><span>サンプル</span><button data-do="test-demo-mode">モードを試す</button><button data-do="exit-demo">自分のデータへ ↗</button></div>':''}<div class="header-actions">${appAudio&&!guideSession?`<button class="app-audio" type="button" data-do="app-audio" aria-label="音楽と効果音" aria-pressed="${appAudioOn}" title="音楽と効果音">${appAudioOn?'♪':'♫'}</button>`:''}<button ${guideSession?'hidden':''} class="avatar" data-do="settings" aria-label="Googleアカウントと設定" title="Googleアカウントと設定">${accountAvatar()}</button></div></header><div class="content">${page}</div></main><nav class="bottom-nav" aria-label="メインメニュー" ${guideSession?'inert':''}>${Object.entries(names).map(([k,v])=>`<button class="nav ${view===k||(view==='star'&&k==='tree')?'active':''}" data-view="${k}" ${view===k?'aria-current="page"':''} ${k!=='tree'&&(!progress.confirmed||progress.days<featureDays[k])?'aria-disabled="true"':''}><span aria-hidden="true">${icon(k)}</span><strong>${v}</strong>${k!=='tree'&&(!progress.confirmed||progress.days<featureDays[k])?`<small>${featureDays[k]}日で解放</small>`:''}</button>`).join('')}</nav>`;bindTree();scheduleGuide();maybeAskReminderSetup();
 bindPanelDivider($('#app [data-panel-divider="analysis"]'));
 if(view==='star'&&!guideSession)starWorldTimer=setInterval(updateStarWorld,1000);
}
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
 openReminderLink();
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
function spaceDetail(id){const n=state.nodes.find(n=>n.id===id);if(!n)return;if(nodeKind(state,id)==='action'&&isEventTask(setting(state,id))){leafPanel(id);return}const hasChildren=visibleChildren(state,id).length>0,a=setting(state,id),m=measurement(state,id),level=a.modes.includes('rest')?'rest':a.modes.includes('busy')?'busy':'full';modal(`<div class="dialog-title"><div><div class="eyebrow">${esc(ancestry(state,id).slice(0,-1).join(' / '))}</div><h2>${esc(n.name)}</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${n.description?`<p class="space-description">${esc(n.description)}</p>`:''}${!hasChildren&&nodeKind(state,id)==='action'?`<div class="space-action-metadata"><span>${MODES[level].icon} ${MODES[level].label}から</span>${m.dailyAmount?`<span>固定量 ${numberText(m.dailyAmount)}${esc(unitInfo(m).label)}</span>`:''}</div>`:''}<div class="space-detail-links"><button data-edit="${esc(id)}">目標を編集 <span>→</span></button>${!hasChildren&&nodeKind(state,id)==='action'?`<button data-open-preset="${esc(id)}">固定量・モードを設定 <span>→</span></button>`:''}<button data-space-stats="${esc(id)}">この目標の統計 <span>→</span></button>${!hasChildren&&nodeKind(state,id)==='action'?`<button data-record-leaf="${esc(id)}">今日の記録を調整 <span>→</span></button>`:''}</div>`)}
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
  const day=i+1,key=`${calendarMonth}-${String(day).padStart(2,'0')}`,mode=recordMode(source,key),future=key>todayKey;
  const activity=Object.values(source.logs[key]||{}).some(log=>log.quantity||log.eventCompleted);
  const event=!readOnly&&scheduledEvents(key).length>0;
  const label=`${monthNumber}月${day}日 ${key>todayKey?'これからの日':MODES[mode].label}${activity?'・タスクの記録あり':''}${event?'・イベントの予定あり':''}`;
  const classes=`day-cell ${future?'day-future':`mode-${mode}`} ${selectedDay===key?'selected':''} ${key===todayKey?'today':''}`;
  const marks=activity||event?`<span class="calendar-day-marks" aria-hidden="true">
   ${activity?'<b class="quantity-calendar-dot"></b>':''}${event?'<b class="event-calendar-dot"></b>':''}
  </span>`:'';
  const contents=`<span class="calendar-day-number">${day}</span>${future?'':`<i aria-hidden="true">${MODES[mode].icon}</i>`}${marks}`;
  return readOnly?`<div class="${classes}" role="img" aria-label="${label}">${contents}</div>`:
   `<button class="${classes}" data-select-date="${key}" aria-label="${label}" ${key>todayKey&&!event?'disabled':''}>${contents}</button>`;
 }).join('');
 return `<section class="calendar-card cosmic-calendar" aria-label="活動カレンダー">
  <div class="month-heading"><div><span class="calendar-year">${year}</span><h1>${monthNumber}<small>月</small></h1></div>
  ${readOnly?'':`<div class="calendar-month-actions">
   <button type="button" class="round-button" data-month="-1" aria-label="前の月">‹</button>
   <button type="button" class="round-button" data-month="1" aria-label="次の月" ${calendarMonth>=todayKey.slice(0,7)?'disabled':''}>›</button>
  </div>`}</div>
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
 return `<section class="calendar-mode-card" aria-label="${monthNumber}月の日数の内訳">
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
function analysisResult(){
 const start=shiftDate(today,1-statsWeeks*7);
 return analysisChart(state,{start,end:today,scope:quantityScope,weeks:statsWeeks,overview:!analysisStarted});
}
function analysisWorkspace(){
 if(!analysisStarted)return `<div class="analysis-overview">
  ${analysisResult()}
  <button class="analysis-launch" type="button" data-do="start-analysis">
   <span class="analysis-launch-icon" aria-hidden="true">✦</span>
   <span>分析を開始する</span>
   <span class="analysis-launch-arrow" aria-hidden="true">→</span>
  </button>
 </div>`;
 const root=state.nodes.find(node=>node.parentId===null);
 return `<div class="analysis-workspace">
  <div class="analysis-map" id="analysis-map-pane" aria-label="分析する目標">
   <div class="analysis-map-heading">
    <button class="analysis-exit" type="button" data-do="exit-analysis"><span aria-hidden="true">←</span> 統計に戻る</button>
    <h2>何の分析をしますか？</h2>
   </div>
   <div class="analysis-map-scroll">${personalMap({selection:quantityScope==='all'?root.id:quantityScope,analysis:true})}</div>
  </div>
  ${panelDivider('analysis','マインドマップとグラフの高さを調節','analysis-map-pane analysis-chart-pane')}
  <div class="analysis-period"><label for="analysis-weeks">分析する期間</label><output for="analysis-weeks">${analysisPeriodLabel(statsWeeks)}</output>
   <input id="analysis-weeks" type="range" min="1" max="52" step="1" value="${statsWeeks}" aria-valuetext="${analysisPeriodLabel(statsWeeks)}">
   <small>1週間</small><small>1年</small>
  </div>
  <div class="analysis-result-scroll" id="analysis-chart-pane">${analysisResult()}</div>
 </div>`;
}
function refreshAnalysis(){
 $('.analysis-result-scroll').innerHTML=analysisResult();
}
function statsPage(){
 quantityScope=reportScope(quantityScope);
 const tabs=[['calendar','カレンダー'],['graph','分析']];
 const calendar=statsTab==='calendar';
 return `<section class="statistics-workspace weekly-workspace stats-dashboard">
  ${!calendar&&analysisStarted?'':`<div class="statistics-toolbar"><div class="statistics-tabs" role="group" aria-label="統計の表示">
   ${tabs.map(([id,label])=>`<button type="button" aria-pressed="${statsTab===id}" data-stat-tab="${id}">${label}</button>`).join('')}
  </div></div>`}
  <div class="statistics-content ${calendar?'calendar-content':'quantity-content'}">${calendar?calendarPage()+calendarModeChart():analysisWorkspace()}</div>
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
  ${mapEditing?'<button type="button" data-do="map-import">AIで作成・取り込み</button>':''}
 </div>`;
}
function personalMap({selection=mapSelection,preview=false,analysis=false,addition=null}={}){
 const selected=state.nodes.find(node=>node.id===selection)||state.nodes.find(node=>node.parentId===null);
 const branchId=analysis?'analysis-map-branch':preview?'editor-map-branch':'home-map-branch';
 const path=nodePath(state,selected.id),root=path[0];
 const childrenFor=id=>{
  const children=visibleChildren(state,id);
  if(addition?.parent===id){
   // A new node has the default order of zero until it is reordered.
   const firstLater=children.findIndex(child=>child.order>0);
   children.splice(firstLater<0?children.length:firstLater,0,{insertion:true});
  }
  return children;
 };
 const galaxies=childrenFor(root.id);
 const branchRoot=path[1];
 const tone=galaxies.findIndex(node=>node.id===branchRoot?.id) % 5;
 const card=(node,depth,style='',overview=false)=>{
  if(node.insertion){
   const label=addition.kind==='action'?'新しいタスク':'新しい目標';
   return `<div class="map-node map-insertion ${style}" role="status"><span aria-hidden="true">＋</span>
    <span><small>ここに追加</small><strong>${label}</strong></span></div>`;
  }
  const task=nodeKind(state,node.id)==='action',level=Math.min(depth,LEVELS.length-1);
  const label=task?(isEventTask(setting(state,node.id))?'イベント':'タスク'):'';
  return `<button class="map-node ${style}" data-map-level="${level}" ${analysis?'data-analysis-target':'data-map-select'}="${esc(node.id)}" ${node.id===selected.id?'aria-current="true"':''} ${mapEditing&&!preview&&!analysis?'aria-keyshortcuts="F2"':''}
    ${overview?`aria-expanded="${node.id===branchRoot?.id}" aria-controls="${branchId}"`:''}>
    <span aria-hidden="true">${task?'✓':hierarchyMarks[level]}</span>
    <span>${label?`<small>${label}</small>`:''}<strong>${esc(node.name)}</strong></span>
  </button>
  ${mapEditing&&!preview&&!analysis&&!task&&depth<LEVELS.length-1?`<div class="map-inline-tools">
   <button type="button" data-space-add="${esc(node.id)}" aria-label="${esc(node.name)}に目標やタスクを追加">＋</button>
  </div>`:''}`;
 };
 const overview=mapDiagram(card(root,0,'map-root'),galaxies.map((node,index)=>({
  tone:index % 5,card:card(node,1,'',true)
 })),{radial:true,label:'マインドマップ全体'});
 if(!branchRoot)return overview+`<div id="${branchId}" hidden></div>`;
 return overview+mapBranchPanel(branchRoot,{childrenFor,card,branchId,tone});
}
function mapBranchPanel(root,{childrenFor,card,branchId,tone,depth=1}){
 function branch(node,level){
  if(node.insertion)return `<li>${card(node,level,'map-branch-row')}</li>`;
  const children=childrenFor(node.id);
  const kind=nodeKind(state,node.id)==='action'?'task':'goal';
  return `<li class="map-branch-${kind}">
   ${card(node,level,'map-branch-row')}
   ${children.length?`<ul>${children.map(child=>branch(child,level+1)).join('')}</ul>`:''}
  </li>`;
 }
 const children=childrenFor(root.id);
 const lanes=children.length>1?[children.filter((_,i)=>i%2===0),children.filter((_,i)=>i%2===1)]:[children];
 return `<section id="${branchId}" class="map-subview map-galaxy-view" aria-labelledby="${branchId}-name" data-map-tone="${tone}">
  <header class="map-branch-header" data-map-level="${Math.min(depth,4)}"><span aria-hidden="true">${hierarchyMarks[Math.min(depth,4)]}</span><h2 id="${branchId}-name">${esc(root.name)}</h2></header>
  ${children.length?`<div class="map-galaxy-tree ${lanes.length===1?'single-lane':''}">${lanes.map(nodes=>
   `<ul class="map-branch-lane">${nodes.map(node=>branch(node,depth+1)).join('')}</ul>`).join('')}</div>`:
   '<p class="map-galaxy-empty">まだ下位の目標やタスクはありません。</p>'}
 </section>`;
}

function leaveUnderworld(){
 inUnderworld=false;
 appAudio?.setUnderworld(false);
 if(underworldAudioStarted&&appAudioOn&&!appAudioChanging)void toggleAppAudio();
 underworldAudioStarted=false;
}
async function enterUnderworld(){
 inUnderworld=true;
 appAudio?.setUnderworld(true);
 const wasPlaying=appAudioOn;
 const start=wasPlaying?null:toggleAppAudio();
 render();
 $('#catchup-title')?.focus({preventScroll:true});
 if(start){
  await start;
  if(!inUnderworld){if(appAudioOn)void toggleAppAudio();return;}
  underworldAudioStarted=appAudioOn;
 }
}
function catchupPage(){
 const tasks=catchupTasks(state,today);
 if(!tasks.size){
  if(inUnderworld)leaveUnderworld();
  return `<section class="catchup-scene heaven" aria-labelledby="catchup-title">
   <div class="catchup-landscape" aria-hidden="true"><div class="heaven-halo"></div></div>
   <div class="catchup-story"><h1 id="catchup-title" tabindex="-1">ようこそ、天国へ</h1>
    <p>取り戻すタスクはありません。</p></div>
  </section>`;
 }
 if(!inUnderworld)return `<section class="catchup-scene underworld-gate" aria-labelledby="catchup-title">
  <div class="catchup-landscape" aria-hidden="true"><div class="underworld-arch"></div></div>
  <div class="catchup-story"><h1 id="catchup-title">地獄の入口</h1>
   <p>取り戻すタスクが <strong>${tasks.size}件</strong> あります。</p>
   <button class="primary" type="button" data-do="enter-underworld">門を開く <span aria-hidden="true">→</span></button>
  </div>
 </section>`;
 return `<section class="catchup-scene underworld-court" aria-labelledby="catchup-title">
  <button class="text-button catchup-exit" type="button" data-do="leave-underworld">← 地獄の入口へ</button>
  <header class="enma-verdict">
   <span class="enma-seal" aria-hidden="true">閻</span>
   <h1 id="catchup-title" tabindex="-1">閻魔の間</h1>
   <p class="enma-line">「こら、先延ばしのツケが来ておるぞ。<br>いつまでにやり遂げるか、わしに約束せい！」</p>
  </header>
  <ul class="catchup-list">${[...tasks].map(([id,task])=>{
   const name=state.nodes.find(node=>node.id===id).name;
   const deadline=task.promise?.deadline;
   const days=deadline?(Date.parse(deadline)-Date.parse(today))/86400000+1:task.days;
   const daily=days>0?numberText(Math.ceil(task.remaining/days*1000)/1000)+esc(task.unit):'';
   return `<li>
    <div class="catchup-task-heading"><h2>${esc(name)}</h2>
     <span>残り <strong>${numberText(task.remaining)}${esc(task.unit)}</strong></span></div>
    <p>${deadline?`約束の日 <time datetime="${esc(deadline)}">${esc(deadline).replaceAll('-','/')}</time>${days<=0?' · 期限を過ぎています':''}`:
     task.type==='week'?'今週の目標':'達成期限までの目標'}${daily?` · 1日 ${daily}が目安`:''}</p>
    <div class="catchup-task-actions"><button type="button" class="primary" data-catchup-promise="${esc(id)}">${deadline?'約束を変更':'期限を約束する'}</button>
     <button type="button" class="text-button" data-record-leaf="${esc(id)}">取り組んだ量を記録</button></div>
   </li>`;
  }).join('')}</ul>
 </section>`;
}
function catchupPromiseForm(id){
 const task=catchupTasks(state,today).get(id);
 if(!task)return;
 const name=state.nodes.find(node=>node.id===id).name;
 const suggested=task.promise?.deadline||task.suggestedDay||today;
 modal(`<form id="catchup-promise-form" data-id="${esc(id)}">
  <div class="dialog-title"><h2>閻魔との約束</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <p>${esc(name)} · 残り ${numberText(task.remaining)}${esc(task.unit)}</p>
  <label>いつまでに取り戻しますか？<input type="date" name="deadline" min="${today}" value="${esc(suggested>=today?suggested:today)}" required></label>
  <div class="dialog-actions"><button class="primary" type="submit">この日までに取り戻す</button></div>
 </form>`);
}
function mindMapPage(){
 const plan=state.records[today];
 const plannedTasks=plan?.plannedMode?modeItems(plan.quantityMenu||[],plan.plannedMode)
  .filter(item=>!plan.quantityExcluded?.includes(item.id)):[];
 const growth=universeGrowth(state,today);
 const energy=planetEnergy();
 const morningTask=morningSelection();
 return `<section class="mind-map" aria-labelledby="mind-map-title">
  <div class="home-universe">
   <button type="button" class="home-universe-art" data-do="open-star" aria-label="自分の星へ">${planetArt(growth.days)}${energy.colors.length?`<span class="planet-prize" style="--planet-prize:${planetPrizes[energy.colors.at(-1)].color}" aria-hidden="true"></span>`:''}</button>
   <div class="home-star-meta"><button type="button" class="planet-energy-balance" data-do="planet-energy" aria-label="宇宙エネルギー ${numberText(energy.balance)}ポイント${featureUnlocked('gacha')?'、ガチャを開く':'、ガチャはマップ確定後、2日の記録で解放'}">✦ ${numberText(energy.balance)} <span>宇宙エネルギー</span>${featureUnlocked('gacha')?'':`<small>ガチャは2日で解放</small>`}</button>
   ${growth.days?`<span class="home-universe-days">${growth.days}日記録</span>`:''}</div>
  </div>
  ${morningTask?`<section class="mind-map-mode morning-task" aria-label="今日のタスク">
   <h2>今日のタスク</h2>
   <button type="button" data-do="morning-choice">${esc(morningTask.name)} <small>${esc(taskAmount(setting(state,morningTask.id).measurement))}</small></button>
  </section>`:''}
  <section class="mind-map-mode" aria-label="今日のペース">
   ${plan?.plannedMode&&!plan.eveningDone?`<h2>今日の予定 · ${MODES[plan.plannedMode].label}</h2>
    <ul class="evening-tasks">${plannedTasks.map(({id,name,setting:{measurement}})=>{
     const amount=taskAmount(measurement);
     return `<li><button type="button" data-record-leaf="${esc(id)}"><span>${esc(name)}</span><span>${esc(amount)}</span></button></li>`;
    }).join('')}</ul>
    <div class="evening-actions"><button type="button" data-do="evening-done">✓ 達成</button>
    <button type="button" data-do="change-evening">選び直す</button></div>`:
    plan?.eveningDone?'':
    `<h2>今日、残りの時間はどのペースでいけそう？</h2>
     <div class="map-mode-buttons">${['full','busy','rest'].map(key=>`<button type="button" data-mode="${key}" data-date="${today}">${MODES[key].label}</button>`).join('')}</div>`}
  </section>
  <header class="mind-map-header"><h1 id="mind-map-title">マインドマップ</h1>
   <div class="mind-map-tools" role="group" aria-label="マインドマップの操作">
    <button type="button" data-do="map-print">PDF</button>
    ${mapEditing?'':'<button type="button" data-map-edit-mode>編集</button>'}
   </div>
  </header>
  ${mapEditing?'<p class="map-edit-hint">項目をダブルタップで編集できます。</p>':''}
  <div class="mind-map-scroll">${personalMap()}</div>
  <footer class="mind-map-footer">
   ${state.universe?.mapConfirmed===true?'':`<div class="map-confirm">
    <p>${canConfirmMap(state)?'マインドマップに納得したら、この内容で始めましょう。':'毎日のタスクを1つ追加すると、マインドマップを確定できます。'}</p>
    <button class="primary" type="button" data-do="confirm-map" ${canConfirmMap(state)?'':'disabled'}>この内容で始める</button>
   </div>`}
   ${mapActions()}
  </footer>
 </section>`;
}

function printableMap(root){
 const childrenFor=id=>visibleChildren(state,id);
 const children=childrenFor(root.id),depth=nodeDepth(state,root.id);
 const card=(node,level,style='')=>{
  const task=nodeKind(state,node.id)==='action';
  const config=task?setting(state,node.id):null;
  const event=config&&isEventTask(config);
  const measurement=config?.measurement;
  const completed=event&&eventCompletionDate(state,node.id);
  const quantities=(style==='map-branch-row'||!children.length)&&!event&&measurement
   ?[measurement,...(measurement.extras||[])].filter(metric=>metric.dailyAmount!=null)
     .map(metric=>numberText(metric.dailyAmount)+unitInfo(metric).label).join(' · '):'';
  const date=event?(completed?'完了 '+completed:config.eventDate?'予定 '+config.eventDate:''):'';
  const label=event?'イベント':task?'タスク':'';
  return `<div class="map-node ${style}">
   <span aria-hidden="true">${task?'✓':hierarchyMarks[Math.min(level,4)]}</span>
   <span>${label?`<small>${label}</small>`:''}<strong>${esc(node.name)}</strong>
    ${quantities?`<small>1日 ${esc(quantities)}</small>`:''}
    ${date?`<small>${esc(date)}</small>`:''}
   </span>
  </div>`;
 };
 function descendantsOf(node,level){
  const children=childrenFor(node.id);
  if(!children.length)return '';
  return `<ul class="map-print-links">${children.map(child=>`<li>
   ${card(child,level,'map-branch-row')}
   ${descendantsOf(child,level+1)}
  </li>`).join('')}</ul>`;
 }
 const overview=mapDiagram(card(root,depth,'map-root'),children.map((node,index)=>({
  tone:index % 5,card:card(node,depth+1,'map-print-branch-root')+descendantsOf(node,depth+2)
 })),{radial:true,label:'マインドマップ全体'});
 return `<article class="map-print-document">${overview}</article>`;
}

function centerPrintPreview(preview){
 const center=preview.querySelector('.map-root').getBoundingClientRect();
 const viewport=preview.getBoundingClientRect();
 preview.scrollTop+=center.top+center.height/2-viewport.top-viewport.height/2;
}
function mapPrintDialog(){
 const root=state.nodes.find(node=>node.parentId===null),selected=selectedMapNode();
 modal(`<form id="map-print-form">
  <div class="dialog-title"><h2>マインドマップを印刷</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <label>印刷する範囲<select name="print-scope"><option value="${esc(root.id)}">マップ全体</option>
   ${selected.id!==root.id?`<option value="${esc(selected.id)}">${esc(selected.name)}</option>`:''}
  </select></label>
  <p>A4縦・1ページ。枝が多いときは、印刷する範囲を絞ると文字を大きくできます。</p>
  <div class="map-print-preview" tabindex="0" aria-label="印刷プレビュー">${printableMap(root)}</div>
  <div class="dialog-actions"><button type="submit" class="primary">PDFを保存</button></div>
 </form>`);
 centerPrintPreview($('.map-print-preview'));
}
function printMap(form){
 document.getElementById('jiku-print-output')?.remove();
 const sheet=document.createElement('div');
 sheet.id='jiku-print-output';
 sheet.setAttribute('aria-hidden','true');
 const id=form.elements.namedItem('print-scope').value;
 const node=state.nodes.find(item=>item.id===id);
 if(!node)return;
 sheet.innerHTML=printableMap(node);
 document.body.append(sheet);
 const diagram=sheet.querySelector('jiku-mind-map');
 diagram.drawConnections();
 const height=diagram.getBoundingClientRect().height;
 // Fit inside the A4 printable height (297 mm less two 14 mm margins).
 const available=268*96/25.4;
 const scale=Math.min(1,available/height);
 sheet.style.setProperty('--map-paper-scale',String(scale));
 sheet.style.setProperty('--map-paper-height',`${height*scale}px`);
 const cleanup=()=>sheet.remove();
 window.addEventListener('afterprint',cleanup,{once:true});
 window.print();
}
function mapImportDialog(){
 const root=state.nodes.find(node=>node.parentId===null),selected=selectedMapNode();
 const parents=state.nodes.filter(node=>canPlace(state,'new',node.id));
 const target=parents.find(node=>node.id===selected.id)||parents.find(node=>node.id===selected.parentId)||root;
 modal(`<form id="map-import-form" data-step="1">
  <div class="dialog-title"><h2>AIで作成・取り込み</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <section class="map-import-step" data-import-step="1"><h3 tabindex="-1">Step 1｜AIとマインドマップを考える</h3>
   <p>AIと自分のマインドマップを考えましょう。</p>
   <label>追加先の目標<select name="parent">${parents.map(node=>`<option value="${esc(node.id)}" ${node.id===target.id?'selected':''}>${esc(nodePath(state,node.id).map(part=>part.name).join(' › '))}</option>`).join('')}</select></label>
   <p data-import-depth class="muted"></p>
   <p>このプロンプトをAIに送り、自分の目標や、目標につながる日々のタスクを一緒に深く考えます。</p>
   <button type="button" class="primary" data-copy-map-prompt="planning">相談用プロンプトをコピー</button>
   <details><summary>プロンプトを表示</summary>
    <textarea aria-label="マインドマップを考えるプロンプト" data-import-prompt="planning" readonly rows="4"></textarea>
   </details>
   <div class="dialog-actions"><button type="button" class="primary" data-import-go="2">次へ</button></div>
  </section>
  <section class="map-import-step" data-import-step="2" hidden><h3 tabindex="-1">Step 2｜決まった内容の形式を整える</h3>
   <p>内容が決まったら、次のプロンプトを同じAIの会話に送り、Jikuで読み込める形式（JSON）に整えます。</p>
   <button type="button" class="primary" data-copy-map-prompt="template">JSONテンプレートをコピー</button>
   <details><summary>テンプレートを表示</summary>
    <textarea aria-label="JSON出力テンプレート" data-import-prompt="template" readonly rows="4">${esc(jsonTemplate)}</textarea>
   </details>
   <div class="dialog-actions"><button type="button" class="text-button" data-import-go="1">戻る</button><button type="button" class="primary" data-import-go="3">次へ</button></div>
  </section>
  <p class="map-import-copy-status" role="status" aria-live="polite"></p>
  <section class="map-import-step" data-import-step="3" hidden>
   <h3 tabindex="-1">Step 3｜Jikuに貼り付けて反映する</h3>
   <p>AIが出力した内容を下に貼り付け、「内容を確認」を押します。内容を確認したら「Jikuに反映する」を押してください。</p>
   <label>AIが出力した内容<textarea name="plan" required disabled rows="6" spellcheck="false" placeholder="ここに貼り付け"></textarea></label>
   <p class="map-import-error" role="alert" hidden></p>
   <div data-import-preview hidden></div>
   <div class="dialog-actions">
    <button type="button" class="text-button" data-import-go="2">戻る</button>
    <button class="primary" type="submit" name="action" value="preview" disabled>内容を確認</button>
    <button class="primary" type="submit" name="action" value="apply" disabled hidden>Jikuに反映する</button>
   </div>
  </section>
 </form>`);
 updateImportPrompt($('#map-import-form'));
}
function showMapImportStep(form,step){
 const page=form.querySelector(`[data-import-step="${step}"]`);
 if(!page)return;
 form.dataset.step=step;
 form.querySelectorAll('[data-import-step]').forEach(section=>{section.hidden=section!==page;});
 form.querySelector('[name="plan"]').disabled=step!=='3';
 form.querySelector('[value="preview"]').disabled=step!=='3';
 form.querySelector('[value="apply"]').disabled=step!=='3'||form.dataset.previewed!=='true';
 form.querySelector('.map-import-copy-status').textContent='';
 form.closest('dialog').scrollTop=0;
 page.querySelector('h3').focus({preventScroll:true});
}
async function copyMapPrompt(button){
 const form=button.form;
 const field=form.querySelector(`[data-import-prompt="${button.dataset.copyMapPrompt}"]`);
 const status=form.querySelector('.map-import-copy-status');
 try{
  await navigator.clipboard.writeText(field.value);
  status.textContent='コピーしました。外部AIの会話に貼り付けてください。';
 }catch{
  field.closest('details').open=true;
  field.focus({preventScroll:true});
  field.select();
  field.scrollIntoView({block:'nearest'});
  status.textContent='文章を選択しました。端末のメニューからコピーしてください。';
 }
}
function updateImportPrompt(form){
 const parent=form.elements.namedItem('parent').value;
 const path=nodePath(state,parent);
 const levels=LEVELS.length-path.length;
 form.querySelector('[data-import-depth]').textContent=`追加できる深さは、選んだ目標の下に最大${levels}階層です。`;
 form.querySelector('[data-import-prompt="planning"]').value=planningPrompt+
  `\n\n追加先の目標（私が選択済み）: ${path.map(node=>node.name).join(' › ')}\n追加できる深さ: ここから下に最大${levels}階層。`;
}
function clearMapImportPreview(form){
 form.querySelector('[data-import-preview]').hidden=true;
 form.querySelector('.map-import-error').hidden=true;
 form.querySelector('[value="apply"]').hidden=true;
 form.querySelector('[value="apply"]').disabled=true;
 delete form.dataset.previewed;
}
function mapImportTree(nodes){
 return `<ul>${nodes.map(item=>{
  const m=item.measurement;
  const metric=m?`<small>合計 ${numberText(m.totalTarget)}分 · 週 ${numberText(m.weeklyTarget)}分 · 日 ${numberText(m.dailyAmount)}分 · ${m.deadline} · ${{full:'余裕がある日だけ',busy:'忙しい日も',rest:'毎日'}[item.mode]}</small>`:'';
  const extras=m?.extras.map(extra=>{
   const unit=unitInfo(extra).label;
   return `<small>${esc(unit)}　合計 ${numberText(extra.totalTarget)} · 週 ${numberText(extra.weeklyTarget)} · 日 ${numberText(extra.dailyAmount)}</small>`;
  }).join('')||'';
  return `<li><strong>${item.kind==='goal'?'目標':'タスク'} · ${esc(item.name)}</strong><small>${esc(item.purpose)}</small>
   ${item.symbolName?`<small>ブラックホール名 · ${esc(item.symbolName)}</small>`:''}${metric}${extras}${item.children.length?mapImportTree(item.children):''}</li>`;
 }).join('')}</ul>`;
}
function handleMapImport(form,action){
 if(form.dataset.step!=='3')return;
 const data=new FormData(form);
 const preview=form.querySelector('[data-import-preview]');
 const error=form.querySelector('.map-import-error');
 try{
  const result=previewMapImport(state,String(data.get('plan')),String(data.get('parent')));
  error.hidden=true;
  if(action==='apply'&&form.dataset.previewed==='true'){
   const previous=state;
   state=result.next;
   const points=earnEnergy('edit',today);
   if(!save()){state=previous;return;}
   mapSelection=result.nodes[0].id;
   close();
   render();
   $('.mind-map [aria-current]')?.scrollIntoView({block:'nearest'});
   energyToast(`目標${result.counts.goal}件、タスク${result.counts.task}件を追加しました`,points);
   return;
  }
  preview.innerHTML=`<h3>追加予定：目標${result.counts.goal}件・タスク${result.counts.task}件</h3>${mapImportTree(result.nodes)}`;
  preview.hidden=false;
  form.dataset.previewed='true';
  form.querySelector('[value="apply"]').hidden=false;
  form.querySelector('[value="apply"]').disabled=false;
  preview.scrollIntoView({block:'nearest'});
 }catch(problem){
  clearMapImportPreview(form);
  error.textContent=problem.message;
  error.hidden=false;
  error.scrollIntoView({block:'nearest'});
 }
}
function projectsPage(){
 const events=state.nodes.filter(node=>nodeKind(state,node.id)==='action'&&isEventTask(setting(state,node.id)));
 const planned=[],history=[];
 for(const node of events){
  const done=eventCompletionDate(state,node.id);
  (done?history:planned).push({node,date:done||setting(state,node.id).eventDate});
 }
 planned.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
 history.sort((a,b)=>b.date.localeCompare(a.date));
 const list=(items,empty)=>items.length
  ?`<ul class="journey-list">${items.map(({node,date})=>`<li><button type="button" data-journey-event="${esc(node.id)}"><strong>${esc(node.name)}</strong><span>${esc(date||'日付未定')} ›</span></button></li>`).join('')}</ul>`
  :`<p class="muted">${empty}</p>`;
 return `<section class="tab-page" aria-labelledby="projects-title">
  <header><h1 id="projects-title">プロジェクト</h1>
   <button type="button" class="primary" data-do="new-journey">＋ プロジェクトを追加</button></header>
  <div class="journey-sections"><section><h2>これからのプロジェクト</h2>${list(planned,'予定はありません。')}</section>
  <section><h2>完了したプロジェクト</h2>${list(history,'完了したプロジェクトがここに残ります。')}</section></div>
 </section>`;
}
function journeys(){
 close();
 view='projects';
 if(location.hash!=='#projects')location.hash='projects';
 render();
}
function journeyForm(){
 const selected=selectedMapNode();
 const parentId=nodeKind(state,selected.id)==='goal'&&canPlace(state,'new',selected.id)?selected.id:selected.parentId;
 const options=state.nodes.filter(node=>nodeKind(state,node.id)==='goal'&&canPlace(state,'new',node.id));
 modal(`<form id="journey-form">
  <div class="dialog-title"><h2>プロジェクトを追加</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <label>プロジェクト名<input name="name" required maxlength="80" placeholder="例：ハッカソンに参加する"></label>
  <label>プロジェクトの目的<textarea name="description" required maxlength="1000" rows="2"></textarea></label>
  <label>繋がっている上位目標<select name="parent" required>${options.map(node=>`<option value="${esc(node.id)}" ${node.id===parentId?'selected':''}>${esc(nodePath(state,node.id).map(part=>part.name).join(' › '))}</option>`).join('')}</select></label>
  <label>日付（任意）<input name="event-date" type="date"></label>
  <label>取り組む予定の時間（分）<input name="event-minutes" type="number" inputmode="decimal" min="0.001" max="1000000" step="any" required></label>
  <div class="dialog-actions"><button type="button" class="text-button" data-do="journeys">‹ プロジェクト一覧</button><button type="submit" class="primary">保存する</button></div>
 </form>`);
}
function openJourneyEvent(id){
 modal(eventPanel(state,id,today,today));
 $('#dialog').insertAdjacentHTML('afterbegin','<button type="button" class="text-button journey-back" data-do="journeys">‹ プロジェクト一覧</button>');
 const form=$('#event-form');
 if(form)form.dataset.journey='true';
}
const planetPrizes=[
 {name:'すみれのオーラ',color:'#b69aff'},
 {name:'青い星雲',color:'#80cbff'},
 {name:'オーロラの光',color:'#70ebbd'},
 {name:'夕焼けの光',color:'#ffb385'}
];
const planetDrawCost=20;
function planetEnergy(){
 const energy=state.planetEnergy;
 if(!Number.isSafeInteger(energy?.balance)||energy.balance<0||!Array.isArray(energy.colors)||new Set(energy.colors).size!==energy.colors.length||!energy.colors.every(index=>Number.isInteger(index)&&planetPrizes[index])||
  !Array.isArray(energy.claims)||!energy.claims.every(key=>typeof key==='string'))return {balance:0,colors:[],claims:[]};
 return energy;
}
if(demoMode){
 const energy=planetEnergy(),claim='demo:starter-energy';
 if(!energy.claims.includes(claim)){
  state.planetEnergy={...energy,balance:energy.balance+30,claims:[...energy.claims,claim]};
 }
}
applyPending(state,today);if(state.universe?.onboarded)save();

function earnEnergy(kind,date){
 if(guideSession||mapPreviewReturn)return 0;
 const energy=planetEnergy();
 const key=kind+':'+date;
 if(energy.claims.includes(key))return 0;
 const points=kind==='record'?10:5;
 state.planetEnergy={...energy,balance:energy.balance+points,claims:[...energy.claims,key]};
 return points;
}
function energyToast(message,points){
 appAudio?.cue?.('save');
 toast(points?`${message} · 宇宙エネルギー ＋${points}`:message);
}
function starWorldPage(){
 const world=starWorldSnapshot(state.starWorld),energy=planetEnergy();
 const cost=facilityCosts[world.level];
 return `<section class="star-world" aria-labelledby="star-world-title">
  <button type="button" class="text-button star-return" data-map-back>← マインドマップ</button>
  <header><h1 id="star-world-title" tabindex="-1">自分の星</h1>
   <button type="button" class="planet-energy-balance" data-do="planet-energy">✦ ${energy.balance} 宇宙エネルギー</button>
  </header>
  <div class="star-landscape" aria-hidden="true">
   <div class="star-moon">${planetArt(universeGrowth(state,today).days)}</div>
   <div class="star-terrain"></div>
   ${world.level?`<div class="star-tower" data-level="${world.level}"><i></i><i></i><i></i></div>`:''}
   <div class="star-residents">${world.friends.map(id=>`<i class="star-creature star-creature-${id}"></i>`).join('')}</div>
  </div>
  <div class="star-world-controls">
   <section class="star-facility" aria-label="エネルギー施設">
    <h2>エネルギー施設${world.level?' · Lv.'+world.level:''}</h2>
    <p>${world.level?`星のエネルギー <strong data-star-stored>${world.stored}</strong> / ${world.level*storageHours} · 毎時＋${world.level}`:
     '宇宙エネルギーで施設を建てると、星のエネルギーが貯まります。'}</p>
    ${world.level?`<small data-star-next>${starProductionStatus(world)}</small>`:''}
    <button type="button" class="primary" data-star-action="facility" ${cost===undefined||energy.balance<cost?'disabled':''}>
     ${cost===undefined?'最大レベル':(world.level?'施設を強化':'施設を建てる')+' · 宇宙エネルギー '+cost}</button>
   </section>
   <section class="star-friends"><h2>星の仲間 <small>${world.friends.length} / ${starFriends.length}</small></h2>
    <p>施設で貯めた星のエネルギーで迎えられます。</p>
    <ul>${starFriends.map(friend=>`<li>
     <i class="star-creature star-creature-${friend.id}" aria-hidden="true"></i>
     <div><strong>${friend.name}</strong><p>${friend.description}</p></div>
     <button type="button" data-star-action="friend" data-star-friend="${friend.id}" aria-label="${friend.name}を迎える · 星のエネルギー ${friend.cost}"
      ${world.friends.includes(friend.id)||world.stored<friend.cost?'disabled':''}>
      ${world.friends.includes(friend.id)?'この星にいる':'迎える · '+friend.cost}</button>
    </li>`).join('')}</ul>
   </section>
  </div>
 </section>`;
}
function starProductionStatus(world){
 if(world.stored===world.level*storageHours)return '満タン · 48時間分まで貯められます';
 const minutes=Math.max(1,Math.ceil((world.last+3600000-Date.now())/60000));
 return `次の生産まで約${minutes}分 · アプリを閉じている間も生産`;
}
function updateStarWorld(){
 const value=$('[data-star-stored]');
 if(!value)return;
 const world=starWorldSnapshot(state.starWorld);
 value.textContent=world.stored;
 $('[data-star-next]').textContent=starProductionStatus(world);
 for(const button of document.querySelectorAll('[data-star-friend]')){
  const friend=starFriends.find(item=>item.id===button.dataset.starFriend);
  button.disabled=world.friends.includes(friend.id)||world.stored<friend.cost;
 }
}
async function commitStarAction(action,friend){
 const commit=()=>{
  if(view!=='star'||storageLocked)return;
  const previous=state;
  try{
   const raw=localStorage.getItem(storageKey);
   if(raw)state=validate(JSON.parse(raw));
   const energy=planetEnergy();
   const result=developStar(state.starWorld,energy.balance,action,friend);
   state={...state,starWorld:result.world,planetEnergy:{...energy,balance:result.balance}};
   if(!save()){state=previous;return;}
   const scroll=$('.view-star .content').scrollTop;
   render();
   $('.view-star .content').scrollTop=scroll;
   appAudio?.cue?.('prize');
   toast(action==='facility'?'エネルギー施設ができました。':starFriends.find(item=>item.id===friend).name+'が星の仲間になりました。');
  }catch(error){state=previous;toast(error.message);}
 };
 if(navigator.locks?.request)await navigator.locks.request(storageKey+':star-world',commit);
 else commit();
}
function showPlanetEnergy(prize){
 const energy=planetEnergy();
 const remaining=planetPrizes.length-energy.colors.length;
 modal(`<div class="dialog-title"><h2>宇宙エネルギー</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <p class="energy-total">✦ ${numberText(energy.balance)} <small>ポイント</small></p>
  ${prize?`<p class="energy-prize" role="status">${esc(prize.name)}を獲得しました。</p>`:''}
  <p>最初の記録で10ポイント、最初のマップ編集で5ポイント。どちらも1日1回貯まります。</p>
  <button type="button" class="primary" data-do="energy-draw" ${!featureUnlocked('gacha')||!remaining||energy.balance<planetDrawCost?'disabled':''}>${!featureUnlocked('gacha')?'ガチャはマップ確定後、2日の記録で解放':remaining?'星のガチャを回す · '+planetDrawCost+'ポイント':'星のオーラがすべて揃いました'}</button>
  ${energy.colors.length?`<ul class="energy-collection">${energy.colors.map(index=>`<li><i style="--planet-prize:${planetPrizes[index].color}"></i>${esc(planetPrizes[index].name)}</li>`).join('')}</ul>`:''}`);
}
function drawPlanetPrize(){
 if(!featureUnlocked('gacha')){explainFeatureLock('gacha');return;}
 const energy=planetEnergy();
 const remaining=planetPrizes.map((_,index)=>index).filter(index=>!energy.colors.includes(index));
 if(!remaining.length||energy.balance<planetDrawCost)return;
 const index=remaining[Math.floor(Math.random()*remaining.length)];
 const previous=state.planetEnergy;
 state.planetEnergy={...energy,balance:energy.balance-planetDrawCost,colors:[...energy.colors,index]};
 if(!save()){state.planetEnergy=previous;return;}
 close();
 render();
 appAudio?.cue?.('prize');
 showPlanetEnergy(planetPrizes[index]);
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
 let count,points;
 try {
  if(date===today&&mode!=='none'&&!state.records[date]?.eveningDone)saveEveningPlan(state,date,mode);
  else {
   count=applyMode(state,date,mode,today);
   points=mode!=='none'?earnEnergy('record',date):0;
  }
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
 if(date===today&&mode!=='none'&&!state.records[date]?.eveningDone)toast('今日の予定を選びました。できたら「達成」を押してください。');
 else energyToast(count?`${count}個のタスクの固定量を反映しました`:'モードを保存しました',points);
}
function finishEvening(){
 const previous=structuredClone(state);
 try{
  const count=completeEveningPlan(state,today);
  const hasActual=Object.values(state.logs[today]||{}).some(log=>log.quantity||log.eventCompleted);
  const points=hasActual?earnEnergy('record',today):0;
  if(!save()){state=previous;return}
  render();
  energyToast(count?`${count}件の予定量を実績に記録しました`:'今日の実績を確定しました',points);
 }catch(error){state=previous;toast(error.message)}
}
function readReminderPreferences(){
 try{
  const prefs=JSON.parse(localStorage.getItem(reminderPreferenceKey));
  return prefs?.role&& !Object.hasOwn(endTimeLabels,prefs.role)?null:prefs;
 }catch{return null;}
}
function openReminderLink(){
 const link=new URL(location.href),morning=link.searchParams.has('morning');
 if((!morning&&!link.searchParams.has('evening'))||onboardingScene||guideSession||$('#dialog').open)return;
 link.searchParams.delete('morning');
 link.searchParams.delete('evening');
 history.replaceState(null,'',link);
 if(morning)morningChoice();
 else if(!state.records[today]?.eveningDone)modePicker();
}
function maybeAskReminderSetup(){
 if(!account||demoMode||guideSession||mapPreviewReturn||storageLocked||readReminderPreferences()||$('#dialog').open)return;
 const link=new URL(location.href);
 if(link.searchParams.has('morning')||link.searchParams.has('evening')||needsLegacyImport)return;
 if(maybeAskReminderSetup.shown)return;
 maybeAskReminderSetup.shown=true;
 void reminderSettings(true);
}
function taskAmount(m){
 if(!m)return '';
 return [m,...(m.extras||[])].filter(metric=>metric.dailyAmount!=null)
  .map(metric=>numberText(metric.dailyAmount)+unitInfo(metric).label).join(' ・ ');
}
function morningTasks(){
 return leaves(state).filter(n=>{
  const task=setting(state,n.id);
  return nodeKind(state,n.id)==='action'&&task.status==='active'&&
   (!isEventTask(task)||(!eventCompletionDate(state,n.id)&&(!task.eventDate||task.eventDate===today)));
 });
}
function morningSelection(){
 try{
  const selected=JSON.parse(localStorage.getItem(morningSelectionKey));
  if(selected?.day===today)return morningTasks().find(task=>task.id===selected.id);
 }catch{}
}
function morningChoice(taskId=morningSelection()?.id){
 const tasks=morningTasks(),task=tasks.find(item=>item.id===taskId);
 const heading=task?task.name:'今日はどんな1日にする？';
 const amount=taskAmount(task&&setting(state,task.id).measurement);
 modal(`<div class="dialog-title"><h2>${esc(heading)}</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  ${task?`${task.description?`<p class="space-description">${esc(task.description)}</p>`:''}${amount?`<strong>${esc(amount)}</strong>`:''}
   <div class="dialog-actions"><button type="button" class="text-button" data-do="morning-change">選び直す</button><button type="button" class="primary" data-do="close">閉じる</button></div>`:
   tasks.length?`<p>今日取り組みたいタスクを一つ選んでください。</p><div class="record-leaf-picker">${tasks.map(item=>
    `<button type="button" data-morning-task="${esc(item.id)}"><strong>${esc(item.name)}</strong><span>→</span></button>`).join('')}</div>`:
    '<p>マインドマップにタスクを追加すると、ここから選べます。</p>'}`);
}
function pickMorningTask(id){
 if(!morningTasks().some(item=>item.id===id))return;
 try{localStorage.setItem(morningSelectionKey,JSON.stringify({id,day:today}));}
 catch{toast('今日のタスクを保存できませんでした。');return;}
 render();
 morningChoice(id);
}
const reminderMinute=value=>Number(value.slice(0,2))*60+Number(value.slice(3,5));
async function reminderSettings(first=false){
 const prefs=readReminderPreferences();
 modal(`<form id="reminder-form">
  <div class="dialog-title"><h2>${first?'あなたの普段の生活について':'朝・夕方の通知'}</h2><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <label>普段どんな生活をしていますか？<select name="role" required>
   <option value="" disabled ${!prefs?.role?'selected':''}>選んでください</option>
   ${[['student','学生'],['worker','社会人'],['other','その他']].map(([value,label])=>`<option value="${value}" ${prefs?.role===value?'selected':''}>${label}</option>`).join('')}
  </select></label>
  <div id="reminder-fields" ${!prefs?.role?'hidden':''}>
   <label>あなたの起床時間を教えてください<input type="time" name="wake" value="${esc(prefs?.wake||'07:00')}" required></label>
   <label><span id="reminder-end-label">${endTimeLabels[prefs?.role]||endTimeLabels.other}</span><input type="time" name="evening" value="${esc(prefs?.evening||'18:00')}" required></label>
   <p class="footnote">日本時間。朝は今日のタスク、夕方はその日のペースを聞きます。</p>
  </div>
  <p id="reminder-status" role="status"></p>
  <div class="dialog-actions"><button type="submit" class="primary" data-do="enable-reminders">時刻を保存</button>
   <button type="button" class="text-button" data-do="test-reminders" hidden>テスト通知</button>
   <button type="button" class="text-button" data-do="disable-reminders" hidden>通知を解除</button>
   ${first?'<button type="button" class="text-button" data-do="skip-reminders">あとで</button>':''}
  </div></form>`);
 const form=$('#reminder-form'),{role,wake,evening}=form.elements;
 const status=$('#reminder-status'),fields=$('#reminder-fields');
 const enable=form.querySelector('[data-do="enable-reminders"]');
 const test=form.querySelector('[data-do="test-reminders"]');
 const disable=form.querySelector('[data-do="disable-reminders"]');
 const closeButton=form.querySelector('[data-do="close"]');
 if(first)closeButton.dataset.do='skip-reminders';
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 let registration,key;
 role.addEventListener('change',()=>{
  fields.hidden=false;
  form.querySelector('#reminder-end-label').textContent=endTimeLabels[role.value];
 });
 const saveTimes=()=>localStorage.setItem(reminderPreferenceKey,JSON.stringify({role:role.value,wake:wake.value,evening:evening.value}));
 async function registerTimes(sendTest){
  const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const response=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({...subscription.toJSON(),times:{wake:reminderMinute(wake.value),evening:reminderMinute(evening.value)},test:sendTest})});
  if(!response.ok)throw Error('通知を登録できませんでした。');
  const result=await response.json();
  disable.hidden=false;
  test.hidden=false;
  enable.textContent='時刻を保存';
  status.textContent=sendTest?(result.testSent?'テスト通知を送信しました。':'時刻を保存しました。テスト通知は送れませんでした。'):'通知時刻を保存しました。';
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  enable.disabled=true;
  try{
   saveTimes();
   if(registration&&key)await registerTimes(false);
   else if(!standalone)status.textContent='保存しました。通知はホーム画面に追加したJikuの設定で有効にできます。';
   else status.textContent='時刻を保存しました。通知は端末の設定を確認してください。';
   if(first&&(!standalone||registration&&key)){close();toast('通知時刻を保存しました。');}
  }catch(error){
   status.textContent=globalThis.Notification?.permission==='denied'?'iPhoneの設定からJikuの通知を許可してください。':error.message;
  }finally{enable.disabled=false;}
 });
 test.addEventListener('click',async ()=>{
  if(!form.reportValidity())return;
  test.disabled=true;
  try{saveTimes();await registerTimes(true);}catch(error){status.textContent=error.message;}
  finally{test.disabled=false;}
 });
 disable.addEventListener('click',async ()=>{
  disable.disabled=true;
  try{
   const subscription=await registration.pushManager.getSubscription();
   if(subscription){
    const response=await fetch('/api/push/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
    if(!response.ok)throw Error('通知を解除できませんでした。');
    await subscription.unsubscribe();
   }
   status.textContent='この端末の通知を解除しました。';
   disable.hidden=true;test.hidden=true;enable.textContent='時刻を保存して通知を有効にする';
  }catch(error){status.textContent=error.message;}
  finally{disable.disabled=false;}
 });
 if(!standalone){
  status.textContent='通知を受け取るには、iPhoneのホーム画面に追加したJikuを開いてください。';
  return;
 }
 if(!('PushManager' in window)||!('serviceWorker' in navigator)||!account){
  status.textContent='通知を有効にするには、対応するiPhoneでGoogleログインしてください。';
  return;
 }
 enable.disabled=true;
 try{
  const config=await fetch('/api/push/config').then(response=>response.json());
  if(!config.publicKey){status.textContent='通知の配信を準備中です。';return;}
  await navigator.serviceWorker.register('/sw.js');
  registration=await navigator.serviceWorker.ready;
  const existing=await registration.pushManager.getSubscription();
  key=Uint8Array.from(atob(config.publicKey.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  enable.textContent=existing?'時刻を保存':'時刻を保存して通知を有効にする';
  disable.hidden=!existing;
  test.hidden=!existing;
 }catch{status.textContent='通知設定を読み込めませんでした。';}
 finally{enable.disabled=false;}
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
 $('.mind-map-footer .mind-map-tools').outerHTML=mapActions();
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
 if(useEvent&&!featureUnlocked('projects')){explainFeatureLock('projects');return}
 modal(useEvent?eventPanel(state,id,key,today):recordPanel(state,id,key,today));
}
function openNode(id){enterSpace(id)}
function openPreset(id){editor(id)}
function modePicker(){modal(modePickerContent(state,today))}
function readExtraSettings(form){
 const event=form.elements.namedItem('task-format')?.value==='event';
 return [...form.querySelectorAll('[data-extra-metric]')].map(card=>{
  const value=name=>card.querySelector(`[name="${name}"]`)?.value||'';
  const amount=name=>value(name)?Number(value(name)):null;
  return {
   unit:value('extra-unit'),customUnit:value('extra-custom-unit').trim(),
   dailyAmount:amount('extra-daily'),totalTarget:event?null:amount('extra-total'),
   weeklyTarget:event?null:amount('extra-weekly')
  };
 });
}
function readTaskSettings(form){
 const data=new FormData(form),event=data.get('task-format')==='event';
 const amount=name=>data.get(name)?Number(data.get(name)):null;
 const measurement={
  unit:'minutes',dailyAmount:amount(event?'event-minutes':'daily-minutes'),
  totalTarget:amount('total-minutes'),weeklyTarget:amount('weekly-minutes'),
  ...(data.get('task-deadline')?{deadline:String(data.get('task-deadline'))}:{}),
  extras:readExtraSettings(form)
 };
 return event?{eventDate:String(data.get('event-date')||''),measurement}:{measurement,mode:data.get('task-level')};
}
function readExtraAmounts(data){
 return data.getAll('record-extra').map(value=>value===''?null:Number(value));
}
function chooseLeaf(key){const available=leaves(state).filter(n=>nodeKind(state,n.id)==='action'&&!isEventTask(setting(state,n.id))).filter(n=>statsTab==='calendar'||quantityScope==='all'||descendants(state,quantityScope).has(n.id));modal(`<div class="dialog-title"><h2>タスクを選ぶ</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="record-leaf-picker">${available.map(n=>`<button data-record-leaf="${esc(n.id)}" data-log-date="${key}"><span>♧</span>${esc(n.name)}<i>＋</i></button>`).join('')||'<p class="muted">この目標にはタスクがありません。</p>'}</div>`)}
let addParent=null,creationDraft=null;
function chooseCreationType(parent){addParent=parent;const depth=nodeDepth(state,parent)+1;if(depth>4){toast('目標とタスクは最上位の目標を含めて5階層までです');return}modal(`<div class="dialog-title"><h2>目標・タスクを追加</h2><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><div class="creation-type-options"><button data-create-kind="goal"><span class="creation-type-icon">✧</span><strong>目標</strong><small>達成したいこと。<br>あとから細かく分解できます。</small><span class="creation-type-arrow">→</span></button><button data-create-kind="action"><span class="creation-type-icon">✓</span><strong>タスク</strong><small>目標に向けて取り組む行動。</small><span class="creation-type-arrow">→</span></button></div>`,{mapId:view==='tree'&&!guideSession?parent:null})}

function editor(id,creationKind=null){const isNew=id==='new',parent=addParent||currentSpace().id,n=isNew?{name:'',description:'',parentId:parent}:state.nodes.find(n=>n.id===id);if(!n)return;if(isNew&&!['goal','action'].includes(creationKind)){chooseCreationType(parent);return}const isRoot=!isNew&&!n.parentId,hasChildren=!isNew&&visibleChildren(state,id).length>0,kind=isNew?creationKind:nodeKind(state,id),depth=isNew?nodeDepth(state,parent)+1:nodeDepth(state,id);if(isNew&&depth>4){toast('目標とタスクは最上位の目標を含めて5階層までです');return}const parentGoal=state.nodes.find(node=>node.id===n.parentId);
 const purposeLabel=parentGoal?`「${parentGoal.name}」に貢献できる理由`:'この目標にした目的';
 modal(`<form id="node-form" data-id="${esc(id)}"><div class="dialog-title"><div><h2>${isNew?(kind==='action'?'タスクを設定':'目標を設定'):isRoot?'最上位の目標を編集':'目標・タスクを編集'}</h2></div><button type="button" data-do="close" class="round-button" aria-label="閉じる">×</button></div><label><span data-node-name-label>${kind==='action'?'タスク名':'目標名'}</span><input required maxlength="80" name="name" value="${esc(n.name)}" placeholder="目指したいことを、自分の言葉で"></label><label><span data-purpose-label>${esc(purposeLabel)}</span><textarea name="description" required maxlength="1000" rows="2" placeholder="取り組む理由を、自分の言葉で">${esc(n.description||'')}</textarea></label>${!isRoot?`<input type="hidden" name="parent" value="${esc(n.parentId)}">`:''}${isNew?`<input type="hidden" name="node-kind" value="${kind}"><button type="button" class="creation-type-back" data-create-back>← タイプを選び直す</button>`:!isRoot?`<fieldset class="goal-kind-picker"><legend>目標／タスク</legend><label><input type="radio" name="node-kind" value="goal" ${kind==='goal'?'checked':''} required><span><strong>目標</strong><small>さらに分解していくもの</small></span></label><label><input type="radio" name="node-kind" value="action" ${kind==='action'?'checked':''} ${hasChildren?'disabled':''} required><span><strong>タスク</strong><small>実際に取り組むタスク</small></span></label></fieldset>`:''}<fieldset class="goal-action-fields" ${kind==='action'?'':'hidden disabled'}>${taskSettingsFields(state,id)}</fieldset>${depth===1?`<details class="cosmic-advanced-settings"><summary>詳細設定</summary><label>ブラックホールの名前<input name="symbol-name" maxlength="80" value="${esc(n.symbolName||n.name)}" placeholder="省略すると銀河名になります"></label></details>`:''}${hasChildren?'<p class="footnote">下位目標があるため、目標として扱います。</p>':''}<div class="dialog-actions">${!isNew&&!isRoot?`<button type="button" class="danger text-button" data-delete="${esc(id)}">削除</button>`:''}${!isNew?`<button type="button" class="text-button" data-space-stats="${esc(id)}">統計を見る</button>`:''}<button class="primary" type="submit">${isNew?'誕生させる':'保存する'}</button></div>${!isNew&&kind==='action'?`<button type="button" class="text-button record-adjust-button" data-record-leaf="${esc(id)}">${isEventTask(setting(state,id))?'イベントの完了を記録':'今日の記録を調整'}</button>`: ''}</form>`,{mapId:view==='tree'&&!guideSession?(isNew?parent:id):null,addition:isNew?kind:null});if(isNew&&creationDraft){
 const form=$('#node-form');
 for(const [key,value] of Object.entries(creationDraft)){
  if(['node-kind','extras','task-format'].includes(key))continue;
  const input=form.elements.namedItem(key);
  if(input instanceof RadioNodeList){input.value=value;}
  else if(input&&input.type!=='radio')input.value=value;
 }
 const list=form.querySelector('[data-extra-list]');
 const event=form.elements.namedItem('task-format')?.value==='event';
 if(list)list.innerHTML=(creationDraft.extras||[]).map(metric=>extraMetricFields(metric,event)).join('');
}}
function review(){if(!featureUnlocked('stats')){explainFeatureLock('stats');return}const ws=weekStart(today),end=shiftDate(ws,6),s=stats(state,ws,end),r=state.reviews[ws]||{},effective=shiftDate(ws,7);modal(`<form id="review-form"><div class="dialog-title"><div><div class="eyebrow">WEEKLY REFLECTION</div><h2>今週の自分と、話そう。</h2></div><button type="button" data-do="close" class="round-button" aria-label="閉じる">×</button></div><p class="muted">${ws.replaceAll('-','/')} — ${end.replaceAll('-','/')}</p><div class="review-summary">${Object.entries(s.counts).map(([k,c])=>`<div><span style="color:${MODES[k].color}">${MODES[k].icon}</span><strong>${c}日</strong><small>${MODES[k].label}</small></div>`).join('')}</div><h3>今週、取り組んだタスク</h3><p class="muted">${s.logs.length} 回の実行記録</p>${Object.entries(s.logs.reduce((o,l)=>(o[l.name]=(o[l.name]||0)+1,o),{})).map(([n,c])=>`<p class="review-log">♧ ${esc(n)} <b>${c}回</b></p>`).join('')}<label>無理があったこと・気づいたこと<textarea name="note" rows="3" placeholder="今週の自分に、どんな言葉をかけたい？">${esc(r.note||'')}</textarea></label><label>来週、大切にしたいこと<textarea name="next" rows="2" placeholder="小さく、具体的な一歩を書いてみよう。">${esc(r.next||'')}</textarea></label><h3>来週のタスクプラン</h3><p class="footnote">${effective.replaceAll('-','/')}（月）から反映。過去の記録はそのまま残ります。</p>${leaves(state).filter(n=>nodeKind(state,n.id)==='action').map(n=>{const a=state.pending.find(p=>p.id===n.id&&p.effective===effective)?.setting||setting(state,n.id);return `<fieldset class="review-setting" data-review-node="${esc(n.id)}"><legend>${esc(n.name)}</legend>${taskLevelFields(a,'review-level-'+n.id)}</fieldset>`}).join('')}<div class="dialog-actions"><button class="primary">レビューを保存</button></div></form>`)}
function switchDemo(enabled){const url=new URL(location.href);if(enabled)url.searchParams.set('demo','1');else url.searchParams.delete('demo');url.searchParams.delete('preview');location.assign(url)}
function settings(){modal(`<div class="dialog-title"><div><div class="eyebrow">YOUR OWN UNIVERSE</div><h2>設定・バックアップ</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>${account?`<div class="account-info"><div class="account-profile-photo">${accountAvatar()}</div><strong>${esc(account.name)}</strong><p>${esc(account.email)}</p>${!account.picture?'<a class="text-button" href="/api/auth/google">Googleのプロフィール画像を取得</a>':''}<form method="post" action="/api/auth/logout" data-native-submit><button class="text-button" type="submit">ログアウト</button></form></div>`:''}<p>データはこの端末・ブラウザ内に保存されます。端末間での同期はありません。ブラウザのデータを消す前にバックアップしてください。</p><button class="text-button" data-do="reminder-settings">朝・夕方の通知 →</button><br><button class="text-button" data-do="open-demo">サンプルを開く →</button><br><button class="text-button" data-do="preview-onboarding">初めて開いたときの画面を見る →</button><br><button class="text-button" data-do="review">今週を振り返る →</button><div class="settings-actions"><button class="primary" data-do="export">↓ バックアップを書き出す</button><label class="import-button">↑ バックアップを読み込む<input type="file" id="import" accept="application/json,.json"></label></div><p class="footnote">読み込み時は現在のデータを置き換えます。先に現在のバックアップを保存することをおすすめします。日付は日本時間、週の始まりは月曜日です。</p><hr><p class="muted">Jiku v1.0 · 自分の軸を、日々のタスクへ。</p>`)}
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-do],[data-view],[data-day],[data-focus],[data-map-back]');if(!b)return;const d=b.dataset;
 if(d.guide==='dismiss'){dismissGuide();return}
 if(b.hasAttribute('data-map-exit')){endMapPreview();return}
 if(b.hasAttribute('data-map-back')||d.view==='tree'){e.preventDefault();appAudio?.cue?.('navigate');openMindMap();return}
 if(d.do==='evening-done'){finishEvening();return}
 if(d.do==='change-evening'){modePicker();return}
 if(d.do==='reminder-settings'){void reminderSettings();return}
 if(d.do==='skip-reminders'){try{localStorage.setItem(reminderPreferenceKey,'{}');}catch{}close();return}
 if(d.do==='morning-choice'){morningChoice();return}
 if(d.do==='morning-change'){morningChoice(null);return}
 if(d.morningTask){pickMorningTask(d.morningTask);return}
 if(b.hasAttribute('data-toggle-time-plan')){
  const calculator=b.closest('[data-target-fields]').querySelector('.target-calculator');
  calculator.hidden=!calculator.hidden;
  b.setAttribute('aria-expanded',String(!calculator.hidden));
  return;
 }
 if(b.hasAttribute('data-calculate-target')||b.hasAttribute('data-apply-target')){
  const box=b.closest('.target-calculator'),fields=box.closest('[data-target-fields]'),time=fields.dataset.targetFields==='time';
  const output=box.querySelector('output'),apply=box.querySelector('[data-apply-target]');
  try{
   const amount=box.querySelector('[data-calc-total]').valueAsNumber;
   const total=time?Number((amount*60).toFixed(6)):amount;
   if(time&&(!Number.isFinite(total)||total<.001||total>1000000))throw Error('目標達成にかかる時間を、0より大きい有効な時間で入力してください。');
   const pace=paceForDeadline(total,today,box.querySelector('[data-calc-date]').value);
   if(pace.dailyAmount<.001)throw Error('1日の目安が0.001未満です。期限や単位を見直してください');
   const unit=time?'分':fields.querySelector('[name="extra-unit"]').selectedOptions[0]?.textContent;
   const suffix=unit&&unit!=='選択してください'&&unit!=='自由入力'?unit:fields.querySelector('[name="extra-custom-unit"]')?.value.trim()||'';
   const hours=new Intl.NumberFormat('ja-JP',{maximumSignificantDigits:4,notation:'standard'});
   const format=value=>time?hours.format(value/60)+'時間':numberText(value)+suffix;
   output.textContent=`残り${pace.days}日 · 週 ${format(pace.weeklyTarget)} / 日 ${format(pace.dailyAmount)}`;
   apply.hidden=false;
   if(b===apply){
    for(const [range,value] of Object.entries({total:pace.totalTarget,weekly:pace.weeklyTarget,daily:pace.dailyAmount})){
     fields.querySelector(`[name="${time?range+'-minutes':'extra-'+range}"]`).value=value;
    }
    if(time)b.form.elements.namedItem('task-deadline').value=box.querySelector('[data-calc-date]').value;
    output.textContent+=' → 反映しました';apply.hidden=true;
   }
  }catch(error){output.textContent=error.message;apply.hidden=true;}
  return;
 }
 if(d.do==='confirm-map'){
  if(!canConfirmMap(state))return;
  const previous=state.universe.mapConfirmed;
  state.universe.mapConfirmed=true;
  if(!save()){state.universe.mapConfirmed=previous;return;}
  render();toast('マインドマップを確定しました。');
  return;
 }
 if(d.do==='start-analysis'){
  if(!featureUnlocked('stats'))return;
  analysisStarted=true;
  render();
  $('[data-analysis-target][aria-current="true"]')?.focus({preventScroll:true});
  return;
 }
 if(d.do==='exit-analysis'){
  analysisStarted=false;
  quantityScope='all';
  render();
  $('[data-do="start-analysis"]')?.focus({preventScroll:true});
  return;
 }
 if(d.analysisTarget){
  if(!featureUnlocked('stats'))return;
  quantityScope=reportScope(d.analysisTarget);
  const map=$('.analysis-map-scroll'),position=map.scrollTop;
  map.innerHTML=personalMap({selection:d.analysisTarget,analysis:true});
  map.scrollTop=position;
  const target=[...map.querySelectorAll('[data-analysis-target]')].find(button=>button.dataset.analysisTarget===d.analysisTarget);
  target?.focus({preventScroll:true});
  const branch=$('#analysis-map-branch');
  if(b.hasAttribute('aria-expanded')&&branch&&!branch.hidden)map.scrollTop=branch.offsetTop;
  $('.analysis-result-scroll').scrollTop=0;
  refreshAnalysis();
  return;
 }
 if(d.do==='enter-underworld'){void enterUnderworld();return}
 if(d.do==='leave-underworld'){leaveUnderworld();render();$('[data-do="enter-underworld"]')?.focus();return}
 if(d.catchupPromise){catchupPromiseForm(d.catchupPromise);return}
 if(d.do==='app-audio'){void toggleAppAudio();return}
 if(d.do==='open-star'){
  appAudio?.cue?.('star');view='star';location.hash='star';render();
  $('#star-world-title')?.focus({preventScroll:true});return;
 }
 if(d.starAction){void commitStarAction(d.starAction,d.starFriend);return}
 if(d.do==='map-print'){mapPrintDialog();return}
 if(d.do==='map-import'){mapImportDialog();return}
 if(d.importGo){showMapImportStep(b.form,d.importGo);return}
 if(d.copyMapPrompt){void copyMapPrompt(b);return}
 if((d.do==='journeys'||d.do==='new-journey'||d.journeyEvent)&&!featureUnlocked('projects')){explainFeatureLock('projects');return}
 if(d.do==='journeys'){journeys();return}
 if(d.do==='new-journey'){journeyForm();return}
 if(d.journeyEvent){openJourneyEvent(d.journeyEvent);return}
 if(d.do==='planet-energy'){appAudio?.cue?.('navigate');showPlanetEnergy();return}
 if(d.do==='energy-draw'){drawPlanetPrize();return}
 if(d.mapSelect){
  appAudio?.cue?.('navigate');
  const preview=b.closest('.map-editor-preview');
  if(preview){
   const expanded=b.getAttribute('aria-expanded')==='true';
   const selection=expanded?null:d.mapSelect;
   const top=preview.scrollTop;
   const {addParent,addKind}=preview.dataset;
   preview.innerHTML=personalMap({selection,preview:true,addition:addParent?{parent:addParent,kind:addKind}:null});
   const current=preview.querySelector('[aria-current="true"]');
   preview.scrollTop=top;
   current?.focus({preventScroll:true});
   if(b.hasAttribute('aria-expanded')&&!expanded)preview.querySelector('.map-branch-header')?.scrollIntoView({block:'nearest'});
  }else if(mapEditing&&e.detail>0)handleMapEditTap(b);
  else selectMapNode(b);
  return;
 }
 if(b.hasAttribute('data-map-edit-mode')){
  appAudio?.cue?.('navigate');
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
  const fromJourney=Boolean($('.journey-back'));
  if(!fromJourney)close();
  render();
  if(fromJourney)journeys();
  toast('完了を取り消しました');return;
 }
 if(b.hasAttribute('data-add-extra')){
  const form=b.closest('form'),list=form.querySelector('[data-extra-list]');
  if(list.children.length>=12){toast('追加できる単位は12種類までです');return}
  list.insertAdjacentHTML('beforeend',extraMetricFields({},form.elements.namedItem('task-format')?.value==='event'));
  list.lastElementChild.querySelector('select').focus();
  return;
 }
 if(b.hasAttribute('data-remove-extra')){b.closest('[data-extra-metric]').remove();return}
 if(d.spaceEnter){enterSpace(d.spaceEnter);return}if(d.spaceGo){close();enterSpace(d.spaceGo);return}if(d.legacyDetail){legacyDetail(d.legacyDetail);return}if(d.spaceAdd){creationDraft=null;chooseCreationType(d.spaceAdd);return}if(d.createKind){editor('new',d.createKind);return}if(b.hasAttribute('data-create-back')){const form=b.closest('form');creationDraft={...creationDraft,...Object.fromEntries(new FormData(form)),extras:readExtraSettings(form)};chooseCreationType(addParent||currentSpace().id);return}if(d.spaceDetail){spaceDetail(d.spaceDetail);return}if(d.spaceStats){if(!featureUnlocked('stats')){explainFeatureLock('stats');return}quantityScope=d.spaceStats;analysisStarted=true;statsTab='graph';view='stats';location.hash='stats';close();render();return}if(d.spaceReorder){const previous=structuredClone(state);reorderNode(state,d.spaceReorder,Number(d.direction));const points=JSON.stringify(state.nodes)!==JSON.stringify(previous.nodes)?earnEnergy('edit',today):0;if(!save()){state=previous;return}render();spaceList();if(points)energyToast('表示順を変更しました',points);return}if(d.openPreset)openPreset(d.openPreset);if(b.hasAttribute('data-configure-leaves')){close();view='tree';location.hash='tree';render();toast('タスクを押して、タスクの固定量を設定してください')}if(d.recordLeaf)leafPanel(d.recordLeaf,d.logDate||today);if(d.pickLeaf)chooseLeaf(d.pickLeaf);if(d.quantityDay)dayEditor(d.quantityDay);if(d.addQuantity){const input=$('#quantity-form [name=record-minutes]');if(input)input.value=String(Math.round(((Number(input.value)||0)+Number(d.addQuantity))*1000000)/1000000)}if(d.removeQuantity){modal(`<h2>この日の量の記録を削除しますか？</h2><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button class="primary danger-bg" data-confirm-remove-quantity="${esc(d.removeQuantity)}" data-log-date="${d.logDate}">削除する</button></div>`)}if(d.confirmRemoveQuantity){removeQuantity(state,d.logDate,d.confirmRemoveQuantity);save();close();render();toast('この日の記録を削除しました')}if(b.hasAttribute('data-scroll-tree')){$('#goal-tree')?.scrollIntoView({behavior:'smooth',block:'start'})}if(d.statTab){
  if(d.statTab!==statsTab){
   appAudio?.cue?.('navigate');
   if(d.statTab==='graph'){analysisStarted=false;quantityScope='all';}
  }
  statsTab=d.statTab;
  render();
  $(`[data-stat-tab="${statsTab}"]`)?.focus({preventScroll:true});
  return;
 }if(d.view){if(d.view!=='tree'&&!featureUnlocked(d.view)){explainFeatureLock(d.view);return}if(view!==d.view)appAudio?.cue?.('navigate');if(d.view==='stats')statsTab='calendar';view=d.view;location.hash=view;render();window.scrollTo(0,0)}if(d.mode){void recordModeChoice(b);return}if(d.check){const n=state.nodes.find(n=>n.id===d.check);if(n){const previous=structuredClone(state);toggleLog(state,d.date,n);const points=state.logs[d.date]?.[n.id]?earnEnergy('record',d.date):0;if(!save()){state=previous;return}render();if(points)energyToast('実行を記録しました',points)}}if(d.edit){addParent=null;editor(d.edit);if(b.hasAttribute('data-quantity-settings'))$('#node-form [name=quantity-unit]')?.focus()}if(d.selectDate){selected=d.selectDate;render();dayEditor(selected)}if(d.day){if(!featureUnlocked('stats')){explainFeatureLock('stats');return}selected=d.day;month=selected.slice(0,7);view='stats';statsTab='calendar';render()}if(d.month){
 const direction=d.month;
 month=boundedMonth(month,Number(direction),today);
 render();
 const arrow=$(`[data-month="${direction}"]`);
 (arrow?.disabled?$('[data-month="-1"]'):arrow)?.focus({preventScroll:true});
 return;
}if(d.focus){focus=d.focus;treeView=null;treeScene?.dispose();treeScene=null;zoom=1;pan={x:0,y:0};close();render()}if(d.delete){const id=d.delete,n=state.nodes.find(n=>n.id===id),count=descendants(state,id).size;modal(`<h2>「${esc(n.name)}」を削除しますか？</h2><p>子孫を含め ${count} 個の目標を削除します。過去の実行記録は残ります。</p><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button class="primary danger-bg" data-confirm-delete="${esc(id)}">削除する</button></div>`)}if(d.confirmDelete){const previous=structuredClone(state);deleteNode(state,d.confirmDelete);const points=earnEnergy('edit',today);if(!save()){state=previous;return}focus=null;treeScene?.dispose();treeScene=null;treeView=null;close();render();energyToast('目標を削除しました',points)}if(d.do)({close,settings,review,'open-demo':()=>switchDemo(true),'exit-demo':()=>switchDemo(false),'test-demo-mode':modePicker,'space-map':()=>showHierarchy(false),'preview-onboarding':previewOnboarding,'space-list':spaceList,'quick-actions':()=>chooseLeaf(today),'today-mode':modePicker,'labels':()=>{showGoalLabels=!showGoalLabels;applyLabelVisibility();b.setAttribute('aria-pressed',String(showGoalLabels))},'zoom-in':()=>{if(treeScene)treeScene.zoom(1.25);else{zoom=Math.min(2.5,zoom+.2);render()}},'zoom-out':()=>{if(treeScene)treeScene.zoom(.8);else{zoom=Math.max(.4,zoom-.2);render()}},'reset-tree':()=>{if(focus){focus=null;treeScene?.dispose();treeScene=null;treeView=null;render()}else if(treeScene)treeScene.reset();else{zoom=1;pan={x:0,y:0};render()}},'clear-record':()=>{clearMode(state,selected);save();render();close();toast('モードを未記録に戻しました')},export:()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`jiku-${demoMode?'demo':'backup'}-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}[d.do])?.()});
let lastTitleTap;
function mapEditButton(target){
 return mapEditing?target.closest('.mind-map-scroll [data-map-select]'):null;
}
function editMapItem(id){
 addParent=null;
 splitSizes.editor=50;
 editor(id);
}
let pendingMapTap;
function handleMapEditTap(button){
 const id=button.dataset.mapSelect;
 if(pendingMapTap?.button===button){
  clearTimeout(pendingMapTap.timer);
  pendingMapTap=null;
  selectMapNode(button);
  editMapItem(id);
  return;
 }
 clearTimeout(pendingMapTap?.timer);
 pendingMapTap={button,timer:setTimeout(()=>{
  pendingMapTap=null;
  if(button.isConnected&&mapEditing&&!$('#dialog').open)selectMapNode(button);
 },370)};
}
document.addEventListener('keydown',event=>{
 const button=mapEditButton(event.target);
 if(button&&(event.key==='F2'||(event.key==='Enter'&&button.hasAttribute('aria-current')))){
  event.preventDefault();
  editMapItem(button.dataset.mapSelect);
  return;
 }
 if(event.key==='Escape'&&!$('.space-vista')?.hidden)closeScenery();
});
document.addEventListener('pointerup',event=>{
 if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;
 const button=event.target.closest('[data-edit-title]');
 if(!button){lastTitleTap=null;return}
 const now=performance.now();
 if(lastTitleTap?.button===button&&now-lastTitleTap.time<=420){
  lastTitleTap=null;
  addParent=null;
  editor(button.dataset.editTitle);
 }else lastTitleTap={button,time:now};
});
document.addEventListener('dblclick',event=>{
 const button=event.target.closest('[data-edit-title]');
 if(button&&!$('#dialog').open){addParent=null;editor(button.dataset.editTitle);}
});
document.addEventListener('error',e=>{if(e.target.matches?.('[data-account-photo]'))e.target.remove()},true);
document.addEventListener('submit',e=>{if(e.target.hasAttribute('data-native-submit'))return;e.preventDefault();
 if(e.target.id==='catchup-promise-form'){
  const previous=structuredClone(state);
  const id=e.target.dataset.id;
  try{
   saveCatchupPromise(state,today,id,new FormData(e.target).get('deadline'));
   if(!save()){state=previous;return;}
   close();
   render();
   [...document.querySelectorAll('[data-catchup-promise]')].find(button=>button.dataset.catchupPromise===id)?.focus();
   toast('閻魔と約束しました。');
  }catch(error){toast(error.message);}
  return;
 }
 if(e.target.id==='map-print-form'){printMap(e.target);return}
 if(e.target.id==='map-import-form'){
  handleMapImport(e.target,e.submitter?.value);
  return;
 }
 if(e.target.id==='journey-form'){
  if(!featureUnlocked('projects')){explainFeatureLock('projects');return;}
  const data=new FormData(e.target),previous=structuredClone(state);
  try {
   writeGoal(state,{name:data.get('name'),purpose:data.get('description'),parentId:data.get('parent'),
    kind:'action',eventDate:String(data.get('event-date')||''),
    measurement:{unit:'minutes',dailyAmount:Number(data.get('event-minutes'))}});
   const points=earnEnergy('edit',today);
   if(!save()){state=previous;return}
   journeys();
   energyToast('プロジェクトを追加しました',points);
  }catch(error){state=previous;toast(error.message)}
  return;
 }
 if(e.target.id==='node-form'){const f=new FormData(e.target),id=e.target.dataset.id,previous=structuredClone(state);try{const kind=f.get('node-kind')||'goal',newId=writeGoal(state,{id,name:f.get('name'),purpose:f.get('description'),parentId:id==='new'?(addParent||currentSpace().id):state.nodes.find(n=>n.id===id)?.parentId,kind,...(kind==='action'?readTaskSettings(e.target):{}),symbolName:f.has('symbol-name')?f.get('symbol-name'):undefined});const changed=JSON.stringify(state.nodes)!==JSON.stringify(previous.nodes)||JSON.stringify(state.settings)!==JSON.stringify(previous.settings);const points=changed?earnEnergy('edit',today):0;if(!save()){state=previous;return}if(id==='new')mapSelection=newId;close();render();if(id==='new')treeScene?.birth(newId);energyToast(id==='new'?(kind==='action'?'タスクを追加しました':'目標を追加しました'):(kind==='action'?'タスクを更新しました':'目標を更新しました'),points)}catch(err){state=previous;toast(err.message)}}if(e.target.id==='event-form'){
 if(!featureUnlocked('projects')){explainFeatureLock('projects');return;}
 const previous=structuredClone(state),id=e.target.dataset.id;
 try{
  const data=new FormData(e.target);
  recordEventCompletion(state,id,data.get('event-completed-date'),today,Number(data.get('record-minutes')),readExtraAmounts(data));
  const points=earnEnergy('record',data.get('event-completed-date'));
  if(!save()){state=previous;return}
  const fromJourney=e.target.dataset.journey==='true';
  if(!fromJourney)close();
  render();
  if(fromJourney)journeys();
  energyToast(fromJourney?'プロジェクトを完了しました':'イベントの完了を記録しました',points);
 }catch(error){state=previous;toast(error.message)}
}if(e.target.id==='quantity-form'){
 const data=new FormData(e.target),previous=structuredClone(state);
 try{
  setTaskRecord(state,data.get('record-date'),e.target.dataset.id,Number(data.get('record-minutes')),readExtraAmounts(data),today);
  const points=earnEnergy('record',data.get('record-date'));
  if(!save()){state=previous;return}
  close();render();energyToast('取り組んだ時間を記録しました',points);
 }catch(error){state=previous;toast(error.message)}
}if(e.target.id==='review-form'){const ws=weekStart(today),effective=shiftDate(ws,7),f=new FormData(e.target);state.reviews[ws]={note:f.get('note'),next:f.get('next'),savedAt:new Date().toISOString()};e.target.querySelectorAll('[data-review-node]').forEach(el=>{const id=el.dataset.reviewNode;state.pending=state.pending.filter(p=>!(p.id===id&&p.effective===effective));state.pending.push({id,effective,setting:{...setting(state,id),modes:modesForLevel(el.querySelector('input:checked').value)}})});save();close();render();toast('レビューを保存しました。タスク設定は来週から反映します。')}});
document.addEventListener('input',e=>{
 if(e.target.id==='analysis-weeks'){
  statsWeeks=Number(e.target.value);
  const label=analysisPeriodLabel(statsWeeks);
  $('.analysis-period output').textContent=label;
  e.target.setAttribute('aria-valuetext',label);
  return;
 }
 if(!e.target.matches('[data-calc-total],[data-calc-date]'))return;
 const box=e.target.closest('.target-calculator');
 box.querySelector('[data-apply-target]').hidden=true;
 box.querySelector('output').textContent='';
});
document.addEventListener('change',event=>{
 if(event.target.id==='analysis-weeks')refreshAnalysis();
});
document.addEventListener('input',event=>{
 const form=event.target.form;
 if(form?.id!=='map-import-form')return;
 if(event.target.name==='parent')updateImportPrompt(form);
 if(['parent','plan'].includes(event.target.name))clearMapImportPreview(form);
});
document.addEventListener('change',async e=>{if(e.target.name==='print-scope'&&e.target.form?.id==='map-print-form'){
 const node=state.nodes.find(node=>node.id===e.target.value);
 if(node){
  const preview=e.target.form.querySelector('.map-print-preview');
  preview.innerHTML=printableMap(node);
  centerPrintPreview(preview);
 }
 return;
 }if(e.target.name==='node-kind'){
 const form=e.target.closest('form'),box=form.querySelector('.goal-action-fields'),active=e.target.value==='action';
 box.hidden=box.disabled=!active;
 form.querySelector('[data-node-name-label]').textContent=active?'タスク名':'目標名';
 }if(e.target.name==='extra-unit'){
 const custom=e.target.closest('[data-extra-metric]').querySelector('[data-extra-custom]');
 const input=custom.querySelector('input'),isCustom=e.target.value==='custom';
 custom.hidden=input.disabled=!isCustom;
 input.required=isCustom;
 }if(e.target.name==='record-date'&&validDateKey(e.target.value)&&e.target.value<=today){leafPanel(e.target.closest('form').dataset.id,e.target.value)}if(e.target.id==='import'&&e.target.files[0]){try{const f=e.target.files[0];if(f.size>10*1024*1024)throw Error('10MB以下のバックアップを選んでください');const next=validate(JSON.parse(await f.text()));modal(`<h2>バックアップを読み込みますか？</h2><p>${next.nodes.length} 個の目標を読み込み、現在のデータを置き換えます。</p><div class="dialog-actions"><button class="text-button" data-do="close">キャンセル</button><button id="confirm-import" class="primary">置き換える</button></div>`);$('#confirm-import').onclick=()=>{state=migrateUniverse(next);onboardingScene?.dispose();onboardingScene=null;storageLocked=false;focus=null;applyPending(state,today);focus=null;save();close();render();toast('バックアップを読み込みました')}}catch(err){toast('読み込めませんでした：'+err.message)}}});
function bindTree(){const host=$('.universe-stage');if(!host)return;try{treeScene=createUniverse(host,{nodes:state.nodes,auraStrength:universeGrowth(state,today).strength,current:showUniverseOrigin()?UNIVERSE_ORIGIN:currentSpace().id,onSelect:id=>{if(!guideSession)openNode(id)},onZoom:value=>{const label=$('[data-zoom-label]');if(label)label.textContent=value+'%'}})}catch(error){if(showUniverseOrigin()){host.innerHTML=`<button class="universe-origin-fallback" style="--fallback-growth:${universeGrowth(state,today).strength}" data-space-enter="${esc(currentSpace().id)}" aria-label="宇宙に入る"></button>`;return}host.innerHTML=`<div class="universe-fallback"><p>この端末では、目標一覧で宇宙を探索できます。</p>${visibleChildren(state,currentSpace().id).map(n=>`<button data-space-enter="${esc(n.id)}">✧ ${esc(n.name)} →</button>`).join('')}</div>`}}
function applyLabelVisibility(){}
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
window.addEventListener('hashchange',()=>{const raw=location.hash.slice(1),h=raw==='home'?'tree':raw==='calendar'?'stats':raw;if(raw==='calendar'||(h==='stats'&&view!=='stats'))statsTab='calendar';if((Object.hasOwn(names,h)||h==='star')&&(view!==h||raw==='calendar')){view=h;render()}});window.addEventListener('focus',()=>{if(dateKey()!==today)render()});if(Object.hasOwn(names,location.hash.slice(1))||location.hash==='#star')view=location.hash.slice(1);if(location.hash==='#home')history.replaceState(null,'','#tree');if(location.hash==='#calendar'){view='stats';statsTab='calendar';history.replaceState(null,'','#stats')}if(new URLSearchParams(location.search).get('preview')==='guide')startGuide(true);
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
render();
openReminderLink();
if(!onboardingPreview&&!guideSession&&needsLegacyImport&&!guestHandoff?.map)offerLegacyImport();

function offerLegacyImport(){modal(`<div class="dialog-title"><h2>以前の記録を引き継ぎますか？</h2></div><p>このブラウザでGoogleログイン前に使っていた記録が残っています。現在ログインしているあなたのアカウントへコピーできます。</p><p class="footnote">元の記録はそのまま残ります。</p><div class="dialog-actions"><button class="text-button" data-do="close">新しく始める</button><button id="copy-legacy" class="primary">記録を引き継ぐ</button></div>`);$('#copy-legacy').onclick=()=>{try{const old=localStorage.getItem('jiku-v1');localStorage.setItem(storageKey+':before-universe',old);state=migrateUniverse(validate(JSON.parse(old)));finishOnboardingReturn();onboardingScene?.dispose();onboardingScene=null;applyPending(state,today);save();close();render();toast('以前の記録を引き継ぎました')}catch{toast('以前の記録を読み込めませんでした。バックアップから読み込んでください。')}}}
