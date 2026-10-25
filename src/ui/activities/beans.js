import {
  BED_TILES, TRAY_TILES, CHANGES, TILE_NAMES, LINES, normalizeBeans, beansReady, beansOpening,
  chooseChange, waitWeek, toggleTile, testDone, cupState, nextStepLine, beanGlyphMarkup,
} from '../../beans.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';
import { INK, PAPER, PAPER_SHADE, WOOD, LANTERN, GRASS, GRASS_DARK } from '../palette.js';

export { LINES };
export const HELP = [
  'Tap one change for cup B: No water or Dark box.',
  'Choose Wait a week two times. Watch both cups.',
  'Tap the tiles a plant needs into the bed card.',
  'Fill the bed, then choose Plant bed.',
];
const CHANGE_OPTIONS = [
  { id: 'water', name: 'No water', glyph: 'dry' },
  { id: 'dark', name: 'Dark box', glyph: 'dark' },
  { id: 'none', name: 'Same as A', glyph: 'same' },
];
const fresh = state => state.change === 'none' && state.weeks === 0 && state.bed.length === 0;
const glyph = tile => `<svg viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${beanGlyphMarkup(tile)}</svg>`;
const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

// The windowsill keeps the ice stand's familiar sun, with a transparent edge.
const SUN_ART = `<svg viewBox="0 0 40 40" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`
  + rect(17, 0, 6, 40, INK) + rect(18, 1, 4, 38, LANTERN) + rect(18, 1, 1, 38, '#ffe08f')
  + rect(21, 1, 1, 38, '#d99a30') + rect(0, 17, 40, 6, INK) + rect(1, 18, 38, 4, LANTERN)
  + rect(1, 18, 38, 1, '#ffe08f') + rect(1, 21, 38, 1, '#d99a30')
  + `<path d="M12 8H28V12H32V28H28V32H12V28H8V12H12Z" fill="${INK}"/>`
  + `<path d="M13 9H27V13H31V27H27V31H13V27H9V13H13Z" fill="${LANTERN}"/>`
  + rect(13, 9, 14, 3, '#ffe08f') + rect(9, 13, 3, 14, '#ffe08f')
  + rect(28, 13, 3, 14, '#d99a30') + rect(13, 28, 14, 3, '#d99a30') + rect(14, 14, 4, 4, PAPER)
  + [[4, 4], [34, 4], [4, 34], [34, 34]].map(([x, y]) => rect(x, y, 3, 3, INK) + rect(x + 1, y + 1, 1, 1, LANTERN)).join('') + '</svg>';

// All growth pictures are built once. A week only changes which group is visible.
const stem = (x, y, h, color = GRASS_DARK) => rect(x, y, 4, h, INK) + rect(x + 1, y, 2, h, color);
const leaf = (x, y, right = false, color = GRASS) => `<g transform="translate(${x} ${y})">`
  + `<path d="${right ? 'M0 6h2V3h3V1h8v6h-3v3H6v2H0z' : 'M0 1h8v2h3v3h2v6H7v-2H3V7H0z'}" fill="${INK}"/>`
  + `<path d="${right ? 'M1 7h2V4h3V2h6v4H9v3H5v2H1z' : 'M1 2h6v2h3v3h2v4H8V9H4V6H1z'}" fill="${color}"/></g>`;
const CUP_STAGES = {
  seed: `<g transform="translate(24 29)">${beanGlyphMarkup('seed')}</g>`,
  sprout: stem(30, 28, 20) + leaf(18, 24) + leaf(33, 21, true),
  tall: stem(30, 9, 39) + leaf(18, 8) + leaf(33, 5, true) + leaf(18, 27) + leaf(33, 23, true),
  droop: stem(30, 24, 24) + rect(23, 23, 10, 4, INK) + rect(23, 24, 9, 2, GRASS_DARK)
    + rect(21, 26, 4, 9, INK) + rect(22, 26, 2, 8, GRASS_DARK) + leaf(13, 31, false, '#c2ac61'),
  pale1: stem(30, 26, 22, '#d8c88a') + leaf(18, 23, false, PAPER_SHADE) + leaf(33, 20, true, PAPER_SHADE),
  pale2: stem(30, 12, 36, '#d8c88a') + leaf(18, 12, false, PAPER_SHADE) + leaf(33, 9, true, PAPER_SHADE),
};
const CUP_ART = `<svg class="beans-plant" viewBox="0 0 64 64" width="64" height="64" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`
  + Object.entries(CUP_STAGES).map(([stage, drawing]) => `<g class="beans-growth" data-growth="${stage}" visibility="hidden">${drawing}</g>`).join('')
  + `<path d="M13 44h38v7h-3v11H16V51h-3z" fill="${INK}"/>`
  + rect(14, 45, 36, 5, WOOD) + rect(17, 50, 30, 11, PAPER_SHADE) + rect(17, 51, 3, 9, PAPER)
  + rect(44, 51, 3, 10, WOOD) + rect(18, 45, 27, 2, INK) + '</svg>';

function act(state, ui, action) {
  if (action?.type === 'command') {
    if (action.id === 'next') return { state, ui, line: nextStepLine(state) };
    if (action.id === 'reset') return {
      state: fresh(state) ? state : normalizeBeans(null, state.grade, state.chapter), ui, line: LINES.reset,
    };
    if (action.id === 'wait') {
      const next = waitWeek(state);
      const line = !CHANGES.includes(state.change) ? LINES.chooseFirst
        : next === state ? nextStepLine(state)
          : LINES[`week${next.weeks}${state.change === 'water' ? 'Water' : 'Dark'}`];
      return { state: next, ui, line };
    }
    return { state, ui };
  }
  if (action?.type !== 'field') return { state, ui };
  const fields = ['change', 'tile'].filter(key => Object.hasOwn(action, key));
  if (fields.length !== 1) return { state, ui };
  if (fields[0] === 'change') {
    const result = chooseChange(state, action.change);
    if (result.status === 'invalid') return { state, ui };
    const line = result.status === 'same' ? LINES.same : result.status === 'unchanged' ? nextStepLine(state)
      : `${result.status === 'restart' ? `${LINES.newTest} ` : ''}${action.change === 'water' ? LINES.changeWater : LINES.changeDark}`;
    return { state: result.state, ui, line };
  }
  if (!TRAY_TILES.includes(action.tile)) return { state, ui };
  const next = toggleTile(state, action.tile);
  const line = state.bed.includes(action.tile) ? LINES.removed(TILE_NAMES[action.tile].toLowerCase())
    : next !== state && next.bed.length === 4 ? beansReady(next) ? LINES.allFour : LINES.early
      : LINES[action.tile];
  return { state: next, ui, line };
}

export function fieldView(state) {
  const phase = beansReady(state) ? 'ready' : testDone(state) ? 'done' : state.change === 'none' ? 'choose' : 'running';
  const needsB = state.change === 'water' ? 'Sun, no water.' : state.change === 'dark' ? 'Water in a dark box.' : 'Sun and water.';
  const words = { seed: 'Seed', sprout: 'Sprout', tall: 'Tall', droop: 'Weak and drooping', pale: 'Weak and pale' };
  return {
    phase, week: `Week ${state.weeks} of 2`,
    cups: ['a', 'b'].map(id => {
      const growth = cupState(state, id), name = id === 'a' ? 'Cup A' : 'Cup B';
      return { id, name, growth, label: `${name}: ${words[growth]}. ${id === 'a' ? 'Sun and water.' : needsB}`,
        needs: id === 'a' || state.change === 'none' ? ['sun', 'water'] : state.change === 'water' ? ['sun', 'dry'] : ['dark', 'water'] };
    }),
    changes: CHANGE_OPTIONS.map(option => ({ ...option, checked: state.change === option.id })),
    bed: { title: 'Garden bed', label: `Garden bed, ${state.bed.length} of 4 tiles.`,
      slots: BED_TILES.map(tile => ({ tile, filled: state.bed.includes(tile), label: `${TILE_NAMES[tile]}, ${state.bed.includes(tile) ? 'in the bed' : 'empty'}.` })) },
    tray: TRAY_TILES.map(tile => ({ tile, name: TILE_NAMES[tile], pressed: state.bed.includes(tile),
      label: state.bed.includes(tile) ? `${TILE_NAMES[tile]} is in the bed. Tap to take it back.` : `${TILE_NAMES[tile]}. Tap to try it in the bed.` })),
  };
}

function mountField(host, { dispatch = () => {} } = {}) {
  const doc = host.ownerDocument ?? document;
  const root = doc.createElement('div');
  root.className = 'beans-field';
  root.innerHTML = `<span class="beans-sun">${SUN_ART}</span>`
    + `<span class="px-chip beans-clock">${icon('clock')}<span class="beans-week"></span></span>`
    + '<div class="beans-sill" aria-hidden="true"></div>'
    + ['a', 'b'].map(id => `<section class="beans-cup beans-cup--${id}" role="img"><span class="px-chip beans-cup-name">Cup ${id.toUpperCase()}</span>${CUP_ART}`
      + `<span class="beans-needs" aria-hidden="true">${['sun', 'water', 'dry', 'dark'].map(tile => `<span data-need="${tile}">${glyph(tile)}</span>`).join('')}</span></section>`).join('')
    + '<div class="beans-changes" role="radiogroup" aria-label="Change one thing for cup B">'
    + CHANGE_OPTIONS.map(option => `<button type="button" class="beans-change" role="radio" aria-checked="false" data-change="${option.id}"><span class="beans-change-pic">${glyph(option.glyph)}</span><span class="beans-change-name">${option.name}</span></button>`).join('') + '</div>'
    + '<section class="beans-bed" role="group"><span class="px-chip beans-bed-title">Garden bed</span><div class="beans-slots">'
    + BED_TILES.map(tile => `<span class="beans-slot" role="img" data-tile="${tile}"><span class="beans-slot-pic">${glyph(tile === 'seed' ? 'sprout' : tile)}</span></span>`).join('') + '</div></section>'
    + '<div class="beans-tray" role="group" aria-label="Garden tiles">'
    + TRAY_TILES.map(tile => `<button type="button" class="beans-tile" data-tile="${tile}" aria-pressed="false"><span class="beans-tile-pic">${glyph(tile)}</span><span class="beans-tile-name">${TILE_NAMES[tile]}</span><span class="beans-tile-mark" aria-hidden="true">${icon('check', { size: 16 })}</span></button>`).join('') + '</div>';
  const week = root.querySelector('.beans-week'), bed = root.querySelector('.beans-bed');
  const cups = [...root.querySelectorAll('.beans-cup')].map(node => ({ node,
    stages: [...node.querySelectorAll('.beans-growth')], needs: [...node.querySelectorAll('[data-need]')],
  }));
  const changes = [...root.querySelectorAll('.beans-change')], tiles = [...root.querySelectorAll('.beans-tile')];
  const slots = [...root.querySelectorAll('.beans-slot')];
  const groups = [changes, tiles], cursors = [0, 0];
  const location = target => {
    const button = target.closest?.('.beans-change, .beans-tile');
    const group = groups.findIndex(buttons => buttons.includes(button));
    return group < 0 ? null : { group, index: groups[group].indexOf(button), button };
  };
  function setCursor(group, index, focus = false) {
    cursors[group] = index;
    groups[group].forEach((button, i) => { button.tabIndex = i === index ? 0 : -1; });
    if (focus) groups[group][index].focus();
  }
  function choose(at) {
    setCursor(at.group, at.index, true);
    dispatch(at.group === 0 ? { type: 'field', change: at.button.dataset.change } : { type: 'field', tile: at.button.dataset.tile });
  }
  const onClick = event => { const at = location(event.target); if (at) choose(at); };
  const onFocus = event => { const at = location(event.target); if (at) setCursor(at.group, at.index); };
  const onKey = event => {
    const intent = keyIntent(event), at = location(event.target);
    if (!at || !['up', 'down', 'left', 'right'].includes(intent)) return;
    const direction = at.group === 0 ? intent === 'left' ? 'up' : intent === 'right' ? 'down' : intent : intent;
    const next = gridMove(at.index, direction, at.group === 0 ? 1 : 6, groups[at.group].length);
    if (next === at.index && intent === 'down') return;
    event.preventDefault();
    if (next !== at.index) {
      setCursor(at.group, next, true);
      if (at.group === 0) dispatch({ type: 'field', change: changes[next].dataset.change });
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('focusin', onFocus);
  groups.forEach((buttons, group) => setCursor(group, 0));
  host.append(root);
  return {
    update(state) {
      const view = fieldView(state);
      root.dataset.phase = view.phase;
      week.textContent = view.week;
      cups.forEach((cup, i) => {
        const v = view.cups[i], growth = v.growth === 'pale' ? `pale${state.weeks}` : v.growth;
        cup.node.setAttribute('aria-label', v.label);
        cup.node.dataset.growth = v.growth;
        cup.stages.forEach(stage => stage.setAttribute('visibility', stage.dataset.growth === growth ? 'visible' : 'hidden'));
        cup.needs.forEach(need => { need.hidden = !v.needs.includes(need.dataset.need); });
      });
      changes.forEach((button, i) => { button.setAttribute('aria-checked', String(view.changes[i].checked)); });
      bed.setAttribute('aria-label', view.bed.label);
      slots.forEach((slot, i) => {
        slot.classList.toggle('beans-slot--filled', view.bed.slots[i].filled);
        slot.setAttribute('aria-label', view.bed.slots[i].label);
        slot.querySelector('.beans-slot-pic').hidden = !view.bed.slots[i].filled;
      });
      tiles.forEach((button, i) => {
        button.setAttribute('aria-pressed', String(view.tray[i].pressed));
        button.setAttribute('aria-label', view.tray[i].label);
        button.querySelector('.beans-tile-mark').hidden = !view.tray[i].pressed;
      });
      groups.forEach((buttons, group) => setCursor(group, cursors[group]));
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
  kind: 'science', title: 'Momo’s bean test', rewardLabel: 'Garden bed card',
  help: HELP, notReadyLine: LINES.notReady,
  start(snapshot, { grade = 2, chapter = 1 } = {}) {
    const saved = snapshot?.kind === 'science' && snapshot.activity === 'beans' ? snapshot : null;
    return { state: normalizeBeans(saved, grade, chapter), ui: {} };
  },
  opening: beansOpening,
  commands(state) {
    return [
      { id: 'wait', label: 'Wait a week', icon: 'clock' },
      { id: 'next', label: 'Next step', icon: 'help' },
      { id: 'reset', label: 'Start over', icon: 'undo', disabled: fresh(state) },
      { id: 'finish', label: 'Plant bed', icon: 'check', finish: true, disabled: !beansReady(state) },
    ];
  },
  act, mountField,
};
