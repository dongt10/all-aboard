import { icon } from '../icons.js';
import { figureMarkup } from '../figures/index.js';
import { onceAtATime } from '../scenes.js';
import { chooseAvatar, chooseGrade, gradeChoices } from '../save.js';
import { comfortMarkup, bindComfort, gradeTilesMarkup, syncGradeTiles, setRoving } from './windows.js';

export { gradeChoices, chooseGrade };

const AVATARS = [{ id: 'boy', label: 'Boy' }, { id: 'girl', label: 'Girl' }];
const ARROWS = new Set(['up', 'down', 'left', 'right']);
const centerX = el => { const box = el.getBoundingClientRect(); return box.left + box.width / 2; };

export function createTitleScene(ctx) {
  let root = null;
  const start = onceAtATime(async () => {
    if (!ctx.getState().hasStarted) ctx.commit({ ...ctx.getState(), hasStarted: true });
    await ctx.go('village');
  });

  function syncAvatars() {
    const chosen = ctx.getState().avatar === 'girl' ? 'girl' : 'boy';
    const buttons = [...root.querySelectorAll('.avatar-choice')];
    buttons.forEach(button => {
      const on = button.dataset.avatar === chosen;
      button.setAttribute('aria-pressed', String(on));
      button.querySelector('.avatar-choice__art').innerHTML = figureMarkup(`player-${button.dataset.avatar}`, { scale: 2, pose: on ? 'joy' : 'idle' });
    });
    setRoving(buttons, buttons.findIndex(button => button.dataset.avatar === chosen));
  }

  // Arrow rows, top to bottom: who you are, grade tiles, Start, comfort toggles.
  const rows = () => [
    [...root.querySelectorAll('.avatar-choice')],
    [...root.querySelectorAll('.grade-tile')],
    [root.querySelector('.title-start')],
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
    if (group.length > 1 && !target.classList.contains('comfort-toggle')) setRoving(group, group.indexOf(target));   // toggles stay separate Tab stops
    target.focus();
    return true;
  }

  return {
    mount() {
      const state = ctx.getState();
      root = document.createElement('div');
      root.className = 'scene title';
      root.innerHTML = `
        <div class="title__bunting" aria-hidden="true">${'<i></i>'.repeat(20)}</div>
        <div class="title__ground" aria-hidden="true"></div>
        <h1 class="title__logo">All Aboard</h1>
        <span class="title__pip" aria-hidden="true">${figureMarkup('pip', { scale: 2 })}</span>
        <span class="title__nori" aria-hidden="true">${figureMarkup('nori', { scale: 2 })}</span>
        <div class="title__who" role="group" aria-labelledby="title-who">
          <h2 class="px-name title__who-label" id="title-who">Who are you?</h2>
          ${AVATARS.map(a => `<button type="button" class="px-button avatar-choice" data-avatar="${a.id}" aria-pressed="false">
            <span class="avatar-choice__art"></span><span class="avatar-choice__label">${a.label}</span>
            <span class="avatar-choice__check" aria-hidden="true">${icon('check')}</span></button>`).join('')}
        </div>
        <p class="px-chip title__grade-label" id="title-grade">Your grade</p>
        <div class="title__grades grade-tiles" role="group" aria-labelledby="title-grade">${gradeTilesMarkup()}</div>
        <button type="button" class="px-button px-button--finish title-start">${icon('play')}<span>${state.hasStarted ? 'Continue' : 'Start'}</span></button>
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
          root.querySelector('.title-start span').textContent = ctx.getState().hasStarted ? 'Continue' : 'Start';
        }
      });
      root.querySelector('.title-start').addEventListener('click', () => start());
      ctx.stage.append(root);
      root.querySelector('.title-start').focus();
    },
    destroy() { root?.remove(); root = null; },
    handleIntent(intent) { return ARROWS.has(intent) ? moveFocus(intent) : false; },
  };
}
