import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyMode,quantitySummary,seed,setQuantity,setTaskRecord,taskRecordFields,validate} from '../dist/model.js';
import {writeGoal,timeGoalProgress} from '../dist/universe-model.js';

const today='2026-11-09';
test('モードは時間と複数の単位を記録し、修正後は二重に加算しない',()=>{
 const state=seed();
 const input={name:'英語で読む',purpose:'語彙を増やす',parentId:'english',kind:'action'};
 const extras=[{unit:'pages',dailyAmount:10,weeklyTarget:50},{unit:'words',dailyAmount:8}];
 assert.throws(()=>writeGoal(state,{...input,measurement:{unit:'minutes',dailyAmount:30,weeklyTarget:120,extras:[extras[0],extras[0]]}}));
 const id=writeGoal(state,{...input,measurement:{unit:'minutes',dailyAmount:30,weeklyTarget:120,extras}});
 applyMode(state,today,'full',today);
 assert.deepEqual(taskRecordFields(state,today,id).extraAmounts,[10,8]);
 setTaskRecord(state,today,id,45,[12,9],today);
 applyMode(state,today,'full',today);
 const summary=quantitySummary(state,today,today,'english');
 assert.deepEqual(summary.entries.map(entry=>entry.amount),[45,12,9]);
 assert.equal(timeGoalProgress(summary.rows).achievement.percent,38);
 assert.equal(timeGoalProgress(summary.rows).target,2);
 validate(JSON.parse(JSON.stringify(state)));
});

test('時間なしの過去記録は数量のまま扱い、時間を追加しても数量は残る',()=>{
 const state=seed();
 state.settings.read.measurement={unit:'pages',dailyAmount:10,weeklyTarget:50};
 setQuantity(state,today,'read',12,today);
 const original=quantitySummary(state,today,today,'health');
 assert.equal(timeGoalProgress(original.rows).achievement,null);
 assert.equal(original.groups.find(group=>group.dimension==='time'),undefined);
 setTaskRecord(state,today,'read',25,[12],today);
 const updated=quantitySummary(state,today,today,'health',false);
 assert.equal(updated.groups.find(group=>group.dimension==='pages').total,12);
 assert.equal(updated.groups.find(group=>group.dimension==='time').total,.416667);
 assert.equal(timeGoalProgress(updated.rows).achievement,null);
});

test('目標全体の達成率は時間の合計から計算し、他の単位と目標未設定の時間を除く',()=>{
 const result=timeGoalProgress([
  {dimension:'time',amount:2,target:2},{dimension:'time',amount:2,target:6},
  {dimension:'time',amount:4,target:null},{dimension:'pages',amount:20,target:20}
 ]);
 assert.equal(result.count,2);
 assert.equal(result.achievement.percent,50);
});
