import { createBandEngine, sanitizeBandSnapshot, applyBeatChanges, notesForBeat, phraseLength, normalizePreset, BAND_PRESETS } from '../../audio.js';
import { createPlaybackController, bandPlaybackMessage, CAST } from '../../music.js';
import { getDraft, getCreations, saveDraft, publishCreation } from '../../progress.js';
import {
  MUSICIAN_COLORS, toggleMusician, toggleBeat, cycleNote, noteLabel, musicCommands,
  leadTrack, TEMPO_NAMES, cycleTempo, setTempo, formLabel, cycleForm, setForm, defaultBandFor, lessonDone,
  melodyShape, shapeLine, restsLine, pickEcho, echoMatches, openingLine, helpLines, lessonHint,
} from '../band.js';
import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { createCommandMenu } from '../menu.js';
import { gridMove, keyIntent } from '../input.js';
import { createDialogue } from '../dialogue.js';
import { stopSpeaking } from '../voice.js';
import { onceAtATime } from '../scenes.js';
import { withScope } from '../save.js';
import { creationMarkup } from '../creations.js';
import { showItemGet } from './item-get.js';
import { openSoundsWindow } from './sounds.js';
import { openWindow } from '../window.js';

// Kiko's Sound Garden: four musicians on floating pedestals, eight lanterns that edit the grade's lead
// musician, a Speed sign (plus Echo at grade 2 and Form at grades 4–5), and the 2×2 menu.
const PEDESTAL_X = [150, 370, 590, 810];   // feet x, in CAST order
const FEET_Y = 260, SCALE = 1.5;
const BOX = { width: 160, top: 132 };        // each musician button, relative to the stage
const LANTERN_GAP = 48;                      // lantern i sits at rail x = i * LANTERN_GAP
const NOTE_STEP = 19, REST_STEP = 96;        // staircase: La hangs at the string, each pitch down adds a step, rests hang lowest
const PART = { bass: 'Bass', voice: 'Singer', melody: 'Whistle', percussion: 'Rhythm' };
const PIANO_PART = {
  bass: { part: 'Low', sound: 'low piano', line: 'I play the low piano notes.' },
  voice: { part: 'Middle', sound: 'middle piano', line: 'I play the middle piano notes.' },
  melody: { part: 'High', sound: 'high piano', line: 'I play the high piano notes.' },
  percussion: { part: 'Rhythm', sound: 'soft drum rhythm', line: 'I add a soft drum beat.' },
};
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
  notYet: 'Not yet. Press Echo to watch it again.',
  stopped: 'Echo stopped. Press Echo to watch it again.',
};
const gradeOf = state => (state.chapter === 0 ? 0 : Number(state.grade) || 0);
const castOf = id => CAST.find(c => c.id === id);
const trackOf = (band, id) => band.tracks.find(t => t.id === id);
// Where a lantern hangs for a note: the string for La, one step down per pitch, and the bottom for a rest.
export const lanternStep = note => (note === null || note === undefined ? REST_STEP : (4 - note) * NOTE_STEP);

export function createMusicScene(ctx) {
  let root = null, menu = null, dialogue = null, engine = null, playback = null, sounds = null, presetWindow = null;
  let band = null, grade = 0, lead = null, selected = 'melody';
  let quiet = false, quietTimer = null, quietBand = null, quietBeat = 0, playedOnce = false;
  let echoed = false, published = false, justPublished = false;
  let echo = null, echoCount = 0, echoToken = 0;   // echo: { mask, phase: 'demo' | 'copy', beat, timer }
  let destroyed = false, finishing = false;
  let presetUndo = null, audition = false, muteDialogue = false, suppressPlaybackLine = 0;
  let reward = null, meaningful = false, endNarration = null;
  const $ = selector => root.querySelector(selector);
  const settings = () => ctx.getState().settings ?? {};
  const say = (speaker, words) => { if (!destroyed) dialogue.say(speaker, words); };
  const lanterns = () => [...root.querySelectorAll('.music-lantern')];
  const edited = () => published || lessonDone(band, { played: playedOnce, echoed }, grade);
  const stoppedLine = mode => `${mode} stopped. ${grade > 0 && !edited() ? lessonHint(grade) : 'Your song is safe.'}`;
  const musicianSound = c => normalizePreset(band.preset) === 'minecraft' ? PIANO_PART[c.id] : { part: PART[c.id], sound: c.sound, line: c.line };

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
        <span class="px-chip music-name" aria-hidden="true"><i class="music-swatch"></i><span class="music-name__text">${c.name} · ${musicianSound(c).part}</span></span>
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
      <div class="music-example">
        <button type="button" class="px-button music-preset">${icon('music')}<span class="music-preset__name"></span>${icon('turn')}</button>
        <span class="music-example__credit"></span>
        <span class="sr-only music-playback-status" aria-live="polite" aria-atomic="true"></span>
      </div>
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
      button.querySelector('.music-name__text').textContent = `${c.name} · ${musicianSound(c).part}`;
      button.setAttribute('aria-label', `${c.name}, ${musicianSound(c).sound}, ${on ? 'in the band. Tap to rest.' : 'resting. Tap to invite.'}${c.id === lead ? ' Edit on the lanterns above.' : ''}`);
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
      showEchoBeat(beat);
      return;
    }
    clearBeats();
    lanterns()[beat % 8]?.classList.add('is-lit');
    for (const note of notes) $(`.music-musician[data-id="${note.id}"]`)?.classList.add('is-performing');
    paintPhrase(phraseIndex ?? Math.floor(beat / 8));
  }

  // ---- Sound ----
  function refreshMenu() {
    const commands = musicCommands({ playing: Boolean(playback?.active), quiet, edited: edited() });
    menu?.set(justPublished ? [commands[0], commands[1], { id: 'guide', label: 'Kiko’s page', icon: 'help' }, { id: 'village', label: 'Village', icon: 'back' }] : commands);
  }
  function paintPreset() {
    const id = normalizePreset(band.preset), example = BAND_PRESETS[id];
    $('.music-preset__name').textContent = example.name;
    $('.music-preset').setAttribute('aria-label', `${example.name} preset. Choose a starting tune.`);
    $('.music-example__credit').textContent = id === 'minecraft' ? 'C418 · editable example' : 'An original band tune';
  }
  function rememberAutoplay(enabled) {
    const state = ctx.getState();
    ctx.commit({ ...state, settings: { ...state.settings, musicAutoplay: enabled } });
  }
  function sayPlayback(words) {
    // Transport feedback must not read itself aloud and cancel the music it just started.
    muteDialogue = true;
    try { say('Kiko', words); } finally { muteDialogue = false; }
  }
  function stopQuiet() { clearInterval(quietTimer); quietTimer = null; quiet = false; quietBand = null; }
  function stopEchoTimers({ silent = false } = {}) {
    echoToken++;
    if (!echo) return;
    clearInterval(echo.timer); echo.timer = null;
    if (echo.phase === 'demo') {   // a copy in progress survives Play and See beat; a cut demo says so
      echo = null;
      if (!silent) say('Kiko', ECHO_LINES.stopped);   // whoever cut it says its own line next
    }
    $('[data-sign="echo"]')?.classList.remove('is-busy');
  }
  // Stops every listening mode. None resumes automatically after a pause, window or hidden tab.
  function stopAll({ silent = false } = {}) {
    endNarration?.();
    if (silent) suppressPlaybackLine++;
    try {
      stopQuiet();
      stopEchoTimers({ silent });
      if (playback?.active) playback.stop(); else engine?.stop();
      clearBeats();
      paintPhrase(null);
      refreshMenu();
    } finally { if (silent) suppressPlaybackLine--; }
  }
  function togglePlay() {
    audition = false;
    if (playback.active) { rememberAutoplay(false); stopAll(); return; }
    stopAll({ silent: true });
    stopSpeaking();
    rememberAutoplay(true);
    playedOnce = true;
    saveNow();
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
    rememberAutoplay(false);
    audition = false;
    if (quiet) { stopAll(); say('Kiko', stoppedLine('See beat')); return; }
    stopAll();
    quiet = true; quietBeat = 0; quietBand = sanitizeBandSnapshot(band); playedOnce = true;
    startQuietTicker();
    saveNow();
    refreshMenu();
    sayPlayback(bandPlaybackMessage(band, { quiet: true }));
  }

  // Narration lowers sound without canceling either the song or the silent lights.
  function narrate(text) {
    endNarration?.();
    engine?.setDucked(true);
    let utterance;
    const ended = () => {
      if (endNarration !== ended) return;
      utterance?.removeEventListener?.('end', ended);
      utterance?.removeEventListener?.('error', ended);
      endNarration = null;
      engine?.setDucked(false);
    };
    endNarration = ended;
    try { utterance = ctx.speak(text); } catch { ended(); return false; }
    if (utterance?.addEventListener) {
      utterance.addEventListener('end', ended);
      utterance.addEventListener('error', ended);
    } else ended();
    return utterance;
  }

  // ---- Saving and editing ----
  const saveNow = () => {
    meaningful = true;
    ctx.commit(saveDraft(ctx.getState(), 'music', withScope({ ...band, lesson: { played: playedOnce, echoed } }, ctx.getState())));
  };
  // Every edit (stage taps and the Sounds window alike) ends a running echo demo first, so the demo band
  // never picks up the change on its next beat.
  const interruptDemo = () => { if (echo?.phase === 'demo') stopAll(); };
  function edit(next, { line, save = true } = {}) {
    interruptDemo();
    band = next;
    justPublished = false;
    meaningful = true;
    engine.update(band);
    paintPreset();
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
    edit(next, { line: [c.name, on ? `${c.name} joins on the next beat. ${musicianSound(c).line}` : `${c.name} rests for now. Tap again to invite them back.`] });
  }
  function tapLantern(beat) {
    if (!lead) return;
    const next = lead === 'percussion' ? toggleBeat(band, lead, beat) : cycleNote(band, lead, beat);
    const notes = trackOf(next, lead).notes;
    let line = lead === 'percussion' ? restsLine(notes) : shapeLine(melodyShape(notes));
    if (echo?.phase === 'copy') {
      const sounds = notes.filter(n => n !== null && n !== undefined).length, wanted = echo.mask.filter(Boolean).length;
      if (echoMatches(notes, echo.mask)) { echoed = true; echo = null; echoCount++; line = ECHO_LINES.matched; }
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

  // ---- Echo (grade 2): the demonstration never replaces the child's editable score ----
  async function startEcho() {
    stopAll();
    stopSpeaking();
    const mask = echo?.mask ?? pickEcho(echoCount), token = echoToken;
    echo = { mask, phase: 'demo', beat: 0, timer: null };
    $('[data-sign="echo"]')?.classList.add('is-busy');
    sayPlayback(settings().musicAutoplay === false ? 'Watch the lanterns…' : ECHO_LINES.listen);
    saveNow();
    // One-off band: only Cricket sounds, and only on the picked beats.
    const demo = {
      ...sanitizeBandSnapshot(band), form: 'A',
      tracks: band.tracks.map(t => (t.id === 'percussion'
        ? { ...t, enabled: true, volume: t.volume, notes: mask.map(on => (on ? 0 : null)) }
        : { ...t, enabled: false, notes: [...t.notes] })),
    };
    // Start lights before awaiting browser audio permission, which may never settle.
    const started = performance.now(), beatMs = 60000 / demo.tempo;
    const tick = () => showEchoBeat(Math.floor((performance.now() - started) / beatMs + 1e-9));
    tick();
    echo.timer = setInterval(tick, beatMs);
    if (settings().musicAutoplay === false) return;
    let audible = false;
    try {
      audible = await engine.start(demo, { beats: 8, onComplete: () => {
        if (!destroyed && token === echoToken && echo?.phase === 'demo') finishDemo();
      } });
    } catch { /* the independent visual demonstration continues */ }
    if (destroyed || token !== echoToken || echo?.phase !== 'demo') return;
    if (!audible) return;
    if (performance.now() - started >= beatMs) { engine.stop(); return; }
    // Prompt audio startup can take over the clock. A late startup keeps the silent demo.
    clearInterval(echo.timer); echo.timer = null;
    clearBeats();
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
    paintRail();
    say('Kiko', ECHO_LINES.copy);
  }

  // Presets are editable band scores. Switching keeps the child's volume and chosen form; one Undo
  // restores the entire previous score without changing lesson evidence.
  function choosePreset(id) {
    const preset = normalizePreset(id);
    if (preset === normalizePreset(band.preset)) return;
    presetUndo = { band: sanitizeBandSnapshot(band) };
    const next = { ...defaultBandFor(grade, preset), masterVolume: band.masterVolume, form: band.form };
    edit(next);
    sayPlayback(`${BAND_PRESETS[preset].name} is your starting tune. Tap a friend or a lantern to make it yours.`);
    auditionBand();
  }
  function undoPreset() {
    if (!presetUndo) return;
    const previous = presetUndo;
    presetUndo = null;
    edit(previous.band);
    sayPlayback('Your previous band is back. Your edits are safe.');
  }
  function auditionBand() {
    if (settings().musicAutoplay === false || settings().autoRead || band.masterVolume === 0 || document.hidden || destroyed) return;
    audition = true;
    stopSpeaking();
    void playback.toggle(band);
  }
  function openPresets() {
    if (ctx.scenes?.busy || presetWindow || sounds || finishing) return;
    stopAll({ silent: true });
    stopSpeaking();
    const current = normalizePreset(band.preset), body = document.createElement('div');
    body.className = 'music-presets';
    body.innerHTML = `<p class="music-presets__intro">Choose a starting tune. Then make it yours.</p>
      <div class="music-presets__choices">${['minecraft', 'meadow'].map(id => `<button type="button" class="px-button music-presets__choice" data-preset="${id}" aria-pressed="${id === current}">
        ${icon(id === current ? 'check' : 'music')}<span>${BAND_PRESETS[id].name}</span><small>${id === 'minecraft' ? 'C418 · editable example' : 'Our original band tune'}</small>
      </button>`).join('')}</div>
      <p class="music-presets__note">A new tune replaces these notes. Undo brings them back.</p>
      <button type="button" class="px-button music-presets__undo" data-undo-preset${presetUndo ? '' : ' disabled'}>${icon('undo')}<span>Undo preset</span></button>`;
    body.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !body.contains(button)) return;
      if (button.dataset.preset) {
        const id = button.dataset.preset;
        presetWindow?.close();
        choosePreset(id);
      } else if ('undoPreset' in button.dataset) {
        presetWindow?.close();
        undoPreset();
      }
    });
    presetWindow = openWindow(ctx.stage, { title: 'Starting tune', body, initialFocus: `[data-preset="${current}"]`, onClose: () => { presetWindow = null; } });
  }

  // ---- Sounds window (another module owns it; it talks back through these callbacks) ----
  function openSounds() {
    if (ctx.scenes?.busy || sounds) return;   // never over a scene change or a second window
    endNarration?.();
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
    if (meaningful) saveNow();
    await ctx.go('village', { focus: 'music' });
  }
  const finish = onceAtATime(async () => {
    if (destroyed || finishing || !edited()) return;
    stopAll();
    saveNow();
    finishing = true;   // the card is up: B and Village wait for it
    const app = ctx.getState();
    const scope = { chapter: app.chapter, grade: app.grade, subjectId: 'music' };
    const creation = withScope({ ...band, lesson: { played: playedOnce, echoed } }, scope);
    reward = showItemGet(ctx.stage, { name: 'Festival band', artHTML: creationMarkup(scope.subjectId, creation), figureHTML: figureMarkup('music', { pose: 'joy', scale: 2 }), speak: ctx.speak, autoRead: app.settings.autoRead });
    const accepted = await reward;
    reward = null;
    const current = ctx.getState();
    if (!accepted || destroyed || current.chapter !== scope.chapter || current.grade !== scope.grade) return;
    ctx.commit(publishCreation(current, scope.subjectId, creation));
    published = true;
    justPublished = true;
    finishing = false;
    refreshMenu();
    say('Kiko', 'Save song is on Kiko’s Guide page.');
  });
  function choose(id) {
    if (id === 'play') togglePlay();
    else if (id === 'quiet') toggleQuiet();
    else if (id === 'tunes') openSounds();
    else if (id === 'save') void finish();
    else if (id === 'guide') { stopAll({ silent: true }); ctx.open.guide('music'); }
    else if (id === 'village') void leave();
  }
  const onHidden = () => { if (document.hidden) stopAll(); };
  const onPageHide = () => stopAll();

  // Arrow keys walk a row of buttons the way they walk the musicians; the ends stop, they never wrap.
  function stepAlong(buttons, current, intent) {
    const i = buttons.indexOf(current);
    buttons[gridMove(i, intent, buttons.length, buttons.length)]?.focus();
    return true;
  }
  // The upper controls: Village, the available lesson signs, then the preset picker.
  const topRow = () => [$('.music-back'), ...root.querySelectorAll('.music-sign'), $('.music-preset')].filter(b => b && !b.disabled);
  const controlRows = () => [topRow(), [...root.querySelectorAll('button.music-lantern')], [...root.querySelectorAll('.music-musician')]];
  function markControl(button) {
    const row = controlRows().find(buttons => buttons.includes(button));
    row?.forEach(control => { control.tabIndex = control === button ? 0 : -1; });
  }
  function onControlKey(event) {
    const intent = keyIntent(event), button = event.target.closest?.('button');
    if (!['left', 'right'].includes(intent)) return;
    const row = controlRows().find(buttons => buttons.includes(button));
    if (!row) return;
    event.preventDefault();
    stepAlong(row, button, intent);
  }
  const firstLantern = () => root.querySelector('button.music-lantern');
  // Up from the band or the rail lands on the row above; down from the top row lands on the rail, or the menu at K.
  function focusTopRow() { ($('.music-sign:not(:disabled)') ?? $('.music-back'))?.focus(); return true; }
  function focusBelowTopRow() { const lantern = firstLantern(); if (lantern) lantern.focus(); else menu.focus(); return true; }

  return {
    mount() {
      const state = ctx.getState();
      grade = gradeOf(state);
      lead = leadTrack(grade);
      const draft = getDraft(state, 'music');
      meaningful = Boolean(draft);
      playedOnce = grade === 0 && draft?.lesson?.played === true;
      echoed = grade === 2 && draft?.lesson?.echoed === true;
      band = sanitizeBandSnapshot(draft ?? defaultBandFor(grade));
      // Older saves acquire A when loaded; grade 4's locked form needs both phrases.
      if (grade === 4 && band.form === 'A') band.form = 'AB';
      // A published band already passed the finish gate, even when its score is still the default.
      published = Boolean(getCreations(state).music);
      selected = lead ?? 'melody';
      build();
      controlRows().forEach(row => markControl(row[0]));
      root.addEventListener('focusin', event => markControl(event.target.closest?.('button')));
      root.addEventListener('click', event => markControl(event.target.closest?.('button')));
      root.addEventListener('keydown', onControlKey);
      dialogue = createDialogue($('.music-dialogue'), {
        speak: narrate,
        onHelp: () => { stopAll({ silent: true }); ctx.open.help('Kiko’s Sound Garden', helpLines(grade)); },
        isLarge: () => settings().largeText,
        autoRead: () => settings().autoRead && !muteDialogue,
      });
      menu = createCommandMenu($('.music-menu'), { onChoose: choose });
      engine = createBandEngine({
        onBeat: showBeat,
        onStatus: status => {
          if (destroyed) return;
          if (status === 'stopped') { playback?.engineStopped(); if (!quiet && echo?.phase !== 'demo') { clearBeats(); paintPhrase(null); } }
          if (status === 'interrupted') { stopEchoTimers(); say('Kiko', 'Sound was interrupted. Press Play band to start again.'); }
        },
      });
      playback = createPlaybackController(engine, {
        onState: (state, reason) => {
          if (destroyed) return;
          refreshMenu();
          $('.music-playback-status').textContent = reason === 'unavailable' ? 'Press Play band to listen. Or try See beat.' : state === 'playing' ? 'Your band is playing.' : '';
          if (audition || suppressPlaybackLine) return;
          sayPlayback(reason === 'unavailable' ? 'Sound is unavailable. Try Play band or See beat.'
            : state === 'starting' ? 'Waking up the band…' : state === 'playing' ? bandPlaybackMessage(band) : stoppedLine('Band'));
        },
      });
      engine.update(band);
      $('.music-preset').addEventListener('click', openPresets);
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
      window.addEventListener('pagehide', onPageHide);
      paintMusicians();
      paintRail();
      paintSpeed();
      paintForm();
      refreshMenu();
      paintPreset();
      say('Kiko', openingLine(grade, band.preset));
      menu.focus();
      if (settings().musicAutoplay !== false && !settings().autoRead) auditionBand();
    },
    handleIntent(intent) {
      if (finishing) return intent === 'b';   // the item-get card handles its own A; B waits
      if (intent === 'b') { void leave(); return true; }
      if (intent === 'a') { if (dialogue.next()) return true; menu.focus(); return true; }
      const active = document.activeElement;
      const lantern = active?.closest?.('button.music-lantern'), musician = active?.closest?.('.music-musician');
      const top = active?.closest?.('.music-sign, .music-back, .music-preset');
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
      reward?.cancel();
      reward = null;
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      engine?.destroy();
      dialogue?.destroy();
      menu?.destroy();
      root?.remove();
      sounds?.close();
      sounds = null;
      presetWindow?.close();
      presetWindow = null;
    },
  };
}
