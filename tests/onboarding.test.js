import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstPersonalTask,initialPersonalMap,onboardingDraft} from '../dist/onboarding.js';
import {exampleMap} from '../dist/example-map.js';
import {completeUniverse,freshUniverse,writeGoal} from '../dist/universe-model.js';
import {validate} from '../dist/model.js';

test('旧版の入力途中からは目標の質問を挟まず宇宙誕生へ進む', () => {
  assert.equal(onboardingDraft(null, {step:'bang'}).step, 'gaze');
  const draft = onboardingDraft(null, {step:'galaxy',draftName:'ものづくりを続ける'});
  assert.equal(draft.step, 'gaze');
  assert.equal(draft.name, 'ものづくりを続ける');
});

test('新規は光を見つめる画面から始まり、途中の画面は目標名なしで再開できる', () => {
  const saved = {step:'ready',name:'自分の時間を持つ'};
  assert.deepEqual(onboardingDraft(saved), {step:'confirm',name:saved.name});
  assert.deepEqual(onboardingDraft({step:'custom',direction:'自分の時間を持ちたい'}), {step:'gaze',name:'自分の時間を持ちたい'});
  assert.deepEqual(onboardingDraft({step:'confirm',name:''}), {step:'confirm',name:''});
  assert.deepEqual(onboardingDraft({step:'map',name:''}), {step:'map',name:''});
  assert.deepEqual(onboardingDraft(null), {step:'gaze',name:''});
});

test('新しい会話では目標と集中の回答が残り、以前の入力とログイン直前の状態も引き継ぐ', () => {
  assert.deepEqual(onboardingDraft({step:'interest',name:'仮の目標',interest:'try'}),
    {step:'gaze',name:'仮の目標'});
  assert.deepEqual(onboardingDraft({step:'name',name:'学び直したい',interest:'continue'}),
    {step:'gaze',name:'学び直したい'});
  assert.deepEqual(onboardingDraft({step:'interest',interest:'invalid'}), {step:'gaze',name:''});
  assert.deepEqual(onboardingDraft({step:'practice',interest:'continue',friction:'time'}),
    {step:'gaze',name:''});
  assert.deepEqual(onboardingDraft({step:'confirm',name:'学び直したい',interest:'continue',friction:'time'}),
    {step:'confirm',name:'学び直したい'});
  assert.deepEqual(onboardingDraft({step:'gaze',name:'幸せな人生'}),
    {step:'gaze',name:'幸せな人生'});
  assert.deepEqual(onboardingDraft({step:'explain',name:'幸せな人生',focusBarrier:'motivation'}),
    {step:'explain',name:'幸せな人生',focusBarrier:'motivation'});
  assert.deepEqual(onboardingDraft({step:'explain',name:'幸せな人生',focusBarrier:'invalid'}),
    {step:'focus',name:'幸せな人生'});
  const starter = {name:'', galaxy:'英語を学ぶ', task:'教材を読む', daily:'15', weekly:'45'};
  assert.deepEqual(onboardingDraft({step:'map',name:'幸せな人生',starter}),
    {step:'map',name:'幸せな人生',starter});
});

test('宇宙の誕生は根だけを保存し、再実行で名前や後から作った銀河を変更しない', () => {
  const state = freshUniverse();
  assert.throws(() => completeUniverse(state, '  '));
  assert.equal(completeUniverse(state, ' 自分の宇宙 '), 'root');
  assert.equal(state.nodes.length, 1);
  assert.equal(state.universe.onboarded, true);
  writeGoal(state, {name:'個人開発',purpose:'アイデアを形にする',parentId:'root',kind:'goal'});
  const before = structuredClone(state);
  completeUniverse(state, '別の名前');
  assert.deepEqual(state, before);
  assert.equal(state.nodes[0].name, '自分の宇宙');
  validate(state);
});

test('途中保存したマインドマップは目標の名前、枝の順序、タスクの時間を引き継ぐ', () => {
  const map = {name:'自分らしく暮らす',children:[
    {name:'健康',kind:'goal',children:[
      {name:'体を動かす',kind:'goal',children:[{name:'歩く',kind:'action',daily:15,weekly:45}]}
    ]},
    {name:'英語',kind:'goal',children:[{name:'本を読む',kind:'action',daily:20,weekly:60}]}
  ]};
  const draft = {step:'map',name:'幸せな人生',map};
  assert.deepEqual(onboardingDraft(JSON.parse(JSON.stringify(draft))), draft);
});

test('新規マインドマップは見本を全階層でコピーし、編集しても見本に影響しない', () => {
  const map = initialPersonalMap({name:'自分らしく暮らす'});
  assert.equal(map.name, exampleMap.name);
  assert.deepEqual(map.children.map(branch => branch.name), exampleMap.branches.map(branch => branch.name));
  assert.deepEqual(map.children.map(branch => branch.children.map(goal =>
    goal.children.map(({name, daily, weekly, mode}) => [name, daily, weekly, mode]))),
    exampleMap.branches.map(branch => branch.goals.map(goal => goal.tasks)));
  const task = map.children[0].children[0].children[0];
  task.name = '少し長めに歩く';
  assert.equal(initialPersonalMap({}).children[0].children[0].children[0].name, '10分歩く');
  const resumed = onboardingDraft({name:map.name, step:'map', map});
  assert.deepEqual(initialPersonalMap(resumed), map);
});


test('会話の回答を本人の枝に反映し、着陸とログインを再開できる', () => {
  const answers = {goal:'運動を続けたい', reason:'休日に元気に出かけたい', values:'家族と出かける日を増やす'};
  const draft = onboardingDraft({step:'meaning', ...answers});
  assert.deepEqual(draft, {name:'', step:'meaning', ...answers});
  const map = initialPersonalMap(draft);
  const branch = map.children[0];
  assert.equal(map.name, '幸せな人生');
  assert.equal(branch.name, answers.values);
  assert.equal(branch.children[0].name, answers.goal);
  assert.equal(branch.children[0].purpose, answers.reason);
  branch.children[0].children.push({name:'夕食後に歩く', kind:'action', daily:10, weekly:30, mode:'busy'});
  assert.deepEqual(firstPersonalTask(map), {
    name:'夕食後に歩く', kind:'action', daily:10, weekly:30, mode:'busy', branch:answers.values
  });
  for (const step of ['arrival', 'login']) {
    const saved = {name:'', step, ...answers, map};
    assert.deepEqual(onboardingDraft(JSON.parse(JSON.stringify(saved))), saved);
  }
});

test('理由を3回答えた枝では、本人のタスクを衛星の深さまで保存できる', () => {
  const answers = {
    goal:'運動を続けたい', reason:'休日に元気に出かけたい',
    reasonTwo:'家族と過ごす時間を増やしたい', values:'家族と楽しい思い出をつくりたい'
  };
  const map = initialPersonalMap(onboardingDraft({step:'meaning', ...answers}));
  const branch = map.children[0];
  assert.equal(branch.name, answers.values);
  assert.equal(branch.purpose, answers.reasonTwo);
  assert.equal(branch.children[0].name, answers.reason);
  const goal = branch.children[0].children[0];
  assert.equal(goal.name, answers.goal);
  goal.children.push({name:'夕食後に歩く', kind:'action', daily:10, weekly:30, mode:'busy'});
  const saved = onboardingDraft({step:'statistics', recordedMode:'busy', map, ...answers});
  assert.equal(saved.recordedMode, 'busy');
  assert.equal(saved.step, 'statistics');
  assert.equal(firstPersonalTask(saved.map).name, '夕食後に歩く');
  assert.deepEqual(saved.map, map);
});
