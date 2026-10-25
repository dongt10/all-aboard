import {
  FRIENDS, PIZZA_CUTS, PIZZA_LINES, normalizePizza, pizzaReady, pizzaOpening,
  pieceUnits, remainingUnits, pizzaReport, shareText, sectorPath, tryLine, giveLine, takeLine, newLine, cutLine,
} from '../../pizza.js';
import { figureMarkup } from '../figures/index.js';
import { gridMove, keyIntent } from '../input.js';
import { INK, PAPER_SHADE, LANTERN, VERMILION } from '../palette.js';

export const LINES = PIZZA_LINES;
export const PIZZA_GLYPH = '<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M11 2a10 10 0 0 0-9 9h9zM13 2v9h9a10 10 0 0 0-9-9zM2 13a10 10 0 0 0 20 0z"/></svg>';
const validPlate = i => Number.isInteger(i) && i >= 0 && i < 4;

function changePlate(state, ui, i, giving) {
  if (!validPlate(i)) return { state, ui };
  const piece = pieceUnits(state);
  if (giving && remainingUnits(state) < piece) return { state, ui, line: LINES.pizzaEmpty };
  if (!giving && state.plates[i] < piece) return { state, ui };
  const plates = state.plates.map((n, at) => at === i ? n + (giving ? piece : -piece) : n);
  const next = { ...state, plates, tried: false };
  return { state: next, ui, line: giving ? giveLine(next, i, state.tried) : takeLine(next, state.tried) };
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
  if (fields[0] === 'take') return changePlate(state, ui, action.take, false);
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
    <button type="button" class="pizza-board"><svg viewBox="0 0 160 160" aria-hidden="true">
      <circle cx="80" cy="80" r="78" fill="${PAPER_SHADE}" stroke="${INK}" stroke-width="2"/>
      ${Array.from({ length: 24 }, () => `<g class="pizza-wedge"><path class="pizza-crust" fill="${LANTERN}" stroke="${INK}"/><path class="pizza-cheese" fill="#f4bf4f"/><circle class="pizza-pepper" r="4" fill="${VERMILION}"/></g>`).join('')}
    </svg></button>
    <div class="pizza-plank" aria-hidden="true"></div><i class="pizza-wheel pizza-wheel--left" aria-hidden="true"></i><i class="pizza-wheel pizza-wheel--right" aria-hidden="true"></i>
    <div class="pizza-ground" aria-hidden="true"></div>
    <div class="pizza-friends" role="group" aria-label="Four friends and their plates"></div>`;
  const friends = root.querySelector('.pizza-friends');
  const board = root.querySelector('.pizza-board');
  const total = root.querySelector('.pizza-total');
  const equation = root.querySelector('.pizza-equation');
  const wedges = [...root.querySelectorAll('.pizza-wedge')].map(node => ({ node,
    crust: node.querySelector('.pizza-crust'), cheese: node.querySelector('.pizza-cheese'), pepper: node.querySelector('.pizza-pepper'),
  }));
  const gives = FRIENDS.map((friend, i) => {
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'pizza-give'; button.dataset.give = String(i);
    button.tabIndex = i === 0 ? 0 : -1;
    button.innerHTML = `<span class="pizza-name">${friend.name}</span><span class="pizza-idle">${figureMarkup(friend.id, { scale: 1 })}</span><span class="pizza-joy" hidden>${figureMarkup(friend.id, { pose: 'joy', scale: 1 })}</span><span class="pizza-plate"><span class="pizza-count"></span></span><span class="pizza-worry" aria-hidden="true" hidden>!</span>`;
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
      button.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path class="pizza-piece-whole" d="M10 18 2 3Q10-1 18 3Z"/><path class="pizza-piece-half" d="M10 18 10 1Q14 1 18 3Z"/><circle cx="12" cy="7" r="1.8" fill="${VERMILION}" stroke="none"/></svg>`;
      group.append(button); return button;
    });
  });
  let cursor = 0, previous = null;
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
    else if (take && !take.hidden) dispatch({ type: 'field', take: Number(take.dataset.take) });
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
      board.setAttribute('aria-label', `Pizza, ${left} left${state.grade >= 5 ? '. Tap to cut the leftovers in half' : ''}`);
      const count = (state.slices * 2) / piece, used = (state.slices * 2 - r.remaining) / piece, angle = 360 / count;
      wedges.forEach(({ node, crust, cheese, pepper }, j) => {
        node.setAttribute('visibility', j >= used && j < count ? 'visible' : 'hidden');
        node.setAttribute('transform', `rotate(${j * angle} 80 80)`);
        crust.setAttribute('d', sectorPath(80, 80, 76, angle));
        crust.setAttribute('stroke-width', state.halves ? '1' : '2');
        cheese.setAttribute('d', sectorPath(80, 80, 67, angle));
        cheese.setAttribute('stroke', INK);
        cheese.setAttribute('stroke-width', state.halves ? '1' : '2');
        pepper.setAttribute('cx', String(80 + 47 * Math.sin(angle * Math.PI / 360)));
        pepper.setAttribute('cy', String(80 - 47 * Math.cos(angle * Math.PI / 360)));
      });
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
          b.classList.toggle('pizza-piece--half', j === visible - 1 && units % 2 === 1);
          b.setAttribute('aria-label', `Take a ${state.halves ? 'half' : 'slice'} back from ${friend.name}`);
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
  help: [
    'New pizza picks the slices. Tap a friend to give one.',
    'Tap a slice on a plate to take it back.',
    'Choose Dig in! to check the shares.',
    'When all four match, choose Serve pizza.',
  ],
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
