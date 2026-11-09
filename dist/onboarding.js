import {BANG_DURATION, SPHERE_FORMATION_AT, startBirthSky} from './onboarding-sky.js';

const guestDraftKey = 'jiku:pending-universe';
const googlePath = '/api/auth/google';
const opening = {
  gaze: ['光を見つめてください。', 2800],
  gather: ['もう少し、しっかり見つめてみて。', 2000]
};

const welcomeLines = [
  'あなたの宇宙が、誕生しました。',
  'ここでは、大きな目標を今日できる一歩まで分けられます。'
];

const interests = {
  try: {
    label: 'やってみたいことがある',
    question: '何をやってみたいですか？',
    example: '自分のサービスを作りたい'
  },
  continue: {
    label: '続けたいことがある',
    question: 'それを続けて、どうなれたらうれしいですか？',
    example: '英語で気軽に話せるようになりたい'
  },
  unsure: {
    label: 'まだ思いつかない',
    question: 'どんな時間が少し増えたら、うれしいですか？',
    example: '好きなことをする時間を増やしたい'
  }
};

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const legacyName = typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const name = (typeof source.name === 'string' ? source.name : legacyName).slice(0, 80);
  const priorAnswer = source.direction || source.custom;
  const interest = Object.hasOwn(interests, source.interest) ? source.interest : null;
  const hasNamedStage = ['name', 'ready', 'confirm'].includes(source.step) ||
    ['universe-name', 'galaxy', 'bang'].includes(legacy?.step) || Boolean(name || priorAnswer);
  return {
    name: name || (typeof priorAnswer === 'string' ? priorAnswer.slice(0, 80) : ''),
    ...(interest ? {interest} : {}),
    step: source.step === 'interest' ? 'interest'
      : ['ready', 'confirm'].includes(source.step) && name.trim() ? 'confirm'
      : hasNamedStage ? 'name' : 'gaze'
  };
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

export function mountGuestOnboarding(host, error) {
  return mountOnboarding(host, {
    initial: guestDraft(),
    guest: true,
    error,
    onDraft(draft) {
      try { sessionStorage.setItem(guestDraftKey, JSON.stringify(draft)); } catch {}
    },
    onSave(name, draft) {
      sessionStorage.setItem(guestDraftKey, JSON.stringify({...draft, name}));
      window.open(googlePath + '?onboarding=1', '_top');
    }
  });
}

export function mountOnboarding(host, {
  initial, guest = false, preview = false, autoSave = false, error = '',
  onDraft, onSave, onClose, onSettings, renderOrigin
} = {}) {
  const draft = onboardingDraft(initial);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = window.visualViewport;
  const events = new AbortController();
  const {signal} = events;
  let step, timer, formingTimer, sky, disposeOrigin, originRequested = false, saving = false;

  host.innerHTML = `
    <main class="birth-screen" aria-label="JIKU はじまりの宇宙">
      <div class="birth-sky" aria-hidden="true">
        <div class="birth-haze"></div><canvas class="birth-stars"></canvas><div class="birth-light"></div><div class="birth-origin"></div>
      </div>
      <header class="birth-header">
        <span class="birth-wordmark">jiku<span>●</span></span>
        ${preview ? '<span class="birth-edition">初回体験プレビュー</span>' : ''}
        ${onClose ? '<button type="button" class="birth-quiet" data-birth="close">閉じる</button>' : ''}
        ${guest ? '<a class="birth-quiet" href="/api/auth/google" target="_top" aria-label="Googleでログイン">ログイン</a>' : ''}
        ${onSettings ? '<button type="button" class="birth-quiet" data-birth="settings" aria-label="Googleアカウントと設定">設定</button>' : ''}
      </header>
      <div class="birth-intro" aria-live="polite"></div>
      <div class="birth-content">
        <div class="birth-conversation" role="log" aria-label="JIKUとの会話" aria-relevant="additions"></div>
        <div class="birth-controls"></div>
        <p class="birth-error" role="alert" hidden></p>
      </div>
      <button type="button" class="birth-quiet birth-skip" data-birth="skip">演出をスキップ</button>
    </main>`;

  const screen = host.firstElementChild;
  const origin = screen.querySelector('.birth-origin');
  const intro = screen.querySelector('.birth-intro');
  const conversation = screen.querySelector('.birth-conversation');
  const controls = screen.querySelector('.birth-controls');
  const note = screen.querySelector('.birth-error');
  const skip = screen.querySelector('[data-birth="skip"]');
  const persist = () => onDraft?.({...draft});
  const scrollToLatest = () => { conversation.scrollTop = conversation.scrollHeight; };

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

  function addTurn(text, className, from = 'JIKU', tag = 'p') {
    const turn = document.createElement('div');
    turn.className = `birth-turn ${className}`;
    turn.append(message('span', from, 'birth-speaker'));
    const copy = message(tag, text, 'birth-copy');
    turn.append(copy);
    conversation.append(turn);
    scrollToLatest();
    return copy;
  }

  function askInterest() {
    return addTurn('最近、もう少し時間を使えたらいいなと思うことはありますか？', 'birth-question birth-interest', 'JIKU', 'h1');
  }

  function showInterests(focus) {
    const question = conversation.querySelector('.birth-interest .birth-copy') || askInterest();
    controls.innerHTML = `<div class="birth-choices" role="group" aria-label="今の気持ち">${Object.entries(interests).map(([id, option]) =>
      `<button class="birth-choice" type="button" data-interest="${id}">${option.label}<span aria-hidden="true">→</span></button>`
    ).join('')}</div>`;
    scrollToLatest();
    if (focus) {
      question.tabIndex = -1;
      question.focus({preventScroll: true});
    }
  }

  function revealFirstQuestion(focus) {
    addTurn(welcomeLines[0], 'birth-welcome');
    timer = setTimeout(() => {
      addTurn(welcomeLines[1], 'birth-welcome');
      timer = setTimeout(() => {
        askInterest();
        timer = setTimeout(() => showInterests(focus), 700);
      }, 2700);
    }, 1700);
  }

  function askGoal(focus) {
    const option = interests[draft.interest];
    if (option && !conversation.querySelector('.birth-choice-answer')) {
      if (!conversation.querySelector('.birth-interest')) askInterest();
      addTurn(option.label, 'birth-answer birth-choice-answer', 'あなた');
    }
    const tag = option ? 'h2' : 'h1';
    const question = addTurn(option?.question || 'これから、どんなことを少しずつ育てたいですか？', 'birth-question birth-goal-question', 'JIKU', tag);
    question.tabIndex = -1;
    if (focus) question.focus({preventScroll: true});
  }

  function showComposer() {
    controls.innerHTML = `<form class="birth-form">
      <label class="birth-visually-hidden" for="birth-input">宇宙の目標</label>
      <input id="birth-input" maxlength="80" required enterkeyhint="send" autocomplete="off">
      <button class="birth-primary" type="submit">送る <span aria-hidden="true">↑</span></button>
    </form><button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>`;
    const input = controls.querySelector('input');
    input.placeholder = '例：' + (interests[draft.interest]?.example || interests.try.example);
    input.value = draft.name;
    controls.querySelector('button').disabled = !draft.name.trim();
    scrollToLatest();
  }

  function showSave() {
    addTurn('最初の一歩から記録していきましょう。積み重ねると、目の前の宇宙に色と光が育ちます。', 'birth-reply');
    controls.innerHTML = `<button class="birth-primary" type="button" data-birth="save">
      ${guest ? '<span class="birth-google" aria-hidden="true">G</span> Googleで続けて保存' : '保存して宇宙へ <span aria-hidden="true">→</span>'}
    </button><button class="birth-quiet birth-edit" type="button" data-birth="edit">目標を書き直す</button>`;
    scrollToLatest();
  }

  function prepareOrigin() {
    if (originRequested) return;
    originRequested = true;
    const getRenderer = renderOrigin ? Promise.resolve(renderOrigin) : import('./origin-preview.js').then(module => module.mountOriginPreview);
    getRenderer.then(render => {if (!signal.aborted) disposeOrigin = render(origin, motion);}).catch(() => {});
  }

  function enter(next, {focus = false} = {}) {
    clearTimeout(timer);
    clearTimeout(formingTimer);
    const previous = step;
    step = next;
    screen.dataset.stage = next;
    sky?.stage(next);
    skip.hidden = ['interest', 'name', 'confirm'].includes(next);
    intro.replaceChildren();
    controls.replaceChildren();
    showError('');
    if (next !== 'gaze') prepareOrigin();
    if (opening[next]) {
      const [text, duration] = opening[next];
      intro.append(message('p', text, 'birth-prompt'));
      timer = setTimeout(() => enter(next === 'gaze' ? 'gather' : motion.matches ? 'interest' : 'bang'), duration);
      return;
    }
    if (next === 'bang') {
      formingTimer = setTimeout(() => {screen.dataset.forming = '';}, SPHERE_FORMATION_AT);
      timer = setTimeout(() => enter('interest'), BANG_DURATION);
      return;
    }

    draft.step = next;
    persist();
    screen.dataset.chat = '';
    if (!conversation.children.length) {
      if (next === 'interest') {
        revealFirstQuestion(focus);
        return;
      }
      for (const line of welcomeLines) addTurn(line, 'birth-welcome');
    }
    if (next === 'interest') {
      conversation.querySelectorAll('.birth-answer, .birth-goal-question, .birth-reply').forEach(turn => turn.remove());
      showInterests(focus);
    } else if (next === 'name') {
      conversation.querySelectorAll('.birth-goal-answer, .birth-reply').forEach(turn => turn.remove());
      const openComposer = () => {
        if (!conversation.querySelector('.birth-goal-question')) askGoal(focus);
        showComposer();
        if (previous === 'confirm') controls.querySelector('input').focus();
      };
      if (previous === 'interest' && !motion.matches) {
        addTurn(interests[draft.interest].label, 'birth-answer birth-choice-answer', 'あなた');
        timer = setTimeout(openComposer, 240);
      } else openComposer();
    } else {
      if (!conversation.querySelector('.birth-goal-question')) askGoal(false);
      const answer = addTurn(draft.name, 'birth-answer birth-goal-answer', 'あなた');
      if (focus) {
        answer.tabIndex = -1;
        answer.focus({preventScroll: true});
      }
      if (previous === 'name' && !motion.matches) timer = setTimeout(showSave, 240);
      else showSave();
    }
  }

  async function saveName() {
    if (step !== 'confirm' || saving) return;
    saving = true;
    controls.querySelectorAll('button').forEach(button => {button.disabled = true;});
    showError('');
    try {
      await onSave(draft.name, {...draft});
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
    const choice = button?.dataset.interest;
    if (choice && step === 'interest' && Object.hasOwn(interests, choice)) {
      draft.interest = choice;
      enter('name', {focus: true});
    }
    if (action === 'skip') enter('interest', {focus: true});
    if (action === 'back') enter('interest', {focus: true});
    if (action === 'close') onClose?.();
    if (action === 'settings') onSettings?.();
    if (action === 'edit') enter('name', {focus: true});
    if (action === 'save') saveName();
  }, {signal});
  screen.addEventListener('input', event => {
    if (event.target.id !== 'birth-input') return;
    draft.name = event.target.value;
    controls.querySelector('button').disabled = !draft.name.trim();
    persist();
  }, {signal});
  screen.addEventListener('submit', event => {
    event.preventDefault();
    event.stopPropagation();
    const value = controls.querySelector('input').value.trim();
    if (!value) return;
    draft.name = value;
    enter('confirm', {focus: true});
  }, {signal});

  function resizeViewport() {
    const keyboard = viewport && viewport.scale === 1 && innerHeight - viewport.height > 110;
    screen.classList.toggle('birth-keyboard', Boolean(keyboard));
    screen.style.setProperty('--birth-viewport', keyboard ? `${viewport.height}px` : '100dvh');
    screen.style.setProperty('--birth-top', keyboard ? `${viewport.offsetTop}px` : '0px');
    scrollToLatest();
  }
  viewport?.addEventListener('resize', resizeViewport, {signal});
  viewport?.addEventListener('scroll', resizeViewport, {signal});
  resizeViewport();
  sky = startBirthSky(screen.querySelector('.birth-stars'), origin, motion);
  enter(draft.step);
  if (error) showError(error);
  if (autoSave && step === 'confirm') queueMicrotask(() => {if (!signal.aborted) saveName();});
  return {dispose() {
    clearTimeout(timer); clearTimeout(formingTimer); events.abort();
    sky?.dispose(); disposeOrigin?.();
  }};
}
