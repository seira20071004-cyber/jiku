import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onboardingDraft} from '../dist/onboarding.js';
import {completeUniverse,freshUniverse,writeGoal} from '../dist/universe-model.js';
import {validate} from '../dist/model.js';

test('旧版で銀河の入力まで進んだユーザーは宇宙名を引き継げる', () => {
  assert.equal(onboardingDraft(null, {step:'bang'}).step, 'name');
  const draft = onboardingDraft(null, {step:'galaxy',draftName:'ものづくりを続ける'});
  assert.equal(draft.step, 'name');
  assert.equal(draft.name, 'ものづくりを続ける');
});

test('命名の下書きと自由回答を保持し、不整合のある分岐は戻す', () => {
  const saved = {step:'ready',goal:'まだない',direction:'自分の時間を持ちたい',name:'自分の時間を持つ'};
  const draft = onboardingDraft(saved);
  assert.equal(draft.step, 'ready');
  assert.equal(draft.name, saved.name);
  assert.equal(draft.direction, saved.direction);
  assert.equal(onboardingDraft({...saved,name:' '}).step, 'name');
  assert.equal(onboardingDraft({step:'custom',goal:'ある',direction:'古い回答'}).step, 'goal');
  assert.equal(onboardingDraft({step:'goal',goal:'ある',direction:'古い回答'}).direction, '');
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
