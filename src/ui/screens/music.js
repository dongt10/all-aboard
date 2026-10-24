import { createBandEngine, sanitizeBandSnapshot, applyBeatChanges, notesForBeat, renderBandPreview, encodeWav } from '../../audio.js';
import { createPlaybackController, bandPlaybackMessage, CAST } from '../../music.js';
import { getDraft, saveDraft, publishCreation } from '../../progress.js';
import { MUSICIAN_COLORS, editorMode, toggleMusician, setPattern, toggleBeat, cycleNote, noteLabel, musicCommands } from '../band.js';
import { figureMarkup } from '../figures/index.js';
import { icon } from '../icons.js';
import { createCommandMenu } from '../menu.js';
import { createDialogue } from '../dialogue.js';
import { openWindow } from '../window.js';
import { onceAtATime } from '../scenes.js';
import { withScope } from '../save.js';
import { creationMarkup } from '../creations.js';
import { showItemGet } from './item-get.js';

// Kiko's Sound Garden: four musicians on floating pedestals, eight beat lanterns, and the 2×2 menu.
const PEDESTAL_X = [150, 370, 590, 810];   // feet x, in CAST order
const FEET_Y = 260, SCALE = 1.5;
const BOX = { width: 160, top: 132 };        // each musician button, relative to the stage
const QUIET_MS = 60000 / 90;
const PART = { bass: 'Bass', voice: 'Singer', melody: 'Whistle', percussion: 'Rhythm' };
const HELP = [
  'Tap a friend to join the band or take a rest.',
  'Press Play to hear your band, or Quiet play to watch the beat.',
  'Open Tunes to change a friend’s tune.',
  'Press Save band when you love your song.',
];
const gradeOf = state => (state.chapter === 0 ? 0 : state.grade);
const castOf = id => CAST.find(c => c.id === id);
const trackOf = (band, id) => band.tracks.find(t => t.id === id);

export function createMusicScene(ctx) {
  let root = null, menu = null, dialogue = null, engine = null, playback = null, tunes = null;
  let band = null, selected = 'melody', quiet = false, quietTimer = null, quietBand = null, quietBeat = 0;
  let destroyed = false, recordingToken = 0, recording = false;
  const downloads = new Map();
  const $ = selector => root.querySelector(selector);
  const settings = () => ctx.getState().settings ?? {};
  const say = (speaker, words) => { if (!destroyed) dialogue.say(speaker, words); };

  // ---- Stage ----
  function musicianMarkup(c, i) {
    const fx = PEDESTAL_X[i], feet = FEET_Y - BOX.top;
    const figureLeft = BOX.width / 2 - 32 * SCALE, figureTop = feet - 57 * SCALE;
    return `<button type="button" class="music-musician" data-id="${c.id}" style="--musician:${MUSICIAN_COLORS[c.id]};--float-delay:${-i * 600}ms;left:${fx - BOX.width / 2}px;top:${BOX.top}px">
        <span class="music-musician__float">
          <span class="music-ring" style="top:${feet - 14}px" aria-hidden="true"></span>
          <span class="music-pedestal" style="top:${feet}px" aria-hidden="true"><i class="music-pedestal__top"></i><i class="music-pedestal__rock"></i></span>
          <span class="music-figure" style="left:${figureLeft}px;top:${figureTop}px" aria-hidden="true">
            <span class="music-figure__idle">${figureMarkup(c.character, { scale: SCALE })}</span>
            <span class="music-figure__joy">${figureMarkup(c.character, { pose: 'joy', scale: SCALE })}</span>
          </span>
          <span class="music-note" aria-hidden="true">${c.icon}</span>
          <span class="music-zzz" aria-hidden="true">z<i>z</i></span>
        </span>
        <span class="px-chip music-name" aria-hidden="true"><i class="music-swatch"></i>${c.name} · ${PART[c.id]}</span>
      </button>`;
  }
  function build() {
    root = document.createElement('section');
    root.className = 'music';
    root.setAttribute('aria-label', 'Kiko’s Sound Garden');
    root.innerHTML = `
      <div class="music-sky" aria-hidden="true"><i class="music-cloud music-cloud--a"></i><i class="music-cloud music-cloud--b"></i><i class="music-hill music-hill--back"></i><i class="music-hill music-hill--front"></i>
        ${Array.from({ length: 9 }, (_, i) => `<i class="music-flower" style="--x:${40 + i * 108}px;--y:${352 + (i % 3) * 8}px;--petal:var(${['--art', '--lantern', '--writing'][i % 3]})"></i>`).join('')}</div>
      <button type="button" class="px-button music-back">${icon('back')}<span>Village</span></button>
      <p class="px-chip px-name music-title">${icon('music')}<span>Kiko’s Sound Garden</span></p>
      <div class="music-lanterns" role="img" aria-label="Eight beat lanterns"><i class="music-string"></i>${Array.from({ length: 8 }, (_, i) => `<span class="music-lantern" data-beat="${i}" style="left:${i * 54}px"><b>${i + 1}</b></span>`).join('')}</div>
      <div class="music-band">${CAST.map(musicianMarkup).join('')}</div>
      <div class="music-dialogue"></div>
      <div class="music-menu"></div>`;
    ctx.stage.append(root);
  }
  function paintMusicians() {
    for (const c of CAST) {
      const on = trackOf(band, c.id).enabled, button = $(`.music-musician[data-id="${c.id}"]`);
      button.classList.toggle('is-resting', !on);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', `${c.name}, ${c.sound}, ${on ? 'in the band. Tap to rest.' : 'resting. Tap to invite.'}`);
    }
  }
  function clearBeats() {
    root?.querySelectorAll('.is-lit, .is-performing').forEach(el => el.classList.remove('is-lit', 'is-performing'));
  }
  function showBeat({ beat, notes }) {
    if (destroyed) return;
    clearBeats();
    $(`.music-lantern[data-beat="${beat}"]`)?.classList.add('is-lit');
    for (const note of notes) $(`.music-musician[data-id="${note.id}"]`)?.classList.add('is-performing');
  }

  // ---- Sound ----
  function refreshMenu() { menu?.set(musicCommands({ playing: Boolean(playback?.active), quiet })); }
  function stopQuiet() { clearInterval(quietTimer); quietTimer = null; quiet = false; quietBand = null; }
  // Stops the band and quiet play. Used by Stop, pause(), leaving, saving and destroy().
  function stopAll() {
    stopQuiet();
    if (playback?.active) playback.stop(); else engine?.stop();
    clearBeats();
    refreshMenu();
  }
  function togglePlay() {
    if (playback.active) { stopAll(); return; }
    stopAll();
    void playback.toggle(band);
  }
  function toggleQuiet() {
    if (quiet) { stopAll(); say('Kiko', 'Quiet play stopped. Your song is safe.'); return; }
    stopAll();
    quiet = true; quietBeat = 0; quietBand = sanitizeBandSnapshot(band);
    const tick = () => {
      quietBand = applyBeatChanges(quietBand, band, quietBeat);
      showBeat({ beat: quietBeat, notes: notesForBeat(quietBand, quietBeat) });
      quietBeat = (quietBeat + 1) % 8;
    };
    tick();
    quietTimer = setInterval(tick, QUIET_MS);
    refreshMenu();
    say('Kiko', bandPlaybackMessage(band, { quiet: true }));
  }

  // ---- Saving ----
  const saveNow = () => ctx.commit(saveDraft(ctx.getState(), 'music', withScope(band, ctx.getState())));
  function edit(next, { line, save = true } = {}) {
    band = next;
    engine.update(band);
    if (save) saveNow();
    paintMusicians();
    if (tunes) paintTunes();
    if (line) say(line[0], line[1]);
  }
  function tapMusician(id) {
    selected = id;
    const next = toggleMusician(band, id), c = castOf(id), on = trackOf(next, id).enabled;
    edit(next, { line: [c.name, on ? `${c.name} joins on the next beat. ${c.line}` : `${c.name} rests for now. Tap again to invite them back.`] });
  }

  // ---- Tunes window ----
  function editorMarkup() {
    const c = castOf(selected), t = trackOf(band, selected), mode = editorMode(gradeOf(ctx.getState()), selected);
    const patterns = ['Sprout', 'Flower'].map((name, p) => `<button type="button" class="px-button tunes-pattern" data-pattern="${p}" aria-pressed="${t.pattern === p}">${t.pattern === p ? icon('check') : ''}<span>${name}</span></button>`).join('');
    const hint = mode === 'patterns' ? 'Try Sprout and Flower. They sound lovely together!'
      : mode === 'notes' ? 'Tap a beat to pick its note. Changes join at the next phrase.' : 'Tap a beat to add a sound or a rest.';
    const beats = mode === 'patterns' ? '' : `<div class="tunes-beats">${t.notes.map((n, i) => mode === 'notes'
      ? `<button type="button" class="tunes-beat${n === null ? '' : ' is-on'}" data-beat="${i}" aria-label="Beat ${i + 1}: ${noteLabel(n)}. Tap for the next note."><b>${i + 1}</b><span>${noteLabel(n)}</span></button>`
      : `<button type="button" class="tunes-beat${n === null ? '' : ' is-on'}" data-beat="${i}" aria-pressed="${n !== null}" aria-label="Beat ${i + 1}: ${n === null ? 'rest' : 'sound'}"><b>${i + 1}</b><span>${n === null ? '–' : '♪'}</span></button>`).join('')}</div>`;
    return `<div class="tunes-editor" style="--musician:${MUSICIAN_COLORS[c.id]}">
        <p class="tunes-hint">${c.icon} ${c.name} · ${c.sound}. ${hint}</p>
        <div class="tunes-patterns">${patterns}</div>${beats}
        <label class="tunes-slider"><span>${c.name} volume</span><input type="range" data-volume="${c.id}" min="0" max="1" step=".05" value="${t.volume}"></label>
        <label class="tunes-slider"><span>Band volume</span><input type="range" data-master min="0" max="1" step=".05" value="${band.masterVolume}"></label>
      </div>`;
  }
  function paintTunes() {
    const body = tunes.body, active = document.activeElement;
    const keep = active && body.contains(active) ? (active.dataset.tab ? `[data-tab="${active.dataset.tab}"]` : active.dataset.pattern ? `[data-pattern="${active.dataset.pattern}"]` : active.dataset.beat ? `[data-beat="${active.dataset.beat}"]` : null) : null;
    body.querySelectorAll('[data-tab]').forEach(tab => {
      const on = tab.dataset.tab === selected;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    if (active?.type === 'range' && body.contains(active)) return;   // don't rebuild a slider under the pointer
    body.querySelector('.tunes-panel').innerHTML = editorMarkup();
    if (keep) body.querySelector(keep)?.focus();
  }
  function setRecordLabel() {
    const button = tunes?.body.querySelector('.tunes-record');
    if (button) button.innerHTML = recording ? `${icon('stop')}<span>Cancel recording</span>` : `${icon('download')}<span>Save recording</span>`;
  }
  const tunesStatus = text => { const el = tunes?.body.querySelector('.tunes-status'); if (el) el.textContent = text; };
  function cancelRecording() { recordingToken++; recording = false; setRecordLabel(); }
  async function record() {
    if (recording) { cancelRecording(); tunesStatus('Recording canceled.'); return; }
    recording = true; setRecordLabel(); tunesStatus('Making a two-phrase recording…');
    const token = ++recordingToken, score = sanitizeBandSnapshot(band);
    try {
      const buffer = await renderBandPreview(score, { phrases: 2 });
      if (destroyed || token !== recordingToken) return;
      const url = URL.createObjectURL(new Blob([encodeWav(buffer)], { type: 'audio/wav' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'my-festival-band.wav'; anchor.hidden = true;
      root.append(anchor); anchor.click(); anchor.remove();
      downloads.set(url, setTimeout(() => { URL.revokeObjectURL(url); downloads.delete(url); }, 30000));
      tunesStatus('Recording ready. Check your downloads.');
    } catch {
      if (!destroyed && token === recordingToken) tunesStatus('This browser could not make a recording. Your band is still here.');
    } finally {
      if (!destroyed && token === recordingToken) { recording = false; setRecordLabel(); }
    }
  }
  function openTunes() {
    const body = document.createElement('div');
    body.className = 'tunes';
    body.innerHTML = `<div class="tunes-tabs" role="tablist" aria-label="Musicians">${CAST.map(c => `<button type="button" role="tab" class="px-chip tunes-tab" data-tab="${c.id}" style="--musician:${MUSICIAN_COLORS[c.id]}"><i class="music-swatch"></i>${c.icon} ${c.name}</button>`).join('')}</div>
      <div class="tunes-panel" role="tabpanel"></div>
      <div class="tunes-foot"><button type="button" class="px-button tunes-record"></button><p class="tunes-status" role="status" aria-live="polite">Download two phrases as a WAV file.</p></div>`;
    body.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.dataset.tab) { selected = target.dataset.tab; paintTunes(); return; }
      if (target.dataset.pattern) { edit(setPattern(band, selected, Number(target.dataset.pattern))); tunesStatus('New tune ready for the next phrase.'); return; }
      if (target.dataset.beat) {
        const mode = editorMode(gradeOf(ctx.getState()), selected), beat = Number(target.dataset.beat);
        edit(mode === 'notes' ? cycleNote(band, selected, beat) : toggleBeat(band, selected, beat));
        return;
      }
      if (target.classList.contains('tunes-record')) void record();
    });
    body.addEventListener('keydown', event => {   // arrows move between musician tabs
      const tab = event.target.closest?.('[data-tab]');
      if (!tab || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const i = CAST.findIndex(c => c.id === tab.dataset.tab), next = CAST[(i + (event.key === 'ArrowRight' ? 1 : CAST.length - 1)) % CAST.length];
      selected = next.id; paintTunes();
      body.querySelector(`[data-tab="${next.id}"]`).focus();
    });
    body.addEventListener('input', event => {   // live mix; the draft is saved on change
      const input = event.target;
      if (input.dataset.volume) edit({ ...band, tracks: band.tracks.map(t => (t.id === input.dataset.volume ? { ...t, notes: [...t.notes], volume: Number(input.value) } : t)) }, { save: false });
      else if ('master' in input.dataset) edit({ ...band, masterVolume: Number(input.value) }, { save: false });
    });
    body.addEventListener('change', event => { if (event.target.type === 'range') saveNow(); });
    const handle = openWindow(ctx.stage, { title: 'Tunes', body, initialFocus: () => body.querySelector(`[data-tab="${selected}"]`), onClose: () => { tunes = null; } });
    if (!handle) return;
    tunes = { ...handle, body };
    paintTunes();
    setRecordLabel();
  }

  // ---- Leaving and finishing ----
  async function leave() {
    stopAll();
    saveNow();
    await ctx.go('village', { focus: 'music' });
  }
  const finish = onceAtATime(async () => {
    stopAll();
    saveNow();
    await showItemGet(ctx.stage, { name: 'Your festival band', artHTML: creationMarkup('music', band), figureHTML: figureMarkup('music', { pose: 'joy', scale: 3 }) });
    if (destroyed) return;
    ctx.commit(publishCreation(ctx.getState(), 'music', withScope(band, ctx.getState())));
    await ctx.go('village', { focus: 'music', celebrate: 'music' });
  });
  function choose(id) {
    if (id === 'play') togglePlay();
    else if (id === 'quiet') toggleQuiet();
    else if (id === 'tunes') openTunes();
    else if (id === 'save') void finish();
  }
  const onHidden = () => { if (document.hidden) stopAll(); };

  return {
    mount() {
      band = sanitizeBandSnapshot(getDraft(ctx.getState(), 'music'));
      build();
      dialogue = createDialogue($('.music-dialogue'), {
        speak: text => ctx.speak(text),
        onHelp: () => ctx.open.help('Kiko’s Sound Garden', HELP),
        isLarge: () => settings().largeText,
        autoRead: () => settings().autoRead,
      });
      menu = createCommandMenu($('.music-menu'), { onChoose: choose });
      engine = createBandEngine({
        onBeat: showBeat,
        onStatus: status => {
          if (destroyed) return;
          if (status === 'stopped') { playback?.engineStopped(); if (!quiet) clearBeats(); }
          if (status === 'interrupted') say('Kiko', 'Sound was interrupted. Press Play to start again.');
        },
      });
      playback = createPlaybackController(engine, {
        onState: (state, reason) => {
          if (destroyed) return;
          refreshMenu();
          say('Kiko', reason === 'unavailable' ? 'Sound is unavailable. Try Quiet play to see your band.'
            : state === 'starting' ? 'Waking up the band…' : state === 'playing' ? bandPlaybackMessage(band) : 'Band stopped. Your song is safe.');
        },
      });
      engine.update(band);
      root.querySelector('.music-band').addEventListener('click', event => {
        const button = event.target.closest('.music-musician');
        if (button) tapMusician(button.dataset.id);
      });
      $('.music-back').addEventListener('click', () => { void leave(); });
      document.addEventListener('visibilitychange', onHidden);
      paintMusicians();
      refreshMenu();
      say('Kiko', 'Welcome to my Sound Garden! Tap a friend to join or rest, then press Play.');
      menu.focus();
    },
    handleIntent(intent) {
      if (intent === 'b') { void leave(); return true; }
      if (intent === 'a') return dialogue.next();
      const musician = document.activeElement?.closest?.('.music-musician');
      if (musician && (intent === 'left' || intent === 'right')) {
        const buttons = [...root.querySelectorAll('.music-musician')], i = buttons.indexOf(musician);
        buttons[Math.max(0, Math.min(buttons.length - 1, i + (intent === 'right' ? 1 : -1)))].focus();
        return true;
      }
      if (musician && intent === 'down') { menu.focus(); return true; }
      return menu.handleIntent(intent);
    },
    pause() { stopAll(); },
    destroy() {
      if (destroyed) return;
      stopAll();
      destroyed = true;
      recordingToken++;
      for (const [url, timer] of downloads) { clearTimeout(timer); URL.revokeObjectURL(url); }
      downloads.clear();
      document.removeEventListener('visibilitychange', onHidden);
      engine?.destroy();
      dialogue?.destroy();
      menu?.destroy();
      root?.remove();
      tunes?.close();
      tunes = null;
    },
  };
}
