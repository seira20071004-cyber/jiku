import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 seed,applyMode,quantitySummary,recordEventCompletion,undoEventCompletion,validate,setTaskRecord
} from '../dist/model.js';
import {writeGoal} from '../dist/universe-model.js';
import {weeklyPanel} from '../dist/quantity-view.js';

test('3か月レポートは選んだタスクだけの日数と月間目標を合算する',()=>{
 const state=seed(),today='2026-01-10';
 const task=writeGoal(state,{name:'朝の読書',purpose:'本を読む',parentId:'health',kind:'action',
  measurement:{unit:'minutes',dailyAmount:30,monthlyTarget:60}});
 const other=writeGoal(state,{name:'散歩',purpose:'運動する',parentId:'health',kind:'action',
  measurement:{unit:'minutes',dailyAmount:30,monthlyTarget:60}});
 setTaskRecord(state,'2025-10-31',task,30,[],today);
 setTaskRecord(state,'2025-11-01',task,30,[],today);
 setTaskRecord(state,'2025-12-08',task,30,[],today);
 setTaskRecord(state,'2026-01-10',task,30,[],today);
 setTaskRecord(state,'2026-01-10',other,60,[],today);
 const html=weeklyPanel(state,{scope:task,today,month:'2026-01',quarter:true});
 assert.match(html,/11\/1 <i>—<\/i> 1\/31/);
 assert.match(html,/達成率 50%/);
 assert.match(html,/<strong>3日<\/strong>記録しました/);
 assert.match(html,/期間内の累積時間は 1\.5時間/);
 assert.doesNotMatch(html,/散歩/);
});

test('イベントはモードで記録せず、完了日を一度だけ集計し取り消せる',()=>{
 const state=seed(),today='2026-11-09';
 const id=writeGoal(state,{name:'ハッカソンに参加',purpose:'チーム開発を試す',parentId:'dev',kind:'action',eventDate:'2026-11-10',measurement:{unit:'minutes',dailyAmount:120,extras:[{unit:'count',dailyAmount:1}]}});
 applyMode(state,today,'full',today);
 assert.equal(state.logs[today]?.[id],undefined);
 assert.throws(()=>recordEventCompletion(state,id,'2026-11-10',today));
 recordEventCompletion(state,id,today,today);
 recordEventCompletion(state,id,'2026-11-08',today);
 assert.equal(state.logs['2026-11-08']?.[id],undefined);
 assert.equal(state.settings[id].status,'completed');
 const summary=quantitySummary(state,today,today);
 assert.equal(summary.unknown,0);
 assert.equal(summary.groups.find(g=>g.dimension==='time').total,2);
 assert.equal(summary.groups.find(g=>g.dimension==='count').total,1);
 validate(JSON.parse(JSON.stringify(state)));
 undoEventCompletion(state,id);
 assert.equal(state.logs[today]?.[id],undefined);
 assert.equal(state.settings[id].status,'active');
});

test('月間目標だけのタスクは月の履歴で集計され、週の目標には換算されない',()=>{
 const state=seed(),today='2026-11-09';
 const id=writeGoal(state,{name:'読書',purpose:'知識を広げる',parentId:'health',kind:'action',measurement:{unit:'minutes',dailyAmount:30,monthlyTarget:600}});
 setTaskRecord(state,today,id,30,[],today);
 const week=quantitySummary(state,'2026-11-09','2026-11-15',id,false,'week');
 const month=quantitySummary(state,'2026-11-01','2026-11-30',id,false,'month');
 assert.equal(week.rows[0].target,null);
 assert.equal(month.rows[0].target,10);
 assert.equal(month.rows[0].amount,.5);
});
