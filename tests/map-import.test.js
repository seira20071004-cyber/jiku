import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewMapImport} from '../dist/map-import.js';
import {freshUniverse,writeGoal} from '../dist/universe-model.js';
import {validate,timeMeasurement} from '../dist/model.js';

const task={kind:'task',name:'過去問',purpose:'傾向を知る',mode:'busy',deadline:'2027-04-01',
 time:{total:1800,weekly:300,daily:60},extras:[{unit:'questions',total:600,weekly:100,daily:20}]};
const goal={kind:'goal',name:'応用情報',purpose:'技術の基礎を固める',children:[task]};
const plan=nodes=>JSON.stringify({version:1,nodes});

test('追加先の下に目標とタスクをプレビューし、期限・単位・既存記録を維持する',()=>{
 const state=freshUniverse();
 state.records['2026-11-12']={mode:'rest'};
 const parent=writeGoal(state,{name:'仕事',purpose:'力をつける',parentId:'root'});
 const before=structuredClone(state);
 const result=previewMapImport(state,'```json\n'+plan([goal])+'\n```',parent);
 const [added]=result.nodes,[leaf]=added.children;
 assert.deepEqual(state,before);
 assert.deepEqual(result.counts,{goal:1,task:1});
 const data=validate(JSON.parse(JSON.stringify(result.next)));
 assert.equal(data.nodes.find(n=>n.id===added.id).parentId,parent);
 assert.equal(data.nodes.find(n=>n.id===leaf.id).parentId,added.id);
 assert.deepEqual(data.records,before.records);
 assert.deepEqual(data.settings[leaf.id].modes,['full','busy']);
 const m=timeMeasurement(data.settings[leaf.id].measurement);
 assert.equal(m.deadline,task.deadline);
 assert.equal(m.dailyAmount,60);
 assert.equal(m.extras[0].weeklyTarget,100);
});
test('途中の項目に不備があるJSONを一部だけ取り込まない',()=>{
 const state=freshUniverse(),before=structuredClone(state);
 assert.throws(()=>previewMapImport(state,plan([goal,{...task,deadline:'2027-02-30'}]),'root'),/2 過去問.*期限/);
 assert.throws(()=>previewMapImport(state,plan([{...goal,children:[{...goal,children:[{...goal,children:[goal]}]}]}]),'root'),/5階層/);
 assert.throws(()=>previewMapImport(state,plan([{...task,extras:[task.extras[0],task.extras[0]]}]),'root'),/重複/);
 assert.deepEqual(state,before);
});
