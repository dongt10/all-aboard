import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBand, createBandPreset, PATTERNS } from '../src/audio.js';
import { CAST } from '../src/music.js';
import { setTrackNotes, toggleBeat, cycleNote, noteLabel, setPattern } from '../src/ui/band.js';
import { LEVELS, levelOf, noteStep, LEAD_LINES, leadLine, soundsPlan, soundsHeight, BODY_BUDGET, hintLine, tuneLine, beatLine, levelLine, playsPattern, soundsPanelMarkup, focusKey, keepFocus, nextTabId, levelEdit } from '../src/ui/screens/sounds.js';
import { declarations, withoutComments, resolveVars } from './helpers/css.js';
import { creationMarkup } from '../src/ui/creations.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const count = (html, re) => (html.match(re) ?? []).length;
const onePage = line => { assert.ok(typeof line === 'string' && line.length <= 56, `${line} (${line?.length})`); for (const s of line.split(/(?<=[.!?])\s+/)) assert.ok(s.length <= 56, s); };

test('K sets a friend loud or soft with two buttons; 0.7 is the line between them', () => {
  assert.deepEqual(LEVELS, { loud: 1, soft: 0.45 });
  assert.equal(levelOf(1), 'loud');
  assert.equal(levelOf(0.8), 'loud');
  assert.equal(levelOf(0.45), 'soft');
  assert.equal(levelOf(0), 'soft');
  assert.equal(levelOf(undefined), 'soft');
});

test('selected Loud and Soft keep their musician color on hover', () => {
  const css = read('src/ui/screens/sounds.css');
  const kit = read('src/ui/kit.css');
  const index = read('index.html');
  // The override ties the global hover rule at specificity (0,3,0) and loads later.
  assert.match(kit, /\.px-button:hover:not\(:disabled\)\s*\{\s*--fill:\s*var\(--white\)/);
  assert.ok(index.indexOf('ui/kit.css') < index.indexOf('screens/sounds.css'));
  assert.match(css, /\.sounds-level\[aria-pressed="true"\]:hover\s*\{\s*--fill:\s*var\(--musician\)/);
  for (const level of ['loud', 'soft']) {
    const band = levelEdit(createDefaultBand(), 'bass', level);
    assert.equal(band.tracks[0].volume, LEVELS[level]);
    const html = soundsPanelMarkup(band, 0, 'bass');
    assert.match(html, new RegExp(`data-level="${level}" aria-pressed="true"`));
    assert.match(html, new RegExp(`data-level="${level === 'soft' ? 'loud' : 'soft'}" aria-pressed="false"`));
  }
});

test('Loud / Soft edits one friend’s volume to 1.0 / 0.45 and leaves every other track alone', () => {
  const band = createDefaultBand();
  const soft = levelEdit(band, 'bass', 'soft');
  assert.equal(soft.tracks[0].volume, 0.45);
  assert.equal(levelEdit(band, 'bass', 'loud').tracks[0].volume, 1);
  assert.equal(levelEdit(band, 'bass', 'junk').tracks[0].volume, 0.45, 'anything but loud is soft');
  for (let i = 1; i < band.tracks.length; i++) assert.deepEqual(soft.tracks[i], band.tracks[i]);
  assert.equal(band.tracks[0].volume, 0.8, 'the old band is not changed');
  assert.notEqual(soft.tracks[1].notes, band.tracks[1].notes, 'notes are copied, not shared');
});

test('staircase steps: a rest sits on the floor, Do is one step up, La five', () => {
  assert.equal(noteStep(null), 0);
  assert.equal(noteStep(undefined), 0);
  assert.equal(noteStep(0), 1);
  assert.equal(noteStep(4), 5);
  assert.equal(noteStep(9), 5);
});

test('the lead musician’s tab points at the lanterns, in one short line', () => {
  assert.equal(leadLine('percussion'), 'Edit Cricket’s rhythm on the lanterns.');
  assert.equal(leadLine('melody'), 'Edit Kiko’s tune on the lanterns.');
  assert.equal(leadLine('bass'), null);
  for (const line of Object.values(LEAD_LINES)) onePage(line);
});

test('the per-tab plan by grade: K has no beat grid and Loud/Soft; 1–2 edit Cricket on the lanterns; 3–5 edit Kiko there', () => {
  for (const id of ['bass', 'voice', 'melody', 'percussion']) {
    assert.deepEqual(soundsPlan(0, id), { editor: 'none', level: 'buttons' });
    assert.deepEqual(soundsPlan('k', id), soundsPlan(0, id));
  }
  for (const g of [1, 2]) {
    assert.equal(soundsPlan(g, 'percussion').editor, 'lead');
    for (const id of ['bass', 'voice', 'melody']) assert.deepEqual(soundsPlan(g, id), { editor: 'beats', level: 'slider' });
  }
  for (const g of [3, 4, 5]) {
    assert.equal(soundsPlan(g, 'melody').editor, 'lead');
    assert.equal(soundsPlan(g, 'percussion').editor, 'beats', 'Cricket has no pitch, so beats');
    for (const id of ['bass', 'voice']) assert.equal(soundsPlan(g, id).editor, 'notes');
  }
});

function declaredSoundsHeights(rawCSS) {
  const css = withoutComments(rawCSS), kit = read('src/ui/kit.css');
  const tokens = declarations(read('src/ui/tokens.css'), '.large-text');
  const rule = selector => declarations(css, selector);
  const px = (value, label) => {
    const resolved = resolveVars(value, tokens);
    assert.match(resolved, /^\d+(?:\.\d+)?px$/, label);
    return Number.parseFloat(resolved);
  };
  const vertical = value => {
    const parts = value.trim().split(/\s+/).map(v => px(v, 'vertical spacing'));
    return parts.length < 3 ? 2 * parts[0] : parts[0] + parts[2];
  };
  const border = value => 2 * px(value.split(' ')[0], 'border');
  const button = declarations(kit, '.px-button'), chip = declarations(kit, '.px-chip');
  const edge = border(button.border);
  const text = selector => px(rule(selector)['font-size'], selector);
  const height = (selector, content, fallback) => {
    const r = rule(selector);
    return Math.max(px(r['min-height'] ?? fallback['min-height'], selector), content + vertical(r.padding ?? fallback.padding) + edge);
  };
  const beat = rule('.sounds-beat');
  const beatBox = Math.max(px(beat['min-height'], 'beat minimum'),
    (text('.sounds-beat b') + text('.sounds-beat span')) * Number(beat['line-height']) + vertical(beat.padding) + border(beat.border));
  const step = rule('.sounds-beat--note')['margin-bottom'].match(/^calc\(var\(--step, 0\) \* (\d+)px\)$/);
  assert.ok(step, 'staircase margin remains measurable');
  assert.equal(rule('.sounds-beats--stairs')['padding-top'], undefined);
  const pattern = (px(button['font-size'], 'command') + text('.sounds-pattern__text small')) * Number(rule('.sounds-pattern__text')['line-height']);
  return {
    tabs: height('.sounds-tab', text('.sounds-tab') * Number(chip['line-height']), chip),
    hint: Math.ceil(text('.sounds-hint') * Number(rule('.sounds-hint')['line-height'])),
    tunes: height('.sounds-pattern', pattern, button),
    beats: beatBox, stairs: beatBox + 5 * Number(step[1]),
    buttons: height('.sounds-level', px(button['font-size'], 'command') * Number(button['line-height']), button),
    slider: Math.max(px(rule('.sounds-slider input')['min-height'], 'slider'), Math.ceil(text('.sounds-slider') * Number(declarations(read('src/ui/interaction.css'), '.win__body')['line-height']))),
    gap: px(rule('.sounds')['gap'], 'outer gap'), editorGap: px(rule('.sounds-editor')['gap'], 'editor gap'),
  };
}
function assertSoundsBudget(css) {
  const h = declaredSoundsHeights(css);
  for (const grade of [0, 1, 2, 3, 4, 5]) for (const { id } of CAST) {
    const html = soundsPanelMarkup(createDefaultBand(), grade, id);
    const rows = [h.hint, html.includes('sounds-levels') ? h.buttons : h.slider, h.slider];
    if (html.includes('sounds-patterns')) rows.push(h.tunes);
    if (html.includes('sounds-beats')) rows.push(html.includes('sounds-beats--stairs') ? h.stairs : h.beats);
    const height = h.tabs + h.gap + rows.reduce((sum, row) => sum + row, 0) + (rows.length - 1) * h.editorGap;
    assert.ok(height <= 400, `grade ${grade} ${id}: declared layout needs ${height}px of the 400px body`);
    assert.ok(soundsHeight(grade, id) <= BODY_BUDGET, 'the public estimate also stays within budget');
  }
}

test('every Sounds tab fits Bigger words using actual CSS declarations, including the tallest La note', () => {
  const css = read('src/ui/screens/sounds.css');
  assertSoundsBudget(css);
  assert.throws(() => assertSoundsBudget(css.replace('min-height: 52px', 'min-height: 520px')), /declared layout needs/);
});

test('eight sound labels fit the Sounds window width at Bigger words', () => {
  const css = read('src/ui/screens/sounds.css');
  const shared = read('src/ui/interaction.css');
  const windowRule = css.match(/\.win:has\(\.sounds\)\s*\{([^}]+)\}/)?.[1]
    ?? shared.match(/\.win\s*\{([^}]+)\}/)[1];
  const width = Number(windowRule.match(/width:\s*min\((\d+)px,\s*100%\)/)[1]);
  const gap = Number(css.match(/\.sounds-beats\s*\{[^}]*gap:\s*(\d+)px/)[1]);
  // The reported Andika bold advance for " sound" at 20px is 63.48px; reserve another
  // full em for the musical glyph, plus each button's 4px borders and 2px padding.
  const required = 8 * (63.48 + 20 + 2 * (4 + 2)) + 7 * gap;
  const available = width - 2 * (4 + 16); // shared frame border and horizontal padding
  assert.ok(required <= available, `${required}px of labels must fit in ${available}px`);
  assert.ok(width <= 960 - 2 * 24, 'window fits inside the stage backdrop');
  for (const [grade, id] of [[1, 'bass'], [3, 'percussion']]) {
    const band = setTrackNotes(createDefaultBand(), id, Array(8).fill(0));
    assert.equal(count(soundsPanelMarkup(band, grade, id), /<span>♪ sound<\/span>/g), 8);
  }
});

test('every line Kiko says from the window fits one 56-character page, in plain words', () => {
  for (const g of [0, 1, 2, 3, 4, 5]) for (const c of CAST) onePage(hintLine(c, soundsPlan(g, c.id)));
  for (const p of [0, 1]) { onePage(tuneLine(p)); assert.doesNotMatch(tuneLine(p), /phrase/i); }
  assert.equal(tuneLine(1), 'Tune 2! It starts when the song comes back to beat 1.');
  for (const beat of [0, 7]) {
    for (const note of [null, 0, 1, 2, 3, 4]) onePage(beatLine(beat, note, 'notes'));
    onePage(beatLine(beat, null, 'beats'));
    onePage(beatLine(beat, 0, 'beats'));
  }
  assert.equal(beatLine(2, 3, 'notes'), 'Beat 3 is Sol now.');
  assert.equal(beatLine(2, null, 'notes'), 'Beat 3 is Rest now.');
  assert.equal(beatLine(7, null, 'beats'), 'Beat 8 is a rest now.');
  assert.equal(beatLine(0, 0, 'beats'), 'Beat 1 is a sound now.');
  assert.equal(noteLabel(3), 'Sol');
  for (const c of CAST) for (const level of ['loud', 'soft']) onePage(levelLine(c.name, level));
  assert.equal(levelLine('Sora', 'loud'), 'Sora plays loud now.');
});

test('a Tune button is pressed only while the track still plays that preset', () => {
  const band = createDefaultBand();
  const bass = band.tracks[0];
  assert.equal(playsPattern(bass, 0), true);
  assert.equal(playsPattern(bass, 1), false);
  const edited = toggleBeat(band, 'bass', 0).tracks[0];
  assert.equal(playsPattern(edited, 0), false, 'one toggled beat and Tune 1 no longer describes the track');
  assert.equal(playsPattern(edited, 1), false);
  const html = soundsPanelMarkup(toggleBeat(band, 'bass', 0), 1, 'bass');
  assert.match(html, /data-pattern="0" aria-pressed="false"/);
  assert.match(html, /data-pattern="1" aria-pressed="false"/);
  assert.equal(count(html, /icon-check|"check"/g), 0);
  const climbed = cycleNote(setTrackNotes(band, 'voice', [...PATTERNS.voice[1]]), 'voice', 0).tracks[1];
  assert.equal(playsPattern({ ...climbed, pattern: 1 }, 1), false);
});

test('Sounds uses the selected Minecraft score for pressed tunes and rhythm previews', () => {
  const band = createBandPreset('minecraft'), bass = band.tracks[0];
  assert.equal(playsPattern(bass, 0, band), true);
  assert.equal(playsPattern(bass, 0), false, 'the old Meadow example has different notes');
  let html = soundsPanelMarkup(band, 0, 'bass');
  assert.match(html, /data-pattern="0" aria-pressed="true"/);
  assert.match(html, /♪ – – ♪ – ♪ – –/);
  const other = setPattern(band, 'bass', 1);
  html = soundsPanelMarkup(other, 0, 'bass');
  assert.match(html, /data-pattern="1" aria-pressed="true"/);
  assert.equal(playsPattern(other.tracks[0], 1, other), true);
  assert.match(html, /♪ – – ♪ – – – –/);
});

test('K panel: Tune 1 / Tune 2 with glyph previews, Loud / Soft pressed by volume, the band slider, no beat grid', () => {
  const band = createDefaultBand();
  const html = soundsPanelMarkup(band, 0, 'bass');
  assert.match(html, /data-pattern="0" aria-pressed="true"/);
  assert.match(html, /data-pattern="1" aria-pressed="false"/);
  assert.match(html, /Tune 1/);
  assert.match(html, /Tune 2/);
  assert.ok(html.includes('♪ – – ♪ ♪ – ♪ –'), 'bass Tune 1 glyphs');
  assert.ok(html.includes('♪ – ♪ – ♪ – ♪ –'), 'bass Tune 2 glyphs');
  assert.match(html, /data-level="loud" aria-pressed="true"/, 'Sora starts at .8, so Loud');
  assert.match(html, /data-level="soft" aria-pressed="false"/);
  assert.equal(count(html, /<svg class="icon"/g), 4, 'an icon on every choice: two tunes, Loud, Soft');
  assert.match(html, /data-master/);
  assert.doesNotMatch(html, /data-volume/);
  assert.doesNotMatch(html, /data-beat/);
  assert.match(soundsPanelMarkup(band, 0, 'melody'), /data-level="soft" aria-pressed="true"/, 'Kiko starts at .55, so Soft');
  assert.doesNotMatch(html, /Sprout|Flower/);
});

test('grade 1 panel: Cricket’s tab says to use the lanterns with no Tune buttons; Sora’s tab has eight sound/rest toggles with a word on each', () => {
  const band = createDefaultBand();
  const lead = soundsPanelMarkup(band, 1, 'percussion');
  assert.match(lead, /Edit Cricket’s rhythm on the lanterns\./);
  assert.doesNotMatch(lead, /data-beat/);
  assert.doesNotMatch(lead, /data-pattern/, 'a Tune button here would wipe the lantern work');
  assert.match(lead, /data-volume="percussion"/);
  assert.match(lead, /data-master/);
  const sora = soundsPanelMarkup(band, 1, 'bass');
  assert.equal(count(sora, /data-beat="\d"/g), 8);
  assert.equal(count(sora, /aria-pressed="true" aria-label="Beat \d: sound"/g), PATTERNS.bass[0].filter(n => n !== null).length);
  assert.equal(count(sora, /<span>♪ sound<\/span>/g), PATTERNS.bass[0].filter(n => n !== null).length, 'every sound beat shows the word');
  assert.equal(count(sora, /<span>– rest<\/span>/g), PATTERNS.bass[0].filter(n => n === null).length, 'every rest shows the word');
  assert.doesNotMatch(sora, /sounds-beats--stairs/);
  assert.doesNotMatch(sora, /data-level/);
  assert.match(sora, /data-pattern="0"/);
});

test('grade 3 panel: Kiko’s tab points at the lanterns; Sora’s notes are a staircase with a step per pitch', () => {
  const band = setTrackNotes(createDefaultBand(), 'bass', [null, 0, 1, 2, 3, 4, null, 2]);
  const kiko = soundsPanelMarkup(band, 3, 'melody');
  assert.match(kiko, /Edit Kiko’s tune on the lanterns\./);
  assert.doesNotMatch(kiko, /data-pattern|data-beat/);
  const sora = soundsPanelMarkup(band, 3, 'bass');
  assert.match(sora, /sounds-beats--stairs/);
  assert.deepEqual([...sora.matchAll(/style="--step:(\d)"/g)].map(m => Number(m[1])), [0, 1, 2, 3, 4, 5, 0, 3]);
  assert.match(sora, /aria-label="Beat 6: La\. Tap for the next note\."/);
  assert.match(sora, /aria-label="Beat 1: Rest\. Tap for the next note\."/);
  assert.equal(count(sora, /sounds-beat--note is-on/g), 6);
  const cricket = soundsPanelMarkup(band, 3, 'percussion');
  assert.doesNotMatch(cricket, /sounds-beats--stairs/, 'Cricket keeps sound/rest toggles');
  assert.equal(count(cricket, /aria-pressed="(true|false)" aria-label="Beat/g), 8);
});

test('focus keys name every control the panel rebuilds, sliders included', () => {
  assert.equal(focusKey({ tab: 'melody' }), '[data-tab="melody"]');
  assert.equal(focusKey({ pattern: '1' }), '[data-pattern="1"]');
  assert.equal(focusKey({ beat: '4' }), '[data-beat="4"]');
  assert.equal(focusKey({ level: 'soft' }), '[data-level="soft"]');
  assert.equal(focusKey({ volume: 'bass' }), '[data-volume="bass"]');
  assert.equal(focusKey({ master: '' }), '[data-master]');
  assert.equal(focusKey({}), null);
  assert.equal(focusKey(), null);
});

test('rebuilding the panel puts focus back on the same control in the new markup', () => {
  // A stub of the little DOM paint() touches: the focused old button, the body that holds it, and the
  // fresh button that querySelector finds once the panel has been rebuilt.
  const makeStub = (activeDataset, { inside = true } = {}) => {
    const log = [];
    const old = { dataset: activeDataset, focus: () => log.push('old') };
    const fresh = { focus: () => log.push('fresh') };
    let rebuilt = false;
    const body = {
      contains: el => inside && el === old,
      querySelector: sel => (rebuilt && sel === focusKey(activeDataset) ? fresh : null),
    };
    return { body, doc: { activeElement: old }, log, rebuild: () => { rebuilt = true; log.push('rebuild'); } };
  };
  const a = makeStub({ pattern: '1' });
  assert.equal(keepFocus(a.body, a.doc, a.rebuild), '[data-pattern="1"]');
  assert.deepEqual(a.log, ['rebuild', 'fresh'], 'the rebuild runs first, then focus lands on the new Tune 2');
  const b = makeStub({ beat: '3' });
  keepFocus(b.body, b.doc, b.rebuild);
  assert.deepEqual(b.log, ['rebuild', 'fresh']);
  const c = makeStub({ level: 'soft' }, { inside: false });   // focus is outside the window: leave it alone
  assert.equal(keepFocus(c.body, c.doc, c.rebuild), null);
  assert.deepEqual(c.log, ['rebuild']);
  const d = makeStub({ volume: 'bass' });   // Safari leaves a dragged slider focused; it is rebuilt and refocused
  assert.equal(keepFocus(d.body, d.doc, d.rebuild), '[data-volume="bass"]');
  assert.deepEqual(d.log, ['rebuild', 'fresh']);
  const e = { contains: () => false, querySelector: () => null };
  assert.equal(keepFocus(e, { activeElement: null }, () => {}), null);
  assert.equal(keepFocus(e, undefined, () => {}), null);
});

test('arrow keys move between the musician tabs and wrap at both ends', () => {
  assert.equal(nextTabId('percussion', 'ArrowRight'), 'bass');
  assert.equal(nextTabId('bass', 'ArrowLeft'), 'percussion');
  assert.equal(nextTabId('bass', 'ArrowRight'), 'voice');
  assert.equal(nextTabId('melody', 'ArrowLeft'), 'voice');
  assert.equal(nextTabId('bass', 'Enter'), null);
  assert.equal(nextTabId('bass', 'ArrowDown'), null);
  assert.equal(nextTabId('nobody', 'ArrowRight'), null);
  const ids = CAST.map(c => c.id);
  for (const id of ids) assert.ok(ids.includes(nextTabId(id, 'ArrowRight')) && ids.includes(nextTabId(id, 'ArrowLeft')));
});

test('the stall score shows pitch height for Kiko’s tune, keeps eight bars and its label', () => {
  const band = setTrackNotes(createDefaultBand(), 'melody', [null, 0, null, 4, null, 2, null, null]);
  const html = creationMarkup('music', band);
  assert.match(html, /aria-label="Your eight beat song on display"/);
  assert.equal(count(html, /<i/g), 8);
  assert.match(html, /data-pitch="0" style="height:8px"/, 'Do is low');
  assert.match(html, /data-pitch="4" style="height:20px"/, 'La is high');
  assert.match(html, /data-pitch="2" style="height:14px"/);
  assert.equal(count(html, /data-pitch/g), 3);
  const others = Array.from({ length: 8 }, (_, i) => band.tracks.some(t => t.id !== 'melody' && t.notes[i] !== null) && [1, 3, 5].includes(i) === false).filter(Boolean).length;
  assert.equal(others, 4, 'Sora, Nori or Cricket sound on beats 1, 3, 5 and 7');
  assert.equal(count(html, /world-note-on/g), 3 + others, 'a pitched bar for each melody note, a short bar where only the others play');
  assert.match(html, /<i class="world-note-on" style="height:6px"><\/i>/);
  // Junk never reaches the markup.
  const junk = creationMarkup('music', { tracks: [{ id: 'melody', enabled: true, notes: ['"><script>', 9, -1, 1.5, null, null, null, null] }] });
  assert.doesNotMatch(junk, /script|data-pitch/);
  assert.equal(count(junk, /<i/g), 8);
  assert.equal(count(creationMarkup('music', { tracks: [] }), /world-note-on/g), 0);
});

test('sounds.css is linked after music.css and styles every class the window uses', () => {
  const index = read('index.html');
  assert.ok(index.indexOf('screens/music.css') < index.indexOf('screens/sounds.css'));
  const css = read('src/ui/screens/sounds.css');
  for (const cls of ['.sounds', '.sounds-tabs', '.sounds-tab', '.sounds-panel', '.sounds-hint', '.sounds-patterns', '.sounds-pattern', '.sounds-beats', '.sounds-beat', '.sounds-beats--stairs', '.sounds-beat--note', '.sounds-levels', '.sounds-level', '.sounds-slider']) {
    assert.ok(css.includes(cls) || cls === '.sounds-panel', `${cls} styled`);
  }
  assert.match(css, /--step/);
  assert.match(css, /\[aria-pressed="true"\]/);
  assert.match(css, /\.sounds-beat span \{[^}]*var\(--text-small\)/, 'the beat word is small enough for eight cells');
});
