import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialPersonalMap,onboardingDraft} from '../dist/onboarding.js';
import {exampleMap} from '../dist/example-map.js';
import {completeUniverse,freshUniverse,writeGoal} from '../dist/universe-model.js';
import {validate} from '../dist/model.js';

test('旧版で銀河の入力まで進んだユーザーは宇宙名を引き継げる', () => {
  assert.equal(onboardingDraft(null, {step:'bang'}).step, 'name');
  const draft = onboardingDraft(null, {step:'galaxy',draftName:'ものづくりを続ける'});
  assert.equal(draft.step, 'name');
  assert.equal(draft.name, 'ものづくりを続ける');
});

test('以前の回答を引き継ぎ、空の名前では確認画面へ進まない', () => {
  const saved = {step:'ready',name:'自分の時間を持つ'};
  assert.deepEqual(onboardingDraft(saved), {step:'confirm',name:saved.name});
  assert.deepEqual(onboardingDraft({step:'custom',direction:'自分の時間を持ちたい'}), {step:'name',name:'自分の時間を持ちたい'});
  assert.deepEqual(onboardingDraft({step:'confirm',name:' '}), {step:'name',name:' '});
  assert.deepEqual(onboardingDraft(null), {step:'goal',name:''});
});

test('新しい会話では目標と集中の回答が残り、以前の入力とログイン直前の状態も引き継ぐ', () => {
  assert.deepEqual(onboardingDraft({step:'interest',name:'仮の目標',interest:'try'}),
    {step:'name',name:'仮の目標'});
  assert.deepEqual(onboardingDraft({step:'name',name:'学び直したい',interest:'continue'}),
    {step:'name',name:'学び直したい'});
  assert.deepEqual(onboardingDraft({step:'interest',interest:'invalid'}), {step:'goal',name:''});
  assert.deepEqual(onboardingDraft({step:'practice',interest:'continue',friction:'time'}),
    {step:'goal',name:''});
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
