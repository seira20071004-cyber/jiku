import {BANG_DURATION, GATHER_DURATION, IGNITION_DURATION, startBirthSky} from './onboarding-sky.js';
import {exampleMap, starterMap} from './example-map.js';
import {mapDiagram} from './mind-map.js';
import {createPortalWarp, mountOriginPreview} from './origin-preview.js';
import {createBirthMusic} from './birth-music.js';
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
  still: {duration: 520, next: 'bang'}
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
    return depth < 4 ? [{name, kind: 'goal', children: draftChildren(node.children, depth + 1), ...purpose}] : [];
  });
}

export function initialPersonalMap(draft) {
  if (draft.map) return draft.map;
  if (!draft.starter) return {name: exampleMap.name, children: []};
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
const legacyFocusBarriers = ['motivation', 'unclear', 'distractions', 'busy'];

const focusOptions = {
  unclear: {
    label: '最初の一歩が決まらず、計画を練り直してしまう',
    reply: 'いつ、何をするかまで決めると、\n行動に移りやすくなることが研究されています。',
    study: ['Webb & Sheeran（2007）', 'https://www.sciencedirect.com/science/article/pii/S002210310600028X']
  },
  notifications: {
    label: 'スマホの通知で気がそれる',
    reply: 'スマホに触らなくても、通知を受け取るだけで、\n注意が必要な作業に影響が出た実験があります。',
    study: ['Stothart ほか（2015）', 'https://pubmed.ncbi.nlm.nih.gov/26121498/']
  },
  switching: {
    label: '別の用事に切り替えると、前の作業が気になる',
    reply: '作業を切り替えたあとも、\n前の作業に注意が残ることが実験で示されています。',
    study: ['Leroy（2009）', 'https://www.sciencedirect.com/science/article/pii/S0749597809000399']
  },
  sleep: {
    label: '寝不足の日は注意が途切れやすい',
    reply: '睡眠をとらない時間が続くと、\n注意が途切れやすくなることが、複数の実験で報告されています。',
    study: ['Lim & Dinges（2010）', 'https://pubmed.ncbi.nlm.nih.gov/20438143/']
  }
};

const dialogueSteps = ['example-choice', 'focus', 'explain', 'goal', 'reason', 'reason-two', 'reason-three', 'values', 'meaning', 'confirm', 'map', 'arrival', 'statistics', 'closing', 'login'];
const research = {
  motivation: ['理由が続ける支えになる', '自己決定理論をもとにした研究では、自分の価値観や関心に合う目標ほど努力が続きやすく、その達成はより高い幸福感にもつながりました。', 'Sheldon & Elliot（1999）', 'https://pubmed.ncbi.nlm.nih.gov/10101878/'],
  recording: ['進捗を確かめると、目標達成を後押しできる', '138件の実験をまとめた分析で、進捗の確認を促すと目標達成が改善しました。進捗を記録した場合に、効果がより大きく見られました。', 'Harkin ほか（2016）', 'https://pubmed.ncbi.nlm.nih.gov/26479070/']
};

function researchNote(key) {
  const [title, description, authors, url] = research[key];
  return `<details class="birth-research"><summary>${title} · 研究を見る</summary>
    <p>${description}</p><a href="${url}" target="_blank" rel="noopener">${authors}</a>
  </details>`;
}

export function firstPersonalTask(map) {
  const findTask = nodes => {
    for (const node of nodes) {
      if (node.kind === 'action') return node;
      const task = findTask(node.children);
      if (task) return task;
    }
    return null;
  };
  for (const branch of map.children) {
    const task = findTask(branch.children);
    if (task) return {...task, branch: branch.name};
  }
  return null;
}

export function onboardingDraft(saved, legacy) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const legacyName = typeof legacy?.draftName === 'string' ? legacy.draftName : '';
  const priorAnswer = source.direction || source.custom;
  const name = ((typeof source.name === 'string' ? source.name : legacyName) ||
    (typeof priorAnswer === 'string' ? priorAnswer : '')).slice(0, 80);
  const focusBarrier = Object.hasOwn(focusOptions, source.focusBarrier) || legacyFocusBarriers.includes(source.focusBarrier)
    ? source.focusBarrier : null;
  const concentration = typeof source.concentration === 'string' ? source.concentration.trim().slice(0, 80) : '';
  let step = 'gaze';
  if (dialogueSteps.includes(source.step) && source.step !== 'explain') step = source.step;
  else if (['ready', 'confirm'].includes(source.step)) step = 'confirm';
  else if (source.step === 'explain') step = concentration || focusBarrier ? 'explain' : 'focus';
  const starter = {};
  for (const key of Object.keys(starterMap)) {
    if (typeof source.starter?.[key] === 'string') starter[key] = source.starter[key].slice(0, 80);
  }
  const map = ['map', 'arrival', 'statistics', 'closing', 'login'].includes(step) && typeof source.map?.name === 'string'
    ? {name: source.map.name.slice(0, 80), children: draftChildren(source.map.children)} : null;
  if (['arrival', 'statistics', 'closing', 'login'].includes(step) && !map) step = 'map';
  const answers = {};
  for (const key of ['goal', 'reason', 'reasonTwo', 'values']) {
    if (typeof source[key] === 'string' && source[key].trim()) answers[key] = source[key].trim().slice(0, 80);
  }
  if (['reason', 'values'].includes(step) && !answers.goal) step = 'goal';
  if (step === 'values' && !answers.reason) step = 'reason';
  if (['reason-two', 'reason-three'].includes(step) && !answers.goal) step = 'goal';
  if (['reason-two', 'reason-three'].includes(step) && !answers.reason) step = 'reason';
  if (step === 'reason-three' && !answers.reasonTwo) step = 'reason-two';
  const recordedMode = ['rest', 'busy', 'full'].includes(source.recordedMode) ? source.recordedMode : null;
  return {name, ...answers, ...(concentration ? {concentration} : {}), ...(recordedMode ? {recordedMode} : {}), ...(focusBarrier ? {focusBarrier} : {}), ...(Object.keys(starter).length ? {starter} : {}),
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
  onDraft, onSave, renderStatistics, onClose, onSettings, loginAtEnd = false, loginError
} = {}) {
  const draft = onboardingDraft(initial);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = window.visualViewport;
  const events = new AbortController();
  const {signal} = events;
  let step, timer, sky, saving = false;
  let openBranch = null;
  let disposeOrigin, warp, flightFrame, demoMode = draft.recordedMode;
  let reportPeriod = 'quantity';

  host.innerHTML = `
    <main class="birth-screen" aria-label="Jiku はじまりの宇宙">
      <div class="birth-sky" aria-hidden="true">
        <div class="birth-haze"></div><canvas class="birth-stars"></canvas><div class="birth-light"></div>
        <div class="birth-origin"><i class="birth-orb-fallback" aria-hidden="true"></i></div>
        <div class="birth-landing-planet">${planetArt()}</div>
      </div>
      <header class="birth-header">
        <span class="birth-wordmark">Jiku<span>●</span></span>
        <button type="button" class="birth-quiet birth-music" data-birth="music" aria-pressed="false">音楽</button>
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
      ${loginAtEnd && !preview ? '<a class="birth-quiet birth-sample-link" href="/?demo=1#stats">サンプルで試す</a>' : ''}
    </main>`;

  const screen = host.firstElementChild;
  const origin = screen.querySelector('.birth-origin');
  const intro = screen.querySelector('.birth-intro');
  const content = screen.querySelector('.birth-content');
  const conversation = screen.querySelector('.birth-conversation');
  const controls = screen.querySelector('.birth-controls');
  const note = screen.querySelector('.birth-error');
  const musicButton = screen.querySelector('[data-birth="music"]');
  const music = createBirthMusic();
  musicButton.hidden = !music;
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
      ['JIKUへようこそ。', 'birth-emphasis'],
      ['あなたの宇宙が、今、誕生しました。', 'birth-emphasis'],
      ['この宇宙は、あなたの人生を映す場所です。', 'birth-reply'],
      ['これから、この宇宙を少しずつ育てていきましょう。', 'birth-reply'],
      ['目の前のことに集中することが、\n目標達成への近道になります。', 'birth-emphasis'],
      ['例えば、英語を話せるようになりたい2人に、\n今夜30分ずつ時間があります。', 'birth-reply'],
      ['Aさんは、教材を探したり\n勉強の予定を組み直したりしているうちに、\n30分が過ぎました。', 'birth-reply'],
      ['Bさんは、短い会話を1つ選び、\n残りの時間は声に出して練習しました。', 'birth-reply']
    ], shouldFocus => {
      showQuestion('今夜、英語を話す練習を\n進められたのはどちらでしょう？', shouldFocus);
      choiceControls([['a', 'Aさん · 教材と予定を見直した'], ['b', 'Bさん · 会話を声に出して練習した']], '今夜の練習を進められた人');
    }, focus);
  }

  function showFocusQuestion(focus, answer) {
    const ask = shouldFocus => {
      showQuestion('やりたいことがあるのに、\n集中が途切れたり、手が止まったりするのは\nどんなときですか？', shouldFocus);
      choiceControls([...Object.entries(focusOptions).map(([id, option]) => [id, option.label]), ['own', '自分の言葉で答える']], '自分に近い場面');
      controls.insertAdjacentHTML('beforeend', '<button type="button" class="birth-quiet birth-edit" data-birth="skip-answer">まだわからない</button>');
    };
    if (!answer) return ask(focus);
    showSequence([
      [answer === 'a' ? 'Aさんは教材と予定を整えました。\n実際に声を出すところまで進んだのはBさんです。' : 'Bさんは、短い会話を実際に\n声に出すところまで進めましたね。', 'birth-reply'],
      ['計画で最初の一歩を決めたら、\nその一歩に集中する時間を取りましょう。', 'birth-emphasis'],
      ['やることが決まっていても、\n手が止まったり、集中が途切れたりすることがあります。', 'birth-reply']
    ], ask, focus);
  }

  function explain(focus) {
    const option = focusOptions[draft.focusBarrier];
    if (option) {
      showQuestion(option.reply, focus);
      controls.innerHTML = `<div class="birth-example">
        <details class="birth-research"><summary>この研究を見る</summary>
          <a href="${option.study[1]}" target="_blank" rel="noopener">${option.study[0]}</a>
        </details>
        <button type="button" class="birth-primary" data-birth="continue-explanation">目標について考える →</button>
      </div>`;
      return;
    }
    showMotivation(focus, draft.concentration ? `「${draft.concentration}」。\nそういうときは、手が止まることもありますよね。` : '');
  }

  function showMotivation(focus, reply = '') {
    showSequence([
      ...(reply ? [[reply, 'birth-reply']] : []),
      ['行動を続ける支えの一つが、モチベーションです。', 'birth-emphasis'],
      ['例えば、どうしても合格したい試験があれば、\nSNSを見る時間を決めて、\n勉強の時間をつくる人もいます。', 'birth-reply'],
      ['達成したいという気持ちがあると、\n目の前の時間の使い方も変わります。', 'birth-reply'],
      ['目標に向けて集中を続けるために、\n自分が取り組む理由を大切にしましょう。', 'birth-emphasis']
    ], shouldFocus => enter('goal', {focus: shouldFocus}), focus);
  }

  function askForAnswer(key, focus) {
    const prompts = {
      concentration: ['なぜ集中が続かないと思いますか？', '例　スマホが気になってしまう', 'explain'],
      goal: ['あなたが達成したい目標は何ですか？', '例　無理なく運動を続けたい', 'reason'],
      reason: [`「${draft.goal}」を、\n何のために達成したいですか？`, '例　休日に元気に出かけたい', 'reason-two'],
      'reason-two': [`「${draft.reason}」。\nでは、それは何のためでしょうか？`, '例　家族と出かける時間を増やしたい', 'reason-three'],
      'reason-three': [`「${draft.reasonTwo}」を実現できたら、\nどんなことを得たいですか？`, '例　家族と楽しい思い出をつくりたい', 'meaning'],
      values: [`「${draft.reason}」の先に、\nどんな日々が増えたら幸せだと思いますか？`, '例　大切な人と元気に過ごしたい', 'meaning']
    };
    const [question, placeholder, next] = prompts[key];
    showQuestion(question, focus);
    const examples = {
      goal: ['無理なく運動を続けたい', '英語で会話できるようになりたい', '作りたいものを形にしたい'],
      reason: ['元気に過ごす日を増やしたい', '大切な人ともっと話したい', 'できることを増やしたい'],
      'reason-two': ['安心して暮らしたい', '家族や友人と過ごす時間を増やしたい', '新しいことに挑戦したい'],
      'reason-three': ['自分で選べる自由', '大切な人との思い出', 'やり遂げた実感']
    }[key] || [];
    controls.innerHTML = `${examples.length ? `<div class="birth-answer-examples" role="group" aria-label="答えの例">
      ${examples.map((example, index) => `<button type="button" class="birth-choice" data-answer-example="${index}">${example}</button>`).join('')}
    </div>` : ''}<form class="birth-form">
      <input name="answer" required maxlength="80" placeholder="${placeholder}">
      <button type="submit" class="birth-primary">答える</button>
    </form>${key === 'goal' ? '<p class="birth-map-caption">大きな目標でも、小さな目標でも構いません。</p>' : ''}
    <button type="button" class="birth-quiet birth-edit" data-birth="skip-answer">まだ思いつかない</button>`;
    const form = controls.querySelector('form');
    form.elements.answer.setAttribute('aria-label', question.replaceAll('\n', ''));
    for (const button of controls.querySelectorAll('[data-answer-example]')) {
      button.addEventListener('click', () => {
        form.elements.answer.value = examples[Number(button.dataset.answerExample)];
        form.elements.answer.setCustomValidity('');
        form.elements.answer.focus();
      });
    }
    form.elements.answer.addEventListener('input', () => form.elements.answer.setCustomValidity(''));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const answer = form.elements.answer.value.trim();
      if (!answer) {
        form.elements.answer.setCustomValidity('答えを入力してください。');
        form.elements.answer.reportValidity();
        return;
      }
      const field = {'reason-two': 'reasonTwo', 'reason-three': 'values'}[key] || key;
      draft[field] = answer;
      enter(next, {focus: true});
    });
  }

  function showMeaning(focus) {
    const value = draft.values || draft.reasonTwo || draft.reason;
    showSequence([
      [value ? `「${value}」。聞かせてくれて、ありがとうございます。` : '答えは、自分のペースで見つけていきましょう。', 'birth-reply'],
      ['「何のため？」と考えていくと、\n自分が本当に大切にしているものが\n少しずつ見えてきます。', 'birth-reply'],
      ['その先には、\n自分らしく幸せに暮らしたいという願いがあるかもしれません。', 'birth-reply'],
      ['例えば、お金を稼ぎたい理由には、\n家族と安心して暮らしたいという願いがあるかもしれません。', 'birth-reply'],
      ['目の前の目標は、\n自分が望む人生に近づくための手段でもあります。', 'birth-emphasis'],
      ['自分の行動が大切なものにつながっていると感じることが、\nやる気を支えてくれます。', 'birth-reply'],
      ['英単語を覚えることも、\n海外の人と自由に話したいという願いにつながると、\n取り組む意味が見えてきます。', 'birth-reply'],
      ['今日の行動と、\n自分が本当に大切にしていることをつなげてみましょう。', 'birth-emphasis']
    ], shouldFocus => {
      showQuestion('ところで、マインドマップを知っていますか？', shouldFocus);
      choiceControls([['know-map', '知っている'], ['new-map', '知らない']], 'マインドマップ');
    }, focus);
  }

  function showMap(focus, editable) {
    showQuestion(editable ? 'あなたのマインドマップをつくりましょう。' : 'まずは「健康」の枝をタップしてみてください。', focus);
    if (!editable) {
      const hub = `<div class="map-node map-root"><span aria-hidden="true">◎</span><strong>自分らしく幸せな人生を送る</strong></div>`;
      const points = exampleMap.branches.map((branch, index) => ({
        tone: index,
        card: `<button type="button" class="map-node" data-example-branch="${index}" aria-expanded="false" aria-controls="birth-example-detail">
          <span aria-hidden="true">◉</span><strong>${branch.name}</strong>
        </button>`
      }));
      controls.innerHTML = `<div class="birth-example">
        ${mapDiagram(hub, points, {radial: true, label: '幸せな人生のマインドマップ'})}
        <div class="map-subview" id="birth-example-detail" hidden></div>
        <div class="birth-example-next"></div>
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
      <button type="button" class="birth-map-add" data-birth-add-node="" data-node-kind="goal">＋ 目標を追加</button>
      <p class="birth-map-caption">「＋ 目標を追加」から、あなたが大切にしたいことをひとつ置いてみましょう。</p>
      ${draft.goal ? `<details class="birth-research"><summary>会話で答えたこと</summary><ul>
        ${[draft.goal, draft.reason, draft.reasonTwo, draft.values].filter(Boolean).map(value => `<li>${escapeMapText(value)}</li>`).join('')}
      </ul></details>` : ''}
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
    function branchCard(node, path) {
      const task = node.kind === 'action';
      const depth = path.split('.').length;
      return `${editNodeButton(node, path, task ? '✓' : '✦')}
        <div class="birth-map-point-actions">
          ${!task && depth < 4 ? `<button type="button" class="birth-map-add" data-birth-add-node="${path}" data-node-kind="action">＋ タスク</button>` : ''}
          ${removeNodeButton(node, path)}
        </div>
        ${task ? `<p class="birth-map-caption">${node.daily}分</p>` : node.children.length ? `
          <ul class="map-task-nodes birth-map-nested">${node.children.map((child, index) =>
            `<li>${branchCard(child, `${path}.${index}`)}</li>`).join('')}</ul>` : ''}`;
    }
    const points = branch.children.map((node, index) => ({
      tone: openBranch % 4,
      card: branchCard(node, `${openBranch}.${index}`)
    }));
    detail.innerHTML = `${mapDiagram(editNodeButton(branch, String(openBranch), '◉', 'map-detail-root'), points, {label: '目標の枝'})}
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
    const points = branch.goals.map((goal, goalIndex) => ({
      tone: index,
      card: `<button type="button" class="map-node" data-example-goal="${index}.${goalIndex}" aria-expanded="false">
        <span aria-hidden="true">✦</span><span>${mapKindLabel('goal')}<strong>${goal.name}</strong></span>
      </button><div class="birth-example-tasks" hidden></div>`
    }));
    showQuestion('次に、枝の中の目標を一つタップしてみましょう。', false);
    detail.innerHTML = mapDiagram(hub, points, {label: branch.name});
    detail.scrollIntoView({block: 'nearest'});
  }

  function showExampleGoal(button) {
    const [branchIndex, goalIndex] = button.dataset.exampleGoal.split('.').map(Number);
    const goal = exampleMap.branches[branchIndex].goals[goalIndex];
    const tasks = button.nextElementSibling;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    tasks.hidden = expanded;
    if (expanded) return;
    tasks.innerHTML = `<ul class="map-task-nodes">${goal.tasks.map(([name, minutes]) =>
      `<li><span>${mapKindLabel('action')}${name}</span><small>${minutes}分</small></li>`).join('')}</ul>`;
    if (controls.querySelector('.birth-example-next button')) return;
    showQuestion('大きな目標から、今日できる行動までたどり着きました。', false);
    controls.querySelector('.birth-example-next').innerHTML = `<p class="birth-map-caption">優秀なエンジニアになることが幸せにつながるかは、人によって違います。心理学でも、自分の価値観に合う目標と、取り組む意欲や幸福感との関係が研究されています。</p>
      ${researchNote('motivation')}
      <p class="birth-map-caption">最初は一つの枝からで大丈夫です。目標は後から何度でも変えられます。</p>
      <button class="birth-primary" type="button" data-birth="example">自分のマインドマップをつくる →</button>`;
    tasks.scrollIntoView({block: 'nearest'});
  }

  function showArrival(focus) {
    const offerMode = shouldFocus => {
      showQuestion('今日は、どのモードで過ごしたいですか？', shouldFocus);
      renderArrival();
    };
    showSequence([
      ['あなたの星にたどり着きました。', 'birth-emphasis'],
      ['ここには、目標に向かって進んだ記録を残せます。', 'birth-emphasis'],
      ['JIKUには、\n休む日・忙しい日・余裕がある日の3つのモードがあります。', 'birth-reply'],
      ['タスクごとに量とモードを設定しておけば、\nその日のペースを選ぶだけで、\n取り組んだ量を記録できます。', 'birth-reply']
    ], offerMode, focus);
  }

  function renderArrival() {
    const task = firstPersonalTask(draft.map);
    const included = task && demoMode && modesForLevel(task.mode || 'rest').includes(demoMode);
    controls.innerHTML = `<div class="birth-example birth-arrival">
      <div class="birth-demo" aria-label="記録のお試し">
        <div class="birth-demo-modes">${['rest', 'busy', 'full'].map(mode =>
          `<button type="button" class="birth-choice" data-demo-mode="${mode}" aria-pressed="${demoMode === mode}">${MODES[mode].label}</button>`
        ).join('')}</div>
        <div class="birth-demo-result" aria-live="polite">
          ${demoMode ? `<p>${included ? `${escapeMapText(task.name)} · ${task.daily}分` : task ? 'このタスクは、選んだモードには含まれません。' : 'タスクを追加すると、取り組んだ量も記録できます。'}</p>` : ''}
        </div>
      </div>
      ${demoMode ? `<p class="birth-map-caption">138件の実験をまとめた研究では、進捗の記録・確認が目標達成を後押ししました。</p>
        ${researchNote('recording')}
        <button class="birth-primary" type="button" data-birth="show-statistics">統計を見る →</button>` : ''}
      <button class="birth-quiet birth-edit" type="button" data-birth="back-to-map">マインドマップに戻る</button>
    </div>`;
  }

  const reportTabs = [
    ['quantity', '1週間', '1週間では、日々の行動を振り返ります。'],
    ['monthly', '1か月', '1か月では、続けてきた時間や目標までの進み具合を確認できます。'],
    ['quarter', '3か月', '3か月では、積み重ねを眺め、目標や人生の方向性を見直せます。'],
    ['calendar', 'カレンダー', 'カレンダーでは、どの日に取り組んだかを振り返れます。']
  ];

  function showStatistics(focus) {
    showQuestion('自分の成長を振り返ってみましょう。', focus);
    controls.innerHTML = `<div class="birth-example birth-statistics">
      <p class="birth-map-caption">お試しで選んだモードの記録</p>
      <div class="statistics-tabs" role="group" aria-label="振り返る期間">
        ${reportTabs.map(([id, label]) => `<button type="button" data-birth-report="${id}" aria-pressed="false">${label}</button>`).join('')}
      </div>
      <p class="birth-map-caption birth-report-caption" aria-live="polite"></p>
      <div class="birth-report-body view-stats"><div class="statistics-content"></div></div>
      <button class="birth-primary" type="button" data-birth="show-closing">自分の星に戻る →</button>
    </div>`;
    updateReport(reportPeriod);
  }

  function updateReport(period) {
    reportPeriod = period;
    for (const tab of controls.querySelectorAll('[data-birth-report]')) {
      tab.setAttribute('aria-pressed', String(tab.dataset.birthReport === period));
    }
    controls.querySelector('.birth-report-caption').textContent = reportTabs.find(([id]) => id === period)[2];
    const body = controls.querySelector('.birth-report-body .statistics-content');
    body.classList.toggle('calendar-content', period === 'calendar');
    body.classList.toggle('quantity-content', period !== 'calendar');
    body.innerHTML = renderStatistics(draft.map, demoMode, period);
  }

  function showClosing(focus) {
    showSequence([
      ['ここまで、ありがとうございました。', 'birth-reply'],
      ['あなたが今日つくった宇宙は、まだ始まったばかりです。', 'birth-emphasis'],
      ['これから、あなたの行動が記録として積み重なり、\n星を育てていきます。', 'birth-reply'],
      ['振り返りを重ねると、次に何をするかが少しずつ見えてきます。', 'birth-reply'],
      ['休む日があっても、目標が変わっても大丈夫です。', 'birth-reply'],
      ['迷ったときは、この宇宙で、\n何を目指しているのか、\n何のために続けるのか、\n今日できることは何かを思い出してください。', 'birth-reply'],
      ['今日の一歩に、人生の意味を。', 'birth-emphasis']
    ], shouldFocus => {
      showQuestion('さあ、あなたの目標に向かって進んでいきましょう。', shouldFocus);
      controls.innerHTML = '<button class="birth-primary" type="button" data-birth="start-jiku">JIKUをはじめる →</button>';
    }, focus);
  }

  function enter(next, {focus = false, answer} = {}) {
    clearTimeout(timer);
    step = next;
    screen.dataset.stage = next;
    const choosing = next === 'login';
    screen.toggleAttribute('data-choosing', choosing);
    screen.toggleAttribute('data-chat', !choosing && !Object.hasOwn(opening, next) && next !== 'bang');
    screen.toggleAttribute('data-map', ['confirm', 'map', 'statistics'].includes(next));
    screen.toggleAttribute('data-landing', ['travel', 'arrival', 'closing', 'login'].includes(next));
    if (next === 'travel') delete screen.dataset.approaching;
    screen.toggleAttribute('data-demo-recorded', Boolean(draft.recordedMode));
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
      music?.accent();
      timer = setTimeout(() => enter('example-choice'), BANG_DURATION);
      return;
    }
    if (next === 'departure') {
      showSequence([
        ['ありがとうございます。\nあなた自身の目標が、少しずつ形になりましたね。', 'birth-reply'],
        ['では、あなたの星へ向かいましょう。', 'birth-emphasis']
      ], shouldFocus => enter('travel', {focus: shouldFocus}), focus);
    } else if (next === 'travel') {
      retireTurn();
      const travelCopy = message('p', 'あなたの星へ向かいます。', 'birth-prompt');
      intro.append(travelCopy);
      if (!motion.matches) {
        warp = createPortalWarp(true);
        const start = performance.now();
        const fly = time => {
          const elapsed = time - start;
          const warpStart = 1050, reveal = 1980, arrival = 3100;
          if (elapsed >= warpStart) {
            warp?.draw((elapsed - warpStart) / (arrival - warpStart),
              Math.min(1, (elapsed - warpStart) / 340, (arrival - elapsed) / (arrival - reveal)));
          }
          if (elapsed >= reveal) screen.dataset.approaching = '';
          if (elapsed < arrival) flightFrame = requestAnimationFrame(fly);
        };
        flightFrame = requestAnimationFrame(fly);
      }
      timer = setTimeout(() => {
        cancelAnimationFrame(flightFrame);
        warp?.dispose();
        warp = null;
        enter('arrival', {focus});
      }, motion.matches ? 0 : 3150);
    } else if (next === 'example-choice') showBirthLesson(focus);
    else if (next === 'focus') showFocusQuestion(focus, answer);
    else if (next === 'explain') explain(focus);
    else if (['goal', 'reason', 'reason-two', 'reason-three', 'values'].includes(next)) askForAnswer(next, focus);
    else if (next === 'meaning') showMeaning(focus);
    else if (next === 'arrival') showArrival(focus);
    else if (next === 'statistics') showStatistics(focus);
    else if (next === 'closing') showClosing(focus);
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
    if (button?.dataset.exampleGoal) {
      showExampleGoal(button);
      return;
    }
    const action = button?.dataset.birth;
    if (action === 'music') {
      void music?.toggle().then(playing => musicButton.setAttribute('aria-pressed', String(playing)));
      return;
    }
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
        enter('departure', {focus: true});
        return;
      }
    }
    if (step === 'login' && action === 'preview-login') void saveMap(draft.map);
    if (step === 'login' && action === 'back-to-star') enter('closing', {focus: true});
    if (step === 'arrival') {
      if (button?.dataset.demoMode) {
        demoMode = button.dataset.demoMode;
        draft.recordedMode = demoMode;
        persist();
        screen.dataset.demoRecorded = '';
        renderArrival();
        controls.querySelector('[aria-pressed="true"]').focus({preventScroll: true});
      }
      if (action === 'back-to-map') {
        delete draft.recordedMode;
        demoMode = null;
        enter('map', {focus: true});
      }
      if (action === 'show-statistics') enter('statistics', {focus: true});
    }
    if (step === 'statistics' && button?.dataset.birthReport) updateReport(button.dataset.birthReport);
    if (step === 'statistics' && action === 'show-closing') enter('closing', {focus: true});
    if (step === 'closing' && action === 'start-jiku') {
      if (!loginAtEnd) void saveMap(draft.map);
      else {
        try { enter('login', {focus: true}); }
        catch { enter('closing'); showError('下書きを保存できませんでした。ブラウザの設定をご確認ください。'); }
      }
    }
    if (step === 'example-choice' && ['a', 'b'].includes(choice)) enter('focus', {focus: true, answer: choice});
    if (step === 'focus' && Object.hasOwn(focusOptions, choice)) {
      draft.focusBarrier = choice;
      enter('explain', {focus: true});
    }
    if (step === 'focus' && choice === 'own') askForAnswer('concentration', true);
    if (step === 'explain' && action === 'continue-explanation') {
      controls.replaceChildren();
      showMotivation(true);
    }
    if (action === 'skip-answer') {
      if (step === 'focus') showMotivation(true);
      else enter('meaning', {focus: true});
    }
    if (step === 'meaning' && ['know-map', 'new-map'].includes(choice)) {
      controls.replaceChildren();
      const turns = choice === 'new-map' ? [
        ['マインドマップは、中心に一つのテーマを書き、\n関連する考えや目標を枝のように広げて\n整理する方法です。', 'birth-reply']
      ] : [];
      turns.push(['今回は、中心に人生の大きな目標を置き、\nそのために必要なことを整理していきます。', 'birth-reply']);
      showSequence(turns, focus => enter('confirm', {focus}), true);
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
    clearTimeout(timer); events.abort();
    cancelAnimationFrame(flightFrame); warp?.dispose();
    sky?.dispose(); disposeOrigin?.(); music?.dispose();
  }};
}
