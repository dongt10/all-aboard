import { loadState, saveState } from '../progress.js';
import { mountStage, applySettings } from './stage.js';
import { keyIntent, routeIntent } from './input.js';
import { createSceneManager, wipe } from './scenes.js';
import { speak, stopSpeaking } from './voice.js';
import { icon } from './icons.js';
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
  let state = loadState(storage);
  let saveOk = true;
  let lastParams;

  const banner = document.createElement('p');
  banner.className = 'px-frame save-off';
  banner.setAttribute('role', 'status');
  banner.textContent = 'Saving is off. Keep this tab open.';
  banner.hidden = true;
  // Outside the stage, so an open window (which makes the stage behind it inert) can't silence it.
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  stage.append(banner);
  root.append(live);
  applySettings(stage, state.settings);

  const calm = () => Boolean(state.settings.reducedMotion);
  const curtain = wipe(stage, { calm });
  const manager = createSceneManager({
    create(name, params) {
      lastParams = params;
      return (Object.hasOwn(scenes, name) ? scenes[name] : createMissingScene)(ctx, params);
    },
    transition: swap => curtain(async () => {
      stopSpeaking();
      await swap();
      // Focus never falls back to <body> after a scene change.
      if (!stage.contains(document.activeElement)) stage.querySelector(`.scene ${FOCUSABLE}, ${FOCUSABLE}`)?.focus();
    }),
  });

  const windowOpen = () => Boolean(stage.querySelector('.win-backdrop'));
  function onKey(event) {
    if (event.defaultPrevented) return;
    // A held A or B acts once: the browser would click a focused button on every repeat.
    if (event.repeat && ['a', 'b'].includes(keyIntent(event))) { event.preventDefault(); return; }
    const route = routeIntent(event);
    if (!route || route === 'native') return;
    if (route === 'click-target') { event.preventDefault(); event.target.click(); return; }
    if (windowOpen() || manager.busy) return;   // windows handle their own B and arrows
    if (manager.scene?.handleIntent?.(keyIntent(event))) event.preventDefault();
  }
  document.addEventListener('keydown', onKey);
  const onVisibility = () => { if (document.hidden) { stopSpeaking(); manager.pause(); } };
  document.addEventListener('visibilitychange', onVisibility);

  const ctx = {
    stage,
    scenes: manager,
    getState: () => state,
    get saveOk() { return saveOk; },
    commit(next) {
      state = next;
      saveOk = saveState(state, storage);
      banner.hidden = saveOk;
      applySettings(stage, state.settings);
      return state;
    },
    go: (name, params) => manager.go(name, params),
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
    speak: text => speak(text),
    // Screen readers always hear it; Read to me says it aloud too.
    announce(text) {
      live.textContent = '';
      setTimeout(() => { live.textContent = text; }, 30);
      if (state.settings.autoRead) speak(text);
    },
    destroy() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      stopSpeaking();
      manager.scene?.destroy();
      live.remove();
      unmountStage();
    },
  };
  return ctx;
}
