import {BANG_DURATION, GATHER_DURATION, IGNITION_DURATION, SPHERE_FORMATION_AT, startBirthSky} from './onboarding-sky.js';
import {createExampleDraft, exampleMap, starterMap} from './example-map.js';
import {mapDiagram} from './mind-map.js';

const guestDraftKey = 'jiku:pending-universe';
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
  let step = 'gaze';
  if (['map', 'focus'].includes(source.step)) step = source.step;
  else if (['ready', 'confirm'].includes(source.step)) step = 'confirm';
  else if (source.step === 'explain') step = focusBarrier ? 'explain' : 'focus';
  const starter = {};
  for (const key of Object.keys(starterMap)) {
    if (typeof source.starter?.[key] === 'string') starter[key] = source.starter[key].slice(0, 80);
  }
  const map = step === 'map' && typeof source.map?.name === 'string'
    ? {name: source.map.name.slice(0, 80), children: draftChildren(source.map.children)} : null;
  return {name, ...(focusBarrier ? {focusBarrier} : {}), ...(Object.keys(starter).length ? {starter} : {}),
    ...(map ? {map} : {}), step};
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
  let openBranch = null;

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

  function choiceControls(options, label) {
    controls.innerHTML = `<div class="birth-choices" role="group" aria-label="${label}">${options.map(([id, text]) =>
      `<button class="birth-choice" type="button" data-choice="${id}">${text}<span aria-hidden="true">→</span></button>`
    ).join('')}</div>`;
  }

  function showQuestion(text, focus) {
    focusTurn(showTurn(text, 'birth-question', 'Jiku', 'h1'), focus);
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
      ['目標達成に関しても同じことが言えます。', 'birth-welcome'],
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
      ['目標と今日の一歩を線でつなぐと、何のために取り組むのかが見えてきます。', 'birth-welcome'],
      ['まずは「幸せな人生」を例に、そのつながりをマインドマップで見てみましょう。', 'birth-reply']
    ], shouldFocus => enter('confirm', {focus: shouldFocus}), focus);
  }

  function showMap(focus, editable) {
    showQuestion(editable ? 'あなたのマインドマップをつくりましょう。' : 'マインドマップのお手本', focus);
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
        <button class="birth-primary" type="button" data-birth="example">宇宙船に乗る <span aria-hidden="true">→</span></button>
      </div>`;
      return;
    }
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
      <button type="button" class="birth-map-add" data-birth-add-node="" data-node-kind="goal">＋ 銀河を追加</button>
      <div class="map-subview" id="birth-personal-detail" hidden></div>
      <div class="birth-node-editor" hidden></div>
      <button class="birth-primary" type="button" data-birth="generate">宇宙をつくる <span aria-hidden="true">→</span></button>
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
    const galaxy = adding ? !path : Boolean(path) && !path.includes('.');
    const title = node.kind === 'action' ? 'タスク' : galaxy ? '銀河' : path ? '目標' : 'いちばん大きな目標';
    const editor = showMapPanel(`<form class="birth-node-form">
      <h2>${title}を${adding ? '追加' : '編集'}</h2>
      <label>${title}の名前<input name="name" maxlength="80" required></label>
      ${node.kind === 'action' ? `<div class="birth-map-time">
        <label>1日（分）<input name="daily" type="number" min="1" max="1000000" value="${node.daily}" required></label>
        <label>週の目標（分）<input name="weekly" type="number" min="1" max="1000000" value="${node.weekly}" required></label>
      </div>` : ''}
      <div class="birth-node-actions">
        ${!adding && path ? removeNodeButton(node, path) : ''}
        <button type="button" data-birth="cancel-node">キャンセル</button>
        <button type="submit">保存</button>
      </div>
    </form>`);
    const form = editor.querySelector('form');
    form.elements.name.value = node.name;
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
      const values = node.kind === 'action'
        ? {name, daily: Number(form.elements.daily.value), weekly: Number(form.elements.weekly.value)} : {name};
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
    detail.innerHTML = mapDiagram(hub, points, {label: branch.name});
    detail.scrollIntoView({block: 'nearest'});
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
    const choosing = next === 'welcome';
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

    if (['gaze', 'focus', 'explain', 'confirm', 'map'].includes(next)) {
      draft.step = next;
      persist();
    }
    if (next === 'welcome') {
      showQuestion('Jikuへようこそ。', focus);
      const description = message('p', 'あなたの目標達成をサポートします。', 'birth-welcome-description');
      conversation.lastElementChild.append(description);
      controls.innerHTML = `<p class="birth-login-instruction">まずはログインしてください。</p>
        <button class="birth-primary" type="button" data-birth="preview-login">ログイン後の画面へ <span aria-hidden="true">→</span></button>`;
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

  async function saveMap(map) {
    if (step !== 'map' || saving) return;
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
        saveMap(draft.map);
        return;
      }
    }
    if (step === 'welcome' && action === 'preview-login') enter('gaze');
    if (step === 'focus' && Object.hasOwn(focusOptions, choice)) {
      draft.focusBarrier = choice;
      enter('explain', {focus: true});
    }
    if (action === 'skip') enter('focus', {focus: true});
    if (action === 'close') onClose?.();
    if (action === 'settings') onSettings?.();
    if (step === 'confirm' && action === 'example') onExample({...draft, step: 'map'});
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
