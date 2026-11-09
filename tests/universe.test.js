import {test} from 'node:test';import assert from 'node:assert/strict';
import {seed,validate,applyMode,quantitySummary,shiftDate} from '../dist/model.js';
import {nodePath,nodeDepth,visibleChildren,canPlace,freshUniverse,migrateUniverse,completeUniverse,reorderNode,sceneLayout,shouldPromptDailyMode,universeGrowth} from '../dist/universe-model.js';
test('移行はID・親・行動設定・履歴を変更せずオンボーディングを再生しない',()=>{const s=seed();s.settings.read.measurement={unit:'pages',dailyAmount:10,weeklyTarget:null};applyMode(s,'2026-11-08','rest','2026-11-08');const original=structuredClone(s),next=migrateUniverse(s);assert.deepEqual(next.nodes,original.nodes);assert.deepEqual(next.settings,original.settings);assert.deepEqual(next.logs,original.logs);assert.deepEqual(next.records,original.records);assert(next.universe.onboarded);assert.equal(quantitySummary(next,'2026-11-08','2026-11-08').entries[0].amount,10);validate(next)});
test('宇宙全体には直下の銀河だけを返し、恒星系や行動は含まない',()=>{const s=seed();assert.deepEqual(visibleChildren(s,'root').map(n=>n.id),['dev','english','health']);assert.deepEqual(visibleChildren(s,'english').map(n=>n.id),['vocab','shadow']);assert.deepEqual(nodePath(s,'vocab').map(n=>n.id),['root','english','vocab'])});
test('新しい目標・移動は5階層を越えず循環しない',()=>{const s=freshUniverse();for(let i=1;i<=4;i++)s.nodes.push({id:'n'+i,parentId:i===1?'root':'n'+(i-1),name:'目標'+i});assert.equal(nodeDepth(s,'n4'),4);assert(canPlace(s,'new','n3'));assert(!canPlace(s,'new','n4'));assert(!canPlace(s,'n1','n3'));s.nodes.push({id:'branch',parentId:'root',name:'別の銀河'});assert(!canPlace(s,'n2','n3'));assert(canPlace(s,'n2','branch'))});
test('旧データの深い階層・途中の行動設定は削除も結合もしない',()=>{const s=freshUniverse();for(let i=1;i<=7;i++)s.nodes.push({id:'n'+i,parentId:i===1?'root':'n'+(i-1),name:'目標'+i});delete s.universe;s.settings.n2={priority:0,type:'once',status:'active',modes:['busy']};const next=migrateUniverse(s);assert(next.universe.legacyDeep);assert.equal(next.nodes.length,8);assert.equal(next.nodes[7].parentId,'n6');assert.equal(next.settings.n2.type,'once');validate(next)});
test('初回完了を再実行しても宇宙と銀河が重複しない',()=>{const s=freshUniverse();assert(!s.universe.onboarded);const id=completeUniverse(s,'自分の人生','つくる力');assert.equal(completeUniverse(s,'自分の人生','つくる力'),id);assert.equal(s.nodes.length,2);assert.equal(s.nodes[0].name,'自分の人生');assert(s.universe.onboarded);validate(s)});
test('表示順の変更は親子関係とIDを保ち再読み込みできる',()=>{const s=seed();reorderNode(s,'health',-1);const next=validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(visibleChildren(next,'root').map(n=>n.id),['dev','health','english']);assert.equal(next.nodes.find(n=>n.id==='health').parentId,'root')});
test('多数の天体をモバイル・PCで重複せず配置する',()=>{const nodes=Array.from({length:24},(_,i)=>({id:'n'+i}));for(const [w,h] of [[390,600],[1200,700]]){const layout=sceneLayout(nodes,w,h);assert.equal(new Set(layout.map(n=>n.x+','+n.y)).size,24);assert(layout.every(n=>[n.x,n.y,n.z].every(Number.isFinite)))}});

test('モードは初回だけ案内し、閉じた日の再起動や旧記録のある日は再表示しない',()=>{const s=migrateUniverse(seed());assert(shouldPromptDailyMode(s,'2026-11-08'));s.universe.lastModePrompt='2026-11-08';assert(!shouldPromptDailyMode(JSON.parse(JSON.stringify(s)),'2026-11-08'));assert(shouldPromptDailyMode(s,'2026-11-09'));s.records['2026-11-09']={mode:'rest'};assert(!shouldPromptDailyMode(s,'2026-11-09'));assert(!shouldPromptDailyMode(freshUniverse(),'2026-11-08'))});

test('宇宙のオーラは銀河作成と累計の記録日で育ち、同じ日を重複して数えない',()=>{
 const s=freshUniverse(),today='2026-11-09';
 applyMode(s,'2026-11-01','rest',today);
 s.logs['2026-11-01']={task:{name:'一歩目'}};
 s.records['2026-11-02']={mode:'none'};
 s.logs['2026-11-03']={};
 s.records['2026-11-10']={mode:'full'};
 assert.equal(universeGrowth(s,today).level,0);
 completeUniverse(s,'自分の宇宙','最初の目標');
 assert.deepEqual(universeGrowth(s,today),{level:1,days:1,strength:1/11,name:'最初の銀河',nextDay:2});
 s.logs['2026-11-08']={task:{name:'二歩目'}};
 assert.equal(universeGrowth(s,today).days,2);
 assert.equal(universeGrowth(s,today).level,2);
 assert.equal(universeGrowth(s,today).nextDay,3);
});

test('記録日の各節目でオーラの段階が一つずつ進み、66日で最終段階になる',()=>{
 const s=freshUniverse(),start='2026-08-01',today='2026-11-09';
 completeUniverse(s,'自分の宇宙','最初の目標');
 const thresholds=[2,3,5,7,10,14,21,30,45,66];
 for(let days=1;days<=70;days++){
  s.records[shiftDate(start,days-1)]={mode:'rest'};
  const crossed=thresholds.filter(day=>day<=days).length;
  const progress=universeGrowth(s,today);
  assert.equal(progress.level,1+crossed);
  assert.equal(progress.nextDay,thresholds[crossed]??null);
 }
 assert.equal(universeGrowth(s,today).strength,1);
});
