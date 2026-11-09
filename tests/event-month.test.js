import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 seed,applyMode,quantitySummary,recordEventCompletion,undoEventCompletion,validate,setTaskRecord
} from '../dist/model.js';
import {writeGoal} from '../dist/universe-model.js';

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
