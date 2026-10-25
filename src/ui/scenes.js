// Scene = { mount(), destroy(), handleIntent?(intent), pause?() }. One scene lives at a time.
export function createSceneManager({ create, transition = swap => swap() }) {
  let scene = null, current = null, busy = false, disposed = false;
  async function go(name, params) {
    if (busy || disposed) return false;
    busy = true;
    try {
      await transition(async () => {
        if (disposed) return;
        const old = scene;
        scene = null; current = null;
        old?.destroy();   // the old scene is gone before the next one exists
        if (disposed) return;
        scene = create(name, params); current = name;
        await scene.mount();
      });
    } finally { busy = false; }
    return !disposed;
  }
  return {
    go,
    pause() { scene?.pause?.(); },
    destroy() {
      if (disposed) return;
      disposed = true;
      const old = scene;
      scene = null; current = null;
      old?.destroy();
    },
    get current() { return current; },
    get scene() { return scene; },
    get busy() { return busy; },
  };
}

// Wraps a handler so a double tap or a held key can't start it twice. Calls made while it is
// still running get the same pending promise back and do nothing.
export function onceAtATime(fn) {
  let pending = null;
  return (...args) => {
    if (pending) return pending;
    let result;
    try { result = fn(...args); } catch (error) { pending = null; throw error; }
    const settled = Promise.resolve(result).finally(() => { pending = null; });
    pending = settled;
    return settled;
  };
}

const BARS = 10, BAR_MS = 210, BAR_STAGGER = 10;   // 210ms + 9 × 10ms ≈ 300ms across the stage
const FADE_MS = 75;                                // out + in = 150ms

// The lantern wipe: festival-colored bars drop over the stage (about 300ms), the scene swaps behind
// them, and they fall away (about 300ms). Calm motion, or a device that asks for reduced motion,
// gets a 150ms fade instead. `calm` is a getter so a live toggle applies to the next change.
export function wipe(stage, { calm = () => false } = {}) {
  return async swap => {
    if (document.hidden || typeof stage.animate !== 'function') return swap();
    const gentle = Boolean(calm()) || Boolean(stage.closest('.calm')) || Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const curtain = document.createElement('div');
    curtain.className = gentle ? 'wipe wipe--fade' : 'wipe';
    if (!gentle) curtain.innerHTML = '<i class="wipe__bar"></i>'.repeat(BARS);
    const parts = gentle ? [curtain] : [...curtain.children];
    const frames = gentle ? [[{ opacity: 0 }, { opacity: 1 }], [{ opacity: 1 }, { opacity: 0 }]]
      : [[{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]];
    const timing = i => gentle ? { duration: FADE_MS } : { duration: BAR_MS, delay: i * BAR_STAGGER };
    const play = keyframes => Promise.allSettled(parts.map((part, i) => part.animate(keyframes, { fill: 'both', easing: 'linear', ...timing(i) }).finished));
    stage.append(curtain);
    try {
      await play(frames[0]);
      await swap();
      await play(frames[1]);
    } finally { curtain.remove(); }
  };
}
