import {BANG_DURATION, GATHER_DURATION, SPHERE_FORMATION_AT, startBirthSky} from './onboarding-sky.js';

const guestDraftKey = 'jiku:pending-universe';
const googlePath = '/api/auth/google';
const opening = {
  gaze: {prompt: '光を見つめてください。', duration: 4400, reducedDuration: 2800, next: 'gather'},
  gather: {prompt: 'もう少し、しっかり見つめてみて。', duration: GATHER_DURATION, reducedDuration: 2000, next: 'ignite'},
  ignite: {duration: 1600, next: 'bang'}
};

const welcomeTurns = [
  ['あなたの宇宙が、誕生しました。', 'birth-emphasis', 1700],
  ['ここでは、大きな目標を今日できる一歩まで分けられます。', 'birth-welcome', 2700],
  ['最近、もう少し時間を使えたらいいなと思うことはありますか？', 'birth-question', 700, 'JIKU', 'h1']
];
const saveTurns = [
  ['最初の一歩から記録していきましょう。', 'birth-reply', 1750],
  ['積み重ねると、目の前の宇宙に色と光が育ちます。', 'birth-reply', 0]
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

const frictionOptions = {
  start: {
    label: '何から始めるか迷う',
    reply: 'まずは、今日できることを一つ決めてみましょう。',
    example: '気になっていることを5分調べる'
  },
  time: {
    label: '続ける時間が取れない',
    reply: '忙しい日は、短い時間でできる一歩にしてみましょう。',
    example: '好きなことに5分だけ触れる'
  },
  progress: {
    label: '進んでいる実感がない',
    reply: '小さな行動も記録に残すと、積み重ねが見えてきます。',
    example: '今日できたことを一つ書く'
  }
};

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const legacyName = typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const name = (typeof source.name === 'string' ? source.name : legacyName).slice(0, 80);
  const priorAnswer = source.direction || source.custom;
  const interest = Object.hasOwn(interests, source.interest) ? source.interest : null;
  const friction = Object.hasOwn(frictionOptions, source.friction) ? source.friction : null;
  const hasNamedStage = ['name', 'ready', 'confirm'].includes(source.step) ||
    ['universe-name', 'galaxy', 'bang'].includes(legacy?.step) || Boolean(name || priorAnswer);
  return {
    name: name || (typeof priorAnswer === 'string' ? priorAnswer.slice(0, 80) : ''),
    ...(interest ? {interest} : {}),
    ...(friction ? {friction} : {}),
    step: source.step === 'practice' && interest && friction ? 'practice'
      : source.step === 'friction' && interest ? 'friction'
      : source.step === 'interest' ? 'interest'
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

  function showTurn(text, className, from = 'JIKU', tag = 'p') {
    const turn = document.createElement('div');
    turn.className = `birth-turn ${className}`;
    turn.append(message('span', from, 'birth-speaker'));
    const copy = message(tag, text, 'birth-copy');
    turn.append(copy);
    conversation.replaceChildren(turn);
    conversation.scrollTop = 0;
    return copy;
  }

  function showSequence(turns, onReady) {
    const show = index => {
      const [text, className, wait, from, tag] = turns[index];
      const copy = showTurn(text, className, from, tag);
      if (index + 1 < turns.length) timer = setTimeout(() => show(index + 1), wait);
      else if (wait) timer = setTimeout(() => onReady(copy), wait);
      else onReady(copy);
    };
    show(0);
  }

  function focusTurn(copy, focus) {
    if (!focus) return;
    copy.tabIndex = -1;
    copy.focus({preventScroll: true});
  }

  function choiceControls(options, label, canGoBack = false) {
    controls.innerHTML = `<div class="birth-choices" role="group" aria-label="${label}">${Object.entries(options).map(([id, option]) =>
      `<button class="birth-choice" type="button" data-choice="${id}">${option.label}<span aria-hidden="true">→</span></button>`
    ).join('')}</div>${canGoBack ? '<button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>' : ''}`;
  }

  function showInterests(previous, focus) {
    const showChoices = question => {
      choiceControls(interests, '今の気持ち');
      focusTurn(question, focus);
    };
    if (previous && !Object.hasOwn(opening, previous) && previous !== 'bang') {
      const [text, className, , from, tag] = welcomeTurns.at(-1);
      showChoices(showTurn(text, className, from, tag));
    } else {
      showSequence(welcomeTurns, showChoices);
    }
  }

  function showPractice(focus) {
    const option = frictionOptions[draft.friction];
    showSequence([
      [option.reply, 'birth-reply', 2200],
      ['小さな一歩が、宇宙の光になる。', 'birth-emphasis', 1800],
      ['「' + option.example + '」を試しに記録してみましょう。', 'birth-reply', 0]
    ], example => {
      controls.innerHTML = `<button class="birth-primary" type="button" data-birth="practice">一歩を記録してみる <span aria-hidden="true">✧</span></button>
        <button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>`;
      focusTurn(example, focus);
    });
  }

  function askGoal(focus) {
    const option = interests[draft.interest];
    const question = showTurn(option?.question || 'これから、どんなことを少しずつ育てたいですか？', 'birth-question', 'JIKU', 'h1');
    focusTurn(question, focus);
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
  }

  function showSave() {
    controls.innerHTML = `<button class="birth-primary" type="button" data-birth="save">
      ${guest ? '<span class="birth-google" aria-hidden="true">G</span> Googleで続けて保存' : '保存して宇宙へ <span aria-hidden="true">→</span>'}
    </button><button class="birth-quiet birth-edit" type="button" data-birth="edit">目標を書き直す</button>`;
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
    skip.hidden = !Object.hasOwn(opening, next) && next !== 'bang';
    origin.toggleAttribute('data-lit', Boolean(draft.friction && ['name', 'confirm'].includes(next)));
    intro.replaceChildren();
    controls.replaceChildren();
    showError('');
    if (next !== 'gaze') prepareOrigin();
    if (opening[next]) {
      const {prompt, duration, reducedDuration, next: following} = opening[next];
      if (prompt) intro.append(message('p', prompt, 'birth-prompt'));
      timer = setTimeout(() => {
        enter(motion.matches && next !== 'gaze' ? 'interest' : following);
      }, motion.matches ? reducedDuration ?? 0 : duration);
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
    if (next === 'interest') {
      showInterests(previous, focus);
    } else if (next === 'friction') {
      const question = showTurn('何かを始めたり続けたりするとき、何がいちばん難しいですか？', 'birth-question', 'JIKU', 'h1');
      choiceControls(frictionOptions, '続けるうえで難しいこと', true);
      focusTurn(question, focus);
    } else if (next === 'practice') {
      showPractice(focus);
    } else if (next === 'name') {
      const openComposer = () => {
        askGoal(focus);
        showComposer();
        if (previous === 'confirm') controls.querySelector('input').focus();
      };
      if (previous === 'practice') {
        showTurn('いまの一歩が、宇宙に光を灯しました。', 'birth-emphasis');
        timer = setTimeout(openComposer, 2000);
      } else openComposer();
    } else {
      const turns = previous === 'name'
        ? [[draft.name, 'birth-answer', 1200, 'あなた'], ...saveTurns]
        : [saveTurns.at(-1)];
      showSequence(turns, reply => {
        showSave();
        focusTurn(reply, focus);
      });
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
    const choice = button?.dataset.choice;
    if (step === 'interest' && Object.hasOwn(interests, choice)) {
      draft.interest = choice;
      delete draft.friction;
      enter('friction', {focus: true});
    }
    if (step === 'friction' && Object.hasOwn(frictionOptions, choice)) {
      draft.friction = choice;
      enter('practice', {focus: true});
    }
    if (action === 'skip') enter('interest', {focus: true});
    if (action === 'practice') enter('name', {focus: true});
    if (action === 'back') {
      const previous = {friction: 'interest', practice: 'friction', name: draft.friction ? 'practice' : 'interest'}[step];
      if (previous) enter(previous, {focus: true});
    }
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
