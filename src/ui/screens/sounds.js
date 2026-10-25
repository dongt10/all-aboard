import { openWindow } from '../window.js';
import { icon } from '../icons.js';
import { CAST } from '../../music.js';
import { patternsFor } from '../../audio.js';
import { MUSICIAN_COLORS, leadTrack, editorMode, setPattern, toggleBeat, cycleNote, noteLabel, patternGlyphs } from '../band.js';

// The Sounds window: one tab per musician, Tune 1 / Tune 2, the beat editor for the
// musicians who are not on the lanterns, and the volumes. Every row is counted so the window fits the
// 960×540 stage with Bigger words on. The pure helpers at the top run under node --test.

// Kindergarten sets a friend's volume with two buttons instead of a slider.
export const LEVELS = { loud: 1, soft: 0.45 };
export const levelOf = volume => (Number(volume) >= 0.7 ? 'loud' : 'soft');

// Staircase step for a lantern or score bar: a rest sits on the floor, Do one step up, La five steps up.
export const noteStep = note => (Number.isInteger(note) && note >= 0 ? Math.min(5, note + 1) : 0);

export const LEAD_LINES = {
  percussion: 'Edit Cricket’s rhythm on the lanterns.',
  melody: 'Edit Kiko’s tune on the lanterns.',
};
export const leadLine = id => LEAD_LINES[id] ?? null;

const HINTS = {
  none: 'Pick a tune. Then loud or soft.',
  beats: 'Tap a beat for a sound or a rest.',
  notes: 'Tap a beat to climb up and down.',
};
const gradeNumber = grade => (grade === 'k' || grade === 'K' ? 0 : Number(grade) || 0);

// What one musician's tab shows at a grade. editor: 'lead' (the lanterns edit this friend, so only a line
// here and no Tune buttons, which would wipe the lantern work), 'none' (K: no beat grid), 'beats' (sound
// or rest toggles) or 'notes' (the staircase). level: 'buttons' (K: Loud / Soft) or 'slider'.
export function soundsPlan(grade, trackId) {
  const g = gradeNumber(grade);
  const editor = trackId === leadTrack(g) ? 'lead' : g <= 0 ? 'none' : editorMode(g, trackId);
  return { editor, level: g <= 0 ? 'buttons' : 'slider' };
}
export const hintLine = (c, plan) => (plan.editor === 'lead' ? leadLine(c.id) : `${c.name}: ${HINTS[plan.editor]}`);

// Kiko's one-line reaction to each edit in the window. Every line is 56 characters or fewer (one page
// with Bigger words on). The tune swap only takes hold when the song comes back to beat 1.
export const tuneLine = p => `Tune ${p + 1}! It starts when the song comes back to beat 1.`;
export const beatLine = (beat, note, editor) => `Beat ${beat + 1} is ${editor === 'notes' ? noteLabel(note) : note === null ? 'a rest' : 'a sound'} now.`;
export const levelLine = (name, level) => `${name} plays ${level === 'loud' ? 'loud' : 'soft'} now.`;

// Row heights with Bigger words on, the same numbers as the budget in sounds.css. A beat button is pixel
// number 20 + word 24 + padding and border 12 = 56; the staircase adds La's 40px step (grid tracks size by
// the margin box). The body must stay under about 400px: 540 stage - 48 backdrop - 24 frame - 52 head - 10 gap.
export const ROW_HEIGHTS = { tabs: 44, hint: 31, tunes: 60, beats: 56, stairs: 96, buttons: 48, slider: 32, gap: 8 };
export const BODY_BUDGET = 400;
export function soundsHeight(grade, trackId) {
  const plan = soundsPlan(grade, trackId), h = ROW_HEIGHTS;
  const rows = [h.tabs, h.hint, plan.editor === 'lead' ? 0 : h.tunes, plan.editor === 'beats' ? h.beats : plan.editor === 'notes' ? h.stairs : 0, plan.level === 'buttons' ? h.buttons : h.slider, h.slider].filter(Boolean);
  return rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * h.gap;
}

const castOf = id => CAST.find(c => c.id === id) ?? CAST[0];
const trackOf = (band, id) => band.tracks.find(t => t.id === id) ?? band.tracks[0];

// A Tune button is pressed only while the track still plays that preset; once a beat is edited, neither is.
export const playsPattern = (track, p, preset = 'meadow') => track.pattern === p && Array.isArray(track.notes) && track.notes.every((n, i) => n === (patternsFor(preset)[track.id]?.[p] ?? [])[i]);

function patternsMarkup(id, track, band) {
  return `<div class="sounds-patterns" role="group" aria-label="Tune">${[0, 1].map(p => {
    const on = playsPattern(track, p, band);
    return `<button type="button" class="px-button sounds-pattern" data-pattern="${p}" aria-pressed="${on}">${icon(on ? 'check' : 'music', { size: 20 })}<span class="sounds-pattern__text"><span>Tune ${p + 1}</span><small aria-hidden="true">${patternGlyphs(id, p, band)}</small></span></button>`;
  }).join('')}</div>`;
}
function beatsMarkup(track, mode) {
  const beats = track.notes.map((n, i) => (mode === 'notes'
    ? `<button type="button" class="sounds-beat sounds-beat--note${n === null ? '' : ' is-on'}" data-beat="${i}" style="--step:${noteStep(n)}" aria-label="Beat ${i + 1}: ${noteLabel(n)}. Tap for the next note."><b>${i + 1}</b><span>${noteLabel(n)}</span></button>`
    : `<button type="button" class="sounds-beat${n === null ? '' : ' is-on'}" data-beat="${i}" aria-pressed="${n !== null}" aria-label="Beat ${i + 1}: ${n === null ? 'rest' : 'sound'}"><b>${i + 1}</b><span>${n === null ? '– rest' : '♪ sound'}</span></button>`)).join('');
  return `<div class="sounds-beats${mode === 'notes' ? ' sounds-beats--stairs' : ''}">${beats}</div>`;
}
function levelMarkup(c, track, plan) {
  if (plan.level === 'buttons') {
    const level = levelOf(track.volume);
    return `<div class="sounds-levels" role="group" aria-label="${c.name}’s volume">
        <button type="button" class="px-button sounds-level" data-level="loud" aria-pressed="${level === 'loud'}">${icon('hear', { size: 20 })}<span>Loud</span></button>
        <button type="button" class="px-button sounds-level" data-level="soft" aria-pressed="${level === 'soft'}">${icon('quiet', { size: 20 })}<span>Soft</span></button>
      </div>`;
  }
  return `<label class="sounds-slider"><span>${c.name} volume</span><input type="range" data-volume="${c.id}" min="0" max="1" step=".05" value="${track.volume}"></label>`;
}

// The selected tab's panel as HTML. Pure, so the layout is testable without a browser.
export function soundsPanelMarkup(band, grade, selected) {
  const c = castOf(selected), t = trackOf(band, c.id), plan = soundsPlan(grade, c.id);
  const editor = plan.editor === 'beats' || plan.editor === 'notes' ? beatsMarkup(t, plan.editor) : '';
  return `<div class="sounds-editor" style="--musician:${MUSICIAN_COLORS[c.id]}">
      <p class="sounds-hint${plan.editor === 'lead' ? ' sounds-hint--lead' : ''}"><span class="sounds-hint__icon" aria-hidden="true">${c.icon}</span> ${hintLine(c, plan)}</p>
      ${plan.editor === 'lead' ? '' : patternsMarkup(c.id, t, band)}${editor}
      ${levelMarkup(c, t, plan)}
      <label class="sounds-slider"><span>Band volume</span><input type="range" data-master min="0" max="1" step=".05" value="${band.masterVolume}"></label>
    </div>`;
}

// Which control to refocus after the panel is rebuilt under the keyboard.
export function focusKey(dataset = {}) {
  if (dataset.tab) return `[data-tab="${dataset.tab}"]`;
  if (dataset.pattern) return `[data-pattern="${dataset.pattern}"]`;
  if (dataset.beat) return `[data-beat="${dataset.beat}"]`;
  if (dataset.level) return `[data-level="${dataset.level}"]`;
  if (dataset.volume) return `[data-volume="${dataset.volume}"]`;
  if ('master' in dataset) return '[data-master]';
  return null;
}

// Runs rebuild() and puts focus back on the same control in the new markup. `doc` is the document (or a
// stub under node --test); `body` is the window body the control lives in.
export function keepFocus(body, doc, rebuild) {
  const active = doc?.activeElement;
  const keep = active && body.contains(active) ? focusKey(active.dataset ?? {}) : null;
  rebuild();
  if (keep) body.querySelector(keep)?.focus?.();
  return keep;
}

// Arrow keys move between the musician tabs and wrap at both ends. Other keys return null.
export function nextTabId(currentId, key) {
  const i = CAST.findIndex(c => c.id === currentId);
  if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(key)) return null;
  return CAST[(i + (key === 'ArrowRight' ? 1 : CAST.length - 1)) % CAST.length].id;
}

const setVolume = (band, id, volume) => ({ ...band, tracks: band.tracks.map(t => (t.id === id ? { ...t, notes: [...t.notes], volume } : { ...t, notes: [...t.notes] })) });
// K's Loud / Soft: one friend's volume jumps to 1.0 or 0.45; every other track is left as it was.
export const levelEdit = (band, id, level) => setVolume(band, id, LEVELS[level === 'loud' ? 'loud' : 'soft']);

// Opens the window. getBand() is the current band, getGrade() the grade (K as 0), getSelected() the tab to
// open on. onEdit(nextBand, line, { save }) applies an edit; line is [speaker, words] or null, and save is
// false while a slider is being dragged (one save:true follows when it is let go). onSelect(id) hears tab
// changes, onClose() the window closing. Returns { close, paint, body } or null if a window is already open.
export function openSoundsWindow(ctx, { getBand, getGrade, getSelected, onEdit, onSelect, onClose } = {}) {
  if (ctx.scenes?.busy) return null;   // never over a scene change
  let selected = getSelected?.() ?? 'melody';
  const grade = () => gradeNumber(getGrade?.() ?? 0);
  const edit = (next, line = null, save = true) => {
    onEdit?.(next, line, { save });
    if (line) feedback.textContent = Array.isArray(line) ? line[1] : line;
  };
  const body = document.createElement('div');
  body.className = 'sounds';
  body.innerHTML = `<div class="sounds-tabs" role="tablist" aria-label="Musicians">${CAST.map(c => `<button type="button" role="tab" class="px-chip sounds-tab" data-tab="${c.id}" style="--musician:${MUSICIAN_COLORS[c.id]}"><i class="music-swatch"></i>${c.icon} ${c.name}</button>`).join('')}</div>
    <div class="sounds-panel" role="tabpanel"></div>
    <p class="sr-only sounds-feedback" aria-live="polite" aria-atomic="true"></p>`;
  const panel = body.querySelector('.sounds-panel');
  const feedback = body.querySelector('.sounds-feedback');

  function paint() {
    body.querySelectorAll('[data-tab]').forEach(tab => {
      const on = tab.dataset.tab === selected;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    keepFocus(body, document, () => { panel.innerHTML = soundsPanelMarkup(getBand(), grade(), selected); });
  }
  function select(id) {
    if (!CAST.some(c => c.id === id)) return;
    selected = id;
    onSelect?.(id);
    paint();
  }

  body.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || !body.contains(target)) return;
    const band = getBand(), c = castOf(selected);
    if (target.dataset.tab) { select(target.dataset.tab); return; }
    if (target.dataset.pattern) {
      const p = Number(target.dataset.pattern);
      edit(setPattern(band, selected, p), [c.name, tuneLine(p)]);
    } else if (target.dataset.beat) {
      const beat = Number(target.dataset.beat), plan = soundsPlan(grade(), selected);
      const next = plan.editor === 'notes' ? cycleNote(band, selected, beat) : toggleBeat(band, selected, beat);
      edit(next, [c.name, beatLine(beat, trackOf(next, selected).notes[beat], plan.editor)]);
    } else if (target.dataset.level) {
      const level = target.dataset.level === 'loud' ? 'loud' : 'soft';
      edit(levelEdit(band, selected, level), [c.name, levelLine(c.name, level)]);
    } else return;
    target.focus?.();   // Safari leaves focus on a dragged slider; the pressed state must still repaint
    paint();
  });
  body.addEventListener('keydown', event => {   // arrows move between musician tabs
    const tab = event.target.closest?.('[data-tab]');
    const next = tab ? nextTabId(tab.dataset.tab, event.key) : null;
    if (!next) return;
    event.preventDefault();
    select(next);
    body.querySelector(`[data-tab="${next}"]`)?.focus();
  });
  body.addEventListener('input', event => {   // live mix while a slider moves; saved when it is let go
    const input = event.target, band = getBand();
    if (input.dataset?.volume) edit(setVolume(band, input.dataset.volume, Number(input.value)), null, false);
    else if (input.dataset && 'master' in input.dataset) edit({ ...band, masterVolume: Number(input.value) }, null, false);
  });
  body.addEventListener('change', event => { if (event.target.type === 'range') edit(getBand(), null, true); });

  const handle = openWindow(ctx.stage, { title: 'Sounds', body, initialFocus: () => body.querySelector(`[data-tab="${selected}"]`), onClose });
  if (!handle) return null;
  paint();
  return { ...handle, body, paint };
}
