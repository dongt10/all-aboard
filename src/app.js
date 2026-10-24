import { CHARACTERS, SUBJECT_UI } from './data.js';
import { characterSVG } from './characters.js';
import { mountWorld, mountParade } from './world.js';
import { mountEncounter } from './encounters.js';
import { mountMusic, createPlaybackController, bandPlaybackMessage } from './music.js';
import { createBandEngine } from './audio.js';
import { loadState, saveState, saveDraft, publishCreation, getCompleted, getCreations, getDraft, canStartParade } from './progress.js';

let state = loadState();
let scene = 'world';
let active;
let world;
let modal;
let paradeAudio;
let paradePlayback;
let toastTimer;
const app = document.querySelector('#app');
const live = document.querySelector('#announcements');
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const chapterName = () => state.chapter === 0 ? 'Kindergarten' : `Grade ${state.grade}`;
const withScope = snapshot => ({ ...snapshot, chapter: state.chapter, grade: state.chapter === 0 ? 0 : state.grade });
function say(message) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = message; }); }
function persist() {
  const saved = saveState(state);
  app.dataset.saveError = String(!saved);
  const warning = document.querySelector('#save-error');
  const message = saved ? '' : 'Saving is unavailable. Keep this tab open.';
  // Update only when availability changes, so each edit does not repeat the warning.
  if (warning.textContent !== message) warning.textContent = message;
}
function notify(message) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); say(message);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}
function applySettings() {
  document.documentElement.classList.toggle('large-text', state.settings.largeText);
  document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion);
  world?.update({ creations: getCreations(state), completedSubjects: getCompleted(state), settings: state.settings });
}
function pauseSound() { active?.pause?.(); paradePlayback?.stop(); window.speechSynthesis?.cancel(); }
function updateHUD() {
  document.querySelector('#chapter-control').textContent = `${chapterName()} ▾`;
  app.dataset.scene = scene;
  document.querySelector('#chapter-control').hidden = scene !== 'world';
  document.querySelector('#map-control').hidden = scene !== 'world';
  document.querySelector('#parade-control').hidden = scene !== 'world' || !canStartParade(state);
  document.querySelector('#map-control').disabled = scene === 'parade';
  document.querySelector('#parade-control').disabled = !canStartParade(state);
  document.querySelector('#parade-control').title = canStartParade(state) ? 'Let the village enjoy what you made' : 'Make something with any neighbor to start a parade';
  document.querySelector('#scene-name').textContent = scene === 'world' ? 'WILLOW BAY · FESTIVAL EVE' : scene === 'parade' ? 'YOUR LITTLE PARADE' : `${CHARACTERS.find(item => item.id === scene)?.name || 'Kiko'}’S CORNER`;
}
function saveCurrentDraft() {
  if (CHARACTERS.some(item => item.id === scene) && active?.getSnapshot) {
    state = saveDraft(state, scene, withScope(active.getSnapshot()));
    persist();
  }
}
function disposeScene() {
  clearTimeout(toastTimer);
  const toast = document.querySelector('#toast');
  toast.classList.remove('show'); toast.textContent = '';
  pauseSound(); active?.destroy(); active = null;
  paradeAudio?.destroy(); paradeAudio = null; paradePlayback = null;
  document.querySelector('#scene-host').replaceChildren();
}
function showWorld(focusId) {
  saveCurrentDraft(); disposeScene(); scene = 'world';
  document.querySelector('#scene-host').hidden = true;
  document.querySelector('#world-host').hidden = false;
  applySettings(); updateHUD();
  if (focusId) {
    const node = document.querySelector(`#world-host [data-subject="${focusId}"], #world-host [data-visit="${focusId}"]`);
    (node || document.querySelector('#world-host [tabindex="0"]') || document.querySelector('#map-control')).focus({ preventScroll: true });
  }
}
function visit(id) {
  if (modal?.open) return;
  const character = CHARACTERS.find(item => item.id === id);
  if (!character) return;
  saveCurrentDraft(); disposeScene(); scene = id;
  document.querySelector('#world-host').hidden = true;
  const host = document.querySelector('#scene-host'); host.hidden = false;
  state.hasStarted = true; persist(); updateHUD();
  const context = {
    character, chapter: state.chapter, grade: state.chapter === 0 ? 0 : state.grade, snapshot: getDraft(state, id), settings: { ...state.settings },
    onSave(snapshot) { state = saveDraft(state, id, withScope(snapshot)); persist(); },
    onComplete(snapshot) {
      state = publishCreation(state, id, withScope(snapshot));
      // Completion is published before scene cleanup, so town art reflects this exact creation.
      persist(); showWorld(id); notify(`${character.name}: “That’s going straight into the festival!”`);
    },
    onClose() { showWorld(id); },
  };
  active = id === 'music' ? mountMusic(host, context) : mountEncounter(host, context);
  host.scrollTop = 0;
  const heading = host.querySelector('h1');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
function openParade() {
  if (!canStartParade(state) || modal?.open) return;
  const origin = document.activeElement;
  saveCurrentDraft(); disposeScene(); scene = 'parade';
  document.querySelector('#world-host').hidden = true;
  const host = document.querySelector('#scene-host'); host.hidden = false;
  const creations = getCreations(state);
  active = mountParade(host, { creations, settings: { ...state.settings }, onClose: () => { showWorld('music'); if (origin?.isConnected && !origin.closest('[hidden]') && !origin.disabled) origin.focus({ preventScroll: true }); } });
  if (creations.music) {
    const controls = document.createElement('div'); controls.className = 'parade-sound-controls';
    const play = document.createElement('button'); play.className = 'pixel-button'; play.textContent = '♫ Play our band';
    const stop = document.createElement('button'); stop.className = 'pixel-button quiet'; stop.textContent = 'Stop music'; stop.disabled = true;
    const status = document.createElement('span'); status.setAttribute('role', 'status');
    let playback;
    paradeAudio = createBandEngine({ onStatus: message => { if (message === 'stopped') playback?.engineStopped(); } });
    playback = createPlaybackController(paradeAudio, { onState: (phase, reason) => {
      play.disabled = phase !== 'stopped';
      stop.disabled = phase === 'stopped';
      const playingMessage = bandPlaybackMessage(creations.music)
        .replace('Invite a friend or add a note.', 'Visit Kiko to invite a friend or add a note.')
        .replace('Raise a friend’s volume to listen.', 'Visit Kiko to raise a friend’s volume.')
        .replace('Raise band volume to listen.', 'Visit Kiko to raise the band volume.')
        .replace(' Try a new sound!', '');
      status.textContent = reason === 'unavailable' ? 'Sound could not start. The parade is still yours.' : phase === 'starting' ? 'Starting your band…' : phase === 'playing' ? playingMessage : 'Music stopped';
    } });
    paradePlayback = playback;
    play.addEventListener('click', () => { if (!playback.active) playback.toggle(creations.music); });
    stop.addEventListener('click', () => playback.stop());
    controls.append(play, stop, status);
    host.querySelector('.world-parade-close').before(controls);
  }
  updateHUD();
  const heading = host.querySelector('h2');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  say('Your parade is ready. Every contribution has a place.');
}
function dialog(title, { className = '', onClose } = {}) {
  if (modal?.open) return null;
  pauseSound();
  const origin = document.activeElement;
  const node = document.createElement('dialog'); node.className = `pocket-dialog ${className}`;
  node.innerHTML = `<div class="pocket-heading"><h2 id="pocket-title">${escape(title)}</h2><button class="close-button" aria-label="Close">×</button></div>`;
  node.setAttribute('aria-labelledby', 'pocket-title');
  node.querySelector('button').addEventListener('click', () => node.close());
  node.addEventListener('close', () => { node.remove(); if (modal === node) modal = null; onClose?.(); if (origin?.isConnected) origin.focus(); }, { once: true });
  document.body.append(node); modal = node;
  return node;
}
function openMap() {
  const node = dialog('Choose a subject'); if (!node) return;
  const intro = document.createElement('p'); intro.className = 'dialog-copy'; intro.textContent = 'Choose any neighbor.';
  const grid = document.createElement('div'); grid.className = 'pocket-map';
  const made = getCompleted(state);
  for (const character of CHARACTERS) {
    const button = document.createElement('button'); button.className = `map-neighbor map-${character.id}`;
    button.style.setProperty('--subject-color', SUBJECT_UI[character.id].color);
    button.innerHTML = `${characterSVG(character.id, { size: 48 })}<span><strong><span aria-hidden="true">${SUBJECT_UI[character.id].icon}</span> ${character.subject}</strong><span>with ${character.name}</span></span>${made.includes(character.id) ? '<span class="map-made" aria-label="Completed">✓</span>' : ''}`;
    button.addEventListener('click', () => { node.addEventListener('close', () => visit(character.id), { once: true }); node.close(); });
    grid.append(button);
  }
  node.append(intro, grid); node.showModal();
}
function openChapter(first = false) {
  if (scene !== 'world') return;
  const node = dialog(first ? 'Welcome to Willow Bay' : 'Choose your grade', { className: 'chapter-dialog' }); if (!node) return;
  node.insertAdjacentHTML('beforeend', `<div class="welcome-friends" aria-hidden="true">${characterSVG('pip', { size: 72, pose: 'joy' })}${characterSVG('player', { size: 88 })}${characterSVG('nori', { size: 72, pose: 'joy' })}</div><p class="dialog-copy">Choose your grade, then visit any neighbor.</p><fieldset class="chapter-choices"><legend>Your grade</legend><label><input type="radio" name="chapter" value="0" ${state.chapter === 0 ? 'checked' : ''}><span><strong>Kindergarten</strong></span></label><label><input type="radio" name="chapter" value="1" ${state.chapter === 1 ? 'checked' : ''}><span><strong>Elementary</strong><span>Grades 1–5</span></span></label></fieldset><label class="grade-choice">Starting grade <select aria-label="Elementary grade">${[1, 2, 3, 4, 5].map(grade => `<option value="${grade}" ${state.grade === grade ? 'selected' : ''}>Grade ${grade}</option>`).join('')}</select></label><button class="pixel-button primary start-adventure">${first ? 'Start playing' : 'Back to village'}</button>`);
  const gradeRow = node.querySelector('.grade-choice');
  const selectChapter = () => Number(node.querySelector('input[name="chapter"]:checked').value);
  gradeRow.hidden = selectChapter() === 0;
  node.querySelectorAll('input[name="chapter"]').forEach(input => input.addEventListener('change', () => { gradeRow.hidden = selectChapter() === 0; }));
  node.querySelector('.start-adventure').addEventListener('click', () => {
    state.chapter = selectChapter(); state.grade = Number(node.querySelector('select').value); state.hasStarted = true;
    persist(); applySettings(); updateHUD(); node.close(); say(`${chapterName()}. All neighbors are ready to play.`);
  });
  node.showModal();
}
function openSettings() {
  let changed = false;
  const node = dialog('Settings', { onClose: () => { if (changed && scene !== 'world' && scene !== 'parade') visit(scene); } }); if (!node) return;

  for (const [key, title, copy] of [['largeText', 'Bigger words', 'More room for reading.'], ['reducedMotion', 'Gentle movement', 'Still scenery and simpler transitions.']]) {
    const row = document.createElement('label'); row.className = 'comfort-row';
    row.innerHTML = `<span><strong>${title}</strong><small>${copy}</small></span><input type="checkbox" ${state.settings[key] ? 'checked' : ''}>`;
    row.querySelector('input').addEventListener('change', event => { state.settings[key] = event.target.checked; changed = true; applySettings(); persist(); }); node.append(row);
  }
  node.insertAdjacentHTML('beforeend', '<p class="pocket-note">Music starts when you press Play. You can stop it anytime, let individual musicians rest, or play with the visible beats in quiet.</p><button class="pixel-button primary done">Done</button>');
  node.querySelector('.done').addEventListener('click', () => node.close()); node.showModal();
}
function openBreak() {
  const node = dialog('Paused', { className: 'break-dialog', onClose: () => applySettings() }); if (!node) return;
  world?.update({ settings: { ...state.settings, reducedMotion: true } });
  node.insertAdjacentHTML('beforeend', `<div class="resting-friend" aria-hidden="true">${characterSVG('nori', { size: 116 })}</div><p class="dialog-copy">Take your time. Your work stays here.</p><button class="pixel-button primary resume">Keep playing</button>`);
  node.querySelector('.resume').addEventListener('click', () => node.close()); node.showModal();
}

app.innerHTML = `<header class="game-hud"><a class="game-logo" href="#game-stage" aria-label="All Aboard village"><img src="./assets/favicon.svg" width="36" height="36" alt=""><span>All Aboard</span></a><span class="scene-caption" id="scene-name"></span><nav class="hud-actions" aria-label="Game controls"><button id="chapter-control" class="hud-button"></button><button id="map-control" class="hud-button"><span>Subjects</span></button><button id="settings-control" class="hud-button" aria-label="Settings">Settings</button><button id="break-control" class="hud-button" aria-label="Pause">Pause</button></nav></header><main class="game-stage" id="game-stage"><div id="world-host"></div><div id="scene-host" hidden></div></main><footer class="game-footer"><span id="save-status">Saved on this device</span><span id="save-error" role="status" aria-live="polite" aria-atomic="true"></span><button id="parade-control" class="parade-shortcut">♫ Parade</button></footer><div class="game-toast" id="toast" aria-hidden="true"></div>`;
world = mountWorld(document.querySelector('#world-host'), { characters: CHARACTERS, creations: getCreations(state), completedSubjects: getCompleted(state), settings: state.settings, onVisit: visit, onParade: openParade });
document.querySelector('#map-control').addEventListener('click', openMap);
document.querySelector('#chapter-control').addEventListener('click', () => openChapter());
document.querySelector('#settings-control').addEventListener('click', openSettings);
document.querySelector('#break-control').addEventListener('click', openBreak);
document.querySelector('#parade-control').addEventListener('click', openParade);
document.querySelector('.game-logo').addEventListener('click', event => { event.preventDefault(); showWorld(); });
applySettings(); updateHUD(); persist();
if (!state.hasStarted) openChapter(true);
window.addEventListener('pagehide', () => { saveCurrentDraft(); persist(); pauseSound(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveCurrentDraft(); pauseSound(); } });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented && !modal?.open && scene !== 'world' && event.target?.tagName !== 'SELECT') {
    event.preventDefault(); showWorld(scene === 'parade' ? 'music' : scene);
  }
});
