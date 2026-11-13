import {test} from 'node:test';import assert from 'node:assert/strict';
import {seed,setQuantity,quantitySummary,moveNode,deleteNode,MODES} from '../dist/model.js';
import {statisticsGoals,statisticsScope,boundedMonth,weeklyTaskSections} from '../dist/universe-model.js';
test('集計の選択肢には目標だけを返し、タスク単体は親目標へまとめる',()=>{const s=seed();const ids=statisticsGoals(s).map(n=>n.id);assert.deepEqual(ids.sort(),['dev','english','health'].sort());assert.equal(statisticsScope(s,'read'),'health');assert.equal(statisticsScope(s,'project'),'dev');assert.equal(statisticsScope(s,'health'),'health');assert.equal(statisticsScope(s,'root'),'all');assert.equal(statisticsScope(s,'missing'),'all')});
test('今月を超えず、年境界をまたいで過去の月を表示できる',()=>{assert.equal(boundedMonth('2026-11',1,'2026-11-08'),'2026-11');assert.equal(boundedMonth('2026-01',-1,'2026-11-08'),'2025-12');assert.equal(boundedMonth('2026-10',1,'2026-11-08'),'2026-11')});
test('同じタスクを移動した週も、記録当時の銀河ごとに量を分ける',()=>{const s=seed();s.settings.read.measurement={unit:'pages',weeklyTarget:null};setQuantity(s,'2026-11-02','read',10,'2026-11-08');moveNode(s,'read','english');setQuantity(s,'2026-11-03','read',5,'2026-11-08');const summary=quantitySummary(s,'2026-11-02','2026-11-08','all',false),groups=weeklyTaskSections(s,summary);assert.equal(groups.find(g=>g.id==='health').rows[0].amount,10);assert.equal(groups.find(g=>g.id==='english').rows[0].amount,5);assert.equal(summary.groups[0].total,15);deleteNode(s,'health');const kept=weeklyTaskSections(s,quantitySummary(s,'2026-11-02','2026-11-08','all',false));assert.equal(kept.find(g=>g.id==='health').name,'心と体を整える')});
test('目標内の集計はその目標の見出しで表示し、異なる単位は混ぜない',()=>{const s=seed();s.settings.read.measurement={unit:'pages',weeklyTarget:null};s.settings.walk.measurement={unit:'minutes',weeklyTarget:null};setQuantity(s,'2026-11-02','read',10,'2026-11-08');setQuantity(s,'2026-11-02','walk',30,'2026-11-08');const summary=quantitySummary(s,'2026-11-02','2026-11-08','health',false),sections=weeklyTaskSections(s,summary,'health');assert.equal(sections.length,1);assert.equal(sections[0].name,'心と体を整える');assert.equal(sections[0].rows.length,2);assert.equal(summary.groups.find(g=>g.dimension==='time').total,.5);assert.equal(summary.groups.find(g=>g.dimension==='pages').total,10)});

import {recordMode,modeDistribution} from '../dist/model.js';
test('記録なしと何もしなかった日は同じモード・割合にまとめ、未来を数えず記録を変更しない',()=>{const s=seed();s.records={'2026-11-02':{mode:'full'},'2026-11-03':{mode:'none'},'2026-11-04':{mode:'busy'},'2026-11-05':{mode:'rest'},'2026-11-10':{mode:'full'}};const before=JSON.stringify(s);assert.equal(recordMode(s,'2026-11-03'),'none');assert.equal(recordMode(s,'2026-11-06'),'none');assert.deepEqual(modeDistribution(s,'2026-11-02','2026-11-15','2026-11-09'),{counts:{full:1,busy:1,rest:1,none:5},days:8});assert.deepEqual(modeDistribution(s,'2026-11-10','2026-11-15','2026-11-09'),{counts:{full:0,busy:0,rest:0,none:0},days:0});assert.equal(JSON.stringify(s),before)});

import {analysisData,analysisChart} from '../dist/quantity-view.js';
import {freshUniverse,writeGoal} from '../dist/universe-model.js';
import {setTaskRecord} from '../dist/model.js';
test('階層を合計し、超過と不足が累計で相殺される',()=>{
 const state=freshUniverse();
 const goal=writeGoal(state,{name:'健康',purpose:'元気に過ごす',parentId:'root'});
 const task=writeGoal(state,{name:'歩く',purpose:'外に出る',parentId:goal,kind:'action',
  measurement:{unit:'minutes',dailyAmount:30,weeklyTarget:60},mode:'rest'});
 setTaskRecord(state,'2026-11-03',task,72,[],'2026-11-14');
 setTaskRecord(state,'2026-11-10',task,48,[],'2026-11-14');
 const period={start:'2026-11-01',end:'2026-11-14',weeks:2};
 const {items,root}=analysisData(state,period);
 assert.equal(root.actual,2);
 assert.equal(root.target,2);
 assert.equal(items.get(goal).actual,2);
 assert.deepEqual(items.get(task).weekly,[{actual:1.2,target:1},{actual:.8,target:1}]);
 const chart=analysisChart(state,{...period,scope:task});
 assert.match(chart,/<td>120%<\/td>\s*<td>120%<\/td>/);
 assert.match(chart,/<td>80%<\/td>\s*<td>100%<\/td>/);
});
