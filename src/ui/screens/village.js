// Hanabi Bay, the bright overworld: stalls, wandering neighbors, the player, the HUD and the festival board.
import { CHARACTERS } from '../../data.js';
import { reactionLine, signReader } from '../../reactions.js';
import { getCreations, getCompleted, getDraft, canStartParade } from '../../progress.js';
import { SUBJECT_THEME } from '../palette.js';
import { icon } from '../icons.js';
import { figureMarkup, playerFigureId } from '../figures/index.js';
import { createDialogue } from '../dialogue.js';
import { openWindow } from '../window.js';
import { stopSpeaking } from '../voice.js';
import { onceAtATime } from '../scenes.js';
import { creationMarkup, creationLabel, fitSignPreviews } from '../creations.js';
import {
  SIDE_SPOTS, PLAYER_START, STEP, homeSpot, hotspotRect, nearestNeighbor,
  setRoad, road, loadRoad, clampWalk, roadPath, talkGoal, stepPlayer, stallState, stallBadge, boardLabel, wanderTarget, stepToward, guideArrow, stallSVG, easelRect,
} from '../village-map.js';
import { BACKGROUND, STALLS, EASELS, STAGE, NEAR_LAMPS, LAMP_HEAD_OFFSETS, LAMP_GLOW } from '../village-layout.js';
import { createScriptedWalk, stepScriptedWalk } from '../scripted-walk.js';
import { keyIntent } from '../input.js';

const SIDE = {
  pip: { name: 'Pip', speed: 48, stride: 150 },
  nori: { name: 'Nori', speed: 12, stride: 500, line: 'You can go anywhere first. I’m going slowly. That’s my favorite speed.' },
};
// Pip greets every visit until the first creation is made in this grade. Each sentence fits one Bigger-words page.
export const WELCOME_LINE = 'Welcome to Hanabi Bay! Tap a neighbor to help them make something.';
export const HELP_STEPS = [
  'Tap a neighbor to walk over and talk.',
  'Tap the path, or use arrow keys to walk.',
  'Press Enter near a neighbor to talk.',
  'Make one thing and the Parade opens.',
  'Make all seven for the big finale.',
  'Open the Guide to find a neighbor or see your stamps.',
  'An exclamation mark means something new to make.',
  'Three dots mean you can keep working.',
  'A check mark means you made something.',
];
// Positions belong to this game stage and grade, not a browser-wide singleton or the saved work.
const villagePositions = new WeakMap();
const TAP_PICTURE = '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><path d="M25 51V25a5 5 0 0 1 10 0v13l4-5 6 5 5-1 5 6-5 17H32l-15-16a5 5 0 0 1 7-7l6 6" fill="var(--paper)" stroke="currentColor" stroke-width="3"/><path d="M17 20l-5-5m18-2V5m13 15 6-5" stroke="currentColor" stroke-width="3"/></svg>';
const helpPicture = page => [
  TAP_PICTURE + figureMarkup('pip'),
  TAP_PICTURE + '<span>↑<br>← ↓ →</span>',
  '<span class="px-chip">Enter</span>' + figureMarkup('pip'),
  icon('star', { size: 56 }), icon('star', { size: 56 }), icon('map', { size: 56 }),
  '<span class="village-help__mark">!</span>', '<span class="village-help__mark">...</span>', icon('check', { size: 56 }),
][page];
const A_KEYS = new Set(['Enter', ' ', 'z', 'Z']);
const WALK_HINT = 'Walk up to a neighbor, then press Enter.';

const preferredBox = (feet, words) => words === WELCOME_LINE || (feet?.x > 440 && feet?.y > 330) ? 'top' : 'bottom';
// Include the tabs and More chip, which extend 18px above and below each frame.
const DIALOGUE_BOXES = {
  top: { x: 12, y: 72, w: 232, h: 172 },
  bottom: { x: 716, y: 72, w: 232, h: 172 },
};
// Hints avoid the whole player sprite; ties preserve the familiar placement.
export function dialogueBox(feet, words) {
  const preferred = preferredBox(feet, words);
  if (!feet) return preferred;
  const player = { x: feet.x - 32, y: feet.y - 57, w: 64, h: 64 };
  const overlap = box => Math.max(0, Math.min(player.x + player.w, box.x + box.w) - Math.max(player.x, box.x))
    * Math.max(0, Math.min(player.y + player.h, box.y + box.h) - Math.max(player.y, box.y));
  const top = overlap(DIALOGUE_BOXES.top), bottom = overlap(DIALOGUE_BOXES.bottom);
  return top === bottom ? preferred : top < bottom ? 'top' : 'bottom';
}

// A belongs to the village when its root, an actor button or the Talk chip has focus, even with nobody near.
// `near` never gates key ownership; actor focus walks to that actor, while the root and Talk use aAction.
// `button` means an actor or Talk button only. HUD, Parade and dialogue controls keep their own keys.
export function talkKeyWins(near, { button = false, onRoot = false, inVillage = false, inDialogue = false } = {}) {
  return (button || onRoot) && inVillage && !inDialogue;
}

// A celebration may be voiced by another neighbor; otherwise Pip welcomes an empty grade.
// Opening dialogue never moves focus from the player controls.
export function openingLine({ creations = {}, celebrate = null, grade = 0 } = {}) {
  const reaction = reactionLine(celebrate, creations?.[celebrate], grade);
  if (reaction) return reaction;
  if (!Object.keys(creations ?? {}).length) return { id: 'pip', words: WELCOME_LINE };
  return null;
}

// What A does: turn an unread page first, else talk only to the neighbor the Talk chip names, else give a hint.
// A hidden chip has no talk target, even if a neighbor is within range during a walk.
export function aAction({ near = null, dialogueOpen = false, hasMore = false } = {}) {
  if (dialogueOpen && hasMore) return { act: 'next' };
  return near ? { act: 'talk', id: near } : { act: 'hint' };
}
const STEP_CYCLE = [1, 0, 2, 0];
const STEP_MS = 80;             // ms per walk frame at the base speed; faster walks step faster
const WANDER_STEP_MS = 300;     // a stroll: the neighbors amble
const WANDER_SPEED = 24;        // px per second
const PLAYER_SPEED = 240;       // px per second for key steps; tap walks speed up to finish within 600ms
const TAP_WALK_MS = 600;
export function frameFor(clock, speed = PLAYER_SPEED) {
  if (speed <= 0) return 0;
  const period = Math.min(120, STEP_MS * PLAYER_SPEED / speed);
  return STEP_CYCLE[Math.floor(clock / period) % STEP_CYCLE.length];
}
const STOP_RADIUS = 96;
const ARROW_GLYPH = { up: '↑', 'up-right': '↗', right: '→', 'down-right': '↘', down: '↓', 'down-left': '↙', left: '←', 'up-left': '↖' };
const FACING_FOR = { up: 'back', down: 'front', left: 'left', right: 'right' };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const px = n => `${n}px`;
const madeLabel = label => /^your /i.test(label) ? `Made ${label.charAt(0).toLowerCase()}${label.slice(1)}.` : `Made a ${label.toLowerCase()}.`;
const gradeLabel = state => state.chapter === 1 ? `Grade ${state.grade}` : 'Kindergarten';
const now = () => globalThis.performance?.now?.() ?? Date.now();
const nextFrame = fn => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16));
const cancelFrame = id => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id));

export const LANTERN_LINES = {
  offer: 'All seven made! Shall I light the lanterns?',
  lighting: 'One by one. Slow and steady.',
  done: 'Lantern night in Hanabi Bay. You made it all.',
};

// A neighbor's button: the subject badge with its status mark, the figure, and the name chip. Pure, so tests can
// check that a started stall shows "..." and says "Started. Tap to continue."
export function neighborMarkup(c, made = {}) {
  const theme = SUBJECT_THEME[c.id];
  const status = stallState(c.id, made.creations, made.completed, made.drafts);
  const badge = stallBadge(status);
  const mark = status === 'made' ? `<span class="village-badge__mark village-badge__mark--made">${icon('check', { size: 16 })}</span>`
    : `<span class="village-badge__mark village-badge__mark--${status}">${esc(badge.mark)}</span>`;
  const said = status === 'made' ? madeLabel(creationLabel(c.id, made.creations?.[c.id])) : badge.said;
  return `<button type="button" class="village-actor village-npc village-npc--${status}" data-id="${c.id}" aria-label="${esc(`${c.name}, ${theme.label}. ${said}`)}">
        <span class="village-badge" style="--subject:${theme.color}" aria-hidden="true">${icon(theme.icon)}${mark}</span>
        <span class="village-actor__fig" aria-hidden="true"></span>
        <span class="px-chip px-name village-name" aria-hidden="true">${esc(c.name)} · ${esc(theme.label)}</span>
      </button>`;
}

// Measure border boxes in logical stage pixels (offset sizes ignore the stage's scale).
// Movement only uses cached sizes; font/size changes invalidate them as a batch.
export function createVillageChipLayout(actors, talk, isLarge, fonts = globalThis.document?.fonts) {
  const names = new Map([...actors].map(a => [a, a.el.querySelector('.village-name')]));
  const sizes = new Map();
  let previous = '', dirty = true, disposed = false;
  const invalidate = () => { dirty = true; sizes.clear(); };
  const observer = globalThis.ResizeObserver ? new ResizeObserver(invalidate) : null;
  for (const el of [...names.values(), talk]) observer?.observe(el);
  fonts?.addEventListener?.('loadingdone', invalidate);
  fonts?.ready?.then(() => { if (!disposed) invalidate(); });
  let large;
  return {
    update(near) {
      const nextLarge = isLarge();
      if (large !== nextLarge) { large = nextLarge; invalidate(); }
      const key = JSON.stringify([near, ...[...names.keys()].map(a => [a.pos.x, a.pos.y])]);
      if (!dirty && key === previous) return;
      previous = key; dirty = false;
      const entries = [...names].map(([a, name]) => ({ a, el: a.id === near ? talk : name }));
      // Keep Talk at its familiar anchor and move the neighboring names around it.
      entries.sort((a, b) => Number(b.el === talk) - Number(a.el === talk));
      const measured = entries.map(entry => {
        const { el } = entry, text = el.textContent;
        let size = sizes.get(el);
        if (!size || size.text !== text) {
          size = { text, w: el.offsetWidth, h: el.offsetHeight };
          sizes.set(el, size);
        }
        return { ...entry, ...size };
      });
      const placed = [], gap = 8, edge = 8;
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      for (const { a, el, w, h } of measured) {
        if (!(w > 0 && h > 0)) continue; // Detached/hidden stage: ResizeObserver retries when visible.
        const x = clamp(a.pos.x - w / 2, edge, STAGE.width - edge - w);
        const base = clamp(a.pos.y + (SIDE[a.id] ? 2 : 4), edge, STAGE.height - edge - h);
        // The gap also covers subpixel rounding in offsetWidth/Height.
        const hits = placed.filter(b => x < b.x + b.w + gap && x + w + gap > b.x);
        const candidates = [base, ...hits.flatMap(b => [b.y + b.h + gap, b.y - h - gap])]
          .filter(y => y >= edge && y + h <= STAGE.height - edge)
          .sort((a, b) => Math.abs(a - base) - Math.abs(b - base) || b - a);
        const y = candidates.find(y => hits.every(b => y >= b.y + b.h + gap || y + h + gap <= b.y));
        if (y === undefined) continue;
        placed.push({ x, y, w, h });
        const parent = el === talk ? { x: 0, y: 0 } : hotspotRect(a.id, a.pos);
        const left = px(x + w / 2 - parent.x), top = px(y - parent.y);
        if (el.style.left !== left) el.style.left = left;
        if (el.style.top !== top) el.style.top = top;
      }
    },
    destroy() {
      disposed = true;
      observer?.disconnect();
      fonts?.removeEventListener?.('loadingdone', invalidate);
    },
  };
}

export function createVillageScene(ctx, { focus, celebrate, guide } = {}) {
  let root = null, dialogue = null, previews = null, frame = 0, last = 0, paused = false, alive = false, leaving = false;
  let ready = false, mapFailed = false, mapLoading = false;
  let findTarget = homeSpot(guide) ? guide : null;
  const actors = new Map();          // id → { id, el, fig, pos, target, facing, step, clock, waitUntil, render }
  let chipLayout = null;
  const player = { pos: { ...PLAYER_START }, target: null, path: [], tapWalk: false, facing: 'back', step: 0, clock: 0, visitOnArrive: null, speed: PLAYER_SPEED, drawn: '' };
  let near = null;
  let timing = null, closeTimer = null, unwatchSpeech = null, welcomeOpen = false, helpWindow = null;
  let lanternsEarned = false, lanternRunning = false, lanternTimer = null, lanternCount = 0;
  let deliveryTimer = null, deliveryPreview = null;
  const scope = () => { const s = ctx.getState(); return s.chapter === 1 ? `grade-${s.grade}` : 'kindergarten'; };
  const positionScope = scope();
  const savedPosition = villagePositions.get(ctx.stage)?.get(positionScope);

  const state = () => ctx.getState();
  const largeText = () => Boolean(ctx.stage?.classList.contains('large-text'));
  const calm = () => Boolean(ctx.stage?.classList.contains('calm') || ctx.stage?.closest?.('.calm') || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const nameOf = id => SIDE[id]?.name ?? CHARACTERS.find(c => c.id === id)?.name ?? id;
  const positions = () => Object.fromEntries([...actors.values()].filter(a => !a.delivery).map(a => [a.id, a.pos]));

  const visit = onceAtATime(async id => {
    hush();
    if (id === findTarget) clearFind();
    if (id === 'nori' && lanternsEarned) { offerLanterns(); return; }
    if (SIDE[id]) { say(id, id === 'pip' ? WELCOME_LINE : SIDE[id].line); return; }
    if (leaving) return;
    leaving = true;
    const went = await (id === 'music' ? ctx.go('music') : ctx.go('encounter', { id }));
    if (went === false) leaving = false;   // the scene manager was busy; stay and let them try again
  });

  function clearCloseTimer() {
    clearTimeout(closeTimer);
    closeTimer = null;
    unwatchSpeech?.();
    unwatchSpeech = null;
  }
  function cancelOpening() {
    timing = null;
    clearCloseTimer();
  }
  function onPage({ text, hasMore, speech }) {
    clearCloseTimer();
    if (!timing || hasMore || !text || paused || !alive) return;
    const delay = timing.closeAfter ?? (largeText() ? 6000 : 4000);
    const close = () => {
      // Windows can open between frames, before pause() reaches this scene.
      if (ctx.stage?.querySelector('.win-backdrop')) { cancelOpening(); return; }
      hush();
    };
    // Allow 500ms per word plus 500ms to start when the voice supplies no end event.
    const estimate = speech ? (String(speech.text ?? text).split(/\s+/).length * 500 + 500) : 0;
    closeTimer = setTimeout(close, delay + estimate);
    if (speech?.addEventListener) {
      const ended = () => {
        clearCloseTimer();
        closeTimer = setTimeout(close, delay);
      };
      speech.addEventListener('end', ended);
      speech.addEventListener('error', ended);
      unwatchSpeech = () => {
        speech.removeEventListener('end', ended);
        speech.removeEventListener('error', ended);
      };
    }
  }
  // Both hints and neighbor lines keep the player's sprite clear.
  function say(id, words, { opening = false, closeAfter = null, chips, onChip } = {}) {
    cancelOpening();
    stopLanterns();
    if (!dialogue || mapFailed) return;
    welcomeOpen = words === WELCOME_LINE;
    if (!welcomeOpen && (opening || closeAfter !== null)) timing = { closeAfter };
    root.querySelector('[data-act="dismiss-welcome"]').hidden = !welcomeOpen;
    const host = root.querySelector('.village-dialogue');
    const box = dialogueBox(player.pos, words);
    host.classList.toggle('village-dialogue--top', box === 'top');
    host.hidden = false;
    dialogue.say(nameOf(id), words);
    dialogueChips(chips, onChip);
  }
  // Shared with Pip's next stop: native buttons keep Tab/Enter/Space and never claim focus.
  function dialogueChips(chips = [], onChip) {
    const host = root?.querySelector('.village-dialogue');
    if (!host) return;
    const old = host.querySelector('.village-chips');
    if (old?.contains(document.activeElement)) root.focus({ preventScroll: true });
    old?.remove();
    if (!chips.length) return;
    const row = document.createElement('div');
    row.className = 'village-chips';
    row.innerHTML = chips.map(({ act, label }) => `<button type="button" class="px-chip" data-act="${esc(act)}">${esc(label)}</button>`).join('');
    row.addEventListener('click', event => {
      const button = event.target.closest('[data-act]');
      if (!button || !row.contains(button)) return;
      event.stopPropagation();
      onChip?.(button.dataset.act);
      // A handler may replace this line, open a window, or leave the village.
      if (root?.contains(row)) hush();
    });
    host.append(row);
  }
  function hush() {
    cancelOpening();
    stopLanterns();
    dialogueChips();
    const host = root?.querySelector('.village-dialogue');
    if (!host || host.hidden || mapFailed) return;
    const held = host.contains(document.activeElement);
    host.hidden = true;
    welcomeOpen = false;
    if (held) root.focus({ preventScroll: true });   // focus never falls back to <body>
  }

  function setLanterns(count) {
    lanternCount = count;
    root?.querySelectorAll('.village-lamp').forEach((lamp, i) => lamp.classList.toggle('village-lamp--lit', i < count));
  }
  function stopLanterns() {
    if (!lanternRunning) return;
    clearTimeout(lanternTimer);
    lanternTimer = null;
    lanternRunning = false;
    const nori = actors.get('nori');
    if (nori) nori.held = false;
    setLanterns(lanternsEarned ? NEAR_LAMPS.length : 0);
  }
  function finishLanterns() {
    stopLanterns();
    say('nori', LANTERN_LINES.done, { chips: [{ act: 'lantern-done', label: 'Got it' }] });
  }
  function calmLanternPages() {
    setLanterns(NEAR_LAMPS.length);
    // Separate, child-paced pages even when both lines would fit normal-size text.
    say('nori', LANTERN_LINES.lighting, {
      chips: [{ act: 'lantern-more', label: 'More' }], onChip: finishLanterns,
    });
  }
  function lightLanterns() {
    if (!lanternsEarned) return;
    stopLanterns();
    if (calm()) { calmLanternPages(); return; }
    say('nori', LANTERN_LINES.lighting, { chips: [{ act: 'lantern-done', label: 'Got it' }] });
    lanternRunning = true;
    const nori = actors.get('nori');
    nori.held = true;
    nori.target = null; nori.facing = 'front'; nori.step = 0;
    drawActor(nori);
    setLanterns(0);
    const lightNext = () => {
      lanternTimer = null;
      if (!alive || !lanternRunning) return;
      if (paused || document.hidden || ctx.stage?.querySelector('.win-backdrop')) { hush(); return; }
      if (calm()) { calmLanternPages(); return; }
      setLanterns(lanternCount + 1);
      if (lanternCount === NEAR_LAMPS.length) finishLanterns();
      else lanternTimer = setTimeout(lightNext, 800);
    };
    lanternTimer = setTimeout(lightNext, 800);
  }
  function offerLanterns() {
    say('nori', LANTERN_LINES.offer, {
      chips: [{ act: 'light-lanterns', label: 'Light lanterns' }, { act: 'lantern-not-now', label: 'Not now' }],
      onChip: act => { if (act === 'light-lanterns') lightLanterns(); },
    });
  }

  function openHelp() {
    if (helpWindow || ctx.stage?.querySelector('.win-backdrop')) return;
    if (lanternRunning) hush();
    cancelOpening();
    paused = true;
    player.target = null; player.path = []; player.tapWalk = false; player.visitOnArrive = null;
    stopSpeaking();
    const body = document.createElement('div');
    body.className = 'village-help';
    body.innerHTML = '<div class="village-help__picture" aria-hidden="true"></div><p class="village-help__text" aria-live="polite"></p><div class="village-help__buttons"><button type="button" class="px-button" data-help="hear">Hear</button><button type="button" class="px-button" data-help="back">Back</button><button type="button" class="px-button" data-help="next">Next</button></div>';
    let page = 0;
    const render = () => {
      stopSpeaking();
      body.querySelector('.village-help__picture').innerHTML = helpPicture(page);
      body.querySelector('.village-help__text').textContent = HELP_STEPS[page];
      const back = body.querySelector('[data-help="back"]');
      if (page === 0 && document.activeElement === back) body.querySelector('[data-help="next"]').focus();
      back.disabled = page === 0;
      body.querySelector('[data-help="next"]').textContent = page === HELP_STEPS.length - 1 ? 'Got it' : 'Next';
      if (state().settings?.autoRead) ctx.speak?.(HELP_STEPS[page]);
    };
    body.addEventListener('click', event => {
      const act = event.target.closest('[data-help]')?.dataset.help;
      if (act === 'hear') ctx.speak?.(HELP_STEPS[page]);
      if (act === 'next' && page === HELP_STEPS.length - 1) { helpWindow?.close(); return; }
      if (act === 'back' && page > 0) { page--; render(); }
      if (act === 'next') { page++; render(); }
    });
    helpWindow = openWindow(ctx.stage, { title: 'Village help', body, initialFocus: '[data-help="next"]', onClose: () => { helpWindow = null; paused = false; stopSpeaking(); } });
    render();
  }

  /* ---------- Markup ---------- */

  function sideMarkup(id) {
    return `<button type="button" class="village-actor village-side" data-id="${id}" aria-label="Talk to ${SIDE[id].name}">
        <span class="village-actor__fig" aria-hidden="true"></span>
        <span class="px-chip px-name village-name village-name--side" aria-hidden="true">${SIDE[id].name}</span>
      </button>`;
  }
  function lampMarkup() {
    return `<div class="village-lamps" aria-hidden="true" style="--lamp-sheet:url('${LAMP_GLOW.src}');--lamp-width:${LAMP_GLOW.frameWidth}px;--lamp-height:${LAMP_GLOW.frameHeight}px">${NEAR_LAMPS.map((base, i) =>
      `<span class="village-lamp${lanternsEarned ? ' village-lamp--lit' : ''}" style="left:${base.x}px;top:${base.y}px">${LAMP_HEAD_OFFSETS[i].map(head =>
        `<span class="village-lamp__head" style="left:${head.x - LAMP_GLOW.anchorX}px;top:${head.y - LAMP_GLOW.anchorY}px"></span>`).join('')}</span>`).join('')}</div>`;
  }
  function stallMarkup(c, made) {
    const { x, y } = STALLS[c.id];
    const creation = made.creations[c.id], easel = easelRect(c.id);
    const reaction = creation && reactionLine(c.id, creation, state().chapter === 0 ? 0 : state().grade);
    const label = creationLabel(c.id, creation).replace(/^your /i, '').toLowerCase();
    return `<div class="village-stall" data-id="${c.id}" style="left:${x}px;top:${y}px">${stallSVG(c.id)}<span class="village-sparkle" aria-hidden="true"></span></div>
      ${creation ? `<button type="button" class="village-easel" data-id="${c.id}" data-easel="${c.id}" aria-label="${esc(`Your ${label}. Tap to hear ${nameOf(reaction.id)} again.`)}" style="left:${easel.x}px;top:${easel.y}px">${creationMarkup(c.id, creation)}</button>` : ''}`;
  }
  function boardMarkup(made) {
    const count = Object.keys(made.creations).length;
    const pips = CHARACTERS.map(c => {
      const theme = SUBJECT_THEME[c.id], filled = Boolean(made.creations[c.id]);
      return `<span class="village-pip${filled ? ' village-pip--filled' : ''}" style="--subject:${theme.color}" title="${theme.label}">${icon(theme.icon, { size: 20 })}<span class="sr-only">${theme.label}${filled ? ', made' : ', not yet'}</span></span>`;
    }).join('');
    return `<div class="px-frame village-board" role="group" aria-label="${esc(boardLabel(count))}">
        <span class="village-board__title" aria-hidden="true">${icon('star', { size: 20 })}<span class="village-board__label">${esc(boardLabel(count))}</span></span>
        <span class="village-board__pips">${pips}</span>
        <button type="button" class="px-button px-button--finish village-parade"${canStartParade(state()) ? '' : ' hidden'}>${icon('star')}<span>Parade</span></button>
      </div>`;
  }

  function build() {
    const s = state();
    const drafts = Object.fromEntries(CHARACTERS.map(c => [c.id, getDraft(s, c.id)]).filter(([, draft]) => draft));
    const made = { creations: getCreations(s), completed: getCompleted(s), drafts };
    lanternsEarned = CHARACTERS.every(c => Boolean(made.creations[c.id]));
    root = document.createElement('div');
    root.className = 'village';
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Hanabi Bay. Walk with the arrow keys. Press Enter near a neighbor to talk. Or choose a neighbor.');
    root.innerHTML = `<img class="village-map" src="${BACKGROUND}" alt="" draggable="false" width="960" height="540">
      <div class="village-stalls">${CHARACTERS.map(c => stallMarkup(c, made)).join('')}</div>
      ${lampMarkup()}
      <div class="village-actors">
        ${CHARACTERS.map(c => neighborMarkup(c, made)).join('')}
        ${Object.keys(SIDE_SPOTS).map(sideMarkup).join('')}
        <div class="village-player" aria-hidden="true"><span class="village-actor__fig"></span></div>
        <span class="village-find" aria-hidden="true" hidden><span class="village-find__lantern"></span></span>
        <span class="px-chip village-pointer" aria-hidden="true" hidden></span>
        <button type="button" class="px-chip village-talk" hidden></button>
      </div>
      <header class="village-hud">
        <button type="button" class="px-chip village-grade" data-act="grade">${esc(gradeLabel(s))}</button>
        <h1 class="village-hud__title">Hanabi Bay</h1>
        <nav class="village-hud__buttons" aria-label="Menu">
          <button type="button" class="px-icon-button" data-act="village-help">${icon('help')}<span>Help</span></button>
          <button type="button" class="px-icon-button" data-act="guide">${icon('map')}<span>Guide</span></button>
          <button type="button" class="px-icon-button" data-act="comfort">${icon('settings')}<span>Comfort</span></button>
          <button type="button" class="px-icon-button" data-act="pause">${icon('pause')}<span>Pause</span></button>
        </nav>
      </header>
      ${boardMarkup(made)}
      <p class="px-chip village-loading" role="status" hidden>Loading map…</p>
      <div class="village-dialogue" hidden></div>`;

    for (const el of root.querySelectorAll('.village-actor[data-id]')) {
      const id = el.dataset.id, home = homeSpot(id);
      actors.set(id, { id, el, fig: el.querySelector('.village-actor__fig'), pos: { ...home }, target: null, facing: 'front', step: 0, clock: 0, waitUntil: 0, drawn: '' });
    }
    dialogue = createDialogue(root.querySelector('.village-dialogue'), {
      speak: text => ctx.speak?.(text),
      onHelp: openHelp,
      isLarge: largeText,
      autoRead: () => Boolean(state().settings?.autoRead),
      onPage,
    });
    const done = document.createElement('button');
    done.setAttribute('type', 'button');
    done.className = 'px-chip village-welcome-done';
    done.dataset.act = 'dismiss-welcome';
    done.textContent = 'Got it';
    done.hidden = true;
    root.querySelector('.village-dialogue').append(done);
  }

  /* ---------- Drawing ---------- */

  function drawActor(a) {
    const rect = hotspotRect(a.id, a.pos);
    a.el.style.left = px(rect.x);
    a.el.style.top = px(rect.y);
    a.el.style.zIndex = String(Math.round(a.pos.y));
    a.el.style.setProperty('--badge-drop', px(Math.max(0, 72 + 96 - a.pos.y)));
    const key = `${a.facing}:${a.step}:${a.pose ?? 'idle'}`;
    // Joy exists only on the front row; keep the original frame intact.
    if (a.drawn !== key) { a.fig.innerHTML = figureMarkup(a.id, { facing: a.pose === 'joy' ? 'front' : a.facing, step: a.step, pose: a.pose }); a.drawn = key; }
  }
  function drawPlayer() {
    if (welcomeOpen) root.querySelector('.village-dialogue').classList.toggle('village-dialogue--top', dialogueBox(player.pos, WELCOME_LINE) === 'top');
    const el = root.querySelector('.village-player');
    el.style.left = px(player.pos.x - 32);
    el.style.top = px(player.pos.y - 57);
    el.style.zIndex = String(Math.round(player.pos.y) + 1);
    const key = `${playerFigureId(state())}:${player.facing}:${player.step}`;
    if (player.drawn !== key) { el.firstElementChild.innerHTML = figureMarkup(playerFigureId(state()), { facing: player.facing, step: player.step }); player.drawn = key; }
  }
  function drawTalk() {
    const id = player.target ? null : nearestNeighbor(player.pos, positions());
    const chip = root.querySelector('.village-talk');
    if (id !== near) {
      near = id;
      if (!id && chip.contains(document.activeElement)) root.focus({ preventScroll: true });
      chip.hidden = !id;
      if (id) {
        chip.innerHTML = `<span class="village-talk__key" aria-hidden="true">Enter</span><span aria-hidden="true">·</span><span>Talk to ${esc(nameOf(id))}</span>`;
        chip.setAttribute('aria-label', `Talk to ${nameOf(id)}`);
      }
      for (const a of actors.values()) a.el.classList.toggle('village-actor--near', a.id === id);
    }
    if (id) chip.style.zIndex = '900';
    chipLayout?.update(id);
  }
  function drawFind() {
    const lantern = root.querySelector('.village-find'), pointer = root.querySelector('.village-pointer');
    const target = findTarget && actors.get(findTarget);
    lantern.hidden = pointer.hidden = !target;
    if (!target) return;
    lantern.style.left = px(target.pos.x - 16);
    lantern.style.top = px(Math.max(72, target.pos.y - 96));
    lantern.style.zIndex = '800';
    const dir = guideArrow(player.pos, target.pos);
    pointer.textContent = ARROW_GLYPH[dir];
    pointer.dataset.dir = dir;
    pointer.style.left = px(player.pos.x + 26);
    pointer.style.top = px(player.pos.y - 52);
    pointer.style.zIndex = '801';
  }
  function clearFind() {
    findTarget = null;
    if (root) drawFind();
  }

  /* ---------- Motion ---------- */

  // Only the published sign chooses a reader. Waiting for the mask never holds a neighbor.
  function deliverSign(opening) {
    const sign = getCreations(state()).writing;
    const reader = actors.get(signReader(sign, state().chapter === 0 ? 0 : state().grade)?.id);
    if (celebrate !== 'writing' || !reader || calm()) return false;
    const pip = actors.get('pip');
    pip.delivery = { reader, opening, started: now(), phase: 'waiting' };
    deliveryTimer = setTimeout(() => finishDelivery(pip, { home: true }), 1500);
    drawTalk();
    return true;
  }
  function faceDeliveryReader(a) {
    const pip = actors.get('pip');
    if (!a.held || pip?.delivery?.reader !== a || a === pip) return false;
    a.target = null; a.step = 0;
    a.facing = pip.pos.x < a.pos.x ? 'left' : pip.pos.x > a.pos.x ? 'right' : 'front';
    return true;
  }
  function clearDelivery(a) {
    clearTimeout(deliveryTimer); deliveryTimer = null;
    deliveryPreview?.(); deliveryPreview = null;
    a.el.querySelector('.village-delivery-sign')?.remove();
    const d = a.delivery;
    if (d?.holding) d.reader.held = d.wasHeld;
    a.delivery = null;
    a.pose = 'idle'; a.target = null; a.step = 0; a.drawn = '';
  }
  function finishDelivery(a, { home = false, silent = false } = {}) {
    const d = a.delivery;
    if (!d) return false;
    const opening = d.opening;
    clearDelivery(a);
    if (home) a.pos = { ...SIDE_SPOTS.pip };
    a.facing = 'front'; a.waitUntil = now() + 1500;
    // Return along the road at the normal wander speed, then hand back to wandering.
    // A straight wander step from a distant reader could cut across a stall.
    const path = !home && roadPath(a.pos, SIDE_SPOTS.pip, 0);
    if (path) {
      a.delivery = { phase: 'home', walk: createScriptedWalk(a.pos, path, WANDER_SPEED), joyUntil: now() + 360 };
      a.pose = 'joy';
    } else if (!home) a.pos = { ...SIDE_SPOTS.pip };
    drawActor(a);
    if (a.pose === 'joy') a.fig.innerHTML = figureMarkup('pip', { pose: 'joy' });
    drawTalk();
    if (opening && !silent && !paused && !leaving && !ctx.stage?.querySelector('.win-backdrop')
      && root.querySelector('.village-dialogue').hidden) say(opening.id, opening.words, { opening: true });
    return Boolean(opening);
  }
  function skipDelivery({ silent = false } = {}) {
    const pip = actors.get('pip');
    return pip?.delivery ? finishDelivery(pip, { home: true, silent }) : false;
  }
  function tickDelivery(a, dt) {
    const d = a.delivery;
    if (calm()) { finishDelivery(a, { home: true }); return; }
    if (d.opening && (paused || leaving || ctx.stage?.querySelector('.win-backdrop') || !root.querySelector('.village-dialogue').hidden)) {
      finishDelivery(a, { home: true, silent: true }); return;
    }
    if (paused) return;
    if (d.phase === 'waiting') {
      if (!ready) return;
      // Pip reads Pip's own mail at home; all other readers are held at their live feet.
      const goal = d.reader === a ? SIDE_SPOTS.pip : talkGoal(d.reader.id, d.reader.pos);
      const path = goal && roadPath(a.pos, goal, 0);
      if (!path) { finishDelivery(a, { home: true }); return; }
      clearTimeout(deliveryTimer);
      deliveryTimer = setTimeout(() => finishDelivery(a, { home: true }), Math.max(0, 3000 - (now() - d.started)));
      d.phase = 'out'; d.walk = createScriptedWalk(a.pos, path, PLAYER_SPEED * 1.5);
      if (d.reader !== a) { d.wasHeld = d.reader.held; d.holding = true; d.reader.held = true; }
      const token = document.createElement('span');
      token.className = 'village-delivery-sign'; token.setAttribute('aria-hidden', 'true');
      token.innerHTML = creationMarkup('writing', getCreations(state()).writing);
      a.el.append(token);
      deliveryPreview = fitSignPreviews(token, 64, 40);
    }
    if (d.phase === 'home' && d.joyUntil) {
      if (now() < d.joyUntil) return;
      d.joyUntil = 0; a.pose = 'idle'; a.drawn = '';
    }
    d.walk = stepScriptedWalk(d.walk, dt);
    a.pos = d.walk.pos; a.facing = d.walk.facing; a.step = d.walk.step;
    if (d.holding) { faceDeliveryReader(d.reader); drawActor(d.reader); }
    if (d.walk.arrived) {
      if (d.phase === 'out') finishDelivery(a);
      else { clearDelivery(a); a.facing = 'front'; a.waitUntil = now() + 1500; }
    }
  }

  function shouldHold(a) {
    if (a.held) return true;
    if (paused || calm() || a.id === findTarget) return true;
    if (player.visitOnArrive === a.id) return true;
    return Math.hypot(player.pos.x - a.pos.x, player.pos.y - a.pos.y) < STOP_RADIUS;
  }
  function tickActor(a, dt, t) {
    if (a.delivery) { tickDelivery(a, dt, t); return; }
    if (faceDeliveryReader(a)) return;
    if (!ready) return;
    const side = SIDE[a.id], still = calm(), feet = still ? homeSpot(a.id) : a.pos;
    const dx = player.pos.x - feet.x;
    const facing = side && Math.abs(dx) > 8 && Math.hypot(dx, player.pos.y - feet.y) < STOP_RADIUS ? (dx < 0 ? 'left' : 'right') : 'front';
    a.pose = side && (near === a.id || t < a.celebrateUntil) ? 'joy' : 'idle';
    if (still) { a.pos = { ...homeSpot(a.id) }; a.target = null; a.facing = facing; a.step = 0; return; }
    if (shouldHold(a)) { a.target = null; a.facing = facing; a.step = 0; a.waitUntil = Math.max(a.waitUntil, t + 1500); return; }
    if (!a.target) {
      if (t < a.waitUntil) return;
      const home = homeSpot(a.id);
      // Return home between excursions: each leg has a straight clear route.
      a.target = a.pos.x === home.x && a.pos.y === home.y ? wanderTarget(a.id) : { ...home };
      a.clock = 0;
    }
    const move = stepToward(a.pos, a.target, (side?.speed ?? WANDER_SPEED) * dt / 1000);
    a.pos = road().step(a.pos, move.pos);
    a.clock += dt;
    if (move.arrived) { a.target = null; a.facing = 'front'; a.step = 0; a.waitUntil = t + 1500 + Math.random() * 2500; return; }
    a.facing = move.facing;
    a.step = STEP_CYCLE[Math.floor(a.clock / (side?.stride ?? WANDER_STEP_MS)) % 4];
  }
  function tickPlayer(dt) {
    if (!ready || !player.target) { player.step = 0; return; }
    let remaining = player.speed * dt / 1000;
    player.clock += dt;
    while (player.path.length && remaining > 0) {
      const waypoint = player.path[0];
      const dx = waypoint.x - player.pos.x, dy = waypoint.y - player.pos.y;
      const move = stepToward(player.pos, waypoint, remaining);
      const next = road().step(player.pos, move.pos);
      remaining -= Math.hypot(next.x - player.pos.x, next.y - player.pos.y);
      player.pos = next;
      if (Math.abs(dx) >= Math.abs(dy) && dx) player.facing = dx > 0 ? 'right' : 'left';
      else if (dy) player.facing = dy > 0 ? 'front' : 'back';
      if (next.x !== move.pos.x || next.y !== move.pos.y) { player.path = []; player.visitOnArrive = null; break; }
      if (!move.arrived) break;
      player.path.shift();
    }
    player.step = calm() ? 0 : frameFor(player.clock, player.speed);
    if (!player.path.length) arrive();
  }

  function arrive() {
    player.target = null;
    player.path = [];
    player.tapWalk = false;
    player.step = 0;
    // Keep the stride phase between keyboard steps so both feet take turns.
    const id = player.visitOnArrive;
    player.visitOnArrive = null;
    if (id) { player.facing = 'back'; visit(id); }
  }

  function tick(t) {
    if (!alive) return;
    if (ctx.stage?.querySelector('.win-backdrop')) cancelOpening();
    const dt = Math.min(100, last ? t - last : 16);
    last = t;
    if (paused && !ctx.stage?.querySelector('.win-backdrop')) paused = false;   // the window closed
    for (const a of actors.values()) { tickActor(a, dt, t); drawActor(a); }
    tickPlayer(dt);
    drawPlayer();
    drawTalk();
    drawFind();
    frame = nextFrame(tick);
  }

  /* ---------- Input ---------- */

  function walkTo(id) {
    hush();
    const a = actors.get(id);
    if (!a || !ready) return;
    const goal = talkGoal(id, a.pos);
    const path = goal && roadPath(player.pos, goal, 0);
    if (!path) return;
    if (calm()) {
      player.pos = path.at(-1);
      player.path = []; player.target = null; player.tapWalk = false; player.visitOnArrive = null;
      player.facing = 'back';
      drawPlayer(); drawTalk(); drawFind();
      visit(id);
      return;
    }
    player.visitOnArrive = id;
    player.target = path.at(-1);
    player.path = path.slice(1);
    player.tapWalk = true;
    player.clock = 0;
    const length = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
    player.speed = Math.max(PLAYER_SPEED, length / (TAP_WALK_MS / 1000));
  }
  function stepBy(intent, keepOpening = false) {
    if (!welcomeOpen && !keepOpening) hush();
    player.facing = FACING_FOR[intent];
    if (!ready) { drawPlayer(); return; }
    if (player.tapWalk) { player.target = null; player.path = []; player.tapWalk = false; player.clock = 0; }
    player.visitOnArrive = null;
    const from = player.target ?? player.pos;
    if (player.target && Math.hypot(player.target.x - player.pos.x, player.target.y - player.pos.y) >= STEP) return;
    const next = stepPlayer(from, intent);
    player.speed = PLAYER_SPEED;
    if (calm()) { player.pos = next; player.target = null; player.path = []; player.step = 0; drawPlayer(); drawTalk(); drawFind(); return; }
    // Keep the old step's corner when a held direction changes mid-stride.
    player.path = player.target ? [player.target, next] : [next];
    player.target = next;
  }
  // The A button: finish unread pages, then follow the Talk chip without starting a walk.
  function pressA() {
    if (mapFailed) return;
    const box = root.querySelector('.village-dialogue');
    const next = aAction({ near, dialogueOpen: !box.hidden, hasMore: dialogue.hasMore() });
    if (next.act === 'next') dialogue.next();
    else if (next.act === 'talk') { player.facing = 'back'; visit(next.id); }
    else say(null, WALK_HINT, { closeAfter: 3000 });
  }
  // Keys reach the document after the village, so claiming A here stops the browser (and app.js) from clicking
  // whichever button happens to hold focus. Space clicks on keyup, so that keyup is swallowed too.
  let swallowSpaceUp = false;
  function onKey(event) {
    if (ctx.stage?.querySelector('.win-backdrop')) { swallowSpaceUp = false; return; }   // a window owns the keys
    if (event.type === 'keyup') {
      if (swallowSpaceUp && event.key === ' ') { swallowSpaceUp = false; event.preventDefault(); }
      return;
    }
    const intent = keyIntent(event);
    const opensMenu = intent === 'a' && event.target?.closest?.('.village-hud, .village-board');
    if (skipDelivery({ silent: Boolean(opensMenu) }) && (FACING_FOR[intent] || intent === 'b' || event.target === root || event.target?.closest?.('.village-actor, .village-talk'))) {
      if (FACING_FOR[intent]) stepBy(intent, true);
      if (intent) {
        event.preventDefault();
        if (event.key === ' ') swallowSpaceUp = true;
        return;
      }
    }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !A_KEYS.has(event.key)) return;
    const target = event.target;
    const actorButton = Boolean(target?.closest?.('.village-actor, .village-talk'));   // never the HUD, the board or a window
    const focus = { button: actorButton, onRoot: target === root, inVillage: Boolean(root?.contains(target)), inDialogue: Boolean(target?.closest?.('.village-dialogue')) };
    if (!talkKeyWins(near, focus)) return;
    event.preventDefault();
    if (event.key === ' ') swallowSpaceUp = true;
    if (!event.repeat) {
      const actor = target?.closest?.('.village-actor[data-id]');
      if (actor) walkTo(actor.dataset.id);
      else pressA();
    }
  }

  function onClick(event) {
    const skipped = skipDelivery({ silent: Boolean(event.target.closest('.village-actor, .village-talk, .village-hud, .village-board')) });
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act === 'village-help') { openHelp(); return; }
    if (act === 'dismiss-welcome') { hush(); return; }
    if (act === 'retry-road') { startRoad(); return; }
    if (act && ['grade', 'guide', 'comfort', 'pause'].includes(act)) { cancelOpening(); paused = true; ctx.open?.[act]?.(); return; }
    if (event.target.closest('.village-parade')) { if (canStartParade(state())) ctx.go('parade'); return; }
    if (event.target.closest('.village-talk')) { if (near) { player.facing = 'back'; visit(near); } return; }
    const easel = event.target.closest('[data-easel]');
    if (easel) {
      const s = state(), id = easel.dataset.easel;
      const reaction = reactionLine(id, getCreations(s)[id], s.chapter === 0 ? 0 : s.grade);
      if (reaction) say(reaction.id, reaction.words, { closeAfter: 4000 });
      return;
    }
    const actor = event.target.closest('.village-actor[data-id]');
    if (actor) { walkTo(actor.dataset.id); return; }
    if (event.target.closest('.village-map')) {   // tap the ground to walk there
      if (root.querySelector('.village-chips')) hush();
      const box = root.getBoundingClientRect();
      if (!box.width || !ready) return;
      const point = { x: (event.clientX - box.left) * 960 / box.width, y: (event.clientY - box.top) * 540 / box.height };
      const path = roadPath(player.pos, point);
      if (!path) return;
      if (!welcomeOpen && !skipped) hush();
      player.visitOnArrive = null;
      player.speed = PLAYER_SPEED * 1.5;
      player.clock = 0;
      player.target = path.at(-1);
      player.path = path.slice(1);
      player.tapWalk = true;
      if (calm()) { player.pos = player.target; player.target = null; player.path = []; player.tapWalk = false; drawPlayer(); drawTalk(); drawFind(); }
    }
  }

  function sparkle(id) {
    const stall = root.querySelector(`.village-stall[data-id="${id}"]`);
    if (!stall) return;
    stall.classList.add('village-stall--sparkle');
    if (!calm()) stall.addEventListener('animationend', () => stall.classList.remove('village-stall--sparkle'), { once: true });
  }

  async function startRoad() {
    if (mapLoading || !alive) return;
    mapLoading = true;
    root.querySelector('.village-loading').hidden = false;
    const retry = root.querySelector('[data-act="retry-road"]');
    if (retry) { retry.disabled = true; retry.textContent = 'Loading…'; }
    try {
      if (ctx.walkable) setRoad(ctx.walkable);
      else {
        const creations = getCreations(state());
        await loadRoad(undefined, { blocked: Object.entries(EASELS).filter(([id]) => creations[id]).map(([, rect]) => rect) });
      }
      if (!alive) return;
      mapFailed = false;
      if (retry) { root.querySelector('.village-map-error')?.remove(); hush(); }
      if (savedPosition) player.pos = clampWalk(savedPosition) ?? { ...PLAYER_START };
      ready = true;
      drawPlayer(); drawTalk(); drawFind();
      frame = nextFrame(tick);
    } catch {
      if (!alive) return;
      cancelOpening();
      const words = 'The village map did not load.';
      mapFailed = false;
      say(null, words);
      mapFailed = true;
      const host = root.querySelector('.village-dialogue');
      let help = host.querySelector('.village-map-error');
      if (!help) {
        help = document.createElement('div');
        help.className = 'px-frame village-map-error';
        help.innerHTML = '<p>We need the map to walk safely. Check your connection, then try again.</p><button type="button" class="px-chip" data-act="retry-road">Retry</button>';
        host.append(help);
      }
      const button = help.querySelector('button');
      button.disabled = false;
      button.textContent = 'Retry';
      ctx.announce?.(`${words} We need the map to walk safely. Check your connection, then choose Retry.`);
    } finally { mapLoading = false; if (alive) root.querySelector('.village-loading').hidden = true; }
  }

  return {
    mount() {
      if (!state().hasStarted) ctx.commit?.({ ...state(), hasStarted: true });
      build();
      ctx.stage.append(root);
      chipLayout = createVillageChipLayout(actors.values(), root.querySelector('.village-talk'), largeText);
      previews = fitSignPreviews(root, 64, 40);
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
      root.addEventListener('keyup', onKey);
      alive = true;
      for (const a of actors.values()) {
        a.waitUntil = now() + 500 + Math.random() * 2500;
        if (celebrate && SIDE[a.id]) { a.celebrateUntil = now() + 1500; a.pose = 'joy'; a.waitUntil = Math.max(a.waitUntil, a.celebrateUntil); }
        drawActor(a);
      }
      // A slow map load has no animation loop yet, but the greeting still ends.
      if (celebrate) setTimeout(() => {
        if (!alive) return;
        for (const a of actors.values()) if (SIDE[a.id]) { a.celebrateUntil = 0; a.pose = near === a.id ? 'joy' : 'idle'; drawActor(a); }
      }, 1500);
      drawPlayer();
      drawTalk();
      drawFind();
      const opening = openingLine({ creations: getCreations(state()), celebrate, grade: state().chapter === 0 ? 0 : state().grade });
      if (opening) { if (celebrate) sparkle(celebrate); if (!deliverSign(opening)) say(opening.id, opening.words, { opening: true }); }   // nothing made yet: Pip says what to do
      if (findTarget) ctx.announce?.(`Find ${nameOf(findTarget)}. Follow the arrow.`);
      const button = focus && root.querySelector(`.village-actor[data-id="${focus}"]`);
      (button || root).focus({ preventScroll: true });   // the welcome never takes focus from the player controls
      // Loading must not hold the scene transition curtain or lock its menu controls.
      void startRoad();
    },
    handleIntent(intent) {
      if (!root) return false;
      const skipped = skipDelivery();
      if (FACING_FOR[intent]) { stepBy(intent, skipped); return true; }
      if (skipped && ['a', 'b'].includes(intent)) return true;
      if (intent === 'a') { pressA(); return true; }
      if (intent === 'b') { hush(); return true; }
      return false;
    },
    pause() {
      if (lanternRunning) hush();
      cancelOpening();
      paused = true;
      player.target = null;
      player.path = [];
      player.tapWalk = false;
      player.visitOnArrive = null;
    },
    destroy() {
      stopLanterns();
      if (alive && ready) {
        if (!villagePositions.has(ctx.stage)) villagePositions.set(ctx.stage, new Map());
        villagePositions.get(ctx.stage).set(positionScope, { ...player.pos });
      }
      helpWindow?.close();
      if (actors.get('pip')?.delivery) clearDelivery(actors.get('pip'));
      cancelOpening();
      alive = false;
      cancelFrame(frame);
      chipLayout?.destroy();
      previews?.();
      dialogue?.destroy();
      root?.removeEventListener('click', onClick);
      root?.removeEventListener('keydown', onKey);
      root?.removeEventListener('keyup', onKey);
      root?.remove();
      root = null;
      dialogue = null;
      actors.clear();
    },
  };
}
