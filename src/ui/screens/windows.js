import { openWindow } from '../window.js';
import { icon } from '../icons.js';
import { keyIntent, gridMove } from '../input.js';
import { figureMarkup } from '../figures/index.js';
import { SUBJECT_THEME } from '../palette.js';
import { toggleSetting, chooseGrade, gradeChoices, isChosenGrade } from '../save.js';
import { guideEntries, stampCount, stampHeading, guideNarration } from '../guide.js';
import { creationMarkup } from '../creations.js';
import { getCreations } from '../../progress.js';
import { renderBandPreview, encodeWav } from '../../audio.js';
import { stopSpeaking } from '../voice.js';

export const RECORDING_LINES = {
  idle: 'Save your band to listen to later.',
  making: 'Making a recording…',
  ready: 'Recording ready. Check your downloads.',
  failed: 'This browser could not make a recording.',
};
const RECORDING_FILE = 'my-festival-band.wav';
const RECORDING_URL_TTL = 30000;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const ARROWS = new Set(['up', 'down', 'left', 'right']);

// Roving focus: one item in the group is tabbable, the arrows move between them.
export function setRoving(items, index) {
  items.forEach((item, i) => { item.tabIndex = i === index ? 0 : -1; });
}
export function rove(container, getItems, columns, onMove) {
  container.addEventListener('keydown', event => {
    const intent = keyIntent(event);
    if (!ARROWS.has(intent)) return;
    const items = getItems(), from = items.indexOf(document.activeElement);
    if (from < 0) return;
    event.preventDefault();
    const to = gridMove(from, intent, columns, items.length);
    if (to === from) return;
    setRoving(items, to);
    items[to].focus();
    onMove?.(to);
  });
}

// Opens a window with a size class, after pausing the scene and its speech. Never mid-transition.
function open(ctx, kind, options) {
  if (ctx.scenes?.busy) return null;
  stopSpeaking();
  ctx.scenes?.pause?.();
  const handle = openWindow(ctx.stage, options);
  if (handle) ctx.stage.querySelector('.win-backdrop .win')?.classList.add(`win--${kind}`);
  return handle;
}

// Comfort toggles, shared by the title screen and the Comfort window.
export const COMFORT = [
  { key: 'largeText', label: 'Bigger words' },
  { key: 'reducedMotion', label: 'Calm motion' },
  { key: 'autoRead', label: 'Read to me' },
];
export const comfortMarkup = () => COMFORT.map(({ key, label }) =>
  `<button type="button" class="px-toggle comfort-toggle" data-setting="${key}" aria-pressed="false"><span>${label}</span><span class="px-toggle__state" aria-hidden="true">Off</span></button>`).join('');

export function syncComfort(root, settings) {
  for (const button of root.querySelectorAll('[data-setting]')) {
    const on = Boolean(settings[button.dataset.setting]);
    button.setAttribute('aria-pressed', String(on));
    button.querySelector('.px-toggle__state').textContent = on ? 'On' : 'Off';
  }
}

export function bindComfort(root, ctx) {
  syncComfort(root, ctx.getState().settings);
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-setting]');
    if (!button || !root.contains(button)) return;
    const { key, label } = COMFORT.find(item => item.key === button.dataset.setting);
    ctx.commit(toggleSetting(ctx.getState(), key));
    syncComfort(root, ctx.getState().settings);
    ctx.announce(`${label} is ${ctx.getState().settings[key] ? 'on' : 'off'}.`);
  });
}

// Grade tiles, shared by the title screen and the Grade window.
export const gradeTilesMarkup = () => gradeChoices().map((choice, i) =>
  `<button type="button" class="px-button grade-tile" data-grade="${i}" aria-label="${choice.name}" aria-pressed="false">
    <span class="grade-tile__num">${choice.label}</span><span class="grade-tile__word">${choice.chapter === 0 ? 'Kinder&shy;garten' : 'Grade'}</span>
    <span class="grade-tile__check" aria-hidden="true">${icon('check')}</span></button>`).join('');

export function syncGradeTiles(root, state) {
  const tiles = [...root.querySelectorAll('.grade-tile')];
  const choices = gradeChoices();
  tiles.forEach((tile, i) => tile.setAttribute('aria-pressed', String(isChosenGrade(state, choices[i]))));
  setRoving(tiles, Math.max(0, tiles.findIndex(tile => tile.getAttribute('aria-pressed') === 'true')));
  return tiles;
}

export function openComfortWindow(ctx) {
  const body = document.createElement('div');
  body.className = 'comfort-window';
  body.innerHTML = comfortMarkup();
  bindComfort(body, ctx);
  return open(ctx, 'comfort', { title: 'Comfort', body });
}

export function openCreditsWindow(ctx) {
  return open(ctx, 'credits', {
    title: 'Credits',
    body: `<div class="credits-window">
      <p>The team who brought Willow Bay to life.</p>
      <dl class="credits-window__artists">
        <div><dt>Backend</dt>
          <dd>Dong · <a href="https://github.com/dongt10" target="_blank" rel="noopener noreferrer">@dongt10 on GitHub</a></dd>
          <dd>Isaac · <a href="https://github.com/TerminatorLV" target="_blank" rel="noopener noreferrer">@TerminatorLV on GitHub</a></dd>
        </div>
        <div><dt>Frontend</dt>
          <dd>Alison · Character art · <a href="https://www.instagram.com/almixao/" target="_blank" rel="noopener noreferrer">@almixao on Instagram</a></dd>
          <dd>Reem Amro · Background art · <a href="https://github.com/reemamro08" target="_blank" rel="noopener noreferrer">@reemamro08 on GitHub</a></dd>
        </div>
      </dl>
      <p class="credits-window__note">Profile links open in a new tab.</p>
    </div>`,
    initialFocus: () => ctx.stage.querySelector('.win__close'),
  });
}

export function openPauseWindow(ctx) {
  const body = document.createElement('div');
  body.className = 'pause-window';
  const note = ctx.saveOk === false ? 'Take your time. Keep this tab open.' : 'Take your time. Your work is saved.';
  body.innerHTML = `<span class="pause-window__nori">${figureMarkup('nori', { scale: 2 })}</span><p>${note}</p>
    <div class="pause-window__actions">
      <button type="button" class="px-button px-button--finish" data-action="resume">${icon('play')}<span>Keep playing</span></button>
      <button type="button" class="px-button" data-action="title">${icon('home')}<span>Title screen</span></button>
    </div>`;
  let handle = null;
  body.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    handle?.close();
    if (action === 'title') ctx.go('title');   // Boy/Girl and the grade live there
  });
  handle = open(ctx, 'pause', { title: 'Paused', body, initialFocus: '[data-action="resume"]' });
  return handle;
}

export function openGradeWindow(ctx) {
  const body = document.createElement('div');
  body.className = 'grade-window';
  body.innerHTML = `<div class="grade-tiles">${gradeTilesMarkup()}</div>`;
  const tiles = syncGradeTiles(body, ctx.getState());
  rove(body, () => tiles, 6);
  let handle = null;
  body.addEventListener('click', event => {
    const tile = event.target.closest('.grade-tile');
    if (!tile) return;
    const before = ctx.getState(), choice = gradeChoices()[Number(tile.dataset.grade)];
    const changed = !isChosenGrade(before, choice);
    ctx.commit(chooseGrade(before, choice));
    syncGradeTiles(body, ctx.getState());
    handle?.close();
    if (changed) ctx.reload?.();
  });
  handle = open(ctx, 'grade', { title: 'Your grade', body, initialFocus: () => tiles.find(tile => tile.tabIndex === 0) });
  return handle;
}

// The thing the child made with this neighbor, when the save still has it.
export const guideCreation = (id, state) => { const made = getCreations(state)[id]; return made ? creationMarkup(id, made) : ''; };

function guidePage(entry, state) {
  const theme = entry.subject ? SUBJECT_THEME[entry.subject] : null;
  const earned = Boolean(entry.stamp?.earned);
  const made = earned ? guideCreation(entry.id, state) : '';
  const stamp = !entry.stamp ? '' : earned
    ? `<div class="guide-stamp guide-stamp--earned"><span class="guide-stamp__seal" aria-hidden="true">${icon(theme.icon)}</span><p><strong>${stampHeading(entry.stamp)}:</strong> ${esc(entry.stamp.learned)}</p></div>`
    : `<div class="guide-stamp"><span class="guide-stamp__seal" aria-hidden="true"></span><p><strong>${stampHeading(entry.stamp)}:</strong> ${esc(entry.stamp.learned)}</p></div>`;
  const buttons = [
    `<button type="button" class="px-button" data-action="hear">${icon('hear')}<span>Hear</span></button>`,
    entry.canFind ? `<button type="button" class="px-button" data-action="find">${icon('map')}<span>Find</span></button>` : '',
    entry.canVisit ? `<button type="button" class="px-button px-button--finish" data-action="visit">${icon('next')}<span>Visit</span></button>` : '',
  ].join('');
  // Kiko's page, once a band is made: a grown-up's download of the band, kept out of the kid's music window.
  const record = entry.id === 'music' && getCreations(state).music
    ? `<div class="guide-record"><button type="button" class="px-button" data-action="record">${icon('download')}<span>Save song</span></button>
        <p class="guide-record__status" role="status">${RECORDING_LINES.idle}</p></div>`
    : '';
  return `<div class="guide-page__who">
      <span class="guide-page__figure">${figureMarkup(entry.id, { scale: 2, pose: earned ? 'joy' : 'idle' })}</span>
      <div><h3 class="px-name">${esc(entry.name)}</h3><p class="guide-page__meta">${esc(entry.species)} · ${esc(entry.role)}</p></div>
      ${made ? `<div class="guide-creation" data-id="${entry.id}">${made}</div>` : ''}
    </div>
    <p class="guide-page__bio">${esc(entry.bio)}</p>${stamp}${record}
    ${buttons ? `<div class="guide-page__actions">${buttons}</div>` : ''}`;
}

// Renders about ten seconds of the band (two runs of form A, one run of AB or ABA) to a WAV file and hands it to the browser's downloads. The object URL
// is revoked after 30 seconds or when the window closes, whichever comes first.
function createRecorder(getBand, { host, status, isOpen }) {
  let token = 0, busy = false;
  const urls = new Map();
  const say = text => { const el = status(); if (el) el.textContent = text; };
  const forget = url => { clearTimeout(urls.get(url)); urls.delete(url); URL.revokeObjectURL(url); };
  return {
    get busy() { return busy; },
    async record() {
      if (busy || !isOpen()) return;
      busy = true;
      const mine = ++token;
      say(RECORDING_LINES.making);
      try {
        const band = getBand();
        const buffer = await renderBandPreview(band, { phrases: (band?.form ?? 'A').length > 1 ? 1 : 2 });   // AB and ABA already run 16-24 beats
        if (!isOpen() || mine !== token) return;
        const url = URL.createObjectURL(new Blob([encodeWav(buffer)], { type: 'audio/wav' }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = RECORDING_FILE; anchor.hidden = true;
        host.append(anchor); anchor.click(); anchor.remove();
        urls.set(url, setTimeout(() => forget(url), RECORDING_URL_TTL));
        say(RECORDING_LINES.ready);
      } catch {
        if (isOpen() && mine === token) say(RECORDING_LINES.failed);
      } finally {
        if (mine === token) busy = false;
      }
    },
    dispose() { token++; busy = false; for (const url of [...urls.keys()]) forget(url); },
  };
}

// The Matsuri Guide: ten character tiles on the left, the chosen character's page on the right.
export function openGuideWindow(ctx, { id } = {}) {
  const state = ctx.getState();
  const entries = guideEntries(state), { earned, total } = stampCount(state);
  let index = Math.max(0, entries.findIndex(entry => entry.id === id));
  const body = document.createElement('div');
  body.className = 'guide';
  body.innerHTML = `<div class="guide__tiles">${entries.map((entry, i) => `<button type="button" class="px-button guide-tile" data-index="${i}" aria-pressed="false"${entry.subject ? ` style="--subject:var(--${entry.subject})"` : ''}>
      ${figureMarkup(entry.id)}<span class="guide-tile__name">${esc(entry.name)}</span>${entry.stamp?.earned ? `<span class="guide-tile__stamp">${icon('check')}<span class="sr-only">, stamp earned</span></span>` : ''}</button>`).join('')}</div>
    <section class="guide-page" aria-live="polite"></section>`;
  const tiles = [...body.querySelectorAll('.guide-tile')];
  const page = body.querySelector('.guide-page');
  const narrate = () => ctx.speak(guideNarration(entries[index], {
    hasSong: entries[index].id === 'music' && Boolean(getCreations(state).music),
  }));
  function show(i) {
    stopSpeaking();
    index = i;
    tiles.forEach((tile, k) => tile.setAttribute('aria-pressed', String(k === i)));
    setRoving(tiles, i);
    page.innerHTML = guidePage(entries[i], state);
    if (handle && ctx.getState().settings.autoRead) narrate();
  }
  let handle = null, closed = false;
  const recorder = createRecorder(() => getCreations(ctx.getState()).music, {
    host: body, status: () => page.querySelector('.guide-record__status'), isOpen: () => !closed && body.isConnected,
  });
  rove(body.querySelector('.guide__tiles'), () => tiles, 2, show);
  body.addEventListener('click', event => {
    const tile = event.target.closest('.guide-tile');
    if (tile) { show(Number(tile.dataset.index)); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'hear') { narrate(); return; }
    if (action === 'record') { recorder.record(); return; }
    const target = entries[index].id;
    handle?.close();
    if (action === 'find') ctx.go('village', { guide: target });
    else ctx.go(target === 'music' ? 'music' : 'encounter', { id: target });
  });
  show(index);
  handle = open(ctx, 'guide', { title: 'Matsuri Guide', body, initialFocus: () => tiles[index], onClose: () => { closed = true; stopSpeaking(); recorder.dispose(); } });
  if (handle && ctx.getState().settings.autoRead) narrate();
  const head = handle && body.closest('.win')?.querySelector('.win__head');
  if (head) {   // the subtitle and the stamp count sit in the header, beside the title
    const title = head.querySelector('.win__title');
    const heading = document.createElement('div');
    heading.className = 'guide__heading';
    title.replaceWith(heading);
    heading.append(title);   // the title keeps its id, so the dialog's label still points at it
    const subtitle = document.createElement('p');
    subtitle.className = 'guide__subtitle';
    subtitle.textContent = 'the town’s character book';
    heading.append(subtitle);
    const count = document.createElement('p');
    count.className = 'px-chip guide__count';
    count.innerHTML = `${icon('star')}<span>${earned} of ${total} stamps</span>`;
    heading.after(count);
  }
  return handle;
}

// Help: numbered steps, each with its own Hear button.
export function openHelpWindow(ctx, title, steps = []) {
  const body = document.createElement('ol');
  body.className = 'help-steps';
  body.innerHTML = steps.map((step, i) => `<li><span class="help-steps__num">${i + 1}</span><p>${esc(step)}</p>
    <button type="button" class="px-icon-button" data-step="${i}" aria-label="Hear step ${i + 1}">${icon('hear')}<span>Hear</span></button></li>`).join('');
  body.addEventListener('click', event => {
    const button = event.target.closest('[data-step]');
    if (button) ctx.speak(steps[Number(button.dataset.step)]);
  });
  return open(ctx, 'help', { title: title || 'Help', body, onClose: stopSpeaking });
}
