import { createBandEngine, sanitizeBandSnapshot, applyBeatChanges, notesForBeat, phraseLength } from '../../audio.js';
import { createPlaybackController, bandPlaybackMessage, CAST } from '../../music.js';
import { getDraft, getCreations, saveDraft, publishCreation } from '../../progress.js';
import {
  MUSICIAN_COLORS, toggleMusician, toggleBeat, cycleNote, noteLabel, setTrackNotes, musicCommands,
  leadTrack, TEMPO_NAMES, cycleTempo, setTempo, formLabel, cycleForm, setForm, defaultBandFor, isEdited,
  melodyShape, shapeLine, restsLine, pickEcho, echoMatches, openingLine, helpLines,
} from '../band.js';
import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { createCommandMenu } from '../menu.js';
import { createDialogue } from '../dialogue.js';
import { stopSpeaking } from '../voice.js';
import { onceAtATime } from '../scenes.js';
import { withScope } from '../save.js';
import { creationMarkup } from '../creations.js';
import { showItemGet } from './item-get.js';
import { openSoundsWindow } from './sounds.js';

// Kiko's Sound Garden: four musicians on floating pedestals, eight lanterns that edit the grade's lead
// musician, a Speed sign (plus Echo at grade 2 and Form at grades 4–5), and the 2×2 menu.
const PEDESTAL_X = [150, 370, 590, 810];   // feet x, in CAST order
const FEET_Y = 260, SCALE = 1.5;
const BOX = { width: 160, top: 132 };        // each musician button, relative to the stage
const LANTERN_GAP = 48;                      // lantern i sits at rail x = i * LANTERN_GAP
const NOTE_STEP = 19, REST_STEP = 96;        // staircase: La hangs at the string, each pitch down adds a step, rests hang lowest
const PART = { bass: 'Bass', voice: 'Singer', melody: 'Whistle', percussion: 'Rhythm' };
const LESSON = {
  0: 'Slow and fast · high and low',
  1: 'Cricket’s rhythm · sound and rest',
  2: 'Cricket’s rhythm · sound and rest',
  3: 'Kiko’s tune · up and down',
  4: 'Cricket keeps the steady part',
  5: 'Form · A B A',
};
const SPEED_LINES = { 60: 'Slow, like a sleepy walk.', 90: 'Steady, like a heartbeat.', 120: 'Fast, like a running rabbit!' };
const FORM_LINES = { A: 'Just tune A, over and over.', AB: 'Tune A, then tune B.', ABA: 'Tune A, then B, then A comes back!' };
export const ECHO_LINES = {
  listen: 'Listen and watch the lanterns…',
  copy: 'Your turn! Tap the lanterns to copy it.',
  matched: 'You echoed it! Now make one for me.',
  notYet: 'Not yet. Press Echo to hear it again.',
  stopped: 'Echo stopped. Press Echo to hear it again.',
};
const gradeOf = state => (state.chapter === 0 ? 0 : Number(state.grade) || 0);
const castOf = id => CAST.find(c => c.id === id);
const trackOf = (band, id) => band.tracks.find(t => t.id === id);
// Where a lantern hangs for a note: the string for La, one step down per pitch, and the bottom for a rest.
export const lanternStep = note => (note === null || note === undefined ? REST_STEP : (4 - note) * NOTE_STEP);

export function createMusicScene(ctx) {
  let root = null, menu = null, dialogue = null, engine = null, playback = null, sounds = null;
  let band = null, grade = 0, lead = null, selected = 'melody';
  let quiet = false, quietTimer = null, quietBand = null, quietBeat = 0, playedOnce = false;
  let echo = null, echoCount = 0, echoToken = 0;   // echo: { mask, phase: 'demo' | 'copy', beat, timer }
  let destroyed = false, finishing = false;
  const $ = selector => root.querySelector(selector);
  const settings = () => ctx.getState().settings ?? {};
  const say = (speaker, words) => { if (!destroyed) dialogue.say(speaker, words); };
  const lanterns = () => [...root.querySelectorAll('.music-lantern')];
  const edited = () => playedOnce || isEdited(band, grade);

  // ---- Stage ----
  function musicianMarkup(c, i) {
    const fx = PEDESTAL_X[i], feet = FEET_Y - BOX.top;
    const figureLeft = BOX.width / 2 - 32 * SCALE, figureTop = feet - 57 * SCALE;
    return `<button type="button" class="music-musician" data-id="${c.id}" style="--musician:${MUSICIAN_COLORS[c.id]};--float-delay:${-i * 600}ms;left:${fx - BOX.width / 2}px;top:${BOX.top}px">
        <span class="music-musician__float">
          <span class="music-lead-glow" style="top:${feet - 18}px" aria-hidden="true"></span>
          <span class="music-ring" style="top:${feet - 14}px" aria-hidden="true"></span>
          <span class="music-pedestal" style="top:${feet}px" aria-hidden="true"><i class="music-pedestal__top"></i><i class="music-pedestal__rock"></i></span>
          <span class="music-figure" style="left:${figureLeft}px;top:${figureTop}px" aria-hidden="true">
            <span class="music-figure__idle">${figureMarkup(c.character, { scale: SCALE })}</span>
            <span class="music-figure__joy">${figureMarkup(c.character, { pose: 'joy', scale: SCALE })}</span>
          </span>
          <span class="music-note" aria-hidden="true">${c.icon}</span>
          <span class="music-zzz" aria-hidden="true">z<i>z</i></span>
        </span>
        ${c.id === 'percussion' ? '<span class="px-chip music-badge" aria-hidden="true">steady part</span>' : ''}
        <span class="px-chip music-name" aria-hidden="true"><i class="music-swatch"></i>${c.name} · ${PART[c.id]}</span>
      </button>`;
  }
  function lanternMarkup(i) {
    const left = `left:${i * LANTERN_GAP}px`;
    if (!lead) return `<span class="music-lantern" data-beat="${i}" style="${left}"><b>${i + 1}</b></span>`;
    return `<button type="button" class="music-lantern" data-beat="${i}" style="${left}"><b></b></button>`;
  }
  function signsMarkup() {
    const speed = `<button type="button" class="px-button music-sign" data-sign="speed">${icon('clock')}<span class="music-sign__word"></span></button>`;
    const echoSign = grade === 2 ? `<button type="button" class="px-button music-sign" data-sign="echo">${icon('hear')}<span>Echo</span></button>` : '';
    const form = grade >= 4 ? `<button type="button" class="px-button music-sign music-form" data-sign="form"${grade === 4 ? ' disabled' : ''}>${icon('turn')}<span class="music-form__letters"></span></button>` : '';
    return `<div class="music-signs">${speed}${echoSign}${form}</div>`;
  }
  function build() {
    const leadName = lead ? castOf(lead).name : null;
    root = document.createElement('section');
    root.className = 'music';
    root.dataset.grade = String(grade);
    if (lead) root.dataset.lead = lead;
    root.classList.toggle('music--steady', grade >= 4);
    root.setAttribute('aria-label', 'Kiko’s Sound Garden');
    root.innerHTML = `
      <div class="music-sky" aria-hidden="true"><i class="music-cloud music-cloud--a"></i><i class="music-cloud music-cloud--b"></i><i class="music-hill music-hill--back"></i><i class="music-hill music-hill--front"></i>
        ${Array.from({ length: 9 }, (_, i) => `<i class="music-flower" style="--x:${40 + i * 108}px;--y:${352 + (i % 3) * 8}px;--petal:var(${['--art', '--lantern', '--writing'][i % 3]})"></i>`).join('')}</div>
      <button type="button" class="px-button music-back">${icon('back')}<span>Village</span></button>
      <p class="px-chip music-lesson"><span>${LESSON[Math.max(0, Math.min(5, grade))]}</span></p>
      <p class="px-chip px-name music-title">${icon('music')}<span>Kiko’s Sound Garden</span></p>
      ${signsMarkup()}
      <div class="music-lanterns" role="${lead ? 'group' : 'img'}" aria-label="${lead ? `${leadName}’s lanterns. Beat ${lead === 'percussion' ? 'sounds and rests' : 'notes'}.` : 'Eight beat lanterns'}"${lead ? ` style="--lead:${MUSICIAN_COLORS[lead]}"` : ''}><i class="music-string"></i>${Array.from({ length: 8 }, (_, i) => lanternMarkup(i)).join('')}</div>
      <div class="music-band">${CAST.map(musicianMarkup).join('')}</div>
      <div class="music-dialogue"></div>
      <div class="music-menu"></div>`;
    ctx.stage.append(root);
  }
  function paintMusicians() {
    for (const c of CAST) {
      const on = trackOf(band, c.id).enabled, button = $(`.music-musician[data-id="${c.id}"]`);
      button.classList.toggle('is-resting', !on);
      button.classList.toggle('is-lead', c.id === lead);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', `${c.name}, ${c.sound}, ${on ? 'in the band. Tap to rest.' : 'resting. Tap to invite.'}${c.id === lead ? ' Edit on the lanterns above.' : ''}`);
    }
  }
  // The lanterns show the lead's eight beats: sound/rest glyphs for Cricket, a note staircase for Kiko.
  function paintRail() {
    if (!lead) return;
    const notes = trackOf(band, lead).notes;
    lanterns().forEach((el, i) => {
      const note = notes[i], rest = note === null || note === undefined;
      el.classList.toggle('is-rest', rest);
      el.classList.toggle('is-sound', !rest);
      const label = el.querySelector('b');
      if (lead === 'percussion') {
        label.textContent = rest ? '–' : '♪';
        el.setAttribute('aria-pressed', String(!rest));
        el.setAttribute('aria-label', `Beat ${i + 1}: ${rest ? 'rest' : 'sound'}. Tap to flip.`);
      } else {
        label.textContent = rest ? '–' : noteLabel(note);
        el.style.setProperty('--step', `${lanternStep(rest ? null : note)}px`);
        el.setAttribute('aria-label', `Beat ${i + 1}: ${noteLabel(rest ? null : note)}. Tap for the next note.`);
      }
    });
  }
  function paintSpeed() {
    const sign = $('[data-sign="speed"]');
    if (!sign) return;
    sign.querySelector('.music-sign__word').textContent = TEMPO_NAMES[band.tempo] ?? 'Steady';
    sign.setAttribute('aria-label', `Speed: ${TEMPO_NAMES[band.tempo] ?? 'Steady'}. Tap for ${TEMPO_NAMES[cycleTempo(band.tempo)]}.`);
  }
  function paintForm() {
    const sign = $('[data-sign="form"]');
    if (!sign) return;
    const label = formLabel(band.form);
    const letters = sign.querySelector('.music-form__letters');
    letters.innerHTML = '';
    for (const letter of label.split(' ')) { const b = document.createElement('b'); b.textContent = letter; letters.append(b); }
    sign.setAttribute('aria-label', sign.disabled ? `Form: ${label}. Cricket keeps the steady part.` : `Form: ${label}. Tap for ${formLabel(cycleForm(band.form))}.`);
  }
  function paintPhrase(index) {
    root?.querySelectorAll('.music-form__letters b').forEach((b, i) => b.classList.toggle('is-now', index !== null && i === index));
  }
  function clearBeats() {
    root?.querySelectorAll('.is-lit, .is-performing').forEach(el => el.classList.remove('is-lit', 'is-performing'));
  }
  function showBeat({ beat, notes, phraseIndex }) {
    if (destroyed) return;
    if (echo?.phase === 'demo') {
      // The engine wraps to beat 0 after the eight-beat demonstration.
      showEchoBeat(beat === 0 && echo.beat > 0 ? 8 : beat);
      return;
    }
    clearBeats();
    lanterns()[beat % 8]?.classList.add('is-lit');
    for (const note of notes) $(`.music-musician[data-id="${note.id}"]`)?.classList.add('is-performing');
    paintPhrase(phraseIndex ?? Math.floor(beat / 8));
  }

  // ---- Sound ----
  function refreshMenu() { menu?.set(musicCommands({ playing: Boolean(playback?.active), quiet, edited: edited() })); }
  function stopQuiet() { clearInterval(quietTimer); quietTimer = null; quiet = false; quietBand = null; }
  function stopEchoTimers() {
    echoToken++;
    if (!echo) return;
    clearInterval(echo.timer); echo.timer = null;
    if (echo.phase === 'demo') {   // a copy in progress survives Play and See beat; a cut demo says so
      echo = null;
      say('Kiko', ECHO_LINES.stopped);   // whoever cut it (Play, a tap, Echo again) says its own line next
    }
    $('[data-sign="echo"]')?.classList.remove('is-busy');
  }
  // Stops the band, See beat and the echo demo. Used by Stop, pause(), leaving, saving and destroy().
  function stopAll() {
    stopQuiet();
    stopEchoTimers();
    if (playback?.active) playback.stop(); else engine?.stop();
    clearBeats();
    paintPhrase(null);
    refreshMenu();
  }
  function togglePlay() {
    if (playback.active) { stopAll(); return; }
    stopAll();
    playedOnce = true;
    void playback.toggle(band);
  }
  // See beat: one ticker lights the lanterns at the band's speed, with no sound.
  function startQuietTicker({ immediate = true } = {}) {
    clearInterval(quietTimer);
    const tick = () => {
      quietBand = applyBeatChanges(quietBand, band, quietBeat);
      quietBeat %= phraseLength(quietBand);
      showBeat({ beat: quietBeat, notes: notesForBeat(quietBand, quietBeat), phraseIndex: Math.floor(quietBeat / 8) });
      quietBeat = (quietBeat + 1) % phraseLength(quietBand);
    };
    if (immediate) tick();
    quietTimer = setInterval(tick, 60000 / band.tempo);
  }
  function toggleQuiet() {
    if (quiet) { stopAll(); say('Kiko', 'See beat stopped. Your song is safe.'); return; }
    stopAll();
    quiet = true; quietBeat = 0; quietBand = sanitizeBandSnapshot(band); playedOnce = true;
    startQuietTicker();
    refreshMenu();
    say('Kiko', bandPlaybackMessage(band, { quiet: true }));
  }

  // ---- Saving and editing ----
  const saveNow = () => ctx.commit(saveDraft(ctx.getState(), 'music', withScope(band, ctx.getState())));
  // Every edit (stage taps and the Sounds window alike) ends a running echo demo first, so the demo band
  // never picks up the change on its next beat. finishDemo edits after the phase turns to 'copy', so it is spared.
  const interruptDemo = () => { if (echo?.phase === 'demo') stopAll(); };
  function edit(next, { line, save = true } = {}) {
    interruptDemo();
    band = next;
    engine.update(band);
    if (save) saveNow();
    paintMusicians();
    paintRail();
    paintSpeed();
    paintForm();
    refreshMenu();
    if (line) say(line[0], line[1]);
  }
  function tapMusician(id) {
    selected = id;
    const next = toggleMusician(band, id), c = castOf(id), on = trackOf(next, id).enabled;
    edit(next, { line: [c.name, on ? `${c.name} joins on the next beat. ${c.line}` : `${c.name} rests for now. Tap again to invite them back.`] });
  }
  function tapLantern(beat) {
    if (!lead) return;
    const next = lead === 'percussion' ? toggleBeat(band, lead, beat) : cycleNote(band, lead, beat);
    const notes = trackOf(next, lead).notes;
    let line = lead === 'percussion' ? restsLine(notes) : shapeLine(melodyShape(notes));
    if (echo?.phase === 'copy') {
      const sounds = notes.filter(n => n !== null && n !== undefined).length, wanted = echo.mask.filter(Boolean).length;
      if (echoMatches(notes, echo.mask)) { echo = null; echoCount++; line = ECHO_LINES.matched; }
      else if (sounds >= wanted) line = ECHO_LINES.notYet;   // enough sounds placed, but on the wrong beats
    }
    edit(next, { line: ['Kiko', line] });
  }
  function tapSpeed() {
    const tempo = cycleTempo(band.tempo);
    edit(setTempo(band, tempo), { line: ['Kiko', SPEED_LINES[tempo]] });
    if (quiet) startQuietTicker({ immediate: false });   // the lights follow the new speed at once
  }
  function tapForm() {
    const form = cycleForm(band.form);
    edit(setForm(band, form), { line: ['Kiko', FORM_LINES[form]] });
  }

  // ---- Echo (grade 2): Kiko plays a rhythm, the lanterns flash it, then Cricket's rail clears for the copy ----
  async function startEcho() {
    stopAll();
    stopSpeaking();
    const mask = echo?.mask ?? pickEcho(echoCount), token = echoToken;
    echo = { mask, phase: 'demo', beat: 0, timer: null };
    $('[data-sign="echo"]')?.classList.add('is-busy');
    say('Kiko', ECHO_LINES.listen);
    // One-off band: only Cricket sounds, and only on the picked beats.
    const demo = {
      ...sanitizeBandSnapshot(band), form: 'A',
      tracks: band.tracks.map(t => (t.id === 'percussion'
        ? { ...t, enabled: true, volume: Math.max(t.volume, .6), notes: mask.map(on => (on ? 0 : null)) }
        : { ...t, enabled: false, notes: [...t.notes] })),
    };
    let audible = false;
    try { audible = await engine.start(demo); } catch { /* lights still run without sound */ }
    if (destroyed || token !== echoToken || echo?.phase !== 'demo') return;
    if (audible) return;   // onBeat drives the lights and completion from the audio clock
    const started = performance.now(), beatMs = 60000 / demo.tempo;
    // A delayed callback catches up to the elapsed beat instead of stretching the rhythm.
    const tick = () => showEchoBeat(Math.floor((performance.now() - started) / beatMs + 1e-9));
    tick();
    echo.timer = setInterval(tick, beatMs);
  }
  function showEchoBeat(beat) {
    if (echo?.phase !== 'demo') return;
    if (beat >= 8) { finishDemo(); return; }
    clearBeats();
    if (echo.mask[beat]) {
      lanterns()[beat]?.classList.add('is-lit');
      $('.music-musician[data-id="percussion"]')?.classList.add('is-performing');
    }
    echo.beat = beat + 1;
  }
  function finishDemo() {
    clearInterval(echo.timer); echo.timer = null;
    engine.stop();
    clearBeats();
    echo.phase = 'copy';
    $('[data-sign="echo"]')?.classList.remove('is-busy');
    edit(setTrackNotes(band, 'percussion', []), { line: ['Kiko', ECHO_LINES.copy] });
  }

  // ---- Sounds window (another module owns it; it talks back through these callbacks) ----
  function openSounds() {
    if (ctx.scenes?.busy || sounds) return;   // never over a scene change or a second window
    stopSpeaking();
    const handle = openSoundsWindow(ctx, {
      getBand: () => band,
      getGrade: () => grade,
      getSelected: () => selected,
      onEdit: (next, line, { save = true } = {}) => edit(next, { line: Array.isArray(line) ? line : line ? ['Kiko', line] : null, save }),
      onSelect: id => { selected = id; },
      onClose: () => { sounds = null; },
    });
    sounds = handle ?? null;
  }

  // ---- Leaving and finishing ----
  async function leave() {
    if (finishing) return;
    stopAll();
    saveNow();
    await ctx.go('village', { focus: 'music' });
  }
  const finish = onceAtATime(async () => {
    if (!edited()) return;
    stopAll();
    saveNow();
    finishing = true;   // the card is up: B and Village wait for it
    await showItemGet(ctx.stage, { name: 'Festival band', artHTML: creationMarkup('music', band), figureHTML: figureMarkup('music', { pose: 'joy', scale: 2 }) });
    if (destroyed) return;
    ctx.commit(publishCreation(ctx.getState(), 'music', withScope(band, ctx.getState())));
    await ctx.go('village', { focus: 'music', celebrate: 'music' });
  });
  function choose(id) {
    if (id === 'play') togglePlay();
    else if (id === 'quiet') toggleQuiet();
    else if (id === 'tunes') openSounds();
    else if (id === 'save') void finish();
  }
  const onHidden = () => { if (document.hidden) stopAll(); };

  // Arrow keys walk a row of buttons the way they walk the musicians; the ends stop, they never wrap.
  function stepAlong(buttons, current, intent) {
    const i = buttons.indexOf(current);
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (intent === 'right' ? 1 : -1)))]?.focus();
    return true;
  }
  // The top row, left to right: the Village button, then the signs (Speed, Echo, Form) that can be pressed.
  const topRow = () => [$('.music-back'), ...root.querySelectorAll('.music-sign')].filter(b => b && !b.disabled);
  const firstLantern = () => root.querySelector('button.music-lantern');
  // Up from the band or the rail lands on the row above; down from the top row lands on the rail, or the menu at K.
  function focusTopRow() { ($('.music-sign:not(:disabled)') ?? $('.music-back'))?.focus(); return true; }
  function focusBelowTopRow() { const lantern = firstLantern(); if (lantern) lantern.focus(); else menu.focus(); return true; }

  return {
    mount() {
      const state = ctx.getState();
      grade = gradeOf(state);
      lead = leadTrack(grade);
      band = sanitizeBandSnapshot(getDraft(state, 'music') ?? defaultBandFor(grade));
      // A published band already passed the finish gate, even when its score is still the default.
      playedOnce = Boolean(getCreations(state).music);
      selected = lead ?? 'melody';
      build();
      dialogue = createDialogue($('.music-dialogue'), {
        speak: text => ctx.speak(text),
        onHelp: () => ctx.open.help('Kiko’s Sound Garden', helpLines(grade)),
        isLarge: () => settings().largeText,
        autoRead: () => settings().autoRead,
      });
      menu = createCommandMenu($('.music-menu'), { onChoose: choose });
      engine = createBandEngine({
        onBeat: showBeat,
        onStatus: status => {
          if (destroyed) return;
          if (status === 'stopped') { playback?.engineStopped(); if (!quiet) { clearBeats(); paintPhrase(null); } }
          if (status === 'interrupted') { stopEchoTimers(); say('Kiko', 'Sound was interrupted. Press Play to start again.'); }
        },
      });
      playback = createPlaybackController(engine, {
        onState: (state, reason) => {
          if (destroyed) return;
          refreshMenu();
          say('Kiko', reason === 'unavailable' ? 'Sound is unavailable. Try See beat to see your band.'
            : state === 'starting' ? 'Waking up the band…' : state === 'playing' ? bandPlaybackMessage(band) : 'Band stopped. Your song is safe.');
        },
      });
      engine.update(band);
      $('.music-band').addEventListener('click', event => {
        const button = event.target.closest('.music-musician');
        if (button) tapMusician(button.dataset.id);
      });
      $('.music-lanterns').addEventListener('click', event => {
        const button = event.target.closest('button.music-lantern');
        if (button) tapLantern(Number(button.dataset.beat));
      });
      $('.music-signs').addEventListener('click', event => {
        const sign = event.target.closest('[data-sign]')?.dataset.sign;
        if (sign === 'speed') tapSpeed();
        else if (sign === 'echo') void startEcho();
        else if (sign === 'form') tapForm();
      });
      $('.music-back').addEventListener('click', () => { void leave(); });
      document.addEventListener('visibilitychange', onHidden);
      paintMusicians();
      paintRail();
      paintSpeed();
      paintForm();
      refreshMenu();
      say('Kiko', openingLine(grade));
      menu.focus();
    },
    handleIntent(intent) {
      if (finishing) return intent === 'b';   // the item-get card handles its own A; B waits
      if (intent === 'b') { void leave(); return true; }
      if (intent === 'a') { if (dialogue.next()) return true; menu.focus(); return true; }
      const active = document.activeElement;
      const lantern = active?.closest?.('button.music-lantern'), musician = active?.closest?.('.music-musician');
      const top = active?.closest?.('.music-sign, .music-back');
      if (top && (intent === 'left' || intent === 'right')) return stepAlong(topRow(), top, intent);
      if (top && intent === 'down') return focusBelowTopRow();
      if (top && intent === 'up') return true;   // the top row is the top
      if (lantern && (intent === 'left' || intent === 'right')) return stepAlong([...root.querySelectorAll('button.music-lantern')], lantern, intent);
      if (lantern && intent === 'down') { menu.focus(); return true; }
      if (lantern && intent === 'up') return focusTopRow();
      if (musician && (intent === 'left' || intent === 'right')) return stepAlong([...root.querySelectorAll('.music-musician')], musician, intent);
      if (musician && intent === 'up') { const first = firstLantern(); if (first) first.focus(); else focusTopRow(); return true; }
      if (musician && intent === 'down') { menu.focus(); return true; }
      return menu.handleIntent(intent);
    },
    pause() { stopAll(); },
    destroy() {
      if (destroyed) return;
      if (echo) { clearInterval(echo.timer); echo = null; }   // leaving mid-demo needs no "Echo stopped" line
      stopAll();
      destroyed = true;
      document.removeEventListener('visibilitychange', onHidden);
      engine?.destroy();
      dialogue?.destroy();
      menu?.destroy();
      root?.remove();
      sounds?.close();
      sounds = null;
    },
  };
}
