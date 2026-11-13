import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyMode,quantitySummary,seed,setQuantity,setTaskRecord,taskRecordFields,validate,paceForDeadline,timeMeasurement} from '../dist/model.js';
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

test('期限は今日を含み、全体の目標と逆算した配分を保存できる',()=>{
 const state=seed();
 const plan=paceForDeadline(420,'2026-11-01','2026-11-14');
 assert.deepEqual(plan,{totalTarget:420,weeklyTarget:210,dailyAmount:30,days:14});
 assert.equal(paceForDeadline(120,'2026-11-01','2026-11-02').weeklyTarget,120);
 assert.throws(()=>paceForDeadline(120,'2026-11-01','2026-10-31'));
 assert.throws(()=>paceForDeadline(120,'2026-11-01','2026-11-31'));
 const id=writeGoal(state,{name:'読書',purpose:'知識を広げる',parentId:'health',kind:'action',
  measurement:{unit:'minutes',dailyAmount:plan.dailyAmount,totalTarget:plan.totalTarget,
   extras:[{unit:'pages',totalTarget:70,weeklyTarget:35,dailyAmount:5}]}});
 const saved=validate(JSON.parse(JSON.stringify(state))).settings[id].measurement;
 assert.equal(timeMeasurement(saved).totalTarget,420);
 assert.equal(timeMeasurement({...saved,unit:'hours',totalTarget:7}).totalTarget,420);
 assert.equal(saved.extras[0].totalTarget,70);
 assert.equal(saved.weeklyTarget,undefined);
});
