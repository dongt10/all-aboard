import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { gridMove, keyIntent } from '../input.js';
import {
  HELP_JOBS, HELP_HELPERS, JOB_IDS, HELPER_IDS, JOB_SHORT, HELPDAY_LINES,
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
  lantern: 'M9 2h6v2H9zM6 4h12v2H6zM4 6h16v12H4zM6 18h12v2H6zM11 20h2v3h-2z',
  gate: 'M2 3h20v3H2zM5 6h3v16H5zm11 0h3v16h-3zM3 9h18v3H3z',
  envelope: 'M2 4h20v2H2zM2 18h20v2H2zM2 6h2v12H2zm18 0h2v12h-2zM4 6h3v2H4zm3 2h3v2H7zm3 2h4v2h-4zm4-2h3v2h-3zm3-2h3v2h-3z',
};
const glyph = name => name === 'drum' ? icon('crate')
  : `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="${GLYPHS[name]}"/></svg>`;
const selected = ui => helperById(ui?.helper) ?? HELP_HELPERS[0];

// This label is shared by the field and the grade-5 accessibility test.
export function helperLabel(state, helper, grade = state?.grade) {
  const person = helperById(helper) ?? HELP_HELPERS[0];
  const job = jobOfHelper(state, person.id);
  return `${person.name}${grade === 5 ? '' : `, ${person.strength.toLowerCase()}`}. On ${job ? JOB_SHORT[job] : 'the bench'}.`;
}

function act(state, ui, action) {
  const helper = selected(ui).id;
  if (action?.type === 'field') {
    if (HELPER_IDS.includes(action.helper)) return {
      state, ui: action.helper === helper ? ui : { ...ui, helper: action.helper },
      line: HELPDAY_LINES.pick(action.helper),
    };
    if (JOB_IDS.includes(action.job)) {
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
      return result.helper ? { state: result.state, ui, line: HELPDAY_LINES.undo(result.helper) } : { state, ui };
    }
  }
  return { state, ui };
}

function mountField(host, { grade = 3, dispatch = () => {} } = {}) {
  let cursor = 0;
  const root = document.createElement('div');
  root.className = 'helpday-field';
  root.innerHTML = `<div class="helpday-board"><div class="helpday-header"><span class="px-chip helpday-count"></span></div><div class="helpday-grid" role="group" aria-label="Help Day jobs, 2 by 2"></div></div><div class="helpday-bench" role="radiogroup" aria-label="Helpers"></div>`;
  const grid = root.querySelector('.helpday-grid');
  const bench = root.querySelector('.helpday-bench');
  const count = root.querySelector('.helpday-count');
  const jobs = HELP_JOBS.map((job, i) => {
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
  const helpers = HELP_HELPERS.map(person => {
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
    if (job) focusJob(JOB_IDS.indexOf(job.dataset.job), false);
  };
  const onClick = event => {
    const job = event.target.closest?.('.helpday-job');
    if (job) { focusJob(JOB_IDS.indexOf(job.dataset.job)); dispatch({ type: 'field', job: job.dataset.job }); return; }
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
      const at = HELPER_IDS.indexOf(helper.dataset.helper);
      const next = gridMove(at, intent === 'left' ? 'up' : intent === 'right' ? 'down' : intent, 1, 4);
      if (next === at && intent === 'down') return;
      event.preventDefault();
      if (next !== at) { helpers[next].button.focus(); dispatch({ type: 'field', helper: HELPER_IDS[next] }); }
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('focusin', onFocus);
  host.append(root);
  return {
    update(state, ui) {
      const chosen = selected(ui);
      count.textContent = `Help Day · ${helpDayFitCount(state)} of 4`;
      jobs.forEach((part, i) => {
        const job = HELP_JOBS[i], who = helperById(helperAt(state, job.id));
        part.button.dataset.fit = who ? (fits(job.id, who.id) ? 'yes' : 'no') : '';
        part.button.dataset.filled = String(Boolean(who));
        part.button.setAttribute('aria-label', who
          ? `${job.description}, ${job.needSays}. ${who.name} is here, ${fits(job.id, who.id) ? 'it fits' : 'try again'}.`
          : `${job.description}, ${job.needSays}, empty. Send ${chosen.name} here.`);
        // Only a changed occupant replaces the sprite; the card and its focus persist.
        if (part.who !== (who?.id ?? null)) {
          part.figure.innerHTML = who ? figureMarkup(who.figure, { scale: 0.75 }) : '';
          part.who = who?.id ?? null;
        }
        part.badge.hidden = !who;
        const badge = who && fits(job.id, who.id) ? icon('check', { size: 20 }) : '?';
        if (part.badge.innerHTML !== badge) part.badge.innerHTML = badge;
      });
      helpers.forEach(({ button, at }, i) => {
        const person = HELP_HELPERS[i], job = jobOfHelper(state, person.id), on = person.id === chosen.id;
        button.setAttribute('aria-checked', String(on));
        button.setAttribute('aria-label', helperLabel(state, person.id, grade));
        button.tabIndex = on ? 0 : -1;
        button.dataset.assigned = String(Boolean(job));
        at.hidden = !job;
        at.textContent = job ? `At: ${HELP_JOBS.find(item => item.id === job).at}` : '';
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
    return { state: normalizeHelpday(input, grade, chapter), ui: { helper: 'kiko' } };
  },
  opening: helpdayOpening,
  commands(state, ui) {
    return [
      { id: 'ask', label: `Ask ${selected(ui).name}`, icon: 'people' },
      { id: 'next', label: 'Next job', icon: 'help' },
      { id: 'undo', label: 'Undo', icon: 'undo', disabled: state.crew.length === 0 },
      { id: 'finish', label: 'Start day', icon: 'check', finish: true, disabled: !helpdayReady(state) },
    ];
  },
  act, mountField,
};
