import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';
import { INK, PAPER, PAPER_SHADE, WOOD, VERMILION, LANTERN } from '../palette.js';
import {
  helpSetFor, JOB_SHORT, HELPDAY_LINES,
  normalizeHelpday, helpdayReady, helpdayOpening, helpDayFitCount, helpDayNextJob,
  assignHelper, undoAssignment, helperAt, jobOfHelper, helperById, fits,
} from '../../helpday.js';

export const HELP = [
  'Tap a helper, then tap a job on the board.',
  'A check means it fits. A question mark means try again.',
  'Choose Ask or Next job if you are stuck.',
  'When all four jobs fit, choose Start day.',
];
export const GLYPHS = {
  lantern: 'M9 2h6v2h3v2h2v12h-2v2h-5v3h-2v-3H6v-2H4V6h2V4h3z',
  gate: 'M2 2h3v1h14V2h3v5h-3v15h-4V12H9v10H5V7H2z',
  envelope: 'M2 4h20v16H2z',
  pot: 'M5 3h14v2h3v3H2V5h3zM1 10h22v4h-3v7H4v-7H1z',
  book: 'M1 3h9v2h4V3h9v18h-9v2h-4v-2H1z',
  brush: 'M17 1h5v6h-2v3h-2v3h-3v4h-2v4h-3v2H1v-4h3v-5h3v-2h5V9h2V6h3z',
  pen: 'M17 1h5v6h-2v3h-2v3h-2v3h-2v3h-3v3H2v-6h3v-3h2v-3h2V7h3V4h5z',
};
// Filled pixel silhouettes keep the one-pixel edge intact when the 24px art is shown at 20px.
const pixel = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
function glyph(name) {
  const art = {
    lantern: `<path d="${GLYPHS.lantern}" fill="${INK}"/>`
      + pixel(7, 5, 10, 14, VERMILION) + pixel(5, 7, 14, 10, VERMILION)
      + pixel(7, 6, 3, 10, '#ff8a61') + pixel(10, 6, 5, 2, '#ff8a61')
      + pixel(16, 8, 3, 9, '#a72f35') + pixel(8, 17, 9, 2, '#a72f35')
      + pixel(11, 7, 1, 10, LANTERN) + pixel(7, 11, 10, 1, '#a72f35')
      + pixel(10, 3, 4, 1, LANTERN) + pixel(11, 20, 1, 2, LANTERN),
    gate: `<path d="${GLYPHS.gate}" fill="${INK}"/>`
      + pixel(3, 4, 18, 2, VERMILION) + pixel(4, 4, 16, 1, '#ff8a61')
      + pixel(6, 7, 2, 14, VERMILION) + pixel(16, 7, 2, 14, VERMILION)
      + pixel(6, 7, 1, 12, '#ff8a61') + pixel(17, 7, 1, 14, '#a72f35')
      + pixel(6, 9, 12, 2, VERMILION) + pixel(9, 9, 6, 1, '#ff8a61')
      + pixel(6, 19, 2, 2, '#a72f35') + pixel(5, 21, 4, 1, INK) + pixel(15, 21, 4, 1, INK),
    envelope: `<path d="${GLYPHS.envelope}" fill="${INK}"/>`
      + pixel(3, 5, 18, 14, PAPER) + pixel(3, 5, 18, 1, '#ffffff')
      + pixel(3, 6, 1, 12, '#ffffff') + pixel(19, 7, 2, 12, PAPER_SHADE) + pixel(4, 17, 17, 2, PAPER_SHADE)
      + `<path d="M3 6h3v2h3v2h6V8h3V6h3v1h-2v2h-3v2H8V9H5V7H3z" fill="${INK}"/>`
      + pixel(10, 11, 4, 4, INK) + pixel(11, 12, 2, 2, VERMILION) + pixel(11, 12, 1, 1, '#ff8a61'),
    drum: pixel(3, 5, 18, 15, INK) + pixel(5, 3, 14, 19, INK)
      + pixel(4, 7, 16, 12, WOOD) + pixel(6, 4, 12, 2, PAPER) + pixel(4, 6, 16, 2, PAPER_SHADE)
      + pixel(4, 8, 3, 10, '#dca372') + pixel(17, 8, 3, 11, '#885036')
      + pixel(6, 19, 12, 2, '#885036') + pixel(5, 8, 14, 1, INK) + pixel(5, 18, 14, 1, INK)
      + pixel(7, 9, 1, 9, PAPER) + pixel(12, 9, 1, 9, PAPER) + pixel(17, 9, 1, 9, PAPER_SHADE)
      + pixel(7, 4, 8, 1, '#ffffff'),
    pot: `<path d="${GLYPHS.pot}" fill="${INK}"/>`
      + pixel(6, 4, 12, 2, PAPER_SHADE) + pixel(3, 6, 18, 1, PAPER)
      + pixel(5, 11, 14, 9, VERMILION) + pixel(5, 11, 3, 8, '#ff8a61')
      + pixel(16, 12, 3, 8, '#a72f35') + pixel(2, 11, 2, 2, PAPER_SHADE) + pixel(20, 11, 2, 2, PAPER_SHADE),
    book: `<path d="${GLYPHS.book}" fill="${INK}"/>`
      + pixel(2, 4, 7, 16, PAPER) + pixel(15, 4, 7, 16, PAPER_SHADE)
      + pixel(10, 6, 4, 16, WOOD) + pixel(11, 7, 2, 14, '#dca372')
      + pixel(3, 7, 5, 1, INK) + pixel(3, 10, 5, 1, INK) + pixel(3, 13, 4, 1, INK)
      + pixel(16, 7, 5, 1, INK) + pixel(16, 10, 5, 1, INK) + pixel(16, 13, 4, 1, INK),
    brush: `<path d="${GLYPHS.brush}" fill="${INK}"/>`
      + pixel(18, 2, 3, 4, WOOD) + pixel(16, 6, 3, 3, WOOD) + pixel(14, 9, 3, 3, WOOD)
      + pixel(12, 12, 3, 3, PAPER_SHADE) + pixel(7, 14, 5, 5, VERMILION)
      + pixel(5, 17, 5, 4, VERMILION) + pixel(2, 20, 5, 2, '#a72f35') + pixel(8, 15, 2, 3, '#ff8a61'),
    pen: `<path d="${GLYPHS.pen}" fill="${INK}"/>`
      + pixel(18, 2, 3, 4, LANTERN) + pixel(16, 5, 3, 4, '#51a2a2')
      + pixel(13, 8, 3, 4, '#51a2a2') + pixel(10, 11, 3, 4, '#51a2a2')
      + pixel(7, 14, 3, 4, '#51a2a2') + pixel(4, 17, 3, 3, PAPER) + pixel(3, 20, 2, 1, LANTERN),
  };
  return `<svg${name === 'drum' ? ' class="icon"' : ''} viewBox="0 0 24 24" width="24" height="24" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${art[name]}</svg>`;
}
const selected = (ui, grade) => helpSetFor(grade).helpers.find(person => person.id === ui?.helper) ?? helpSetFor(grade).helpers[0];

// This label is shared by the field and the grade-5 accessibility test.
export function helperLabel(state, helper, grade = state?.grade) {
  const person = selected({ helper }, grade);
  const job = jobOfHelper(state, person.id);
  return `${person.name}${grade === 5 ? '' : `, ${person.strength.toLowerCase()}`}. On ${job ? JOB_SHORT[job] : 'the bench'}.`;
}

function act(state, ui, action) {
  const set = helpSetFor(state.grade);
  const helper = selected(ui, state.grade).id;
  if (action?.type === 'field') {
    if (set.helperIds.includes(action.helper)) return {
      state, ui: action.helper === helper ? ui : { ...ui, helper: action.helper },
      line: HELPDAY_LINES.pick(action.helper),
    };
    if (set.jobIds.includes(action.job)) {
      const result = assignHelper(state, action.job, helper);
      const line = result.status === 'same' ? HELPDAY_LINES.same(action.job, helper)
        : result.status === 'mismatch' ? HELPDAY_LINES.mismatch(action.job, helper)
          : HELPDAY_LINES.fit(action.job) + (helpdayReady(result.state) ? ` ${HELPDAY_LINES.allSet}` : '');
      return { state: result.state, ui, line };
    }
  }
  if (action?.type === 'command') {
    if (action.id === 'ask') return { state, ui, line: HELPDAY_LINES.ask(helper) };
    if (action.id === 'next') return { state, ui, line: HELPDAY_LINES.next(helpDayNextJob(state)) };
    if (action.id === 'undo') {
      const result = undoAssignment(state);
      return result.helper ? { state: result.state, ui,
        line: HELPDAY_LINES.undo(result.helper, result.state) + (helpdayReady(result.state) ? ` ${HELPDAY_LINES.allSet}` : ''),
      } : { state, ui };
    }
  }
  return { state, ui };
}

function mountField(host, { grade = 3, dispatch = () => {} } = {}) {
  const set = helpSetFor(grade);
  let cursor = 0;
  const root = document.createElement('div');
  root.className = 'helpday-field';
  root.innerHTML = `<div class="helpday-board"><div class="helpday-header"><span class="px-chip helpday-count"></span></div><div class="helpday-grid" role="group" aria-label="Help Day jobs, 2 by 2"></div></div><div class="helpday-bench" role="radiogroup" aria-label="Helpers"></div>`;
  const grid = root.querySelector('.helpday-grid');
  const bench = root.querySelector('.helpday-bench');
  const count = root.querySelector('.helpday-count');
  const jobs = set.jobs.map((job, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'helpday-job';
    button.dataset.job = job.id;
    button.tabIndex = i === 0 ? 0 : -1;
    button.innerHTML = `<span class="helpday-job-heading"><span class="helpday-glyph">${glyph(job.glyph)}</span><span class="helpday-job-name"></span></span><span class="helpday-job-body"><span class="helpday-need"></span><span class="helpday-slot"><span class="helpday-figure"></span><span class="helpday-badge" aria-hidden="true" hidden></span></span></span>`;
    button.querySelector('.helpday-job-name').textContent = job.name;
    button.querySelector('.helpday-need').textContent = job.need;
    grid.append(button);
    return { button, figure: button.querySelector('.helpday-figure'), badge: button.querySelector('.helpday-badge'), who: null };
  });
  const helpers = set.helpers.map(person => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'helpday-helper';
    button.dataset.helper = person.id;
    button.setAttribute('role', 'radio');
    button.innerHTML = `${figureMarkup(person.figure, { scale: 0.75 })}<span class="helpday-helper-words"><span class="helpday-helper-name"></span><span class="helpday-strength"></span><span class="helpday-at" hidden></span></span>`;
    button.querySelector('.helpday-helper-name').textContent = person.name;
    button.querySelector('.helpday-strength').textContent = person.strength;
    button.querySelector('.helpday-strength').hidden = grade === 5;
    bench.append(button);
    return { button, at: button.querySelector('.helpday-at') };
  });
  function focusJob(index, focus = true) {
    jobs[cursor].button.tabIndex = -1;
    cursor = index;
    jobs[cursor].button.tabIndex = 0;
    if (focus) jobs[cursor].button.focus();
  }
  const onFocus = event => {
    const job = event.target.closest?.('.helpday-job');
    if (job) focusJob(set.jobIds.indexOf(job.dataset.job), false);
  };
  const onClick = event => {
    const job = event.target.closest?.('.helpday-job');
    if (job) { focusJob(set.jobIds.indexOf(job.dataset.job)); dispatch({ type: 'field', job: job.dataset.job }); return; }
    const helper = event.target.closest?.('.helpday-helper');
    if (helper) dispatch({ type: 'field', helper: helper.dataset.helper });
  };
  const onKey = event => {
    const intent = keyIntent(event);
    if (!['up', 'down', 'left', 'right'].includes(intent)) return;
    if (event.target.closest?.('.helpday-job')) {
      const next = gridMove(cursor, intent, 2, 4);
      if (next === cursor && intent === 'down') return;
      event.preventDefault();
      if (next !== cursor) focusJob(next);
    } else {
      const helper = event.target.closest?.('.helpday-helper');
      if (!helper) return;
      const at = set.helperIds.indexOf(helper.dataset.helper);
      const next = gridMove(at, intent === 'left' ? 'up' : intent === 'right' ? 'down' : intent, 1, 4);
      if (next === at && intent === 'down') return;
      event.preventDefault();
      if (next !== at) { helpers[next].button.focus(); dispatch({ type: 'field', helper: set.helperIds[next] }); }
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('focusin', onFocus);
  host.append(root);
  return {
    update(state, ui) {
      const chosen = selected(ui, grade);
      count.textContent = `Help Day · ${helpDayFitCount(state)} of 4`;
      jobs.forEach((part, i) => {
        const job = set.jobs[i], who = helperById(helperAt(state, job.id));
        part.button.dataset.fit = who ? (fits(job.id, who.id, grade) ? 'yes' : 'no') : '';
        part.button.dataset.filled = String(Boolean(who));
        part.button.setAttribute('aria-label', who
          ? `${job.description}, ${job.needSays}. ${who.name} is here, ${fits(job.id, who.id, grade) ? 'it fits' : 'try again'}.`
          : `${job.description}, ${job.needSays}, empty. Send ${chosen.name} here.`);
        // Only a changed occupant replaces the sprite; the card and its focus persist.
        if (part.who !== (who?.id ?? null)) {
          part.figure.innerHTML = who ? figureMarkup(who.figure, { scale: 0.75 }) : '';
          part.who = who?.id ?? null;
        }
        part.badge.hidden = !who;
        const badge = who && fits(job.id, who.id, grade) ? icon('check', { size: 20 }) : '?';
        if (part.badge.innerHTML !== badge) part.badge.innerHTML = badge;
      });
      helpers.forEach(({ button, at }, i) => {
        const person = set.helpers[i], job = jobOfHelper(state, person.id), on = person.id === chosen.id;
        button.setAttribute('aria-checked', String(on));
        button.setAttribute('aria-label', helperLabel(state, person.id, grade));
        button.tabIndex = on ? 0 : -1;
        button.dataset.assigned = String(Boolean(job));
        at.hidden = !job;
        at.textContent = job ? set.jobs.find(item => item.id === job).at : '';
      });
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
  kind: 'community', title: 'Hana’s Help Day', help: HELP,
  notReadyLine: HELPDAY_LINES.notReady, rewardLabel: 'Help Day team',
  start(snapshot, { grade = 3, chapter = 1 } = {}) {
    const input = snapshot?.kind === 'community' && snapshot.activity === 'helpday' ? snapshot : {};
    const state = normalizeHelpday(input, grade, chapter);
    return { state, ui: { helper: helpSetFor(state.grade).helperIds[0] } };
  },
  opening: helpdayOpening,
  commands(state, ui) {
    return [
      { id: 'ask', label: `Ask ${selected(ui, state.grade).name}`, icon: 'people' },
      { id: 'next', label: 'Next job', icon: 'help' },
      { id: 'undo', label: 'Undo', icon: 'undo', disabled: state.crew.length === 0 },
      { id: 'finish', label: 'Start day', icon: 'check', finish: true, disabled: !helpdayReady(state) },
    ];
  },
  act, mountField,
};
