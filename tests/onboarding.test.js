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

test('以前の回答を引き継いで一問にまとめ、空の名前では確認画面へ進まない', () => {
  const saved = {step:'ready',name:'自分の時間を持つ'};
  assert.deepEqual(onboardingDraft(saved), {step:'confirm',name:saved.name});
  assert.deepEqual(onboardingDraft({step:'custom',direction:'自分の時間を持ちたい'}), {step:'name',name:'自分の時間を持ちたい'});
  assert.deepEqual(onboardingDraft({step:'confirm',name:' '}), {step:'name',name:' '});
  assert.deepEqual(onboardingDraft(null), {step:'gaze',name:''});
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
