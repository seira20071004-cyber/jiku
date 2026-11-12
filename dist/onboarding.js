import {BANG_DURATION, GATHER_DURATION, IGNITION_DURATION, SPHERE_FORMATION_AT, startBirthSky} from './onboarding-sky.js';

const guestDraftKey = 'jiku:pending-universe';
const opening = {
  gaze: {prompt: '光を見つめてください。', duration: 4400, reducedDuration: 2800, next: 'gather'},
  gather: {prompt: 'もう少し、しっかり見つめてみて。', duration: GATHER_DURATION, reducedDuration: 2000, next: 'ignite'},
  ignite: {duration: IGNITION_DURATION, next: 'still'},
  still: {duration: 1050, next: 'bang'}
};

const suggestedGoal = '幸せな人生';
export const exampleMap = Object.freeze({
  name: suggestedGoal, galaxy: '健康を大切にする', task: '10分歩く', daily: '10', weekly: '30'
});
const goalOptions = [
  ['known', '明確に決まっている'],
  ['unsure', 'まだ決まっていない']
];
const focusOptions = {
  motivation: {
    label: 'やる気が湧かないとき',
    reply: 'やる気が湧かない日は、最初の一歩が重く感じますよね。',
    benefit: '宇宙を育てて自分の積み重ねが見えると、また取り組むきっかけが生まれます。'
  },
  unclear: {
    label: '何から手をつけるか迷うとき',
    reply: 'やることが大きすぎると、どこから始めればいいか迷いますよね。',
    benefit: '今日できることを一つ決めておくと、最初の一歩が見えてきます。'
  },
  distractions: {
    label: 'ほかのことに気を取られるとき',
    reply: '目の前にいろいろあると、大切にしたいことに戻るのは難しいですよね。',
    benefit: '今日の一歩を宇宙に置いておけば、気がそれたあとも何に戻るか思い出せます。'
  },
  busy: {
    label: '忙しくて余裕がないとき',
    reply: '忙しい日は、やりたいことに手が回らないこともありますよね。',
    benefit: 'Jikuでは、忙しい日にもできる小さな行動をあらかじめ用意できます。'
  }
};

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const legacyName = typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const priorAnswer = source.direction || source.custom;
  const name = ((typeof source.name === 'string' ? source.name : legacyName) ||
    (typeof priorAnswer === 'string' ? priorAnswer : '')).slice(0, 80);
  const focusBarrier = Object.hasOwn(focusOptions, source.focusBarrier) ? source.focusBarrier : null;
  let step = 'goal';
  if (name.trim() && source.step === 'map') step = 'map';
  else if (name.trim() && ['ready', 'confirm'].includes(source.step)) step = 'confirm';
  else if (name.trim() && ['gaze', 'focus'].includes(source.step)) step = source.step;
  else if (name.trim() && source.step === 'explain') step = focusBarrier ? 'explain' : 'focus';
  else if (source.step === 'suggest') step = 'suggest';
  else if (source.step === 'goal') step = 'goal';
  else if (name || source.step === 'name' || ['universe-name', 'galaxy', 'bang'].includes(legacy?.step)) step = 'name';
  const starter = {};
  for (const key of Object.keys(exampleMap)) {
    if (typeof source.starter?.[key] === 'string') starter[key] = source.starter[key].slice(0, 80);
  }
  return {name, ...(focusBarrier ? {focusBarrier} : {}), ...(Object.keys(starter).length ? {starter} : {}), step};
}

function guestDraft() {
  try { return onboardingDraft(JSON.parse(sessionStorage.getItem(guestDraftKey))); }
  catch { return null; }
}

export function pendingUniverse() {
  const draft = guestDraft();
  return draft?.step === 'confirm' ? draft : null;
}

export function clearPendingUniverse() {
  try { sessionStorage.removeItem(guestDraftKey); } catch {}
}

export function mountOnboarding(host, {
  initial, preview = false, previewStart = 'welcome',
  onDraft, onExample, onSave, onClose, onSettings, renderOrigin
} = {}) {
  const draft = onboardingDraft(initial);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = window.visualViewport;
  const events = new AbortController();
  const {signal} = events;
  let step, timer, formingTimer, sky, disposeOrigin, originRequested = false, saving = false;

  host.innerHTML = `
    <main class="birth-screen" aria-label="Jiku はじまりの宇宙">
      <div class="birth-sky" aria-hidden="true">
        <div class="birth-haze"></div><canvas class="birth-stars"></canvas><div class="birth-light"></div><div class="birth-origin"></div>
      </div>
      <header class="birth-header">
        <span class="birth-wordmark">Jiku<span>●</span></span>
        ${preview ? '<span class="birth-edition">初回体験プレビュー</span>' : ''}
        ${onClose ? '<button type="button" class="birth-quiet" data-birth="close">閉じる</button>' : ''}
        ${onSettings ? '<button type="button" class="birth-quiet" data-birth="settings" aria-label="Googleアカウントと設定">設定</button>' : ''}
      </header>
      <div class="birth-intro" aria-live="polite"></div>
      <div class="birth-content">
        <div class="birth-conversation" role="log" aria-label="Jikuとの会話" aria-relevant="additions"></div>
        <div class="birth-controls"></div>
        <p class="birth-error" role="alert" hidden></p>
      </div>
      <button type="button" class="birth-quiet birth-skip" data-birth="skip">演出をスキップ</button>
    </main>`;

  const screen = host.firstElementChild;
  const origin = screen.querySelector('.birth-origin');
  const intro = screen.querySelector('.birth-intro');
  const content = screen.querySelector('.birth-content');
  const conversation = screen.querySelector('.birth-conversation');
  const controls = screen.querySelector('.birth-controls');
  const note = screen.querySelector('.birth-error');
  const skip = screen.querySelector('[data-birth="skip"]');
  const persist = () => onDraft?.({...draft});
  function showError(message) {
    note.textContent = message;
    note.hidden = !message;
  }

  function message(tag, text, className) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function retireTurn() {
    conversation.querySelector('.is-leaving')?.remove();
    const previous = conversation.lastElementChild;
    if (!previous) return false;
    if (motion.matches) {
      previous.remove();
      return false;
    }
    previous.classList.add('is-leaving');
    if (previous.contains(document.activeElement)) document.activeElement.blur();
    previous.inert = true;
    previous.setAttribute('aria-hidden', 'true');
    previous.addEventListener('animationend', () => previous.remove(), {once: true, signal});
    return true;
  }

  function showTurn(text, className, from = 'Jiku', tag = 'p') {
    const transitioning = retireTurn();
    const turn = document.createElement('div');
    turn.className = `birth-turn ${className}`;
    turn.classList.toggle('is-arriving', transitioning);
    turn.append(message('span', from, 'birth-speaker'));
    const copy = message(tag, text, 'birth-copy');
    turn.append(copy);
    conversation.append(turn);
    content.scrollTop = 0;
    return copy;
  }

  function showSequence(turns, onReady, focus) {
    const show = (index, shouldFocus) => {
      if (index === turns.length) {
        onReady(shouldFocus);
        return;
      }
      const [text, className] = turns[index];
      const copy = showTurn(text, className);
      focusTurn(copy, shouldFocus);
      const readingTime = Math.max(4600, 1700 + text.length * 110);
      timer = setTimeout(() => show(index + 1, shouldFocus), readingTime);
    };
    show(0, focus);
  }

  function focusTurn(copy, focus) {
    if (!focus) return;
    copy.tabIndex = -1;
    copy.focus({preventScroll: true});
  }

  function choiceControls(options, label, canGoBack = false) {
    controls.innerHTML = `<div class="birth-choices" role="group" aria-label="${label}">${options.map(([id, text]) =>
      `<button class="birth-choice" type="button" data-choice="${id}">${text}<span aria-hidden="true">→</span></button>`
    ).join('')}</div>${canGoBack ? '<button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>' : ''}`;
  }

  function showQuestion(text, focus) {
    focusTurn(showTurn(text, 'birth-question', 'Jiku', 'h1'), focus);
  }

  function showComposer(focus) {
    showQuestion('いちばん大きな目標を教えてください。', focus);
    controls.innerHTML = `<form class="birth-form">
      <label class="birth-visually-hidden" for="birth-input">いちばん大きな目標</label>
      <input id="birth-input" maxlength="80" required enterkeyhint="done" autocomplete="off" placeholder="例：幸せな人生">
      <button class="birth-primary" type="submit">この目標で始める <span aria-hidden="true">→</span></button>
    </form><button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>`;
    const input = controls.querySelector('input');
    input.value = draft.name;
    controls.querySelector('button').disabled = !draft.name.trim();
  }

  function showFocusQuestion(focus, previous, witnessedBirth) {
    const showChoices = shouldFocus => {
      showQuestion('あなたは、どんなときに集中できませんか？', shouldFocus);
      choiceControls(Object.entries(focusOptions).map(([id, option]) => [id, option.label]), '集中しづらい場面');
    };
    if (previous === undefined) {
      showChoices(focus);
      return;
    }
    const turns = witnessedBirth ? [
      ['あなたが見つめた小さな光から、宇宙が生まれました。', 'birth-emphasis']
    ] : [];
    turns.push(
      ['目標に向かうときも、ひとつの光を見つめるときと同じです。', 'birth-welcome'],
      ['大切なことに意識を向けるところから、最初の一歩が始まります。', 'birth-emphasis']
    );
    showSequence(turns, showChoices, focus);
  }

  function explain(focus) {
    const option = focusOptions[draft.focusBarrier];
    showSequence([
      [option.reply, 'birth-reply'],
      ['でも、いい知らせがあります。', 'birth-emphasis'],
      [option.benefit, 'birth-reply'],
      ['この宇宙では、大きな目標を日々のタスクまで分けられます。', 'birth-emphasis'],
      ['欲しいものがはっきりしていると、そのために働いてお金を貯めようと思えますよね。', 'birth-welcome'],
      ['目標も同じで、何のためかがわかると、今日やることを自分で選びやすくなります。', 'birth-reply']
    ], shouldFocus => enter('confirm', {focus: shouldFocus}), focus);
  }

  function showMap(focus, editable) {
    showQuestion(editable ? 'あなたのマインドマップをつくりましょう。' : 'マインドマップのお手本', focus);
    const defaults = draft.name === exampleMap.name ? exampleMap : {
      ...exampleMap, galaxy: '目標に向けて始める', task: '今日できる一歩に10分取り組む'
    };
    const values = editable ? {...defaults, name: draft.name, ...draft.starter} : exampleMap;
    const field = (name, label, mark) => `<label class="birth-map-node">
      <span><i aria-hidden="true">${mark}</i> ${label}</span>
      <input name="${name}" maxlength="80" required ${editable ? '' : 'readonly'}>
    </label>`;
    controls.innerHTML = `<form class="birth-map-form">
      <div class="birth-map">
        ${field('name', '宇宙 · いちばん大きな目標', '◎')}
        ${field('galaxy', '銀河 · 目標につながるテーマ', '◉')}
        <div class="birth-map-branch">
          ${field('task', 'タスク · 今日の一歩', '✦')}
          <div class="birth-map-time">
            <label>1日（分）<input name="daily" type="number" min="1" max="1000000" required ${editable ? '' : 'readonly'}></label>
            <label>週の目標（分）<input name="weekly" type="number" min="1" max="1000000" required ${editable ? '' : 'readonly'}></label>
          </div>
        </div>
      </div>
      ${editable ? '<button class="birth-primary" type="submit">宇宙をつくる <span aria-hidden="true">→</span></button>' :
       '<button class="birth-primary" type="button" data-birth="example">宇宙船に乗る <span aria-hidden="true">→</span></button>'}
    </form>`;
    const form = controls.querySelector('form');
    for (const [key, value] of Object.entries(values)) form.elements.namedItem(key).value = value;
  }

  function chooseGoal(name) {
    draft.name = name;
    delete draft.focusBarrier;
    enter('gaze');
  }

  function prepareOrigin() {
    if (originRequested) return;
    originRequested = true;
    const getRenderer = renderOrigin ? Promise.resolve(renderOrigin) : import('./origin-preview.js').then(module => module.mountOriginPreview);
    getRenderer.then(render => {if (!signal.aborted) disposeOrigin = render(origin, motion);}).catch(() => {});
  }

  function enter(next, {focus = false, witnessedBirth = false} = {}) {
    clearTimeout(timer);
    clearTimeout(formingTimer);
    const previous = step;
    step = next;
    screen.dataset.stage = next;
    const choosing = ['welcome', 'goal', 'name', 'suggest'].includes(next);
    screen.toggleAttribute('data-choosing', choosing);
    screen.toggleAttribute('data-chat', !choosing && !Object.hasOwn(opening, next) && next !== 'bang');
    screen.toggleAttribute('data-map', next === 'confirm' || next === 'map');
    if (choosing || next === 'gaze') delete screen.dataset.forming;
    sky?.stage(next);
    skip.hidden = !Object.hasOwn(opening, next) && next !== 'bang';
    origin.toggleAttribute('data-lit', next === 'confirm');
    intro.replaceChildren();
    controls.replaceChildren();
    showError('');

    if (choosing || ['gaze', 'focus', 'explain', 'confirm', 'map'].includes(next)) {
      if (next !== 'welcome') {
        draft.step = next;
        persist();
      }
    }
    if (next === 'welcome') {
      showQuestion('Jikuへようこそ。', focus);
      const description = message('p', 'あなたの目標達成をサポートします。', 'birth-welcome-description');
      conversation.lastElementChild.append(description);
      controls.innerHTML = `<p class="birth-login-instruction">まずはログインしてください。</p>
        <button class="birth-primary" type="button" data-birth="preview-login">ログイン後の画面へ <span aria-hidden="true">→</span></button>`;
      return;
    }
    if (next === 'goal') {
      const showGoal = shouldFocus => {
        showQuestion('すでに大きな目標が明確に決まっていますか？', shouldFocus);
        choiceControls(goalOptions, '目標について');
      };
      if (previous === undefined || previous === 'welcome') {
        focusTurn(showTurn('最初にあなたに聞きたいことがあります！', 'birth-emphasis'), focus);
        timer = setTimeout(() => showGoal(focus), 2200);
      } else showGoal(focus);
      return;
    }
    if (next === 'name') {
      showComposer(focus);
      return;
    }
    if (next === 'suggest') {
      showQuestion('では、まず「幸せな人生」を目標にしてみましょう。', focus);
      controls.innerHTML = `<button class="birth-primary" type="button" data-birth="suggested">「幸せな人生」で始める <span aria-hidden="true">→</span></button>
        <button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>`;
      return;
    }

    if (next !== 'gaze') prepareOrigin();
    if (Object.hasOwn(opening, next)) {
      retireTurn();
      const {prompt, duration, reducedDuration, next: following} = opening[next];
      if (prompt) intro.append(message('p', prompt, 'birth-prompt'));
      timer = setTimeout(() => {
        enter(motion.matches && next !== 'gaze' ? 'focus' : following);
      }, motion.matches ? reducedDuration ?? 0 : duration);
      return;
    }
    if (next === 'bang') {
      retireTurn();
      formingTimer = setTimeout(() => {screen.dataset.forming = '';}, SPHERE_FORMATION_AT);
      timer = setTimeout(() => enter('focus', {witnessedBirth: true}), BANG_DURATION);
      return;
    }
    if (next === 'focus') showFocusQuestion(focus, previous, witnessedBirth);
    else if (next === 'explain') explain(focus);
    else showMap(focus, next === 'map');
  }

  async function saveMap(starter) {
    if (step !== 'map' || saving) return;
    saving = true;
    controls.querySelectorAll('button').forEach(button => {button.disabled = true;});
    showError('');
    try {
      await onSave(starter);
    } catch {
      showError('目標を保存できませんでした。もう一度お試しください。');
    } finally {
      saving = false;
      controls.querySelectorAll('button').forEach(button => {button.disabled = false;});
    }
  }

  screen.addEventListener('click', event => {
    const button = event.target.closest('button');
    const action = button?.dataset.birth;
    const choice = button?.dataset.choice;
    if (step === 'goal' && choice === 'known') enter('name', {focus: true});
    if (step === 'welcome' && action === 'preview-login') enter('goal', {focus: true});
    if (step === 'goal' && choice === 'unsure') enter('suggest', {focus: true});
    if (step === 'focus' && Object.hasOwn(focusOptions, choice)) {
      draft.focusBarrier = choice;
      enter('explain', {focus: true});
    }
    if (action === 'suggested') chooseGoal(suggestedGoal);
    if (action === 'skip') enter('focus', {focus: true});
    if (action === 'back') enter('goal', {focus: true});
    if (action === 'close') onClose?.();
    if (action === 'settings') onSettings?.();
    if (step === 'confirm' && action === 'example') onExample({...draft, step: 'map'});
  }, {signal});
  screen.addEventListener('input', event => {
    if (step === 'map' && event.target.form?.classList.contains('birth-map-form')) {
      draft.starter = Object.fromEntries(new FormData(event.target.form));
      persist();
      return;
    }
    if (event.target.id !== 'birth-input') return;
    draft.name = event.target.value;
    controls.querySelector('button').disabled = !draft.name.trim();
    persist();
  }, {signal});
  screen.addEventListener('submit', event => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target.classList.contains('birth-map-form')) {
      const starter = Object.fromEntries([...new FormData(event.target)].map(([key, value]) => [key, value.trim()]));
      if (step === 'map' && Object.values(starter).every(Boolean)) saveMap(starter);
      else if (step === 'map') showError('目標・銀河・タスクの名前を入力してください。');
      return;
    }
    const value = controls.querySelector('input').value.trim();
    if (!value) return;
    chooseGoal(value);
  }, {signal});

  function resizeViewport() {
    const keyboard = viewport && viewport.scale === 1 && innerHeight - viewport.height > 110;
    screen.classList.toggle('birth-keyboard', Boolean(keyboard));
    screen.style.setProperty('--birth-viewport', keyboard ? `${viewport.height}px` : '100svh');
    screen.style.setProperty('--birth-top', keyboard ? `${viewport.offsetTop}px` : '0px');
  }
  viewport?.addEventListener('resize', resizeViewport, {signal});
  viewport?.addEventListener('scroll', resizeViewport, {signal});
  resizeViewport();
  sky = startBirthSky(screen.querySelector('.birth-stars'), origin, motion);
  enter(preview ? previewStart : draft.step);
  return {dispose() {
    clearTimeout(timer); clearTimeout(formingTimer); events.abort();
    sky?.dispose(); disposeOrigin?.();
  }};
}
