import {BANG_DURATION, GATHER_DURATION, IGNITION_DURATION, SPHERE_FORMATION_AT, startBirthSky} from './onboarding-sky.js';
import {createExampleDraft, exampleMap, starterMap} from './example-map.js';
import {mapDiagram} from './mind-map.js';
import {createPortalWarp, mountOriginPreview} from './origin-preview.js';
import {MODES, modesForLevel} from './model.js';

const guestDraftKey = 'jiku:pending-universe';
export function planetArt(days = 0) {
  return `<div class="home-planet" style="--planet-light:${days ? .36 + .64 * (1 - Math.exp(-days / 18)) : .10}" aria-hidden="true">
    <div class="planet-globe"><i class="planet-beacon"></i></div>
  </div>`;
}
const opening = {
  gaze: {prompt: '光を見つめてください。', duration: 4400, reducedDuration: 2800, next: 'gather'},
  gather: {prompt: 'もう少し、しっかり見つめてみて。', duration: GATHER_DURATION, reducedDuration: 2000, next: 'ignite'},
  ignite: {duration: IGNITION_DURATION, next: 'still'},
  still: {duration: 1050, next: 'bang'}
};

const escapeMapText = text => text.replace(/[&<>"']/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);

function draftChildren(nodes, depth = 1) {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap(node => {
    if (typeof node?.name !== 'string') return [];
    const name = node.name.slice(0, 80);
    const purpose = typeof node.purpose === 'string' ? {purpose: node.purpose.slice(0, 1000)} : {};
    if (depth > 1 && node.kind === 'action') {
      const duration = value => Number.isInteger(value) && value >= 1 && value <= 1000000 ? value : 10;
      const mode = ['rest', 'busy', 'full'].includes(node.mode) ? {mode: node.mode} : {};
      return [{name, kind: 'action', daily: duration(node.daily), weekly: duration(node.weekly), ...purpose, ...mode}];
    }
    return depth < 3 ? [{name, kind: 'goal', children: draftChildren(node.children, depth + 1), ...purpose}] : [];
  });
}

export function initialPersonalMap(draft) {
  if (draft.map) return draft.map;
  if (draft.goal) {
    const map = createExampleDraft();
    map.children.unshift({
      name: draft.values || draft.reason || '大切にしたいこと',
      purpose: draft.reason || draft.goal,
      kind: 'goal',
      children: [{name: draft.goal, purpose: draft.reason || draft.values || map.name, kind: 'goal', children: []}]
    });
    return map;
  }
  if (!draft.starter) return createExampleDraft();
  const defaultStarter = draft.name === exampleMap.name ? starterMap : {
    ...starterMap, galaxy: '目標に向けて始める', task: '今日できる一歩に10分取り組む'
  };
  const starter = {...defaultStarter, ...draft.starter};
  return {
    name: draft.starter.name?.trim() || draft.name?.trim() || exampleMap.name,
    children: [{name: starter.galaxy || defaultStarter.galaxy, kind: 'goal', children: [
      {name: starter.task || defaultStarter.task, kind: 'action',
        daily: Number(starter.daily || defaultStarter.daily), weekly: Number(starter.weekly || defaultStarter.weekly)}
    ]}]
  };
}
const focusOptions = {
  motivation: {
    label: 'やる気が湧かないとき',
    reply: 'やる気が湧かない日は、最初の一歩が重く感じますよね。',
    benefit: '自分にとって大切な理由を思い出すと、もう一度取り組むきっかけになります。'
  },
  unclear: {
    label: '何から手をつけるか迷うとき',
    reply: 'やることが大きすぎると、どこから始めればいいか迷いますよね。',
    benefit: '今日できることを一つ決めておくと、最初の一歩が見えてきます。'
  },
  distractions: {
    label: 'ほかのことに気を取られるとき',
    reply: '目の前にいろいろあると、大切にしたいことに戻るのは難しいですよね。',
    benefit: '次にやることを決めておくと、気がそれたあとも戻りやすくなります。'
  },
  busy: {
    label: '忙しい、または疲れているとき',
    reply: '忙しい日は、やりたいことに手が回らないこともありますよね。',
    benefit: 'Jikuでは、忙しい日にもできる小さな行動をあらかじめ用意できます。'
  }
};

const dialogueSteps = ['example-choice', 'focus', 'explain', 'goal', 'reason', 'values', 'meaning', 'confirm', 'map', 'arrival', 'login'];
const research = {
  motivation: ['理由が続ける支えになる', '価値観や関心に合う目標を追う人ほど、努力を続けやすい傾向がありました。', 'Sheldon & Elliot（1999）', 'https://pubmed.ncbi.nlm.nih.gov/10101878/'],
  values: ['人が望む気持ちには違いがある', '穏やかさや高揚感など、どんな気持ちを理想とするかに文化による違いが見られました。', 'Tsai ほか（2006）', 'https://web.stanford.edu/group/spanlab/Publications/jt06jpsp.pdf'],
  recording: ['進捗を確かめると、目標達成を後押しできる', '138件の実験をまとめた分析で、進捗の確認を促すと目標達成が改善しました。進捗を記録した場合に、効果がより大きく見られました。', 'Harkin ほか（2016）', 'https://pubmed.ncbi.nlm.nih.gov/26479070/']
};

function researchNote(key) {
  const [title, description, authors, url] = research[key];
  return `<details class="birth-research"><summary>${title} · 研究を見る</summary>
    <p>${description}</p><a href="${url}" target="_blank" rel="noopener">${authors}</a>
  </details>`;
}

export function firstPersonalTask(map) {
  for (const branch of map.children) {
    for (const node of branch.children) {
      const task = node.kind === 'action' ? node : node.children.find(child => child.kind === 'action');
      if (task) return {...task, branch: branch.name};
    }
  }
  return null;
}

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const legacyName = typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const priorAnswer = source.direction || source.custom;
  const name = ((typeof source.name === 'string' ? source.name : legacyName) ||
    (typeof priorAnswer === 'string' ? priorAnswer : '')).slice(0, 80);
  const focusBarrier = Object.hasOwn(focusOptions, source.focusBarrier) ? source.focusBarrier : null;
  let step = 'gaze';
  if (dialogueSteps.includes(source.step) && source.step !== 'explain') step = source.step;
  else if (['ready', 'confirm'].includes(source.step)) step = 'confirm';
  else if (source.step === 'explain') step = focusBarrier ? 'explain' : 'focus';
  const starter = {};
  for (const key of Object.keys(starterMap)) {
    if (typeof source.starter?.[key] === 'string') starter[key] = source.starter[key].slice(0, 80);
  }
  const map = ['map', 'arrival', 'login'].includes(step) && typeof source.map?.name === 'string'
    ? {name: source.map.name.slice(0, 80), children: draftChildren(source.map.children)} : null;
  if (['arrival', 'login'].includes(step) && !map) step = 'map';
  const answers = {};
  for (const key of ['goal', 'reason', 'values']) {
    if (typeof source[key] === 'string' && source[key].trim()) answers[key] = source[key].trim().slice(0, 80);
  }
  if (['reason', 'values'].includes(step) && !answers.goal) step = 'goal';
  if (step === 'values' && !answers.reason) step = 'reason';
  return {name, ...answers, ...(focusBarrier ? {focusBarrier} : {}), ...(Object.keys(starter).length ? {starter} : {}),
    ...(map ? {map} : {}), step};
}

function guestDraft() {
  try { return onboardingDraft(JSON.parse(sessionStorage.getItem(guestDraftKey))); }
  catch { return null; }
}

export function pendingUniverse() {
  const draft = guestDraft();
  return ['confirm', 'login'].includes(draft?.step) ? draft : null;
}

export function saveGuestDraft(draft) {
  sessionStorage.setItem(guestDraftKey, JSON.stringify(draft));
}

export function resumeGuestDraft() {
  return guestDraft();
}

export function clearPendingUniverse() {
  try { sessionStorage.removeItem(guestDraftKey); } catch {}
}

export function mountOnboarding(host, {
  initial, preview = false, previewStart = 'gaze',
  onDraft, onSave, onClose, onSettings, loginAtEnd = false, loginError
} = {}) {
  const draft = onboardingDraft(initial);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = window.visualViewport;
  const events = new AbortController();
  const {signal} = events;
  let step, timer, formingTimer, sky, saving = false;
  let openBranch = null;
  let disposeOrigin, warp, flightFrame, demoMode, demoRecorded = false;

  host.innerHTML = `
    <main class="birth-screen" aria-label="Jiku はじまりの宇宙">
      <div class="birth-sky" aria-hidden="true">
        <div class="birth-haze"></div><canvas class="birth-stars"></canvas><div class="birth-light"></div>
        <div class="birth-origin"><i class="birth-orb-fallback" aria-hidden="true"></i></div>
        <div class="birth-landing-planet">${planetArt()}</div>
      </div>
      <header class="birth-header">
        <span class="birth-wordmark">Jiku<span>●</span></span>
        ${preview ? '<span class="birth-edition">初回体験プレビュー</span>' : ''}
        ${onClose ? '<button type="button" class="birth-quiet" data-birth="close">閉じる</button>' : ''}
        ${onSettings ? '<button type="button" class="birth-quiet" data-birth="settings" aria-label="Googleアカウントと設定">設定</button>' : ''}
        ${loginAtEnd && !preview ? '<a class="birth-quiet" href="/api/auth/google">登録済みの方</a>' : ''}
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
      if (shouldFocus && index === 0) focusTurn(copy, true);
      const readingTime = Math.max(2600, Math.min(7800, 1200 + text.length * 96));
      timer = setTimeout(() => show(index + 1, shouldFocus), readingTime);
    };
    show(0, focus);
  }

  function focusTurn(copy, focus) {
    if (!focus) return;
    copy.tabIndex = -1;
    copy.focus({preventScroll: true});
  }

  function choiceControls(options, label) {
    controls.innerHTML = `<div class="birth-choices" role="group" aria-label="${label}">${options.map(([id, text]) =>
      `<button class="birth-choice" type="button" data-choice="${id}">${text}<span aria-hidden="true">→</span></button>`
    ).join('')}</div>`;
  }

  function showQuestion(text, focus) {
    focusTurn(showTurn(text, 'birth-question', 'Jiku', 'h1'), focus);
  }

  function showBirthLesson(focus) {
    showSequence([
      ['あなたの宇宙が、誕生しました。', 'birth-emphasis'],
      ['さっきは、目の前の小さな光に意識を向けました。', 'birth-reply'],
      ['目標達成に関しても、同じことが言えます。', 'birth-emphasis'],
      ['目の前の一歩がはっきりすると、何をするか迷わずに始められるからです。', 'birth-reply']
    ], shouldFocus => {
      showQuestion('今夜、健康のために10分だけ使えます。どちらならすぐに始められそうですか？', shouldFocus);
      choiceControls([['broad', '健康のために何かする'], ['walk', '夕食後に10分歩く']], 'どちらから始めやすい？');
    }, focus);
  }

  function showFocusQuestion(focus, answer) {
    const showChoices = shouldFocus => {
      showQuestion('あなたは、どんなときに集中が続かないと感じますか？', shouldFocus);
      choiceControls(Object.entries(focusOptions).map(([id, option]) => [id, option.label]), '集中しづらい場面');
    };
    if (!answer) return showChoices(focus);
    showSequence([
      [answer === 'walk' ? '何をするか、すぐに思い浮かびますよね。' : '「何かする」を「夕食後に10分歩く」にすると、やることが見えてきます。', 'birth-reply'],
      ['大きな目標があるときこそ、今日の一歩に意識を向けてみましょう。', 'birth-emphasis']
    ], showChoices, focus);
  }

  function explain(focus) {
    const option = focusOptions[draft.focusBarrier];
    showSequence([
      [option.reply, 'birth-reply'],
      [option.benefit, 'birth-reply'],
      ['集中が続かない理由のなかから、ここではやる気に注目してみましょう。', 'birth-reply'],
      ['やる気を保つには、「何のためにやるのか」を思い出すことが助けになります。', 'birth-emphasis'],
      ['たとえば、海外に住む友人ともっと話したいなら、SNSを見ていた10分を英語の練習に使う理由が見えてきます。', 'birth-reply'],
      ['目の前の一歩を続ける支えになるのは、自分にとって大切な理由です。', 'birth-emphasis']
    ], shouldFocus => enter('goal', {focus: shouldFocus}), focus);
  }

  function askForAnswer(key, focus) {
    const prompts = {
      goal: ['いま、あなたが叶えたいことは何ですか？', '例　無理なく運動を続けたい'],
      reason: [`「${draft.goal}」が叶ったら、どんなことがうれしいですか？`, '例　休日に元気に出かけたい'],
      values: [`「${draft.reason}」の先に、どんな日々が増えたら幸せだと思いますか？`, '例　大切な人と元気に過ごしたい']
    };
    const [question, placeholder] = prompts[key];
    showQuestion(question, focus);
    controls.innerHTML = `<form class="birth-form">
      <input name="answer" required maxlength="80" placeholder="${placeholder}">
      <button type="submit" class="birth-primary">答える</button>
    </form>${key === 'goal' ? researchNote('motivation') : ''}
    <button type="button" class="birth-quiet birth-edit" data-birth="skip-answer">まだ思いつかない</button>`;
    const form = controls.querySelector('form');
    form.elements.answer.setAttribute('aria-label', question);
    form.elements.answer.addEventListener('input', () => form.elements.answer.setCustomValidity(''));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const answer = form.elements.answer.value.trim();
      if (!answer) {
        form.elements.answer.setCustomValidity('答えを入力してください。');
        form.elements.answer.reportValidity();
        return;
      }
      draft[key] = answer;
      enter({goal: 'reason', reason: 'values', values: 'meaning'}[key], {focus: true});
    });
  }

  function showMeaning(focus) {
    showSequence([
      [draft.values || draft.reason ? `「${draft.values || draft.reason}」。あなたにとっての幸せを考える手がかりが見つかりました。` : 'どんな日が増えたら幸せか、考えるところから始めても大丈夫です。', 'birth-reply'],
      ['目標の先にある「何のため？」が見えると、今日の行動が自分の幸せにどうつながるか見えてきます。', 'birth-emphasis'],
      ['そのつながりを、マインドマップで見てみましょう。', 'birth-reply']
    ], shouldFocus => {
      showQuestion('マインドマップを知っていますか？', shouldFocus);
      choiceControls([['know-map', '知っている'], ['new-map', '初めて聞いた']], 'マインドマップ');
    }, focus);
  }

  function showMap(focus, editable) {
    showQuestion(editable ? 'あなたのマインドマップをつくりましょう。' : 'まずは「健康」の枝をタップしてみてください。', focus);
    if (!editable) {
      const hub = `<div class="map-node map-root"><span aria-hidden="true">◎</span><strong>${exampleMap.name}</strong></div>`;
      const points = exampleMap.branches.map((branch, index) => ({
        tone: index,
        card: `<button type="button" class="map-node" data-example-branch="${index}" aria-expanded="false" aria-controls="birth-example-detail">
          <span aria-hidden="true">◉</span><strong>${branch.name}</strong>
        </button>`
      }));
      controls.innerHTML = `<div class="birth-example">
        ${mapDiagram(hub, points, {radial: true, label: '幸せな人生のマインドマップ'})}
        <div class="map-subview" id="birth-example-detail" hidden></div>
        <p class="birth-map-caption">「幸せな人生」は、この地図の一番大きな目標です。エンジニアになることが幸せにつながるかは、何を大切にしたいかで変わります。</p>
        <button class="birth-primary" type="button" data-birth="example">自分のマインドマップをつくる <span aria-hidden="true">→</span></button>
        ${researchNote('values')}
      </div>`;
      return;
    }
    if (draft.goal && !draft.map) openBranch = 0;
    draft.map = initialPersonalMap(draft);
    delete draft.starter;
    persist();
    renderPersonalMap();
  }

  function mapNode(path) {
    return path ? path.split('.').reduce((node, index) => node.children[Number(index)], draft.map) : draft.map;
  }

  function editNodeButton(node, path, mark, style = '') {
    const kind = path.includes('.') ? node.kind : '';
    return `<button type="button" class="map-node ${style}" data-birth-edit-node="${path}">
      <span aria-hidden="true">${mark}</span>
      <span>${kind ? mapKindLabel(kind) : ''}<strong>${escapeMapText(node.name)}</strong></span>
      <span class="birth-map-edit-mark" aria-hidden="true">✎</span>
    </button>`;
  }

  function mapKindLabel(kind) {
    const task = kind === 'action';
    return `<small class="birth-map-kind" data-map-kind="${kind}">${task ? 'タスク' : '目標'}</small>`;
  }

  function removeNodeButton(node, path) {
    return `<button type="button" class="birth-map-delete" data-birth-remove-node="${path}"
      aria-label="${escapeMapText(node.name)}を削除">削除</button>`;
  }

  function renderPersonalMap() {
    const map = draft.map;
    const points = map.children.map((node, index) => ({
      tone: index % 4,
      card: `<button type="button" class="map-node" data-birth-map-branch="${index}" aria-controls="birth-personal-detail" aria-expanded="${openBranch === index}">
        <span aria-hidden="true">◉</span><strong>${escapeMapText(node.name)}</strong>
      </button>`
    }));
    controls.innerHTML = `<div class="birth-example birth-personal-map">
      ${mapDiagram(editNodeButton(map, '', '◎', 'map-root'), points, {radial: true, label: '自分のマインドマップ'})}
      <button type="button" class="birth-map-add" data-birth-add-node="" data-node-kind="goal">＋ 目標を追加</button>
      <p class="birth-map-caption">枝を開いて、今日できるタスクをひとつ置いてみましょう。見本の目標は編集・削除できます。</p>
      <div class="map-subview" id="birth-personal-detail" hidden></div>
      <div class="birth-node-editor" hidden></div>
      <button class="birth-primary" type="button" data-birth="generate">自分の星へ向かう <span aria-hidden="true">→</span></button>
    </div>`;
    renderPersonalBranch();
  }

  function renderPersonalBranch() {
    const detail = controls.querySelector('#birth-personal-detail');
    const branch = draft.map.children[openBranch];
    detail.hidden = !branch;
    if (!branch) {
      detail.replaceChildren();
      return;
    }
    const points = branch.children.map((node, index) => {
      const path = `${openBranch}.${index}`;
      const task = node.kind === 'action';
      return {tone: openBranch % 4, card: `
        ${editNodeButton(node, path, task ? '✓' : '✦')}
        <div class="birth-map-point-actions">
          ${task ? '' : `<button type="button" class="birth-map-add" data-birth-add-node="${path}" data-node-kind="action">＋ タスク</button>`}
          ${removeNodeButton(node, path)}
        </div>
        ${task ? '' : `
          <ul class="map-task-nodes">${node.children.map((task, taskIndex) => `<li>
            <button type="button" data-birth-edit-node="${path}.${taskIndex}">
              ${mapKindLabel('action')}<span>${escapeMapText(task.name)}</span><small>${task.daily}分</small>
            </button>
            ${removeNodeButton(task, `${path}.${taskIndex}`)}
          </li>`).join('')}</ul>`}`};
    });
    detail.innerHTML = `${mapDiagram(editNodeButton(branch, String(openBranch), '◉', 'map-detail-root'), points, {label: '銀河の枝'})}
      <div class="birth-map-add-actions">
        <button type="button" class="birth-map-add" data-birth-add-node="${openBranch}" data-node-kind="goal">＋ 目標を追加</button>
        <button type="button" class="birth-map-add" data-birth-add-node="${openBranch}" data-node-kind="action">＋ タスクを追加</button>
      </div>`;
  }

  function showMapPanel(html) {
    const panel = controls.querySelector('.birth-node-editor');
    panel.innerHTML = html;
    panel.hidden = false;
    controls.querySelector('[data-birth="generate"]').disabled = true;
    showError('');
    return panel;
  }

  function closeMapPanel(panel, button) {
    panel.hidden = true;
    controls.querySelector('[data-birth="generate"]').disabled = false;
    button?.focus();
  }

  function openMapEditor(button) {
    const adding = button.hasAttribute('data-birth-add-node');
    const path = adding ? button.dataset.birthAddNode : button.dataset.birthEditNode;
    const node = adding ? {kind: button.dataset.nodeKind, name: '', daily: 10, weekly: 30} : mapNode(path);
    const title = node.kind === 'action' ? 'タスク' : !adding && !path ? 'いちばん大きな目標' : '目標';
    const editor = showMapPanel(`<form class="birth-node-form">
      <h2>${title}を${adding ? '追加' : '編集'}</h2>
      <label>${title}の名前<input name="name" maxlength="80" required></label>
      ${path || adding ? `<label>${node.kind === 'action' ? 'このタスクにした理由' : 'この目標にした理由'}<input name="purpose" maxlength="1000"></label>` : ''}
      ${node.kind === 'action' ? `<div class="birth-map-time">
        <label>1日（分）<input name="daily" type="number" min="1" max="1000000" value="${node.daily}" required></label>
        <label>週の目標（分）<input name="weekly" type="number" min="1" max="1000000" value="${node.weekly}" required></label>
      </div>
      <label>どのペースから取り組みますか？
        <select name="mode">${['rest', 'busy', 'full'].map(mode => `<option value="${mode}">${MODES[mode].label}から</option>`).join('')}</select>
      </label>
      <p>忙しい日には休む日のタスク、余裕がある日には両方のタスクも含まれます。</p>` : ''}
      <div class="birth-node-actions">
        ${!adding && path ? removeNodeButton(node, path) : ''}
        <button type="button" data-birth="cancel-node">キャンセル</button>
        <button type="submit">保存</button>
      </div>
    </form>`);
    const form = editor.querySelector('form');
    form.elements.name.value = node.name;
    if (form.elements.purpose) form.elements.purpose.value = node.purpose || '';
    if (form.elements.mode) form.elements.mode.value = node.mode || 'rest';
    form.elements.name.focus();
    editor.scrollIntoView({block: 'nearest'});
    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopPropagation();
      const name = form.elements.name.value.trim();
      if (!name) {
        form.elements.name.setCustomValidity('名前を入力してください。');
        form.elements.name.reportValidity();
        return;
      }
      const purpose = form.elements.purpose?.value.trim() || '';
      const values = node.kind === 'action'
        ? {name, purpose, daily: Number(form.elements.daily.value), weekly: Number(form.elements.weekly.value), mode: form.elements.mode.value}
        : {name, purpose};
      if (adding) {
        const children = mapNode(path).children;
        children.push({kind: node.kind, ...(node.kind === 'goal' ? {children: []} : {}), ...values});
        if (!path) openBranch = children.length - 1;
      } else Object.assign(node, values);
      persist();
      renderPersonalMap();
      controls.querySelector('#birth-personal-detail:not([hidden])')?.scrollIntoView({block: 'nearest'});
    });
    form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''));
    form.querySelector('[data-birth="cancel-node"]').addEventListener('click', () => {
      closeMapPanel(editor, button);
    });
  }

  function confirmMapRemoval(button) {
    const path = button.dataset.birthRemoveNode;
    const node = mapNode(path);
    const returnTarget = button.closest('.birth-node-editor')
      ? Array.from(controls.querySelectorAll('[data-birth-edit-node]')).find(card => card.dataset.birthEditNode === path)
      : button;
    const panel = showMapPanel(`<div class="birth-node-form">
      <h2>「${escapeMapText(node.name)}」を削除しますか？</h2>
      ${node.children?.length ? '<p>この枝の下にある目標とタスクも削除します。</p>' : ''}
      <div class="birth-node-actions">
        <button type="button" data-birth-cancel-removal>キャンセル</button>
        <button type="button" class="birth-map-delete" data-birth-confirm-removal>削除する</button>
      </div>
    </div>`);
    const cancel = panel.querySelector('[data-birth-cancel-removal]');
    cancel.addEventListener('click', () => closeMapPanel(panel, returnTarget));
    cancel.focus();
    panel.scrollIntoView({block: 'nearest'});
    panel.querySelector('[data-birth-confirm-removal]').addEventListener('click', () => {
      const indices = path.split('.');
      const index = Number(indices.pop());
      mapNode(indices.join('.')).children.splice(index, 1);
      if (!indices.length) openBranch = null;
      persist();
      renderPersonalMap();
      const destination = controls.querySelector('[data-birth-map-branch][aria-expanded="true"]')
        || controls.querySelector('[data-birth-add-node]');
      destination.focus();
    });
  }

  function showExampleBranch(button) {
    const index = Number(button.dataset.exampleBranch), branch = exampleMap.branches[index];
    const detail = controls.querySelector('#birth-example-detail');
    const alreadyOpen = button.getAttribute('aria-expanded') === 'true';
    controls.querySelector('[data-example-branch][aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
    detail.hidden = alreadyOpen;
    if (alreadyOpen) return;
    button.setAttribute('aria-expanded', 'true');
    const hub = `<div class="map-node map-detail-root"><strong>${branch.name}</strong></div>`;
    const points = branch.goals.map(goal => ({
      tone: index,
      card: `<div class="map-node"><span aria-hidden="true">✦</span><span>${mapKindLabel('goal')}<strong>${goal.name}</strong></span></div>
        <ul class="map-task-nodes">${goal.tasks.map(([name, minutes]) =>
          `<li><span>${mapKindLabel('action')}${name}</span><small>${minutes}分</small></li>`).join('')}</ul>`
    }));
    detail.innerHTML = mapDiagram(hub, points, {label: branch.name}) +
      (index === 0 ? '<p class="birth-map-caption">「健康でいたい」から枝をたどると、「10分歩く」までたどり着きます。</p>' : '');
    detail.scrollIntoView({block: 'nearest'});
  }

  function showArrival(focus) {
    showQuestion('あなたの星にたどり着きました。', focus);
    renderArrival();
  }

  function renderArrival() {
    const task = firstPersonalTask(draft.map);
    const included = task && demoMode && modesForLevel(task.mode || 'rest').includes(demoMode);
    controls.innerHTML = `<div class="birth-example birth-arrival">
      <p>目標へ向けた行動は、ここで記録できます。</p>
      <p>休む日・忙しい日・余裕がある日。どのペースから取り組むかは、自分で決められます。</p>
      ${task ? `<div class="birth-demo" aria-label="記録のお試し">
        <strong>今日のモードを試す</strong>
        <div class="birth-demo-modes">${['rest', 'busy', 'full'].map(mode =>
          `<button type="button" class="birth-choice" data-demo-mode="${mode}" aria-pressed="${demoMode === mode}">${MODES[mode].label}</button>`
        ).join('')}</div>
        <div class="birth-demo-result" aria-live="polite">
        ${demoMode ? included ? `<p>${escapeMapText(task.name)} · ${task.daily}分</p>
          ${demoRecorded ? `<p><strong>統計のプレビュー</strong> · ${escapeMapText(task.branch)}</p>
            <progress value="${Math.min(task.daily, task.weekly)}" max="${task.weekly}" aria-label="週の達成度"></progress>
            <p>今週 ${task.daily} / ${task.weekly}分 · ${Math.round(task.daily / task.weekly * 100)}%</p>
            <p>記録が星の灯りになりました。日々の積み重ねは、週・月・3か月ごとに振り返れます。</p>`
            : '<button type="button" class="birth-primary" data-birth="demo-record">このタスクの記録を試す</button>'}`
          : '<p>このタスクは、もう少し余裕がある日に取り組む設定です。</p>' : ''}
        </div>
      </div>` : '<p>マインドマップにタスクを追加すると、ここで記録を試せます。</p>'}
      ${researchNote('recording')}
      <button class="birth-primary" type="button" data-birth="finish-arrival">自分の星を保存する <span aria-hidden="true">→</span></button>
      <button class="birth-quiet birth-edit" type="button" data-birth="back-to-map">マインドマップに戻る</button>
    </div>`;
  }

  function enter(next, {focus = false, answer} = {}) {
    clearTimeout(timer);
    clearTimeout(formingTimer);
    step = next;
    screen.dataset.stage = next;
    const choosing = next === 'login';
    screen.toggleAttribute('data-choosing', choosing);
    screen.toggleAttribute('data-chat', !choosing && !Object.hasOwn(opening, next) && next !== 'bang');
    screen.toggleAttribute('data-map', next === 'confirm' || next === 'map');
    screen.toggleAttribute('data-landing', ['travel', 'arrival', 'login'].includes(next));
    if (choosing || next === 'gaze' || next === 'arrival') delete screen.dataset.forming;
    sky?.stage(next);
    skip.hidden = !Object.hasOwn(opening, next) && next !== 'bang';
    intro.replaceChildren();
    controls.replaceChildren();
    showError('');

    if (next === 'gaze' || dialogueSteps.includes(next)) {
      draft.step = next;
      persist();
    }
    if (next === 'login') {
      showQuestion('自分の星を保存しましょう。', focus);
      controls.innerHTML = `<div class="birth-example">
        ${preview ? '<button class="birth-primary" type="button" data-birth="preview-login">ログイン後の画面へ →</button>'
          : '<a class="birth-primary" href="/api/auth/google?onboarding=1">Googleでログイン →</a>'}
        <p class="birth-map-caption">保存できたら、目標に向けて今日の一歩から始めましょう。</p>
        <button class="birth-quiet birth-edit" type="button" data-birth="back-to-star">星に戻る</button>
      </div>`;
      if (loginError) showError(loginError);
      return;
    }
    if (Object.hasOwn(opening, next)) {
      retireTurn();
      const {prompt, duration, reducedDuration, next: following} = opening[next];
      if (prompt) intro.append(message('p', prompt, 'birth-prompt'));
      timer = setTimeout(() => {
        enter(motion.matches && next !== 'gaze' ? 'example-choice' : following);
      }, motion.matches ? reducedDuration ?? 0 : duration);
      return;
    }
    if (next === 'bang') {
      retireTurn();
      formingTimer = setTimeout(() => {screen.dataset.forming = '';}, SPHERE_FORMATION_AT);
      timer = setTimeout(() => enter('example-choice'), BANG_DURATION);
      return;
    }
    if (next === 'travel') {
      retireTurn();
      const travelCopy = message('p', 'あなたの星へ向かいます。', 'birth-prompt');
      intro.append(travelCopy);
      if (!motion.matches) {
        warp = createPortalWarp(true);
        const start = performance.now();
        const fly = time => {
          const elapsed = time - start;
          warp?.draw((elapsed - 650) / 1450, Math.min(1, (elapsed - 650) / 250, (2400 - elapsed) / 350));
          if (elapsed < 2400) flightFrame = requestAnimationFrame(fly);
        };
        flightFrame = requestAnimationFrame(fly);
      }
      timer = setTimeout(() => {
        cancelAnimationFrame(flightFrame);
        warp?.dispose();
        warp = null;
        enter('arrival', {focus});
      }, motion.matches ? 0 : 2450);
    } else if (next === 'example-choice') showBirthLesson(focus);
    else if (next === 'focus') showFocusQuestion(focus, answer);
    else if (next === 'explain') explain(focus);
    else if (['goal', 'reason', 'values'].includes(next)) askForAnswer(next, focus);
    else if (next === 'meaning') showMeaning(focus);
    else if (next === 'arrival') showArrival(focus);
    else showMap(focus, next === 'map');
  }

  async function saveMap(map) {
    if (saving) return;
    saving = true;
    controls.querySelectorAll('button').forEach(button => {button.disabled = true;});
    showError('');
    try {
      await onSave(map);
    } catch {
      showError('目標を保存できませんでした。もう一度お試しください。');
    } finally {
      saving = false;
      controls.querySelectorAll('button').forEach(button => {button.disabled = false;});
    }
  }

  screen.addEventListener('click', event => {
    const exampleBranch = event.target.closest('[data-example-branch]');
    if (exampleBranch) {
      showExampleBranch(exampleBranch);
      return;
    }
    const button = event.target.closest('button');
    const action = button?.dataset.birth;
    const choice = button?.dataset.choice;
    if (step === 'map' && button && !saving) {
      if (button.hasAttribute('data-birth-map-branch')) {
        const index = Number(button.dataset.birthMapBranch);
        openBranch = openBranch === index ? null : index;
        controls.querySelector('[data-birth-map-branch][aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-expanded', String(openBranch === index));
        renderPersonalBranch();
        controls.querySelector('#birth-personal-detail:not([hidden])')?.scrollIntoView({block: 'nearest'});
        return;
      }
      if (button.hasAttribute('data-birth-edit-node') || button.hasAttribute('data-birth-add-node')) {
        openMapEditor(button);
        return;
      }
      if (button.hasAttribute('data-birth-remove-node')) {
        confirmMapRemoval(button);
        return;
      }
      if (action === 'generate') {
        enter('travel', {focus: true});
        return;
      }
    }
    if (step === 'login' && action === 'preview-login') void saveMap(draft.map);
    if (step === 'login' && action === 'back-to-star') enter('arrival', {focus: true});
    if (step === 'arrival') {
      if (button?.dataset.demoMode) {
        demoMode = button.dataset.demoMode;
        demoRecorded = false;
        delete screen.dataset.demoRecorded;
        renderArrival();
        controls.querySelector('[aria-pressed="true"]').focus({preventScroll: true});
      }
      if (action === 'demo-record' && !demoRecorded) {
        demoRecorded = true;
        screen.dataset.demoRecorded = '';
        renderArrival();
        const progress = controls.querySelector('progress');
        progress.tabIndex = -1;
        progress.focus({preventScroll: true});
        progress.scrollIntoView({block: 'nearest'});
      }
      if (action === 'back-to-map') {
        demoMode = null;
        demoRecorded = false;
        delete screen.dataset.demoRecorded;
        enter('map', {focus: true});
      }
      if (action === 'finish-arrival') {
        if (!loginAtEnd) void saveMap(draft.map);
        else {
          try { enter('login', {focus: true}); }
          catch { enter('arrival'); showError('下書きを保存できませんでした。ブラウザの設定をご確認ください。'); }
        }
      }
    }
    if (step === 'example-choice' && ['broad', 'walk'].includes(choice)) enter('focus', {focus: true, answer: choice});
    if (['goal', 'reason', 'values'].includes(step) && action === 'skip-answer') enter('meaning', {focus: true});
    if (step === 'meaning' && choice === 'know-map') enter('confirm', {focus: true});
    if (step === 'meaning' && choice === 'new-map') {
      controls.replaceChildren();
      showSequence([
        ['真ん中に大きな目標を置き、枝を伸ばして、今日できることまで整理する地図です。', 'birth-reply']
      ], focus => enter('confirm', {focus}), true);
    }
    if (step === 'focus' && Object.hasOwn(focusOptions, choice)) {
      draft.focusBarrier = choice;
      enter('explain', {focus: true});
    }
    if (action === 'skip') enter('example-choice', {focus: true});
    if (action === 'close') onClose?.();
    if (action === 'settings') onSettings?.();
    if (step === 'confirm' && action === 'example') enter('map', {focus: true});
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
  try { disposeOrigin = mountOriginPreview(origin, motion); }
  catch {} // Keep the CSS sphere on devices without WebGL.
  enter(preview ? previewStart : draft.step);
  return {dispose() {
    clearTimeout(timer); clearTimeout(formingTimer); events.abort();
    cancelAnimationFrame(flightFrame); warp?.dispose();
    sky?.dispose(); disposeOrigin?.();
  }};
}
