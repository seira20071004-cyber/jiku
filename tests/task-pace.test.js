import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMode,setTaskRecord,taskPaceWarnings} from '../dist/model.js';
import {freshUniverse,writeGoal} from '../dist/universe-model.js';

function create(s,measurement){
 return writeGoal(s,{name:'過去問を解く',purpose:'苦手を見つける',parentId:'root',kind:'action',
  mode:'rest',measurement:{unit:'minutes',dailyAmount:30,...measurement}});
}

test('残り2日で週目標120分なら2倍を警告し、確定した記録を引く',()=>{
 const s=freshUniverse(),id=create(s,{weeklyTarget:120}),today='2026-11-14';
 assert.equal(taskPaceWarnings(s,'2026-11-09').has(id),false);
 applyMode(s,today,'busy',today);
 assert.deepEqual(taskPaceWarnings(s,today).get(id),
  {type:'week',days:2,needed:60,ratio:2,daily:30,unit:'分'});
 setTaskRecord(s,today,id,30,[],today);
 assert.equal(taskPaceWarnings(s,today).has(id),false);
});

test('期限までの別単位の必要量は当週より前の確定実績も差し引く',()=>{
 const s=freshUniverse(),today='2026-11-14';
 const id=create(s,{weeklyTarget:90,totalTarget:200,deadline:'2026-11-15',
  extras:[{unit:'questions',dailyAmount:10,totalTarget:100}]});
 setTaskRecord(s,'2026-11-01',id,100,[50],today);
 const warning=taskPaceWarnings(s,today).get(id);
 assert.equal(warning?.type,'deadline');
 assert.equal(warning?.needed,25);
 assert.equal(warning?.unit,'問');
});
