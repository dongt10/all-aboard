import { loadSave, saveState, normalizeState, STORAGE_KEY } from '../progress.js';
import { openSaveRecovery } from './save.js';
import { mountStage, applySettings } from './stage.js';
import { keyIntent, routeIntent } from './input.js';
import { createSceneManager, wipe } from './scenes.js';
import { speak, stopSpeaking } from './voice.js';
import { icon } from './icons.js';
import { closeWindow } from './window.js';
import { openComfortWindow, openPauseWindow, openGradeWindow, openGuideWindow, openHelpWindow } from './screens/windows.js';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Any scene name the app doesn't know yet lands on this friendly card.
function createMissingScene(ctx) {
  let root = null;
  return {
    mount() {
      root = document.createElement('div');
      root.className = 'scene missing-scene';
      root.innerHTML = `<div class="px-frame missing-scene__card"><p>This part of the festival is still being set up.</p>
        <button type="button" class="px-button">${icon('back')}<span>Back</span></button></div>`;
      const back = root.querySelector('button');
      back.addEventListener('click', () => ctx.go('title'));
      ctx.stage.append(root);
      back.focus();
    },
    destroy() { root?.remove(); root = null; },
  };
}

// AppContext = { stage, getState(), commit(next), go(name, params?), open, speak(text), announce(text), scenes, ... }
export function createApp(root, { scenes = {}, storage } = {}) {
  const { stage, destroy: unmountStage } = mountStage(root);
  const readSave = () => (storage === undefined ? globalThis.localStorage : storage)?.getItem(STORAGE_KEY) ?? null;
  const loaded = loadSave(storage);
  let lastSaved = loaded.currentRaw;
  let state = loaded.state;
  const protectedSave = loaded.status === 'unreadable';
  let recoveryShown = false;
  let saveOk = ['ready', 'empty'].includes(loaded.status);
  let destroyed = false;
  let lastParams;

  const banner = document.createElement('p');
  banner.className = 'px-frame save-off';
  banner.setAttribute('aria-hidden', 'true');
  const saveWarning = protectedSave ? 'Old save kept. New play is not saved.' : 'Saving is off. Keep this tab open.';
  banner.textContent = saveWarning;
  if (protectedSave) {
    banner.removeAttribute('aria-hidden');
    const recover = document.createElement('button');
    recover.type = 'button';
    recover.className = 'px-button';
    recover.textContent = 'Old save';
    recover.style.pointerEvents = 'auto';
    recover.addEventListener('click', () => openSaveRecovery(ctx, loaded));
    banner.append(' ', recover);
  }
  banner.hidden = saveOk;
  // Outside the stage, so an open window (which makes the stage behind it inert) can't silence it.
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  const saveStatus = document.createElement('div');
  saveStatus.className = 'sr-only';
  saveStatus.setAttribute('role', 'status');
  saveStatus.setAttribute('aria-atomic', 'true');
  saveStatus.textContent = saveOk ? '' : saveWarning;
  stage.append(banner);
  root.append(live, saveStatus);
  applySettings(stage, state.settings);

  const calm = () => Boolean(state.settings.reducedMotion);
  const curtain = wipe(stage, { calm });
  const manager = createSceneManager({
    create(name, params) {
      lastParams = params;
      return (Object.hasOwn(scenes, name) ? scenes[name] : createMissingScene)(ctx, params);
    },
    transition: swap => curtain(async () => {
      if (destroyed) return;
      stopSpeaking();
      await swap();
      // Focus never falls back to <body> after a scene change.
      if (!destroyed && !stage.contains(document.activeElement)) stage.querySelector(`.scene ${FOCUSABLE}, ${FOCUSABLE}`)?.focus();
    }),
  });

  const windowOpen = () => Boolean(stage.querySelector('.win-backdrop'));
  function lockTransitionKey(event) {
    if (manager.busy && stage.contains(event.target) && keyIntent(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  function onKey(event) {
    if (event.defaultPrevented) return;
    // A held A or B acts once: the browser would click a focused button on every repeat.
    if (event.repeat && ['a', 'b'].includes(keyIntent(event))) { event.preventDefault(); return; }
    const route = routeIntent(event);
    if (!route || route === 'native') return;
    if (route === 'click-target') { event.preventDefault(); event.target.click(); return; }
    if (stage.inert || windowOpen() || manager.busy) return;   // windows handle their own B and arrows
    if (manager.scene?.handleIntent?.(keyIntent(event))) event.preventDefault();
  }
  document.addEventListener('keydown', lockTransitionKey, true);
  document.addEventListener('keydown', onKey);
  const onVisibility = () => { if (document.hidden) { manager.pause(); stopSpeaking(); } };
  document.addEventListener('visibilitychange', onVisibility);

  const ctx = {
    stage,
    scenes: manager,
    getState: () => state,
    get saveOk() { return saveOk; },
    commit(next) {
      state = next;
      saveOk = false;
      // Keep local play, but never replace a save written or cleared by another tab.
      // A reload starts with the newer snapshot and establishes a new baseline.
      try {
        const legacyUnchanged = lastSaved !== null || !loaded.raw || loaded.key === STORAGE_KEY
          || (storage === undefined ? globalThis.localStorage : storage)?.getItem(loaded.key) === loaded.raw;
        if (!destroyed && !protectedSave && legacyUnchanged && readSave() === lastSaved && saveState(state, storage)) {
          lastSaved = JSON.stringify(normalizeState(state));
          saveOk = true;
        }
      } catch { /* keep the local work and show the save warning */ }
      banner.hidden = saveOk;
      saveStatus.textContent = saveOk ? '' : saveWarning;
      applySettings(stage, state.settings);
      return state;
    },
    go: async (name, params) => {
      const changed = await manager.go(name, params);
      if (!destroyed && protectedSave && !recoveryShown) recoveryShown = Boolean(openSaveRecovery(ctx, loaded));
      return changed;
    },
    // Rebuild the current scene, e.g. after the grade changes underneath it.
    // One-shot params (a celebration, a Find target) don't replay.
    reload: () => {
      const { celebrate, guide, ...keep } = lastParams ?? {};
      return manager.go(manager.current ?? 'title', lastParams && keep);
    },
    open: {
      comfort: () => openComfortWindow(ctx),
      pause: () => openPauseWindow(ctx),
      grade: () => openGradeWindow(ctx),
      guide: id => openGuideWindow(ctx, { id }),
      help: (title, steps) => openHelpWindow(ctx, title, steps),
    },
    speak: text => !destroyed && !document.hidden && speak(text),
    // Screen readers always hear it; Read to me says it aloud too.
    announce(text) {
      live.textContent = '';
      setTimeout(() => { live.textContent = text; }, 30);
      if (state.settings.autoRead) ctx.speak(text);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('keydown', lockTransitionKey, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      manager.destroy();
      closeWindow(stage);
      stopSpeaking();
      live.remove();
      saveStatus.remove();
      unmountStage();
    },
  };
  if (loaded.status === 'empty' && stage.classList.contains('phone')) {
    ctx.commit({ ...state, settings: { ...state.settings, largeText: true } });
  }
  return ctx;
}
