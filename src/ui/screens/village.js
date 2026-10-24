// Willow Bay, the bright overworld: stalls, wandering neighbors, the player, the HUD and the festival board.
import { CHARACTERS } from '../../data.js';
import { getCreations, getCompleted, canStartParade } from '../../progress.js';
import { SUBJECT_THEME } from '../palette.js';
import { icon } from '../icons.js';
import { figureMarkup, playerFigureId } from '../figures/index.js';
import { createDialogue } from '../dialogue.js';
import { onceAtATime } from '../scenes.js';
import { creationMarkup } from '../creations.js';
import {
  VILLAGE_SPOTS, SIDE_SPOTS, PLAYER_START, WALK_BOUNDS, STEP, homeSpot, hotspotRect, talkPoint, nearestNeighbor,
  stepPlayer, stallState, wanderTarget, stepToward, guideArrow, villageMapSVG, stallSVG,
} from '../village-map.js';

const SIDE = {
  pip: { name: 'Pip', line: 'I delivered every invitation! Except this one. Oh. It’s mine.' },
  nori: { name: 'Nori', line: 'You can go anywhere first. I’m going slowly. That’s my favorite speed.' },
};
const STEP_CYCLE = [1, 0, 2, 0];
const STEP_MS = 160;
const WANDER_SPEED = 24;        // px per second
const PLAYER_SPEED = 240;       // px per second for key steps; tap walks speed up to finish within 600ms
const TAP_WALK_MS = 600;
const STOP_RADIUS = 96;
const ARROW_GLYPH = { up: '↑', 'up-right': '↗', right: '→', 'down-right': '↘', down: '↓', 'down-left': '↙', left: '←', 'up-left': '↖' };
const FACING_FOR = { up: 'back', down: 'front', left: 'left', right: 'right' };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const px = n => `${Math.round(n)}px`;
const madeLabel = label => /^your /i.test(label) ? `Made ${label.charAt(0).toLowerCase()}${label.slice(1)}.` : `Made a ${label.toLowerCase()}.`;
const gradeLabel = state => state.chapter === 1 ? `Grade ${state.grade}` : 'Kindergarten';
const now = () => globalThis.performance?.now?.() ?? Date.now();
const nextFrame = fn => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16));
const cancelFrame = id => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id));

export function createVillageScene(ctx, { focus, celebrate, guide } = {}) {
  let root = null, dialogue = null, frame = 0, last = 0, paused = false, alive = false, leaving = false;
  let findTarget = homeSpot(guide) ? guide : null;
  const actors = new Map();          // id → { id, el, fig, pos, target, facing, step, clock, waitUntil, render }
  const player = { pos: { ...PLAYER_START }, target: null, facing: 'back', step: 0, clock: 0, visitOnArrive: null, speed: PLAYER_SPEED, drawn: '' };
  let near = null;

  const state = () => ctx.getState();
  const calm = () => Boolean(ctx.stage?.classList.contains('calm') || ctx.stage?.closest?.('.calm') || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const nameOf = id => SIDE[id]?.name ?? CHARACTERS.find(c => c.id === id)?.name ?? id;
  const positions = () => Object.fromEntries([...actors.values()].map(a => [a.id, a.pos]));

  const visit = onceAtATime(async id => {
    if (id === findTarget) clearFind();
    if (SIDE[id]) { say(id, SIDE[id].line); return; }
    if (leaving) return;
    leaving = true;
    const went = await (id === 'music' ? ctx.go('music') : ctx.go('encounter', { id }));
    if (went === false) leaving = false;   // the scene manager was busy; stay and let them try again
  });

  // The box sits bottom right; when the speaker stands there (Kiko), it moves to the top so they stay in view.
  function say(id, words) {
    if (!dialogue) return;
    const host = root.querySelector('.village-dialogue'), feet = actors.get(id)?.pos;
    host.classList.toggle('village-dialogue--top', Boolean(feet && feet.x > 440 && feet.y > 330));
    host.hidden = false;
    dialogue.say(nameOf(id), words);
  }
  function hush() {
    const host = root?.querySelector('.village-dialogue');
    if (host && !host.hidden) host.hidden = true;
  }

  /* ---------- Markup ---------- */

  function neighborMarkup(c, made) {
    const theme = SUBJECT_THEME[c.id];
    const status = stallState(c.id, made.creations, made.completed);
    const mark = status === 'made' ? `<span class="village-badge__mark village-badge__mark--made">${icon('check', { size: 16 })}</span>`
      : status === 'visited' ? '<span class="village-badge__mark village-badge__mark--visited">Visited</span>'
      : '<span class="village-badge__mark village-badge__mark--new">!</span>';
    const said = status === 'made' ? madeLabel(c.reward.label) : status === 'visited' ? 'Visited.' : 'Something new to make.';
    return `<button type="button" class="village-actor village-npc village-npc--${status}" data-id="${c.id}" aria-label="${esc(`${c.name}, ${theme.label}. ${said}`)}">
        <span class="village-badge" style="--subject:${theme.color}" aria-hidden="true">${icon(theme.icon)}${mark}</span>
        <span class="village-actor__fig" aria-hidden="true"></span>
        <span class="px-chip px-name village-name" aria-hidden="true">${esc(c.name)} · ${esc(theme.label)}</span>
      </button>`;
  }
  function sideMarkup(id) {
    return `<button type="button" class="village-actor village-side" data-id="${id}" aria-label="Talk to ${SIDE[id].name}">
        <span class="village-actor__fig" aria-hidden="true"></span>
        <span class="px-chip px-name village-name village-name--side" aria-hidden="true">${SIDE[id].name}</span>
      </button>`;
  }
  function stallMarkup(c, made) {
    const { x, y } = VILLAGE_SPOTS[c.id];
    const creation = made.creations[c.id];
    const easelLeft = x > 480 ? x - 64 - 88 : x + 64 + 8;
    return `<div class="village-stall" data-id="${c.id}" style="left:${x - 64}px;top:${y - 96}px">${stallSVG(c.id)}<span class="village-sparkle" aria-hidden="true"></span></div>
      <div class="village-easel${creation ? '' : ' village-easel--empty'}" data-id="${c.id}" style="left:${easelLeft}px;top:${y - 70}px">${creation ? creationMarkup(c.id, creation) : ''}</div>`;
  }
  function boardMarkup(made) {
    const count = Object.keys(made.creations).length;
    const pips = CHARACTERS.map(c => {
      const theme = SUBJECT_THEME[c.id], filled = Boolean(made.creations[c.id]);
      return `<span class="village-pip${filled ? ' village-pip--filled' : ''}" style="--subject:${theme.color}" title="${theme.label}">${icon(theme.icon, { size: 20 })}<span class="sr-only">${theme.label}${filled ? ', made' : ', not yet'}</span></span>`;
    }).join('');
    return `<div class="px-frame village-board" role="group" aria-label="Festival board: ${count} of 7 made">
        <span class="village-board__title" aria-hidden="true">${icon('star', { size: 20 })}</span>
        <span class="village-board__pips">${pips}</span>
        <button type="button" class="px-button px-button--finish village-parade"${canStartParade(state()) ? '' : ' hidden'}>${icon('star')}<span>Parade</span></button>
      </div>`;
  }

  function build() {
    const s = state();
    const made = { creations: getCreations(s), completed: getCompleted(s) };
    root = document.createElement('div');
    root.className = 'village';
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Willow Bay. Walk with the arrow keys. Press A near a neighbor to talk, or choose a neighbor.');
    root.innerHTML = `${villageMapSVG()}
      <div class="village-stalls">${CHARACTERS.map(c => stallMarkup(c, made)).join('')}</div>
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
        <h1 class="village-hud__title">Willow Bay</h1>
        <nav class="village-hud__buttons" aria-label="Menu">
          <button type="button" class="px-icon-button" data-act="guide">${icon('map')}<span>Guide</span></button>
          <button type="button" class="px-icon-button" data-act="comfort">${icon('settings')}<span>Comfort</span></button>
          <button type="button" class="px-icon-button" data-act="pause">${icon('pause')}<span>Pause</span></button>
        </nav>
      </header>
      ${boardMarkup(made)}
      <div class="village-dialogue" hidden></div>`;

    for (const el of root.querySelectorAll('.village-actor[data-id]')) {
      const id = el.dataset.id, home = homeSpot(id);
      actors.set(id, { id, el, fig: el.querySelector('.village-actor__fig'), pos: { ...home }, target: null, facing: 'front', step: 0, clock: 0, waitUntil: 0, drawn: '' });
    }
    dialogue = createDialogue(root.querySelector('.village-dialogue'), {
      speak: text => ctx.speak?.(text),
      onHelp: () => ctx.open?.help?.('Willow Bay', ['Walk with the arrow keys or WASD, or tap a neighbor.', 'Stand near a neighbor and press A to talk.', 'Make something at every stall, then start the Parade.']),
      isLarge: () => ctx.stage?.classList.contains('large-text'),
      autoRead: () => Boolean(state().settings?.autoRead),
    });
  }

  /* ---------- Drawing ---------- */

  function drawActor(a) {
    const rect = hotspotRect(a.id, a.pos);
    a.el.style.left = px(rect.x);
    a.el.style.top = px(rect.y);
    a.el.style.zIndex = String(Math.round(a.pos.y));
    const key = `${a.facing}:${a.step}`;
    if (a.drawn !== key) { a.fig.innerHTML = figureMarkup(a.id, { facing: a.facing, step: a.step }); a.drawn = key; }
  }
  function drawPlayer() {
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
      chip.hidden = !id;
      if (id) {
        chip.innerHTML = `<span class="village-talk__key" aria-hidden="true">A</span><span aria-hidden="true">·</span><span>Talk to ${esc(nameOf(id))}</span>`;
        chip.setAttribute('aria-label', `Talk to ${nameOf(id)}`);
      }
      for (const a of actors.values()) a.el.classList.toggle('village-actor--near', a.id === id);
    }
    if (id) {
      chip.style.left = px(player.pos.x);
      chip.style.top = px(Math.max(76, player.pos.y - 57 - 40));
      chip.style.zIndex = '900';
    }
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
    pointer.style.left = px(Math.min(WALK_BOUNDS.maxX, player.pos.x + 26));
    pointer.style.top = px(player.pos.y - 52);
    pointer.style.zIndex = '801';
  }
  function clearFind() {
    findTarget = null;
    if (root) drawFind();
  }

  /* ---------- Motion ---------- */

  function shouldHold(a) {
    if (paused || calm() || a.id === findTarget) return true;
    if (player.visitOnArrive === a.id) return true;
    return Math.hypot(player.pos.x - a.pos.x, player.pos.y - a.pos.y) < STOP_RADIUS;
  }
  function tickActor(a, dt, t) {
    if (calm()) { a.pos = { ...homeSpot(a.id) }; a.target = null; a.facing = 'front'; a.step = 0; return; }
    if (shouldHold(a)) { a.target = null; a.facing = 'front'; a.step = 0; a.waitUntil = Math.max(a.waitUntil, t + 1500); return; }
    if (!a.target) {
      if (t < a.waitUntil) return;
      a.target = wanderTarget(a.id);
      a.clock = 0;
    }
    const move = stepToward(a.pos, a.target, WANDER_SPEED * dt / 1000);
    a.pos = move.pos;
    a.clock += dt;
    if (move.arrived) { a.target = null; a.facing = 'front'; a.step = 0; a.waitUntil = t + 1500 + Math.random() * 2500; return; }
    a.facing = move.facing;
    a.step = STEP_CYCLE[Math.floor(a.clock / STEP_MS) % 4];
  }
  function tickPlayer(dt) {
    const goal = player.visitOnArrive ? clampToBounds(talkPoint(player.visitOnArrive, actors.get(player.visitOnArrive).pos)) : player.target;
    if (!goal) { player.step = 0; return; }
    player.target = goal;
    const move = stepToward(player.pos, goal, player.speed * dt / 1000);
    const dx = goal.x - player.pos.x, dy = goal.y - player.pos.y;
    player.pos = move.pos;
    player.clock += dt;
    if (Math.abs(dx) >= Math.abs(dy) && dx) player.facing = dx > 0 ? 'right' : 'left';
    else if (dy) player.facing = dy > 0 ? 'front' : 'back';
    player.step = calm() ? 0 : STEP_CYCLE[Math.floor(player.clock / STEP_MS) % 4];
    if (move.arrived) arrive();
  }
  function arrive() {
    player.target = null;
    player.step = 0;
    player.clock = 0;
    const id = player.visitOnArrive;
    player.visitOnArrive = null;
    if (id) { player.facing = 'back'; visit(id); }
  }
  const clampToBounds = p => ({ x: Math.max(WALK_BOUNDS.minX, Math.min(WALK_BOUNDS.maxX, p.x)), y: Math.max(WALK_BOUNDS.minY, Math.min(WALK_BOUNDS.maxY, p.y)) });

  function tick(t) {
    if (!alive) return;
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
    if (!a) return;
    const goal = clampToBounds(talkPoint(id, a.pos));
    if (calm()) {   // no walking tween: stand there and go
      player.pos = goal;
      player.facing = 'back';
      drawPlayer();
      visit(id);
      return;
    }
    player.visitOnArrive = id;
    player.clock = 0;
    player.speed = Math.max(PLAYER_SPEED, Math.hypot(goal.x - player.pos.x, goal.y - player.pos.y) / (TAP_WALK_MS / 1000));
  }
  function stepBy(intent) {
    hush();
    player.visitOnArrive = null;
    player.facing = FACING_FOR[intent];
    const from = player.target ?? player.pos;
    if (player.target && Math.hypot(player.target.x - player.pos.x, player.target.y - player.pos.y) >= STEP) return;   // a held key waits for the last step
    const next = stepPlayer(from, intent);
    player.speed = PLAYER_SPEED;
    if (calm()) { player.pos = next; player.target = null; player.step = 0; drawPlayer(); drawTalk(); drawFind(); return; }
    player.target = next;
  }
  function talk() {
    const id = nearestNeighbor(player.pos, positions());
    if (!id) return false;
    player.facing = 'back';
    visit(id);
    return true;
  }

  function onClick(event) {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act && ['grade', 'guide', 'comfort', 'pause'].includes(act)) { paused = true; ctx.open?.[act]?.(); return; }
    if (event.target.closest('.village-parade')) { if (canStartParade(state())) ctx.go('parade'); return; }
    if (event.target.closest('.village-talk')) { if (near) { player.facing = 'back'; visit(near); } return; }
    const actor = event.target.closest('.village-actor[data-id]');
    if (actor) { walkTo(actor.dataset.id); return; }
    if (event.target.closest('.village-map')) {   // tap the ground to walk there
      const box = root.getBoundingClientRect();
      if (!box.width) return;
      hush();
      player.visitOnArrive = null;
      player.speed = PLAYER_SPEED * 1.5;
      player.target = clampToBounds({ x: (event.clientX - box.left) * 960 / box.width, y: (event.clientY - box.top) * 540 / box.height });
      if (calm()) { player.pos = player.target; player.target = null; }
    }
  }

  function sparkle(id) {
    const stall = root.querySelector(`.village-stall[data-id="${id}"]`);
    if (!stall) return;
    stall.classList.add('village-stall--sparkle');
    if (!calm()) stall.addEventListener('animationend', () => stall.classList.remove('village-stall--sparkle'), { once: true });
  }

  return {
    mount() {
      build();
      ctx.stage.append(root);
      root.addEventListener('click', onClick);
      alive = true;
      for (const a of actors.values()) { a.waitUntil = now() + 500 + Math.random() * 2500; drawActor(a); }
      drawPlayer();
      drawTalk();
      drawFind();
      const hero = CHARACTERS.find(c => c.id === celebrate);
      if (hero) { sparkle(hero.id); say(hero.id, 'That’s going straight into the festival!'); }
      if (findTarget) ctx.announce?.(`Find ${nameOf(findTarget)}. Follow the arrow.`);
      const button = focus && root.querySelector(`.village-actor[data-id="${focus}"]`);
      (button || root).focus({ preventScroll: true });
      frame = nextFrame(tick);
    },
    handleIntent(intent) {
      if (!root) return false;
      if (FACING_FOR[intent]) { stepBy(intent); return true; }
      if (intent === 'a') {
        const box = root.querySelector('.village-dialogue');
        if (!box.hidden && dialogue.hasMore()) { dialogue.next(); return true; }
        if (talk()) return true;
        hush();
        return true;
      }
      if (intent === 'b') { hush(); return true; }
      return false;
    },
    pause() {
      paused = true;
      player.target = null;
      player.visitOnArrive = null;
    },
    destroy() {
      alive = false;
      cancelFrame(frame);
      dialogue?.destroy();
      root?.removeEventListener('click', onClick);
      root?.remove();
      root = null;
      dialogue = null;
      actors.clear();
    },
  };
}
