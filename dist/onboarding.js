import {BANG_DURATION, GATHER_DURATION, IGNITION_DURATION, SPHERE_FORMATION_AT, startBirthSky} from './onboarding-sky.js';

const guestDraftKey = 'jiku:pending-universe';
const googlePath = '/api/auth/google';
const opening = {
  gaze: {prompt: '光を見つめてください。', duration: 4400, reducedDuration: 2800, next: 'gather'},
  gather: {prompt: 'もう少し、しっかり見つめてみて。', duration: GATHER_DURATION, reducedDuration: 2000, next: 'ignite'},
  ignite: {duration: IGNITION_DURATION, next: 'still'},
  still: {duration: 1050, next: 'bang'}
};

const witnessedBirthTurns = [
  ['あなたが見つめた小さな光から、宇宙が生まれました。', 'birth-emphasis'],
  ['あの光を見つめたときのように、大切なことに意識を向けられる時間を想像してみてください。', 'birth-welcome']
];
const welcomeTurns = [
  ['やりたい気持ちはあるのに、一日が終わると何も進んでいないと感じることはありませんか？', 'birth-welcome']
];
const interestQuestion = '大切なことを前に進めたいとき、どこでつまずきますか？';

const interests = {
  try: {
    label: 'やりたいことがあるのに、始められない',
    question: '最初の一歩を踏み出すとき、何がいちばん気になりますか？',
    reflection: 'その挑戦が形になったら、どんな自分になっていたいですか？',
    steps: {
      start: ['何から始めたらいいか分からない', '気になることを一つだけ調べる'],
      time: ['始める時間がなかなか取れない', '試しに5分だけ触れてみる'],
      progress: ['うまくできるか自信がない', 'すぐに試せそうなことを一つ書く']
    },
    example: '自分のサービスを作りたい'
  },
  continue: {
    label: '始めても、なかなか続かない',
    question: '続けたいと思っていても、どんなときに止まってしまいますか？',
    reflection: '続けた先で、何ができるようになったらうれしいですか？',
    steps: {
      start: ['毎回、何をするか迷う', '次にやることを一つ決めておく'],
      time: ['忙しい日に後回しになる', 'いつもの取り組みを5分だけやる'],
      progress: ['上達している実感がない', '今日取り組んだ時間を記録する']
    },
    example: '英語で気軽に話せるようになりたい'
  },
  unsure: {
    label: '何に時間を使いたいか、まだ見えていない',
    question: 'やりたいことを見つけるうえで、何がいちばん難しいですか？',
    reflection: '夢中になれることが見つかったら、どんな毎日を過ごしたいですか？',
    steps: {
      start: ['自分が何を好きなのか思い浮かばない', '最近楽しかったことを一つ思い出す'],
      time: ['考える余裕がなかなかない', '今週、自分のために5分空けてみる'],
      progress: ['気になることが多くて選べない', '一週間だけ試したいことを一つ選ぶ']
    },
    example: '自分の好きなことを楽しめる暮らしにしたい'
  }
};

const replies = {
  start: {
    try: 'Jikuでは、大きな目標を分けて、今日すぐにできる一歩を決められます。',
    continue: 'Jikuに次の一歩を置いておけば、次に開いたときに何をするか迷わずに済みます。',
    unsure: '最近楽しかったことを手がかりに、もう一度試したいことをJikuに置いておけます。'
  },
  time: {
    try: 'まとまった時間が取れない日も、Jikuで5分から試せる一歩を決められます。',
    continue: 'Jikuなら、忙しい日でも取り組める小さな行動を、余裕のある日と分けて用意できます。',
    unsure: 'Jikuでは、やりたいことを探すための5分も、ひとつの行動として決められます。'
  },
  progress: {
    try: 'うまくできるか不安なときは、Jikuで挑戦を分けて、まずは試せそうなことから始められます。',
    continue: 'Jikuに取り組んだ時間を残せば、結果が出る前でも積み重ねを振り返れます。',
    unsure: '気になることを一つ選んでJikuに置き、短い期間だけ試して自分に合うか確かめられます。'
  }
};

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const legacyName = typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const name = (typeof source.name === 'string' ? source.name : legacyName).slice(0, 80);
  const priorAnswer = source.direction || source.custom;
  const interest = Object.hasOwn(interests, source.interest) ? source.interest : null;
  const friction = interest && Object.hasOwn(replies, source.friction) ? source.friction : null;
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
    <main class="birth-screen" aria-label="Jiku はじまりの宇宙">
      <div class="birth-sky" aria-hidden="true">
        <div class="birth-haze"></div><canvas class="birth-stars"></canvas><div class="birth-light"></div><div class="birth-origin"></div>
      </div>
      <header class="birth-header">
        <span class="birth-wordmark">Jiku<span>●</span></span>
        ${preview ? '<span class="birth-edition">初回体験プレビュー</span>' : ''}
        ${onClose ? '<button type="button" class="birth-quiet" data-birth="close">閉じる</button>' : ''}
        ${guest ? '<a class="birth-quiet" href="/api/auth/google" target="_top" aria-label="Googleでログイン">ログイン</a>' : ''}
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

  function showTurn(text, className, from = 'Jiku', tag = 'p') {
    const turn = document.createElement('div');
    turn.className = `birth-turn ${className}`;
    turn.append(message('span', from, 'birth-speaker'));
    const copy = message(tag, text, 'birth-copy');
    turn.append(copy);
    conversation.replaceChildren(turn);
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

  function showInterests(previous, focus, witnessedBirth) {
    const showChoices = shouldFocus => {
      const question = showTurn(interestQuestion, 'birth-question', 'Jiku', 'h1');
      choiceControls(Object.entries(interests).map(([id, option]) => [id, option.label]), '当てはまる困りごと');
      focusTurn(question, shouldFocus);
    };
    if (previous && !Object.hasOwn(opening, previous) && previous !== 'bang') {
      showChoices(focus);
    } else {
      showSequence(witnessedBirth ? [...witnessedBirthTurns, ...welcomeTurns] : welcomeTurns, showChoices, focus);
    }
  }

  function showPractice(focus) {
    const [, example] = interests[draft.interest].steps[draft.friction];
    showSequence([
      [replies[draft.friction][draft.interest], 'birth-reply']
    ], shouldFocus => {
      const copy = showTurn('たとえば「' + example + '」。', 'birth-emphasis');
      controls.innerHTML = `<button class="birth-primary" type="button" data-birth="practice">この一歩を例に進む <span aria-hidden="true">✧</span></button>
        <button class="birth-quiet birth-edit" type="button" data-birth="back">前の質問に戻る</button>`;
      focusTurn(copy, shouldFocus);
    }, focus);
  }

  function showComposer() {
    controls.innerHTML = `<form class="birth-form">
      <label class="birth-visually-hidden" for="birth-input">いちばん大きな目標</label>
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

  function enter(next, {focus = false, witnessedBirth = false} = {}) {
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
      timer = setTimeout(() => enter('interest', {witnessedBirth: true}), BANG_DURATION);
      return;
    }

    draft.step = next;
    persist();
    screen.dataset.chat = '';
    if (next === 'interest') {
      showInterests(previous, focus, witnessedBirth);
    } else if (next === 'friction') {
      const interest = interests[draft.interest];
      const question = showTurn(interest.question, 'birth-question', 'Jiku', 'h1');
      choiceControls(Object.entries(interest.steps).map(([id, [label]]) => [id, label]), '今の気持ちに近い答え', true);
      focusTurn(question, focus);
    } else if (next === 'practice') {
      showPractice(focus);
    } else if (next === 'name') {
      const openComposer = shouldFocus => {
        const question = showTurn('この宇宙で叶えたい、いちばん大きな目標は何ですか？', 'birth-question', 'Jiku', 'h1');
        showComposer();
        if (previous === 'confirm') controls.querySelector('input').focus();
        else focusTurn(question, shouldFocus);
      };
      if (previous === 'practice') {
        showSequence([[interests[draft.interest].reflection, 'birth-question']], openComposer, focus);
      } else openComposer(focus);
    } else {
      const answer = showTurn(draft.name, 'birth-answer', 'あなた');
      showSave();
      focusTurn(answer, focus);
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
    if (step === 'friction' && Object.hasOwn(replies, choice)) {
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
    screen.style.setProperty('--birth-viewport', keyboard ? `${viewport.height}px` : '100svh');
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
