import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstPersonalTask,initialPersonalMap,onboardingDraft} from '../dist/onboarding.js';
import {createExampleDraft,exampleMap} from '../dist/example-map.js';
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

test('新規マインドマップは中心の目標だけで始まり、既存の編集途中のマップは引き継ぐ', () => {
  assert.deepEqual(initialPersonalMap({
    goal:'運動を続けたい', reason:'元気に出かけたい', reasonTwo:'家族と過ごしたい', values:'楽しい思い出をつくりたい'
  }), {name:exampleMap.name, children:[]});
  const sample = createExampleDraft();
  assert.ok(sample.children[0].children[0].children.length);
  const saved = onboardingDraft({step:'map', name:sample.name, map:sample});
  assert.deepEqual(initialPersonalMap(saved), sample);
});

test('理由を3回答えた後に作った個人のマップは、衛星の深さのタスクまで保持する', () => {
  const answers = {
    goal:'運動を続けたい', reason:'休日に元気に出かけたい',
    reasonTwo:'家族と過ごす時間を増やしたい', values:'家族と楽しい思い出をつくりたい'
  };
  const map = {name:exampleMap.name, children:[
    {name:'健康',kind:'goal',children:[
      {name:'運動',kind:'goal',children:[
        {name:'散歩',kind:'goal',children:[
          {name:'夕食後に歩く',kind:'action',daily:10,weekly:30,mode:'busy'}
        ]}
      ]}
    ]}
  ]};
  for (const step of ['arrival','statistics','login']) {
    const saved = onboardingDraft({step, name:'', recordedMode:'busy', map, ...answers});
    assert.deepEqual(saved, {step, name:'', recordedMode:'busy', map, ...answers});
    assert.equal(firstPersonalTask(saved.map).name, '夕食後に歩く');
  }
});
