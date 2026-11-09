const goals = ['ある', 'なんとなくある', 'まだない'];
const clarity = ['明確に分かっている', 'なんとなく分かる', 'まだ分からない'];
const directions = ['毎日をもっと充実させたい', '新しいことに挑戦したい', '自分のやりたいことを見つけたい'];
const stages = ['welcome', 'goal', 'clarity', 'direction', 'custom', 'value', 'name', 'ready', 'bang', 'born'];
const lead = text => ({text, lead: true});
const placeholder = '例：自分らしく幸せな人生を送る';

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const name = typeof source.name === 'string' ? source.name : typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const goal = goals.includes(source.goal) ? source.goal : '';
  let step = source.step;
  if (step === 'clarity' && goal !== goals[0]) step = 'goal';
  if (['direction', 'custom'].includes(step) && goal !== goals[2]) step = 'goal';
  if (step === 'ready' && !name.trim()) step = 'name';
  if (!stages.slice(1, 8).includes(step)) step = ['universe-name', 'galaxy', 'bang'].includes(legacy?.step) ? 'name' : 'goal';
  return {
    step, goal, name: name.slice(0, 80), skipped: source.skipped === true,
    direction: typeof source.direction === 'string' && goal === goals[2] ? source.direction.trim().slice(0, 80) : '',
    custom: typeof source.custom === 'string' && goal === goals[2] ? source.custom.slice(0, 80) : ''
  };
}

function conversation(step, draft) {
  switch (step) {
    case 'welcome': return [
      lead('JIKUへようこそ。'),
      'ここは、あなたが目指す未来を、自分だけの宇宙として育てていく場所です。',
      'まずは、ログインして始めましょう。'
    ];
    case 'goal': return ['ありがとうございます。', 'まず、ひとつ聞かせてください。', lead('あなたには、叶えたい大きな目標がありますか？')];
    case 'clarity': return ['そうですよね。', '叶えたい未来があるって、素敵なことです。', lead('その目標に向かって、何をすればいいか明確ですか？')];
    case 'direction': return ['もちろん、大丈夫です。', '目標は、最初から見つかっている必要はありません。', lead('これからどんな毎日を過ごしたいですか？')];
    case 'custom': return [lead('どんな毎日を過ごしたいか、あなたの言葉で聞かせてください。')];
    case 'value': return [
      lead('大きな目標も、最初は小さな一歩から。'),
      'JIKUでは、あなたが目指す未来を、小さな目標や日々の行動につなげていきます。',
      'その積み重ねを記録すると、自分がどれだけ前に進んだのかを振り返ることができます。',
      lead('さあ、あなただけの宇宙をつくりましょう。')
    ];
    case 'name': return [
      'この宇宙は、あなたが目指す未来そのものです。',
      lead('あなたは、どんな人生を歩みたいですか？'),
      '正解はありません。今の気持ちを、あなたの言葉で。'
    ];
    case 'ready': return ['素敵な未来ですね。', lead(draft.name), 'その未来への第一歩を、ここから始めましょう。'];
    case 'born': return [lead('あなたの宇宙が、誕生しました。'), lead(draft.name), 'ここから、あなたの物語が始まります。'];
    default: return [];
  }
}

const valueReplies = [
  ['いいですね。', 'では、その行動を積み重ねて、目標に近づいていきましょう。'],
  ['その「なんとなく」を、少しずつ具体的にしていきましょう。'],
  ['大きな目標ほど、何から始めればいいのか迷いますよね。', 'でも、大丈夫。小さな目標に分けると、今日できることが見えてきます。']
];
const directionReply = ['いいですね。', 'その思いも、あなたの未来をつくる大切な一歩です。'];

export function mountOnboarding(host, {
  initial = {}, welcome = false, preview = false, error = '',
  onDraft, onBirth, onExplore, onClose, onSettings
} = {}) {
  const draft = onboardingDraft(initial);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const {signal} = events;
  const viewport = window.visualViewport;
  let step, pending = [], timer, sky, following = true, busy = false;
  host.innerHTML = `
    <main class="birth-screen" data-stage="welcome" aria-label="JIKU はじまりの宇宙">
      <div class="birth-sky" aria-hidden="true">
        <div class="birth-haze"></div><canvas></canvas>
        <div class="birth-light"></div><div class="birth-wave"></div>
      </div>
      <header class="birth-header">
        <span class="birth-wordmark">jiku<span>●</span></span>
        <span class="birth-edition">${preview ? '初回体験プレビュー' : 'THE FIRST LIGHT'}</span>
        ${onClose ? '<button type="button" class="birth-quiet" data-birth="close">閉じる</button>' : ''}
        ${onSettings ? '<button type="button" class="birth-quiet birth-settings" data-birth="settings" aria-label="Googleアカウントと設定">設定</button>' : ''}
      </header>
      <div class="birth-content">
        <div class="birth-transcript" tabindex="0" aria-label="会話履歴">
          <div class="birth-messages" role="log" aria-label="JIKUとの会話" aria-live="polite"></div>
        </div>
        <div class="birth-controls"></div>
        <footer class="birth-tools">
          <button type="button" class="birth-quiet" data-birth="back" hidden>← 前に戻る</button>
          <button type="button" class="birth-quiet birth-skip" data-birth="skip" hidden></button>
        </footer>
      </div>
    </main>`;
  const screen = host.firstElementChild;
  const transcript = screen.querySelector('.birth-transcript');
  const history = screen.querySelector('.birth-messages');
  const controls = screen.querySelector('.birth-controls');
  const back = screen.querySelector('[data-birth="back"]');
  const skip = screen.querySelector('[data-birth="skip"]');
  const persist = () => onDraft?.({...draft});
  const button = (action, text, className = 'birth-choice') => `<button type="button" class="${className}" data-birth="${action}">${text}</button>`;
  const mainButton = (action, text) => button(action, text, 'birth-primary');
  const stop = () => {clearTimeout(timer); pending = [];};
  const scrollToLatest = () => {if (following) transcript.scrollTop = transcript.scrollHeight;};

  function moveHistory(update) {
    const anchor = history.lastElementChild;
    if (!anchor || !following || motion.matches || typeof history.animate !== 'function') {
      update();
      scrollToLatest();
      return;
    }
    const oldTop = anchor.getBoundingClientRect().top;
    history.getAnimations().forEach(animation => animation.cancel());
    update();
    scrollToLatest();
    const movement = oldTop - anchor.getBoundingClientRect().top;
    if (Math.abs(movement) > 2) {
      history.animate([{transform: `translateY(${movement}px)`}, {transform: 'none'}], {duration: 320, easing: 'ease-out'});
    }
  }

  function say(message, speaker = 'jiku') {
    const item = document.createElement(message.lead ? 'h2' : 'p');
    item.className = `birth-message ${message.lead ? 'birth-lead' : ''}`;
    item.dataset.speaker = speaker;
    item.dataset.turn = step;
    item.textContent = message.text ?? message;
    moveHistory(() => history.append(item));
    item.previousElementSibling?.classList.add('birth-prior');
  }

  function showControls() {
    switch (step) {
      case 'welcome':
        controls.innerHTML = preview ? mainButton('preview-login', 'ログインして始める')
          : '<a class="birth-primary" href="/api/auth/google" target="_top" aria-label="ログインして始める（Googleでログイン）"><span class="birth-google" aria-hidden="true">G</span>ログインして始める</a>';
        if (error) {
          const note = document.createElement('p');
          note.className = 'birth-error';
          note.setAttribute('role', 'alert');
          note.textContent = error;
          controls.prepend(note);
        }
        break;
      case 'goal':
      case 'clarity':
      case 'direction': {
        const choices = step === 'goal' ? goals : step === 'clarity' ? clarity : [...directions, '自分で考えて入力する'];
        controls.innerHTML = `<div class="birth-choices" aria-label="回答の選択肢">${choices.map((label, index) => button(`choice-${index}`, label)).join('')}</div>`;
        break;
      }
      case 'custom':
      case 'name': {
        const isName = step === 'name';
        const label = isName ? '宇宙の名前' : 'どんな毎日を過ごしたいか';
        controls.innerHTML = `<form class="birth-form">
          <label for="birth-input">${label}</label>
          <input id="birth-input" maxlength="80" required placeholder="${isName ? placeholder : '例：毎日、好きなことに時間を使いたい'}" enterkeyhint="next" autocomplete="off">
          ${isName && draft.direction ? button('suggest', '', 'birth-suggestion') : ''}
          ${isName ? '<p class="birth-note">この名前は、あとから変更できます。</p>' : ''}
          <button class="birth-primary" type="submit">次へ <span aria-hidden="true">→</span></button>
        </form>`;
        const input = controls.querySelector('input');
        input.value = isName ? draft.name : draft.custom;
        controls.querySelector('button[type="submit"]').disabled = !input.value.trim();
        const suggestion = controls.querySelector('[data-birth="suggest"]');
        if (suggestion) suggestion.textContent = 'この案を使う · ' + draft.direction;
        break;
      }
      case 'value': controls.innerHTML = mainButton('name', '自分の宇宙をつくる'); break;
      case 'ready': controls.innerHTML = mainButton('ignite', 'ビッグバンを起こす'); break;
      case 'born': controls.innerHTML = mainButton('explore', '宇宙を探索する'); break;
    }
    scrollToLatest();
  }

  function nextMessage() {
    clearTimeout(timer);
    const message = pending.shift();
    if (message) {
      say(message);
      const duration = motion.matches ? 280 : Math.min(1550, 620 + (message.text ?? message).length * 14);
      timer = setTimeout(nextMessage, duration);
    } else {
      moveHistory(showControls);
    }
  }

  function enter(next, {reply, prefix = [], rewind = false} = {}) {
    stop();
    controls.replaceChildren();
    following = true;
    if (rewind) {
      const index = stages.indexOf(next);
      for (const item of [...history.children]) {
        if (stages.indexOf(item.dataset.turn) >= index) item.remove();
      }
    }
    if (reply) say(reply, 'you');
    step = next;
    screen.dataset.stage = next;
    if (stages.indexOf(next) > 0 && stages.indexOf(next) < 8) {
      draft.step = next;
      persist();
    }
    back.hidden = !['clarity', 'direction', 'custom', 'value', 'name', 'ready'].includes(next);
    skip.hidden = ['welcome', 'name', 'born'].includes(next);
    skip.textContent = ['bang', 'ready'].includes(next) ? '演出をスキップ' : '会話をスキップ';
    if (next === 'bang') {
      sky?.burst();
      timer = setTimeout(() => enter('born'), 3900);
      return;
    }
    pending = [...prefix, ...conversation(next, draft)];
    timer = setTimeout(nextMessage, rewind || motion.matches ? 40 : 260);
  }

  function goBack() {
    const prior = {
      clarity: 'goal', direction: 'goal', custom: 'direction',
      value: draft.goal === goals[0] ? 'clarity' : draft.custom && draft.direction === draft.custom ? 'custom' : draft.goal === goals[2] ? 'direction' : 'goal',
      name: draft.skipped ? 'goal' : 'value', ready: 'name'
    }[step];
    if (!prior) return;
    if (prior === 'goal') Object.assign(draft, {goal: '', direction: '', custom: '', skipped: false});
    if (prior === 'direction') Object.assign(draft, {direction: '', custom: ''});
    enter(prior, {rewind: true});
  }

  function choose(index) {
    if (step === 'goal' && goals[index]) {
      Object.assign(draft, {goal: goals[index], direction: '', custom: ''});
      if (index === 0) enter('clarity', {reply: goals[index]});
      if (index === 1) enter('value', {reply: goals[index], prefix: [
        'いいですね。', '最初から、はっきりした目標でなくても大丈夫です。', 'ぼんやりした思いも、少しずつ形にしていけます。'
      ]});
      if (index === 2) enter('direction', {reply: goals[index]});
    } else if (step === 'clarity' && clarity[index]) {
      enter('value', {reply: clarity[index], prefix: valueReplies[index]});
    } else if (step === 'direction') {
      if (index === directions.length) enter('custom', {reply: '自分で考えて入力する'});
      else if (directions[index]) {
        draft.direction = directions[index];
        enter('value', {reply: draft.direction, prefix: directionReply});
      }
    }
  }

  async function ignite(skipMotion = false) {
    if (busy || step !== 'ready' || !draft.name.trim()) return;
    busy = true;
    const primary = controls.querySelector('button');
    if (primary) primary.disabled = true;
    back.disabled = skip.disabled = true;
    try {
      const savedName = await onBirth?.(draft.name);
      if (savedName === false || signal.aborted) return;
      if (typeof savedName === 'string') draft.name = savedName;
      enter(skipMotion || motion.matches ? 'born' : 'bang');
    } catch {
      const note = document.createElement('p');
      note.className = 'birth-error';
      note.setAttribute('role', 'alert');
      note.textContent = '宇宙を保存できませんでした。もう一度お試しください。';
      controls.querySelector('.birth-error')?.remove();
      controls.prepend(note);
    } finally {
      busy = false;
      if (primary) primary.disabled = false;
      back.disabled = skip.disabled = false;
    }
  }

  screen.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.birth;
    if (action === 'close') onClose?.();
    else if (action === 'settings') onSettings?.();
    else if (action === 'back') goBack();
    else if (action === 'skip') {
      if (step === 'bang') enter('born');
      else if (step === 'ready') ignite(true);
      else {draft.skipped = true; enter('name');}
    } else if (action === 'preview-login') enter('goal');
    else if (action === 'name') enter('name');
    else if (action === 'ignite') ignite();
    else if (action === 'explore') onExplore?.();
    else if (action === 'suggest') {
      const input = controls.querySelector('input');
      input.value = draft.direction;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.focus();
    } else if (action?.startsWith('choice-')) choose(Number(action.slice(7)));
    else if (!event.target.closest('a,button,form') && !getSelection()?.toString() && (pending.length || !controls.hasChildNodes()) && step !== 'bang') {
      following = true;
      nextMessage();
    }
  }, {signal});
  screen.addEventListener('input', event => {
    if (event.target.id !== 'birth-input') return;
    draft[step === 'name' ? 'name' : 'custom'] = event.target.value;
    controls.querySelector('button[type="submit"]').disabled = !event.target.value.trim();
    persist();
  }, {signal});
  screen.addEventListener('submit', event => {
    event.preventDefault();
    event.stopPropagation();
    const value = controls.querySelector('input').value.trim();
    if (!value) return;
    if (step === 'custom') {
      draft.custom = draft.direction = value;
      enter('value', {reply: value, prefix: directionReply});
    } else if (step === 'name') {
      draft.name = value;
      enter('ready', {reply: value});
    }
  }, {signal});
  transcript.addEventListener('scroll', () => {
    following = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 28;
  }, {passive: true, signal});
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
  enter(welcome ? 'welcome' : draft.step);
  sky = startSky(screen.querySelector('canvas'), () => step, motion);
  return {dispose() {stop(); events.abort(); sky?.dispose();}};
}

function startSky(canvas, stage, motion) {
  const context = canvas.getContext('2d');
  if (!context) return null;

  // Seed the field so that changes in light reveal the same stars.
  let seed = 71;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = Array.from({length: 135}, (_, index) => ({
    x: random() - .5, y: random() - .5, depth: .35 + random() * .65,
    size: .4 + random() * 1.05, phase: random() * Math.PI * 2, color: index % 7 === 0 ? '#ffcbb8' : index % 3 === 0 ? '#a6baff' : '#e3e8ff'
  }));
  const dust = Array.from({length: 21}, () => ({
    angle: random() * Math.PI * 2, distance: .15 + random() * .85, size: .55 + random() * .65
  }));
  let width = 0, height = 0, centerY = 0, lastTime = 0, frame, burstTime = 0, brightness = 0;
  const levels = {welcome: .05, goal: .12, clarity: .17, direction: .17, custom: .2, value: .48, name: .56, ready: .68, bang: .72, born: 1};

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    centerY = height * (parseFloat(getComputedStyle(canvas).getPropertyValue('--birth-point-height')) || 39) / 100;
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function paint(time) {
    const delta = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    frame = requestAnimationFrame(paint);
    if (!width || !height) return;

    const still = motion.matches;
    const current = stage();
    const target = levels[current] || 0;
    const drift = still ? 0 : time / 1000;
    const burst = !still && burstTime ? Math.max(0, (time - burstTime) / 3900) : 1;
    const exploding = current === 'bang' && burst > .12;
    const opening = current === 'born' ? 1 : exploding ? Math.min(1, (burst - .12) / .88) : 0;
    brightness = still ? target : brightness + (target - brightness) * delta / 450;

    context.clearRect(0, 0, width, height);
    const centerX = width / 2;
    for (const star of stars) {
      const push = 1 + opening * (1 + star.depth * 1.65);
      const x = (centerX + star.x * width * push + Math.sin(drift * .095 + star.phase) * star.depth * 7 + width * 2) % width;
      const y = (centerY + (star.y + .5 - centerY / height) * height * push + Math.cos(drift * .08 + star.phase) * star.depth * 5 + height * 2) % height;
      const shimmer = .72 + .28 * Math.sin(drift * .9 + star.phase);
      context.globalAlpha = Math.min(1, (brightness + opening * .44) * star.depth * shimmer);
      context.fillStyle = star.color;
      context.beginPath();
      context.arc(x, y, star.size * (1 + opening * .55), 0, Math.PI * 2);
      context.fill();
    }

    if (current === 'name' || current === 'ready' || (current === 'bang' && !exploding)) {
      const radius = Math.min(width, height) * .28;
      for (const grain of dust) {
        const cycle = still ? grain.distance : (grain.distance + 1 - (drift * .11 % 1)) % 1;
        const reach = current === 'bang' ? 1 - burst * 6 : 1;
        const distance = Math.max(0, cycle * radius * reach);
        context.globalAlpha = (1 - cycle) * cycle * 1.8;
        context.fillStyle = '#c5bcfc';
        context.beginPath();
        context.arc(centerX + Math.cos(grain.angle) * distance, centerY + Math.sin(grain.angle) * distance * .72, grain.size, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  frame = requestAnimationFrame(paint);
  return {
    burst() {burstTime = performance.now();},
    dispose() {cancelAnimationFrame(frame); observer.disconnect();}
  };
}
