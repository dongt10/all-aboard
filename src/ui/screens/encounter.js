import { CHARACTERS } from '../../data.js';
import { encounterReady } from '../../encounters.js';
import { getDraft, saveDraft, publishCreation, getCompleted } from '../../progress.js';
import { ACTIVITIES, activityFor } from '../registry.js';
import { withScope } from '../save.js';
import { creationMarkup } from '../creations.js';
import { figureMarkup, playerFigureId } from '../figures/index.js';
import { icon } from '../icons.js';
import { SUBJECT_THEME } from '../palette.js';
import { createCommandMenu, arrangeCommands } from '../menu.js';
import { createDialogue } from '../dialogue.js';
import { keyIntent } from '../input.js';
import { onceAtATime } from '../scenes.js';
import { showItemGet } from './item-get.js';
import { openHelpWindow } from './windows.js';
import { helpSteps, stepIndex, stepPicture } from '../help-steps.js';
import { demoFor } from '../demos.js';
import { createDemoRunner } from '../demo.js';
import { stopSpeaking } from '../voice.js';

// Stand a figure with its feet at stage point (fx, fy): the feet sit at x 32, y 57 of the 64×64 frame.
const feetAt = (fx, fy, scale) => `left:${fx - 32 * scale}px;top:${fy - 57 * scale}px`;
const NEIGHBOR = { x: 848, y: 240, scale: 2 };
const PLAYER = { x: 120, y: 420, scale: 3 };   // high enough that the speaker chip never sits on the hair
const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const NOT_READY_LINE = 'Not ready yet. Open Help for the steps.';

// What to say when an action returned no line but the creation's readiness flipped, so the last line
// never goes stale: an activity's own notReadyLine (optional), or a plain fallback; and "Ready!" naming
// the finish command when it just became ready.
export function readinessLine(activity, commands, wasReady, isReady) {
  if (wasReady && !isReady) return typeof activity.notReadyLine === 'string' ? activity.notReadyLine : NOT_READY_LINE;
  if (!wasReady && isReady) {
    const finish = commands.find(command => command?.finish);
    return finish ? `Ready! Choose ${finish.label}.` : 'Ready!';
  }
  return null;
}

// The Pokémon-battle frame: plate, neighbor on its platform, the player's back, the field, dialogue and menu.
export function createEncounterScene(ctx, { id } = {}, { getDemo = demoFor } = {}) {
  const character = CHARACTERS.find(item => item.id === id);
  let activity = ACTIVITIES[id];
  if (!character || !activity) throw new RangeError(`No encounter for ${id}`);
  const theme = SUBJECT_THEME[id];
  let root, field, menu, dialogue, state, ui, grade, finishing = false, dirty = false;
  let destroyed = false, reward = null;
  let demo, runner, demoFocus, leaving = false, pausing = false;

  const scoped = () => withScope(state, ctx.getState());
  const saveNow = () => ctx.commit(saveDraft(ctx.getState(), id, scoped()));
  const say = line => { dialogue.say(character.name, line); if (dialogue.hasMore()) dialogue.focusMore(); };
  const inField = () => root.querySelector('.enc__field').contains(document.activeElement);
  // If every command is disabled, keep focus on an editable field control.
  const focusMenu = () => { menu.focus(); return root.querySelector('.enc__menu').contains(document.activeElement); };
  const focusField = () => {
    const area = root.querySelector('.enc__field');
    const control = area.querySelector('textarea:not(:disabled)') ?? area.querySelector('[tabindex="0"]') ?? area.querySelector(FOCUSABLE);
    control?.focus();
    return area.contains(document.activeElement);
  };
  const focusAction = () => {
    if (runner?.active) { root.querySelector('.enc__demo-next').focus(); return; }
    if (id === 'writing' && !state.text.trim()) focusField();
    else if (!focusMenu()) focusField();
  };

  const commands = () => {
    const list = activity.commands(state, ui, grade);
    // Rotate story pictures between parts without changing their order after a wrong try.
    if (activity.kind === 'reading' && list.length && list.every(command => command.id.startsWith('pick-'))) {
      const offset = (state.found.length + 1) % list.length;
      return arrangeCommands([...list.slice(offset), ...list.slice(0, offset)]);
    }
    return arrangeCommands(list);
  };   // the finish always ends up in slot 4
  const steps = () => helpSteps(activity, grade);

  function updateSchedule(next) {
    const list = steps(), index = stepIndex(activity, state, ui, grade);
    const ready = encounterReady(state), watching = runner?.active;
    const finish = next.find(command => command?.finish);
    const strip = root.querySelector('.enc__schedule');
    strip.dataset.step = String(index);
    strip.setAttribute('aria-label', watching ? `${character.name}'s example` : 'Your steps');
    strip.classList.toggle('is-ready', ready);
    root.querySelector('.enc__now-label').textContent = watching ? `Watch ${character.name}` : ready ? 'Ready!' : 'Now';
    for (const [cell, at] of [['now', index], ['next', Math.min(index + 1, list.length - 1)]]) {
      const picture = stepPicture(activity, state, at, grade);
      root.querySelector(`.enc__${cell}-picture`).innerHTML = picture ? icon(picture) : String(at + 1);
      root.querySelector(cell === 'now' ? '.enc__now' : '.enc__upcoming').setAttribute('aria-label', `${cell === 'now' ? 'Now' : 'Next'}: ${list[at] ?? 'Open Help.'}`);
    }
    root.querySelector('.enc__finish-label').textContent = finish?.label ?? (activity.kind === 'reading' ? 'Share story' : 'Finish');
    root.querySelector('.enc__step-text').textContent = list[index] ?? 'Open Help for the steps.';
  }

  // A second request from the same neighbor. The activity's optional another(state, ui, grade) returns a fresh
  // request's { state, ui, line } (or null). It is offered once this subject is finished in this grade and the
  // current work is ready, so a tap never throws away something half-done.
  const canTryAnother = () => typeof activity.another === 'function' && encounterReady(state) && getCompleted(ctx.getState()).includes(id);

  function updateMenu(next) {
    const choosing = activity.kind === 'reading' && next.some(command => command?.id.startsWith('pick-'));
    menu.set(next, { requireSelection: choosing });
    updateSchedule(next);
    root.querySelector('.enc__choose').hidden = !choosing || Boolean(runner?.active);
    root.querySelector('.enc__another').hidden = Boolean(runner?.active) || !canTryAnother();
  }

  function tryAnother() {
    if (finishing || destroyed || runner?.active || !canTryAnother()) return;
    if (dialogue.hasMore()) { dialogue.focusMore(); return; }
    const result = activity.another(state, ui, grade);
    if (!result) return;
    state = result.state;
    ui = result.ui;
    dirty = true;
    saveNow();
    field.update(state, ui);
    updateMenu(commands());
    say(result.line || activity.opening(state, ui, grade));
    if (!dialogue.hasMore()) focusAction();
  }

  function dispatch(action) {
    if (finishing || destroyed || runner?.active) return;
    if (dialogue.hasMore()) { field.update(state, ui); dialogue.focusMore(); return; }
    const returnToField = id === 'writing' && action?.type === 'command' && ['remove', 'clear'].includes(action.id)
      && root.querySelector('.enc__menu').contains(document.activeElement);
    const wasReady = encounterReady(state);
    const result = activity.act(state, ui, action, grade);
    const changed = result.state !== state;
    state = result.state;
    ui = result.ui;
    if (changed) { dirty = true; saveNow(); }
    field.update(state, ui);
    const next = commands();
    updateMenu(next);
    if (returnToField && !state.text.trim()) focusField();
    const line = result.line || readinessLine(activity, next, wasReady, encounterReady(state));
    if (line) say(line);
  }

  const finish = onceAtATime(async () => {
    if (destroyed || finishing || runner?.active || !encounterReady(state)) return;
    finishing = true;
    saveNow();
    const app = ctx.getState();
    const scope = { chapter: app.chapter, grade: app.grade, subjectId: id };
    const creation = withScope(state, scope);
    reward = showItemGet(ctx.stage, {
      name: activity.rewardLabel ?? character.reward.label,
      allowEdit: true,
      speak: ctx.speak,
      autoRead: Boolean(app.settings?.autoRead),
      artHTML: creationMarkup(scope.subjectId, creation),
      figureHTML: figureMarkup(id, { pose: 'joy', scale: 2 }),
    });
    const accepted = await reward;
    reward = null;
    const current = ctx.getState();
    if (!accepted) { if (!destroyed) { finishing = false; focusAction(); } return; }
    if (destroyed || current.chapter !== scope.chapter || current.grade !== scope.grade) return;
    ctx.commit(publishCreation(current, scope.subjectId, creation));
    await ctx.go('village', { focus: scope.subjectId, celebrate: scope.subjectId });
  });
  const leave = onceAtATime(async () => {
    if (finishing) return;
    leaving = true;
    runner?.stop();
    if (dirty) saveNow();   // an untouched stall must not look "Started" in the village
    await ctx.go('village', { focus: id });
  });

  function advanceDemo() {
    if (dialogue.hasMore()) dialogue.next();
    else runner?.next();
  }

  function startDemo() {
    if (!demo || destroyed || finishing || runner?.active) return;
    demoFocus = document.activeElement;
    stopSpeaking();
    runner.start();
  }

  return {
    mount() {
      const app = ctx.getState();
      grade = app.chapter === 0 ? 0 : app.grade;
      activity = activityFor(id, grade);
      demo = getDemo(activity, grade);
      ({ state, ui } = activity.start(getDraft(app, id), { chapter: app.chapter, grade }));

      root = document.createElement('div');
      root.className = `enc enc--${id}`;
      root.style.setProperty('--subject', theme.color);
      root.innerHTML = `<div class="enc__backdrop" aria-hidden="true"><i class="enc__platform enc__platform--neighbor"></i><i class="enc__platform enc__platform--player"></i></div>
        <div class="enc__neighbor" style="${feetAt(NEIGHBOR.x, NEIGHBOR.y, NEIGHBOR.scale)}" aria-hidden="true">${figureMarkup(id, { scale: NEIGHBOR.scale })}</div>
        <div class="enc__player" style="${feetAt(PLAYER.x, PLAYER.y, PLAYER.scale)}" aria-hidden="true">${figureMarkup(playerFigureId(app), { facing: 'back', scale: PLAYER.scale })}</div>
        <header class="px-frame enc__plate">
          <button type="button" class="px-icon-button enc__back">${icon('back')}<span>Village</span></button>
          <div class="enc__who"><h1 class="px-name enc__name"></h1><span class="enc__grade"></span></div>
          <span class="px-chip enc__subject">${icon(theme.icon, { size: 18 })}<span></span></span>
        </header>
        <aside class="enc__guidance">
          <button type="button" class="px-chip enc__nav" aria-label="Up from choices goes to the field. Down at the field edge goes to choices.">↑Field ↓Menu</button>
          <div class="enc__schedule" role="group" aria-label="Your steps">
            <div class="enc__now"><strong class="enc__now-label">Now</strong><span class="enc__now-picture" aria-hidden="true"></span></div>
            <div class="enc__upcoming"><strong>Next</strong><span class="enc__next-picture" aria-hidden="true"></span></div>
            <div class="enc__finish"><strong>Finish</strong><span aria-hidden="true">${icon('check')}</span><span class="enc__finish-label"></span></div>
          </div>
          <button type="button" class="enc__step" aria-label="Hear this step">${icon('hear', { size: 18 })}<span class="enc__step-text"></span></button>
          <p class="enc__choose" hidden>Arrows pick. Enter chooses.</p>
          <div class="enc__demo-controls" hidden><button type="button" class="px-chip enc__demo-next">${icon('next', { size: 18 })}<span>Next</span></button><button type="button" class="px-chip enc__demo-stop">${icon('stop', { size: 18 })}<span>Stop</span></button></div>
          <button type="button" class="px-chip enc__another" hidden>${icon('undo', { size: 18 })}<span>Try another</span></button>
        </aside>
        <section class="enc__field" aria-label=""></section>
        <div class="enc__dialogue"></div>
        <div class="enc__menu"></div>`;
      root.querySelector('.enc__name').textContent = character.name;
      root.querySelector('.enc__subject span').textContent = theme.label;
      root.querySelector('.enc__grade').textContent = grade === 0 ? 'Kindergarten' : `Grade ${grade}`;
      root.querySelector('.enc__field').setAttribute('aria-label', activity.title);
      root.querySelector('.enc__back').addEventListener('click', () => leave());
      ctx.stage.append(root);
      root.querySelector('.enc__nav').addEventListener('click', () => ctx.speak('Up from choices goes to the field. Down at the field edge goes to choices.'));
      root.querySelector('.enc__step').addEventListener('click', () => ctx.speak(root.querySelector('.enc__step-text').textContent));
      root.querySelector('.enc__another').addEventListener('click', tryAnother);
      root.querySelector('.enc__demo-next').addEventListener('click', advanceDemo);
      root.querySelector('.enc__demo-stop').addEventListener('click', () => runner?.stop());
      // Capture before native Enter/Space, Z routing, or field handlers can replace unread pages.
      const isWork = target => root.querySelector('.enc__field').contains(target) || root.querySelector('.enc__menu').contains(target);
      root.addEventListener('click', event => {
        if (runner?.active && isWork(event.target)) { event.preventDefault(); event.stopPropagation(); return; }
        if (!dialogue?.hasMore() || !isWork(event.target)) return;
        event.preventDefault(); event.stopPropagation(); dialogue.focusMore();
      }, true);
      root.addEventListener('beforeinput', event => {
        if (runner?.active && isWork(event.target)) { event.preventDefault(); event.stopPropagation(); return; }
        if (!dialogue?.hasMore() || !isWork(event.target)) return;
        event.preventDefault(); event.stopPropagation(); dialogue.focusMore();
      }, true);
      root.addEventListener('keydown', event => {
        if (runner?.active) {
          const intent = keyIntent(event);
          // Keep native activation of Hear, Stop and Village; A elsewhere advances the example.
          const native = event.target.closest('.enc__demo-stop, .enc__back, [data-act="hear"], .enc__step, .enc__nav');
          if (intent === 'b' || (intent === 'a' && !native)) {
            event.preventDefault(); event.stopPropagation();
            if (!event.repeat) { if (intent === 'b') runner.stop(); else advanceDemo(); }
          }
          return;
        }
        if (!dialogue?.hasMore() || !isWork(event.target) || !keyIntent(event) || keyIntent(event) === 'b') return;
        event.preventDefault(); event.stopPropagation();
        if (keyIntent(event) === 'a' && !event.repeat) dialogue.next();
        else dialogue.focusMore();
      }, true);

      field = activity.mountField(root.querySelector('.enc__field'), { grade, dispatch });
      dialogue = createDialogue(root.querySelector('.enc__dialogue'), {
        speak: text => ctx.speak(text),
        onHelp: () => {
          if (runner?.active) return;
          openHelpWindow(ctx, activity.title, steps(), {
            pictures: steps().map((_, index) => stepPicture(activity, state, index, grade)),
            onShowMe: demo ? startDemo : undefined,
          });
        },
        isLarge: () => ctx.stage.classList.contains('large-text'),
        autoRead: () => !pausing && Boolean(ctx.getState().settings?.autoRead),
        onComplete: () => { focusAction(); runner?.resume(); },
        extendedControls: true,
      });
      menu = createCommandMenu(root.querySelector('.enc__menu'), {
        onChoose: commandId => (commands().find(command => command?.id === commandId)?.finish ? finish() : dispatch({ type: 'command', id: commandId })),
        onExitUp: focusField,
      });
      runner = createDemoRunner({
        activity, demo, chapter: app.chapter, grade,
        getWork: () => ({ state, ui }),
        setWork: work => { ({ state, ui } = work); },
        update: () => { field.update(state, ui); updateMenu(commands()); },
        say,
        calm: () => Boolean(ctx.getState().settings?.reducedMotion)
          || Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || dialogue.hasMore(),
        onRunning: active => {
          root.querySelector('.enc__field').inert = active;
          root.querySelector('.enc__menu').inert = active;
          root.querySelector('.enc__demo-controls').hidden = !active;
          for (const action of ['help', 'replay', 'skip']) root.querySelector(`[data-act="${action}"]`).disabled = active;
          if (active) root.querySelector('.enc__demo-next').focus();
        },
        onRestore: reason => {
          if (destroyed || leaving) { stopSpeaking(); return; }
          if (reason !== 'complete') { stopSpeaking(); say('Your turn. ' + (steps()[stepIndex(activity, state, ui, grade)] ?? '')); }
          if (demoFocus?.isConnected && !demoFocus.disabled) demoFocus.focus();
          else focusAction();
        },
      });
      field.update(state, ui);
      updateMenu(commands());
      say(activity.opening(state, ui, grade));
      if (!dialogue.hasMore()) focusAction();
    },
    handleIntent(intent) {
      if (finishing) return false;   // the item-get card handles its own A
      if (runner?.active) {
        if (intent === 'b') runner.stop();
        else if (intent === 'a') advanceDemo();
        return true;
      }
      if (intent === 'b') {
        if (inField() && TYPING.has(document.activeElement.tagName)) {
          if ((id === 'writing' && !state.text.trim()) || !focusMenu()) root.querySelector('.enc__back').focus();   // a second B leaves
          return true;
        }
        leave();
        return true;
      }
      if (intent === 'a') {
        if (dialogue.hasMore()) { dialogue.next(); return true; }
        if (!inField()) { menu.focus(); return true; }
        return false;
      }
      if (inField()) return intent === 'down' && focusMenu();   // grids that use the arrows already took them
      return menu.handleIntent(intent);
    },
    pause() {
      pausing = true;
      try { runner?.stop(); } finally { pausing = false; }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      runner?.dispose();
      reward?.cancel();
      reward = null;
      field?.destroy();
      dialogue?.destroy();
      menu?.destroy();
      root?.remove();
      root = null;
    },
  };
}
