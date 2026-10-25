import {
  FRIENDS, PIZZA_CUTS, PIZZA_LINES, normalizePizza, pizzaReady, pizzaOpening,
  pieceUnits, remainingUnits, pizzaReport, shareText, tryLine, giveLine, takeLine, newLine, cutLine,
} from '../../pizza.js';
import { figureMarkup } from '../figures/index.js';
import { gridMove, keyIntent } from '../input.js';
import { INK, PAPER, PAPER_SHADE, PATH, WOOD, LANTERN, VERMILION, SUBJECT_THEME } from '../palette.js';

export const LINES = PIZZA_LINES;
export const helpFor = grade => [
  'New pizza picks the slices. Tap a friend to give one.',
  grade >= 5 ? 'Cut a half when slices are left. Hand out every piece.' : 'Hand out every slice. Tap one to take it back.',
  'Choose Dig in! to check the shares.',
  'When all four match, choose Serve pizza.',
];
export const PIZZA_GLYPH = '<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="M8 2h3v9H2V8h2V5h4zM13 2h3v2h3v3h3v4h-9zM2 13h9v9H8v-2H5v-3H2zM13 13h9v3h-2v3h-3v3h-4z"/></svg>';
const validPlate = i => Number.isInteger(i) && i >= 0 && i < 4;

// Filled pixel runs avoid half-pixel strokes and rotated edges. The silhouette uses
// a 2px grid; its inside edge is one ink pixel. Light stays at the upper left as
// pieces leave the tray. Splitting a slice also splits its existing pepperoni.
const PIZZA_TONES = {
  crust: INK, 'crust-base': SUBJECT_THEME.math.color, 'crust-light': PATH, 'crust-shade': WOOD,
  cheese: LANTERN, 'cheese-light': '#ffe6a0', 'cheese-shade': '#d9a532',
  pepper: VERMILION, 'pepper-light': '#f77b58', 'pepper-shade': '#a92e32',
};
const pizzaArtCache = new Map();
function pizzaArt(slices, halves) {
  const key = `${slices}/${halves}`;
  if (pizzaArtCache.has(key)) return pizzaArtCache.get(key);
  const count = slices * (halves ? 2 : 1), turn = Math.PI * 2;
  const art = Array.from({ length: count }, () => Object.fromEntries(Object.keys(PIZZA_TONES).map(tone => [tone, ''])));
  const owner = (x, y) => {
    const dx = Math.floor(x / 2) * 2 + 1 - 80, dy = Math.floor(y / 2) * 2 + 1 - 80;
    if (dx * dx + dy * dy > 76 * 76) return -1;
    return Math.floor(((Math.atan2(dx, -dy) + turn) % turn) / turn * count);
  };
  const peppers = Array.from({ length: slices }, (_, j) => {
    const angle = (j + 0.5) * turn / slices;
    return [80 + 2 * Math.round(47 * Math.sin(angle) / 2), 80 - 2 * Math.round(47 * Math.cos(angle) / 2)];
  });
  const paint = (x, y) => {
    const j = owner(x, y);
    if (j < 0) return null;
    let tone = 'crust';
    if ([owner(x - 1, y), owner(x + 1, y), owner(x, y - 1), owner(x, y + 1)].every(n => n === j)) {
      const dx = Math.floor(x / 2) * 2 + 1 - 80, dy = Math.floor(y / 2) * 2 + 1 - 80;
      const radius = dx * dx + dy * dy;
      if (radius > 66 * 66) {
        tone = dx + dy < -24 ? 'crust-light' : dx + dy > 46 || y > 144 ? 'crust-shade' : 'crust-base';
      } else {
        tone = dx + dy < -44 ? 'cheese-light' : dx + dy > 62 ? 'cheese-shade' : 'cheese';
        // A few baked cheese freckles, kept clear of the slice-counting cuts.
        if ([[62, 56], [96, 66], [58, 108], [100, 104]].some(([a, b]) => x >= a && x < a + 2 && y >= b && y < b + 2)) tone = 'cheese-shade';
        const [px, py] = peppers[Math.floor(j / (halves ? 2 : 1))];
        const a = x - px, b = y - py;
        if (a >= -5 && a < 5 && b >= -5 && b < 5 && Math.abs(a + 0.5) + Math.abs(b + 0.5) <= 7) {
          const edge = a === -5 || a === 4 || b === -5 || b === 4 || Math.abs(a + 0.5) + Math.abs(b + 0.5) === 7;
          tone = edge ? 'crust' : b >= 2 || a >= 3 ? 'pepper-shade' : a < 0 && b < -1 ? 'pepper-light' : 'pepper';
        }
      }
    }
    return `${j}:${tone}`;
  };
  for (let y = 0; y < 160; y++) {
    let start = 0, last = null;
    for (let x = 0; x <= 160; x++) {
      const next = x < 160 ? paint(x, y) : null;
      if (next === last) continue;
      if (last !== null) {
        const [j, tone] = last.split(':'), width = x - start;
        art[j][tone] += `M${start} ${y}h${width}v1h-${width}z`;
      }
      start = x; last = next;
    }
  }
  pizzaArtCache.set(key, art);
  return art;
}

const PLATE_ART = `<svg viewBox="0 0 56 18" width="56" height="18" shape-rendering="crispEdges" aria-hidden="true">
  <path d="M10 0h36v2h6v2h4v10h-4v2h-6v2H10v-2H4v-2H0V4h4V2h6z" fill="${INK}"/>
  <path d="M10 1h36v2h6v2h3v8h-4v2h-6v2H11v-2H5v-2H1V5h4V3h5z" fill="${PAPER_SHADE}"/>
  <path class="pizza-plate-face" d="M10 1h36v2h6v2h3v4H1V5h4V3h5z" fill="${PAPER}"/>
  <path d="M8 6h40v2h4v3h-4v2H8v-2H4V8h4z" fill="#d6c39d"/>
  <path d="M8 7h40v2h3v2h-4v1H9v-1H5V9h3z" fill="${PAPER_SHADE}"/>
  <path d="M10 3h20v1H10zM6 5h4v1H6z" fill="${PAPER}"/>
</svg>`;

const PIECE_ART = `<svg viewBox="0 0 20 20" shape-rendering="crispEdges" aria-hidden="true">
  <g class="pizza-piece-whole">
    <path d="M5 1h10v1h3v4h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v1H9v-1H8v-2H7v-2H6v-2H5v-2H4V8H3V6H2V2h3z" fill="${INK}"/>
    <path d="M5 2h10v1h2v3H3V3h2z" fill="${SUBJECT_THEME.math.color}"/>
    <path d="M5 2h10v1H5zM3 3h2v1H3z" fill="${PATH}"/>
    <path d="M3 5h14v1H3z" fill="${WOOD}"/>
    <path d="M4 6h12v2h-1v2h-1v2h-1v2h-1v2h-1v2H9v-2H8v-2H7v-2H6v-2H5V8H4z" fill="${LANTERN}"/>
    <path d="M4 6h6v1H5v1H4zM6 8h2v2H6z" fill="#ffe6a0"/>
    <path d="M14 8h1v2h-1v2h-1v2h-1v2h-1v1h-1v-3h1v-2h1v-2h2z" fill="#d9a532"/>
  </g>
  <g class="pizza-piece-half">
    <path d="M9 1h6v1h3v4h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v1H9z" fill="${INK}"/>
    <path d="M10 2h5v1h2v3h-7z" fill="${SUBJECT_THEME.math.color}"/>
    <path d="M10 2h5v1h-5z" fill="${PATH}"/><path d="M10 5h7v1h-7z" fill="${WOOD}"/>
    <path d="M10 6h6v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1z" fill="${LANTERN}"/>
    <path d="M10 6h3v1h-2v8h-1z" fill="#ffe6a0"/>
    <path d="M14 8h1v2h-1v2h-1v2h-1v2h-1v1h-1v-3h1v-2h1v-2h2z" fill="#d9a532"/>
  </g>
  <path d="M11 7h3v1h1v2h-1v1h-3V10h-1V8h1z" fill="${INK}"/>
  <path d="M11 8h3v2h-3z" fill="${VERMILION}"/><path d="M11 8h1v1h-1z" fill="#f77b58"/>
</svg>`;

function changePlate(state, ui, i, giving, piece = pieceUnits(state)) {
  if (!validPlate(i)) return { state, ui };
  if (![1, 2].includes(piece) || (!state.halves && piece !== 2)) return { state, ui };
  if (giving && remainingUnits(state) < piece) return { state, ui, line: LINES.pizzaEmpty };
  if (!giving && state.plates[i] < piece) return { state, ui };
  const plates = state.plates.map((n, at) => at === i ? n + (giving ? piece : -piece) : n);
  const next = { ...state, plates, tried: false };
  return { state: next, ui, line: giving ? giveLine(next, i, state.tried) : takeLine(next, state.tried, piece) };
}

function act(state, ui, action) {
  if (action?.type === 'command') {
    if (action.id === 'new') {
      const cuts = PIZZA_CUTS(state.grade);
      const slices = cuts[(cuts.indexOf(state.slices) + 1) % cuts.length];
      const next = normalizePizza({ slices }, state.grade, state.chapter);
      return { state: next, ui, line: newLine(next) };
    }
    if (action.id === 'try') {
      const next = state.tried ? state : { ...state, tried: true };
      return { state: next, ui, line: tryLine(next) };
    }
    if (action.id === 'take') {
      if (state.plates.every(n => n === 0)) return { state, ui, line: LINES.platesEmpty };
      // Last among tied fullest plates, so repeated undo is deterministic.
      const i = state.plates.lastIndexOf(Math.max(...state.plates));
      return changePlate(state, ui, i, false);
    }
    return { state, ui };
  }
  if (action?.type !== 'field') return { state, ui };
  const fields = ['give', 'take', 'pizza'].filter(key => Object.hasOwn(action, key));
  if (fields.length !== 1) return { state, ui };
  if (fields[0] === 'give') return changePlate(state, ui, action.give, true);
  if (fields[0] === 'take') return changePlate(state, ui, action.take, false, action.units);
  if (action.pizza !== true) return { state, ui };
  if (state.grade < 5) return { state, ui, line: LINES.tapHint };
  if (remainingUnits(state) === 0) return { state, ui, line: LINES.cutEmpty };
  if (state.halves) return { state, ui, line: LINES.cutAlready };
  const next = { ...state, halves: true, tried: false };
  return { state: next, ui, line: cutLine(next) };
}

function mountField(host, { dispatch = () => {} } = {}) {
  const doc = host.ownerDocument ?? document;
  const root = doc.createElement('div');
  root.className = 'pizza-field';
  // Fixed pools: no focused button is replaced when a piece moves.
  root.innerHTML = `
    <div class="pizza-badges"><span class="px-chip pizza-total"></span><span class="px-chip pizza-equation"></span></div>
    <button type="button" class="pizza-board"><svg viewBox="0 0 160 160" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M48 0h64v4h16v8h12v12h12v16h4v16h4v48h-4v16h-4v16h-12v12h-12v8h-16v4H48v-4H32v-8H20v-12H8v-16H4v-16H0V56h4V40h4V24h12V12h12V4h16z" fill="${INK}"/>
      <path d="M48 1h64v4h16v8h12v12h11v16h4v16h4v46h-4v16h-4v16h-11v12h-12v8h-16v4H48v-4H32v-8H20v-12H9v-16H5v-16H1V57h4V41h4V25h11V13h12V5h16z" fill="${PAPER_SHADE}"/>
      <path d="M48 1h64v4h16v8h12v12h-4V17h-12V9h-16V5H52v4H36v8H24v12H13v16H9v16H5v42H1V57h4V41h4V25h11V13h12V5h16z" fill="${PAPER}"/>
      <path d="M155 91h4v12h-4v16h-4v16h-11v12h-12v8h-16v4H48v-4H32v-4h16v4h64v-4h12v-8h12v-12h11v-16h4V99h4z" fill="#d6c39d"/>
      <path d="M52 48h56v1H52zM44 72h72v1H44zM48 96h64v1H48zM60 120h36v1H60z" fill="#d6c39d"/>
      ${Array.from({ length: 24 }, () => `<g class="pizza-wedge">${Object.entries(PIZZA_TONES).map(([tone, fill]) => `<path class="pizza-${tone}" fill="${fill}"/>`).join('')}</g>`).join('')}
    </svg></button>
    <div class="pizza-plank" aria-hidden="true"></div><i class="pizza-wheel pizza-wheel--left" aria-hidden="true"></i><i class="pizza-wheel pizza-wheel--right" aria-hidden="true"></i>
    <div class="pizza-ground" aria-hidden="true"></div>
    <div class="pizza-friends" role="group" aria-label="Four friends and their plates"></div>`;
  const friends = root.querySelector('.pizza-friends');
  const board = root.querySelector('.pizza-board');
  const total = root.querySelector('.pizza-total');
  const equation = root.querySelector('.pizza-equation');
  const wedges = [...root.querySelectorAll('.pizza-wedge')].map(node => ({ node,
    layers: Object.keys(PIZZA_TONES).map(tone => [tone, node.querySelector(`.pizza-${tone}`)]),
  }));
  const gives = FRIENDS.map((friend, i) => {
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'pizza-give'; button.dataset.give = String(i);
    button.tabIndex = i === 0 ? 0 : -1;
    button.innerHTML = `<span class="pizza-name">${friend.name}</span><span class="pizza-idle">${figureMarkup(friend.id, { scale: 1 })}</span><span class="pizza-joy" hidden>${figureMarkup(friend.id, { pose: 'joy', scale: 1 })}</span><span class="pizza-plate">${PLATE_ART}<span class="pizza-count"></span></span><span class="pizza-worry" aria-hidden="true" hidden>!</span>`;
    friends.append(button);
    return { button, count: button.querySelector('.pizza-count'), idle: button.querySelector('.pizza-idle'), joy: button.querySelector('.pizza-joy'), worry: button.querySelector('.pizza-worry') };
  });
  // All give buttons precede ALL piece buttons in DOM order, preserving the roving rail's Tab order.
  const pieces = FRIENDS.map((friend, i) => {
    const group = doc.createElement('div'); group.className = 'pizza-pieces';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', `${friend.name}’s slices`);
    friends.append(group);
    return Array.from({ length: 12 }, () => {
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'pizza-piece'; button.dataset.take = String(i); button.hidden = true;
      button.innerHTML = PIECE_ART;
      group.append(button); return button;
    });
  });
  let cursor = 0, previous = null, previousArt = null;
  function focusGive(i, focus = true) {
    cursor = i;
    gives.forEach(({ button }, at) => { button.tabIndex = at === cursor ? 0 : -1; });
    if (focus) gives[i].button.focus();
  }
  const onFocus = event => {
    const give = event.target.closest?.('.pizza-give');
    if (give) focusGive(Number(give.dataset.give), false);
  };
  const onClick = event => {
    const give = event.target.closest?.('.pizza-give');
    const take = event.target.closest?.('.pizza-piece');
    if (give) { focusGive(Number(give.dataset.give)); dispatch({ type: 'field', give: Number(give.dataset.give) }); }
    else if (take && !take.hidden) dispatch({ type: 'field', take: Number(take.dataset.take), units: Number(take.dataset.units) });
    else if (event.target.closest?.('.pizza-board')) dispatch({ type: 'field', pizza: true });
  };
  const onKey = event => {
    const intent = keyIntent(event);
    // Down belongs to the frame's menu, including while a piece or pizza has focus.
    if (!['left', 'right'].includes(intent)) return;
    const give = event.target.closest?.('.pizza-give');
    if (!give) return;
    event.preventDefault();
    focusGive(gridMove(Number(give.dataset.give), intent, 4, 4));
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('focusin', onFocus);
  host.append(root);
  return {
    update(state) {
      const r = pizzaReport(state), ready = pizzaReady(state), piece = pieceUnits(state);
      total.textContent = `${state.slices} slices · 4 friends`;
      equation.textContent = `${state.slices} ÷ 4 = ${ready ? shareText(r.share) : '?'}`;
      equation.classList.toggle('pizza-equation--ready', ready);
      const left = state.halves ? `${r.remaining} of ${state.slices * 2} halves` : `${r.remainingWhole} of ${state.slices} slices`;
      board.setAttribute('aria-label', `Pizza, ${left} left${state.grade >= 5 && !state.halves && r.remaining > 0 ? '. Tap to cut the leftovers in half' : ''}`);
      const count = (state.slices * 2) / piece, used = (state.slices * 2 - r.remaining) / piece;
      const art = pizzaArt(state.slices, state.halves);
      wedges.forEach(({ node, layers }, j) => {
        node.setAttribute('visibility', j >= used && j < count ? 'visible' : 'hidden');
        if (art !== previousArt) layers.forEach(([tone, path]) => path.setAttribute('d', art[j]?.[tone] ?? ''));
      });
      previousArt = art;
      gives.forEach(({ button, count: chip, idle, joy, worry }, i) => {
        const units = state.plates[i], friend = FRIENDS[i];
        chip.textContent = shareText(units);
        button.setAttribute('aria-label', `Give ${friend.name} a ${state.halves ? 'half' : 'slice'}. ${friend.name} has ${shareText(units)}.`);
        idle.hidden = ready; joy.hidden = !ready;
        worry.hidden = !(state.tried && !r.equal && units === r.fewest.units);
        button.classList.toggle('pizza-give--ready', ready);
        if (previous !== state) {
          button.classList.remove('pizza-give--got');
          if (previous && units > previous.plates[i]) {
            void button.offsetWidth;
            button.classList.add('pizza-give--got');
          }
        }
        const visible = Math.ceil(units / 2);
        pieces[i].forEach((b, j) => {
          if (j >= visible && doc.activeElement === b) focusGive(i);
          b.hidden = j >= visible;
          const half = j === visible - 1 && units % 2 === 1;
          b.classList.toggle('pizza-piece--half', half);
          b.dataset.units = half ? '1' : '2';
          b.setAttribute('aria-label', `Take a ${half ? 'half' : 'slice'} back from ${friend.name}`);
        });
      });
      previous = state;
    },
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('focusin', onFocus);
      root.remove();
    },
  };
}

export default {
  kind: 'math', title: 'Taro’s pizza party', rewardLabel: 'Pizza party',
  help: helpFor(3), helpFor,
  notReadyLine: LINES.changed,
  start(snapshot, { grade = 3, chapter = 1 } = {}) {
    const saved = snapshot?.kind === 'math' && snapshot.activity === 'pizza' ? snapshot : null;
    return { state: normalizePizza(saved, grade, chapter), ui: {} };
  },
  opening: pizzaOpening,
  commands(state) {
    return [
      { id: 'new', label: 'New pizza', art: PIZZA_GLYPH },
      { id: 'take', label: 'Take back', icon: 'undo', disabled: state.plates.every(n => n === 0) },
      { id: 'try', label: 'Dig in!', icon: 'people' },
      { id: 'finish', label: 'Serve pizza', icon: 'check', finish: true, disabled: !pizzaReady(state) },
    ];
  },
  act, mountField,
};
