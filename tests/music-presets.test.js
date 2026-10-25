import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATTERNS, BAND_PRESETS, normalizePreset, patternsFor, createDefaultBand,
  createBandPreset, sanitizeBandSnapshot, phraseNotes, notesForBeat,
  applyBeatChanges, bandNoteFrequency, playBandNote, createBandEngine,
  renderBandPreview,
} from '../src/audio.js';

const near = (actual, expected, tolerance=.01) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} is near ${expected}`);

test('legacy bands retain the original Meadow score, register and available musicians', () => {
  const legacy=createDefaultBand();delete legacy.preset;
  const restored=sanitizeBandSnapshot(legacy);
  assert.equal(restored.preset,'meadow');
  assert.equal(restored.tempo,90);
  assert.ok(restored.tracks.every(track=>track.enabled));
  assert.deepEqual(restored.tracks.map(track=>track.notes),Object.values(PATTERNS).map(tunes=>tunes[0]));
  near(bandNoteFrequency('bass',0,restored.preset),130.8128);
  near(bandNoteFrequency('voice',2,restored.preset),329.6276);
  near(bandNoteFrequency('melody',4,restored.preset),880);
  assert.deepEqual(phraseNotes(restored.tracks[2],'B'),PATTERNS.melody[1]);
});

test('preset selection creates an independent editable score and accepts only known ids', () => {
  assert.deepEqual(Object.keys(BAND_PRESETS),['meadow','minecraft']);
  for(const value of [undefined,null,{},'Minecraft','unknown',true])assert.equal(normalizePreset(value),'meadow');
  const first=createBandPreset('minecraft'),second=createBandPreset('minecraft');
  assert.equal(first.tempo,90);
  assert.equal(first.tracks.find(track=>track.id==='percussion').enabled,false);
  first.tracks[2].notes[0]=null;
  first.tracks[0].volume=0;
  assert.equal(second.tracks[2].notes[0],2);
  assert.equal(patternsFor('minecraft').melody[0][0],2);
  assert.deepEqual(patternsFor(second),patternsFor('minecraft'));
  assert.deepEqual(sanitizeBandSnapshot(first),first,'edits, including silence, survive saving');
});

test('the Minecraft example retains the measured opening landmarks and alternating low ending', () => {
  const band=createBandPreset('minecraft');band.form='AB';
  const pitches=beat=>Object.fromEntries(notesForBeat(band,beat).map(note=>[note.id,bandNoteFrequency(note.id,note.pitch,note.preset)]));
  near(pitches(0).bass,138.5913);
  near(pitches(0).melody,466.1638);
  near(pitches(2).melody,415.3047);
  near(pitches(3).voice,311.1270);
  near(pitches(5).melody,369.9944);
  near(pitches(13).voice,277.1826);
  assert.equal(pitches(13).melody,undefined,'the second ending is the lower voice, not an octave-shifted high note');
  assert.deepEqual(Array.from({length:8},(_,beat)=>notesForBeat(band,beat).length>0),[true,false,true,true,false,true,false,false]);
  for(const id of ['bass','voice','melody']) {
    const frequencies=Array.from({length:5},(_,pitch)=>bandNoteFrequency(id,pitch,'minecraft'));
    assert.ok(frequencies.every((frequency,index)=>index===0||frequency>frequencies[index-1]),'Do through La always ascend');
  }
});

test('invalid saved notes fall back within their chosen preset and preserve explicit quiet settings', () => {
  const band=sanitizeBandSnapshot({preset:'minecraft',tempo:75,masterVolume:0,tracks:[{id:'voice',pattern:1,enabled:false,volume:0,notes:[99]}]});
  assert.equal(band.tempo,90);
  assert.equal(band.masterVolume,0);
  assert.equal(band.tracks[1].enabled,false);
  assert.equal(band.tracks[1].volume,0);
  assert.deepEqual(band.tracks[1].notes,patternsFor('minecraft').voice[1]);
  assert.equal(sanitizeBandSnapshot({preset:'other',tempo:75}).tempo,90);
});

test('switching preset holds the sounding palette and B phrase until the next phrase boundary', () => {
  const current=createDefaultBand();current.form='AB';
  const pending=createBandPreset('minecraft');pending.form='AB';pending.tempo=60;
  const middle=applyBeatChanges(current,pending,9);
  assert.equal(middle.preset,'meadow');
  assert.equal(middle.tempo,60,'tempo and volume still respond immediately');
  assert.deepEqual(phraseNotes(middle.tracks[2],'B',middle.preset),PATTERNS.melody[1]);
  const boundary=applyBeatChanges(middle,pending,16);
  assert.equal(boundary.preset,'minecraft');
  assert.deepEqual(boundary.tracks.map(track=>track.notes),pending.tracks.map(track=>track.notes));
  assert.ok(notesForBeat(boundary,16).every(note=>note.preset==='minecraft'));
  near(bandNoteFrequency('melody',notesForBeat(boundary,16).find(note=>note.id==='melody').pitch,boundary.preset),466.1638);
});

function captureContext({frames=0,sampleRate=44100}={}) {
  const oscillators=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,time){this.events.push({value,time});},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
  return {
    oscillators,currentTime:0,state:'running',destination:{},sampleRate,frames,
    resume:()=>Promise.resolve(),close:()=>Promise.resolve(),
    createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),
    createDynamicsCompressor:()=>({threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){},disconnect(){}}),
    createOscillator(){
      const oscillator={frequency:parameter(),connect(){},disconnect(){},start(time){this.started=time;},stop(time){this.stopped=time;},addEventListener(){}};
      oscillators.push(oscillator);return oscillator;
    },
    startRendering(){return Promise.resolve({length:frames,sampleRate});},
  };
}

test('Minecraft notes synthesize their actual pitches without the Meadow voice glide', () => {
  const context=captureContext();
  playBandNote(context,context.destination,{id:'melody',pitch:2,volume:.8,preset:'minecraft'},.1);
  assert.equal(context.oscillators.length,4,'piano partials are synthesized rather than playing a recording');
  near(context.oscillators[0].frequency.events[0].value,466.1638);
  assert.ok(context.oscillators.every(oscillator=>oscillator.frequency.events.length===1));
  assert.ok(context.oscillators.every(oscillator=>oscillator.stopped>.1));
});

test('live and WAV rendering use the same edited Minecraft notes and preserve their decay', async () => {
  const keys=['AudioContext','OfflineAudioContext','requestAnimationFrame','cancelAnimationFrame'];
  const previous=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  let live,offline,engine;
  globalThis.AudioContext=class {constructor(){live=captureContext();return live;}};
  globalThis.OfflineAudioContext=class {constructor(channels,frames,sampleRate){offline=captureContext({frames,sampleRate});return offline;}};
  globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  try {
    const band=createBandPreset('minecraft');band.tempo=120;band.form='ABA';
    band.tracks[2].notes[0]=4;
    engine=createBandEngine();assert.equal(await engine.start(band),true);
    await renderBandPreview(band,{phrases:2});
    const firstLive=live.oscillators.map(oscillator=>oscillator.frequency.events[0].value);
    const firstOffline=offline.oscillators.filter(oscillator=>oscillator.started===.05).map(oscillator=>oscillator.frequency.events[0].value);
    assert.deepEqual(firstOffline,firstLive,'an edited first beat has the same piano pitches in both paths');
    near(firstLive[8],622.254);
    assert.equal(offline.frames/44100,15,'24 beats at Fast plus the full three-second decay tail');
    assert.ok(Math.max(...offline.oscillators.map(oscillator=>oscillator.stopped))<offline.frames/44100);
  } finally {
    engine?.destroy();
    for(const key of keys)if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key];
  }
});
