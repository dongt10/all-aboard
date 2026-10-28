import { icon } from '../icons.js';
import { openWindow } from '../window.js';
import { stopSpeaking } from '../voice.js';
import { figureMarkup } from '../figures/index.js';
import { onceAtATime } from '../scenes.js';
import { chooseAvatar, chooseGrade, gradeChoices } from '../save.js';
import { comfortMarkup, bindComfort, gradeTilesMarkup, syncGradeTiles, setRoving, openCreditsWindow } from './windows.js';

export { gradeChoices, chooseGrade };

const TIP_KEY = 'all-aboard-fullscreen-tip-dismissed';
const TIP = 'For full screen: Share, then Add to Home Screen.';
let tipDismissed = false;

function shouldShowTip() {
  const nav = globalThis.navigator;
  const ua = nav?.userAgent ?? '';
  if (!/iPhone/i.test(ua) || !/Safari/i.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)) return false;
  if (nav.standalone || globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.matchMedia?.('(display-mode: fullscreen)').matches) return false;
  try { return !tipDismissed && globalThis.localStorage?.getItem(TIP_KEY) !== '1'; } catch { return !tipDismissed; }
}
function dismissTip() {
  tipDismissed = true;
  try { globalThis.localStorage?.setItem(TIP_KEY, '1'); } catch { /* Keep the dismissal for this tab. */ }
}

const AVATARS = [{ id: 'boy', label: 'Boy' }, { id: 'girl', label: 'Girl' }];
const PARADE = ['pip', 'math', 'science', 'art', 'reading', 'writing', 'community', 'music', 'nori'];
const paradeMarkup = pose => PARADE.map(id => `<span class="title__neighbor">${figureMarkup(id, { scale: 1.5, pose })}</span>`).join('');
const ARROWS = new Set(['up', 'down', 'left', 'right']);
const centerX = el => { const box = el.getBoundingClientRect(); return box.left + box.width / 2; };

export function createTitleScene(ctx) {
  let root = null, dialog = null, pending = false, lockedForEntry = false, generation = 0;
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const target = () => document.documentElement;
  const available = () => Boolean(!/iPhone/i.test(globalThis.navigator?.userAgent ?? '') && target() && (target().requestFullscreen || target().webkitRequestFullscreen) && (document.exitFullscreen || document.webkitExitFullscreen) && document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false);
  function syncFullscreen() {
    const button = root?.querySelector('.title-fullscreen');
    if (!button) return;
    const active = Boolean(fullscreenElement());
    if (!active) lockedForEntry = false;
    else if (!lockedForEntry) {
      lockedForEntry = true;
      try { Promise.resolve(globalThis.screen?.orientation?.lock?.('landscape')).catch(() => {}); } catch { /* Orientation lock is optional. */ }
    }
    button.querySelector('span').textContent = active ? 'Exit full screen' : 'Full screen';
    button.setAttribute('aria-pressed', String(active));
  }
  function showMessage(text, onClose) {
    const body = document.createElement('div');
    body.className = 'fullscreen-message';
    body.innerHTML = `<p></p><div class="fullscreen-message__actions"><button type="button" class="px-icon-button" data-action="hear">${icon('hear')}<span>Hear</span></button><button type="button" class="px-button px-button--finish" data-action="done"><span>Got it</span></button></div>`;
    body.querySelector('p').textContent = text;
    body.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'hear') ctx.speak?.(text);
      if (action === 'done') dialog?.close();
    });
    dialog = openWindow(ctx.stage, { title: 'Full screen', body, initialFocus: '[data-action="done"]', onClose: () => { dialog = null; stopSpeaking(); onClose?.(); } });
  }
  const failure = () => {
    pending = false;
    if (root && !ctx.stage.querySelector('.win-backdrop')) showMessage('Full screen could not be opened or closed. Please try again.');
  };
  function changed() { pending = false; syncFullscreen(); }
  async function toggleFullscreen() {
    if (pending) return;
    pending = true;
    const mine = generation;
    try {
      const element = fullscreenElement() ? document : target();
      const request = element === document ? document.exitFullscreen || document.webkitExitFullscreen : element.requestFullscreen || element.webkitRequestFullscreen;
      const result = request.call(element);
      // Older WebKit returns nothing and signals completion through an event.
      if (result && typeof result.then === 'function') {
        await result;
        if (mine === generation && root) { pending = false; syncFullscreen(); }
      }
    } catch {
      if (mine === generation) failure();
    }
  }
  const start = onceAtATime(async () => {
    await ctx.go('village');
  });

  function syncAvatars() {
    const chosen = ctx.getState().avatar === 'girl' ? 'girl' : 'boy';
    const buttons = [...root.querySelectorAll('.avatar-choice')];
    buttons.forEach(button => {
      const on = button.dataset.avatar === chosen;
      button.setAttribute('aria-pressed', String(on));
      button.querySelector('.avatar-choice__art').innerHTML = figureMarkup(`player-${button.dataset.avatar}`, { scale: 1.5, pose: on ? 'joy' : 'idle' });
    });
    setRoving(buttons, buttons.findIndex(button => button.dataset.avatar === chosen));
  }

  // Arrow rows, top to bottom: who you are, grade tiles, Start/Credits, comfort toggles.
  const rows = () => [
    [...root.querySelectorAll('.avatar-choice')],
    [...root.querySelectorAll('.grade-tile')],
    [...root.querySelectorAll('.title-fullscreen, .title-start, .title-credits')],
    [...root.querySelectorAll('.comfort-toggle')],
  ];
  function moveFocus(intent) {
    const all = rows(), active = document.activeElement;
    const r = all.findIndex(row => row.includes(active));
    if (r < 0) { root.querySelector('.title-start').focus(); return true; }
    let target = null;
    if (intent === 'left' || intent === 'right') target = all[r][all[r].indexOf(active) + (intent === 'left' ? -1 : 1)];
    else {
      const row = all[r + (intent === 'up' ? -1 : 1)];
      if (row) { const x = centerX(active); target = row.reduce((best, el) => Math.abs(centerX(el) - x) < Math.abs(centerX(best) - x) ? el : best); }
    }
    if (!target) return true;
    const group = all.find(row => row.includes(target));
    if (target.matches('.avatar-choice, .grade-tile')) setRoving(group, group.indexOf(target));   // commands and toggles stay separate Tab stops
    target.focus();
    return true;
  }

  return {
    mount() {
      const state = ctx.getState();
      root = document.createElement('div');
      root.className = 'scene title';
      root.innerHTML = `
        <div class="title__landscape" aria-hidden="true"></div>
        <div class="title__lanterns" aria-hidden="true">${'<i class="title__lantern"><b></b></i>'.repeat(4)}</div>
        <h1 class="title__logo">All Aboard</h1>
        <p class="title__welcome">an evening in Hanabi Bay</p>
        <div class="px-frame title__paper" aria-hidden="true"></div>
        <div class="title__who" role="group" aria-labelledby="title-who">
          <h2 class="px-name title__who-label" id="title-who">Who are you?</h2>
          ${AVATARS.map(a => `<button type="button" class="px-button avatar-choice" data-avatar="${a.id}" aria-pressed="false">
            <span class="avatar-choice__art"></span><span class="avatar-choice__label">${a.label}</span>
            <span class="avatar-choice__check" aria-hidden="true">${icon('check')}</span></button>`).join('')}
        </div>
        <p class="px-name title__grade-label" id="title-grade">Your grade</p>
        <div class="title__grades grade-tiles" role="group" aria-labelledby="title-grade">${gradeTilesMarkup()}</div>
        ${available() ? '<button type="button" class="px-button title-fullscreen" aria-pressed="false"><span>Full screen</span></button>' : ''}
        <button type="button" class="px-button px-button--finish title-start">${icon('play')}<span>${state.hasStarted ? 'Continue' : 'Start'}</span></button>
        <button type="button" class="px-button title-credits">Credits</button>
        <div class="title__parade" aria-hidden="true">${paradeMarkup('idle')}</div>
        <div class="title__comfort" role="group" aria-label="Comfort">${comfortMarkup()}</div>`;
      syncAvatars();
      syncGradeTiles(root, state);
      bindComfort(root.querySelector('.title__comfort'), ctx);
      root.addEventListener('click', event => {
        const avatar = event.target.closest('.avatar-choice');
        if (avatar) { ctx.commit(chooseAvatar(ctx.getState(), avatar.dataset.avatar)); syncAvatars(); return; }
        const tile = event.target.closest('.grade-tile');
        if (tile) {
          ctx.commit(chooseGrade(ctx.getState(), gradeChoices()[Number(tile.dataset.grade)]));
          syncGradeTiles(root, ctx.getState());
          root.querySelector('.title__parade').innerHTML = paradeMarkup('joy');
          root.querySelector('.title-start span').textContent = ctx.getState().hasStarted ? 'Continue' : 'Start';
        }
      });
      root.querySelector('.title-fullscreen')?.addEventListener('click', toggleFullscreen);
      document.addEventListener('fullscreenchange', changed);
      document.addEventListener('webkitfullscreenchange', changed);
      document.addEventListener('fullscreenerror', failure);
      document.addEventListener('webkitfullscreenerror', failure);
      syncFullscreen();
      root.querySelector('.title-start').addEventListener('click', () => start());
      root.querySelector('.title-credits').addEventListener('click', () => openCreditsWindow(ctx));
      ctx.stage.append(root);
      root.querySelector('.title-start').focus();
      if (shouldShowTip()) showMessage(TIP, dismissTip);
    },
    destroy() { generation++; pending = false; dialog?.close(); document.removeEventListener('fullscreenchange', changed); document.removeEventListener('webkitfullscreenchange', changed); document.removeEventListener('fullscreenerror', failure); document.removeEventListener('webkitfullscreenerror', failure); root?.remove(); root = null; },
    handleIntent(intent) { return ARROWS.has(intent) ? moveFocus(intent) : false; },
  };
}
