// Run a neighbor's example on separate work, then return the exact child work.
export function createDemoRunner({ activity, demo, chapter, grade, getWork, setWork, update, say,
  calm = () => false, onRunning = () => {}, onRestore = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let saved = null;
  let timer = null;
  let index = 0;
  let disposed = false;
  let running = false;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function restore(reason) {
    if (!running) return;
    cancelTimer();
    running = false;
    const work = saved;
    saved = null;
    // Always release the scene controls, even if a redraw fails.
    let error;
    for (const callback of [() => setWork(work), update, () => onRunning(false), () => onRestore(reason)]) {
      try { callback(); } catch (caught) { error ??= caught; }
    }
    if (error) throw error;
  }

  function schedule() {
    if (running && timer === null && !calm()) timer = setTimer(() => { timer = null; if (!calm()) next(); }, 1400);
  }

  function next() {
    if (!running) return;
    cancelTimer();
    try {
      if (index >= demo.steps.length) {
        if (demo.done) say(demo.done);
        restore('complete');
        return;
      }
      const step = demo.steps[index++];
      if (step.line) say(step.line);
      const { state, ui } = getWork();
      const result = activity.act(state, ui, structuredClone(step.action), grade);
      setWork({ state: result.state, ui: result.ui });
      update();
      schedule();
    } catch (error) {
      try { restore('error'); } catch { /* Preserve the original failure. */ }
      throw error;
    }
  }

  function start() {
    if (disposed || running || !demo) return false;
    const work = getWork();
    // start and act may mutate their inputs: never give them the child's work or the shared demo definition.
    const example = activity.start(structuredClone(demo.snapshot), { chapter, grade });
    saved = work;
    running = true;
    index = 0;
    try {
      setWork(example);
      onRunning(true);
      update();
      if (demo.intro) say(demo.intro);
      schedule();
      return true;
    } catch (error) {
      try { restore('error'); } catch { /* Preserve the original failure. */ }
      throw error;
    }
  }

  return {
    start, next, resume: schedule,
    stop: () => restore('stop'),
    dispose() { disposed = true; restore('dispose'); },
    get active() { return running; },
  };
}
