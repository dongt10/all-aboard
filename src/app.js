import { CHARACTERS, getActivity } from './data.js';
import { mountVillage, avatarMarkup } from './village.js';
import { mountActivity } from './activity.js';
import { loadState, saveState, completeActivity, getCompleted, getRewards } from './progress.js';

const app = document.querySelector('#app');
const activityHost = document.querySelector('#activity-host');
const announcements = document.querySelector('#announcements');
let state = loadState();
let village;
let activeActivity;
let shellDialog;
let toastTimer;
const icons = {
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6M16 14v6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>',
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function scopeLabel() { return state.chapter === 0 ? 'Chapter 0 · Kindergarten' : `Chapter 1 · Grade ${state.grade}`; }
function persist() {
  const saved = saveState(state);
  const status = document.querySelector('#save-status');
  if (status) status.textContent = saved ? 'Progress saved on this device' : 'Progress stays open for this visit';
}

function applySettings() {
  document.documentElement.classList.toggle('large-text', state.settings.largeText);
  document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion);
  village?.update({ completedSubjects: getCompleted(state), settings: state.settings });
}

function announce(text) {
  announcements.textContent = '';
  requestAnimationFrame(() => { announcements.textContent = text; });
}

function showToast(text) {
  clearTimeout(toastTimer);
  const toast = document.querySelector('#toast');
  toast.textContent = text;
  toast.classList.add('is-visible');
  announce(text);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4500);
}

function closeActivity() {
  activeActivity?.destroy();
  activeActivity = null;
}

function visit(subjectId) {
  if (activeActivity || shellDialog?.open) return;
  const character = CHARACTERS.find(item => item.id === subjectId);
  if (!character) return;
  const origin = document.activeElement;
  const restoreFocus = () => {
    if (origin?.isConnected) origin.focus?.();
    else document.querySelector(`[data-subject="${subjectId}"]`)?.focus();
  };
  const activity = getActivity(subjectId, state.chapter, state.grade);
  const previousCount = getCompleted(state).length;
  state.hasStarted = true;
  persist();
  activeActivity = mountActivity(activityHost, {
    character, activity, settings: state.settings,
    onClose() { closeActivity(); restoreFocus(); },
    onComplete(result) {
      const raw = result?.creation;
      const creation = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(value => typeof value === 'string' ? value : value.label || '').join(' · ') : raw?.label || null;
      state = completeActivity(state, activity, creation);
      closeActivity();
      persist();
      renderProgress();
      restoreFocus();
      showToast(`${activity.reward.label} added to your festival stall.`);
      if (previousCount < 7 && getCompleted(state).length === 7) openCelebration();
    },
  });
}

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <a class="wordmark" href="#village-section" aria-label="All Aboard, go to village"><img src="./assets/favicon.svg" alt="" width="40" height="40"><span>All Aboard<small>SUMMER FESTIVAL</small></span></a>
      <div class="topbar-center">${icons.sun}<span>A little summer adventure</span></div>
      <nav class="header-actions" aria-label="Game controls">
        <button class="button button-quiet" id="chapter-control"><span id="chapter-label"></span><span aria-hidden="true">⌄</span></button>
        <button class="button icon-button" id="settings-control" aria-label="Comfort settings" title="Comfort settings">${icons.settings}</button>
        <button class="button button-quiet" id="break-control">${icons.pause}<span>Take a break</span></button>
      </nav>
    </header>
    <main class="game-layout">
      <section class="village-section" id="village-section" aria-labelledby="village-heading" tabindex="-1">
        <div class="section-intro"><div><p class="eyebrow">A PLACE FOR EVERY IDEA</p><h1 id="village-heading">Welcome to the village.</h1><p>Choose any neighbor. Help with a little something. Make the festival yours.</p></div><span class="season-stamp"><span aria-hidden="true">✿</span> Summer<br>festival</span></div>
        <div class="map-frame"><div class="map-topline"><span><span class="live-dot"></span> Festival village</span><span class="map-tag">Explore at your pace</span></div><div id="village-mount"></div></div>
        <div class="below-map"><span><strong>Your pace. Your path.</strong> Every subject is open from the start.</span><span class="prototype-label">Rough draft · Placeholder art</span></div>
      </section>
      <aside class="journey-panel" aria-label="Your festival preparations">
        <section class="stall-card" aria-labelledby="stall-heading"><div class="card-heading"><div><p class="eyebrow">MADE BY YOU</p><h2 id="stall-heading">Your festival stall</h2></div><span class="stall-symbol" aria-hidden="true">✷</span></div><p class="stall-description">A little piece from every adventure.</p><div class="progress-meta"><span id="progress-text">0 of 7 preparations</span><strong id="progress-percent">0%</strong></div><div class="progress-track" role="progressbar" aria-label="Festival preparations" aria-valuemin="0" aria-valuemax="7" aria-valuenow="0"><span id="progress-fill"></span></div><div id="reward-shelf" class="reward-shelf"></div><p id="stall-caption" class="stall-caption"></p></section>
        <section class="neighbor-section" aria-labelledby="neighbors-heading"><div class="neighbor-section-heading"><h2 id="neighbors-heading">Meet your neighbors</h2><span>7 places to explore</span></div><div id="neighbor-list" class="neighbor-list"></div></section>
        <div class="companion-note"><span class="pip-portrait">${avatarMarkup('pip', {size: 46})}</span><p><strong>Pip’s tip</strong>You can start anywhere. I’ll be cheering you on!</p></div>
      </aside>
    </main>
    <footer class="app-footer"><span id="save-status">Progress saved on this device</span><span>One sample activity per subject · A demo, not a full curriculum</span></footer>
    <div id="toast" class="toast" aria-hidden="true"></div>`;
  document.querySelector('#chapter-control').addEventListener('click', () => openChapterPicker(false));
  document.querySelector('#settings-control').addEventListener('click', openSettings);
  document.querySelector('#break-control').addEventListener('click', openBreak);
  village = mountVillage(document.querySelector('#village-mount'), { characters: CHARACTERS, completedSubjects: getCompleted(state), onVisit: visit, settings: state.settings });
  renderProgress();
  applySettings();
  persist();
}

function renderProgress() {
  const completed = getCompleted(state);
  const rewards = getRewards(state);
  document.querySelector('#chapter-label').textContent = scopeLabel();
  document.querySelector('#progress-text').textContent = `${completed.length} of 7 preparations`;
  document.querySelector('#progress-percent').textContent = `${Math.round(completed.length / 7 * 100)}%`;
  document.querySelector('#progress-fill').style.width = `${completed.length / 7 * 100}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', completed.length);
  document.querySelector('#stall-caption').textContent = completed.length === 7 ? 'Your stall is ready for the festival!' : completed.length ? 'Look at everything you’re making together.' : 'Your first creation is one little adventure away.';
  const shelf = document.querySelector('#reward-shelf');
  shelf.replaceChildren();
  for (const character of CHARACTERS) {
    const reward = rewards.find(item => item.subjectId === character.id);
    const slot = element('div', `reward-slot${reward ? ' is-earned' : ''}`);
    slot.title = reward ? reward.reward.label : `${character.subject}: an empty spot for your creation`;
    slot.setAttribute('aria-label', slot.title);
    slot.textContent = reward ? reward.reward.icon : '·';
    shelf.append(slot);
  }
  const list = document.querySelector('#neighbor-list');
  list.replaceChildren();
  for (const character of CHARACTERS) {
    const done = completed.includes(character.id);
    const button = element('button', `neighbor-button${done ? ' is-complete' : ''}`);
    button.type = 'button';
    button.dataset.subject = character.id;
    button.setAttribute('aria-label', `${character.name}, ${character.subject}${done ? ', complete; play again' : ', visit'}`);
    const portrait = element('span', 'neighbor-avatar');
    portrait.style.setProperty('--character-color', character.color);
    portrait.innerHTML = avatarMarkup(character.id, {size: 40});
    const text = element('span', 'neighbor-label');
    text.append(element('strong', '', character.name), element('span', '', character.subject));
    const status = element('span', 'neighbor-status', done ? '✓' : '↗');
    status.setAttribute('aria-hidden', 'true');
    button.append(portrait, text, status);
    button.addEventListener('click', () => visit(character.id));
    list.append(button);
  }
  village?.update({completedSubjects: completed, settings: state.settings});
}

function makeDialog(title, className = '') {
  if (shellDialog) { shellDialog.close(); shellDialog.remove(); }
  const origin = document.activeElement;
  const dialog = element('dialog', `shell-dialog ${className}`);
  const heading = element('h2', '', title);
  heading.id = 'shell-dialog-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  const close = element('button', 'dialog-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  function cleanup() {
    if (shellDialog === dialog) shellDialog = null;
    dialog.remove();
    if (origin?.isConnected) origin.focus?.();
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', cleanup, {once:true});
  dialog.append(close, heading);
  document.body.append(dialog);
  shellDialog = dialog;
  return dialog;
}

function openChapterPicker(firstVisit = false) {
  if (activeActivity) return;
  const dialog = makeDialog(firstVisit ? 'Your adventure starts here.' : 'Where shall we go next?', 'chapter-dialog');
  dialog.querySelector('h2').before(element('p', 'eyebrow', 'WELCOME TO ALL ABOARD'));
  dialog.append(element('p', 'dialog-intro', 'Choose a chapter. The same friendly village is waiting, with activities for your starting point.'));
  let selected = state.chapter;
  let grade = state.grade;
  const group = element('div', 'chapter-options');
  group.setAttribute('role','radiogroup');
  group.setAttribute('aria-label','Choose a chapter');
  const choices = [];
  for (const [chapter, label, description, icon] of [[0,'Kindergarten','Notice, count, match, and create.','🌱'],[1,'Elementary','Explore ideas from grades 1 to 5.','🌿']]) {
    const labelNode = element('label', 'chapter-choice');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'chapter'; input.value = chapter; input.checked = selected === chapter;
    const content = element('span', 'chapter-choice-content');
    content.append(element('span','chapter-icon',icon),element('small','','CHAPTER ' + chapter),element('strong','',label),element('span','',description));
    input.addEventListener('change', () => { selected = chapter; gradeRow.hidden = selected !== 1; });
    labelNode.append(input, content); group.append(labelNode); choices.push(input);
  }
  const gradeRow = element('label','grade-row');
  gradeRow.append(element('span','','Choose a grade'));
  const select = element('select');
  select.setAttribute('aria-label','Elementary grade');
  for (let i=1;i<=5;i++) { const option = new Option(`Grade ${i}`, String(i), false, i === grade); select.add(option); }
  select.addEventListener('change', () => { grade=Number(select.value); });
  gradeRow.append(select); gradeRow.hidden=selected!==1;
  const note = element('p','dialog-footnote','All seven subjects are available. You can change chapters later; each chapter and grade keeps its own progress.');
  const start = element('button','button button-primary button-wide',firstVisit ? 'Let’s explore the village' : 'Go to this chapter');
  start.addEventListener('click', () => {
    state.chapter=selected; state.grade=grade; state.hasStarted=true;
    persist(); renderProgress(); dialog.close();
    document.querySelector('#village-heading').scrollIntoView({behavior:'instant',block:'start'});
    document.querySelector('#village-section').focus({preventScroll:true});
    announce(`Welcome to ${scopeLabel()}. Choose any neighbor to begin.`);
  });
  dialog.append(group,gradeRow,note,start);
  dialog.showModal();
  choices[selected].focus();
}

function openSettings() {
  if (activeActivity) return;
  const dialog = makeDialog('Make yourself comfortable.');
  dialog.append(element('p','dialog-intro','A few small choices to make the village feel right for you.'));
  for (const [key,label,description] of [['largeText','Larger text','Give words a little more room.'],['reducedMotion','Calmer movement','Reduce movement and transitions.']]) {
    const row = element('label','setting-row');
    const text = element('span');
    text.append(element('strong','',label),element('small','',description));
    const check = document.createElement('input'); check.type='checkbox'; check.checked=state.settings[key];
    check.addEventListener('change',()=>{state.settings[key]=check.checked; applySettings(); persist();});
    row.append(text,check); dialog.append(row);
  }
  dialog.append(element('p','dialog-footnote','Sound is optional. Use “Read aloud” inside an activity whenever you want to hear it. No microphone is needed.'));
  const done=element('button','button button-primary button-wide','Back to the village');
  done.addEventListener('click',()=>dialog.close()); dialog.append(done); dialog.showModal();
}

function openBreak() {
  if (activeActivity) return;
  window.speechSynthesis?.cancel();
  const dialog=makeDialog('A little time for you.','break-dialog');
  const portrait=element('div','resting-nori'); portrait.innerHTML=avatarMarkup('nori',{size:96});
  dialog.querySelector('h2').before(portrait);
  dialog.append(element('p','dialog-intro','There’s no hurry. Stretch, look away, or take a quiet moment. Your creations will be right here.'));
  const resume=element('button','button button-primary button-wide','I’m ready to come back');
  resume.addEventListener('click',()=>dialog.close());dialog.append(resume);dialog.showModal();
}

function openCelebration() {
  const dialog=makeDialog('You helped the festival bloom.','celebration-dialog');
  dialog.querySelector('h2').before(element('div','celebration-flower','✿'));
  dialog.append(element('p','dialog-intro','Seven little adventures, seven creations. Your stall is ready, and the whole village has a piece of your imagination.'));
  const shelf=element('div','celebration-rewards');
  for(const record of getRewards(state)){const icon=element('span','',record.reward.icon);icon.title=record.reward.label;shelf.append(icon);}
  dialog.append(shelf);
  const resume=element('button','button button-primary button-wide','Keep exploring');
  resume.addEventListener('click',()=>dialog.close());dialog.append(resume);dialog.showModal();
}

renderShell();
if (!state.hasStarted) openChapterPicker(true);
window.addEventListener('pagehide',event=>{persist();closeActivity();if(!event.persisted)village?.destroy();});
