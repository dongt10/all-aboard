// Editable scores and synthesis. Meadow is original; Minecraft is a short teaching
// arrangement of C418's opening motif. Playback and exports use synthesized notes.
export const TRACK_IDS = ['bass', 'voice', 'melody', 'percussion'];
export const PATTERNS = {
  bass: [[0,null,null,2,0,null,3,null],[0,null,2,null,3,null,2,null]],
  voice: [[2,null,3,null,2,null,0,null],[3,null,4,3,2,null,0,null]],
  melody: [[null,4,null,3,null,2,null,3],[null,2,3,null,4,null,3,2]],
  percussion: [[0,null,1,null,0,1,1,null],[0,1,null,1,0,null,1,1]],
};
const MINECRAFT_PATTERNS = {
  bass: [[3,null,null,0,null,2,null,null],[3,null,null,0,null,null,null,null]],
  voice: [[0,null,null,4,null,null,null,null],[0,null,null,4,null,3,null,null]],
  melody: [[2,null,1,null,null,0,null,null],[2,null,1,null,null,null,null,null]],
  // An optional rhythm layer for children to add; it is not part of C418's piano motif.
  percussion: PATTERNS.percussion.map(notes=>[...notes]),
};
export const BAND_PRESETS = Object.freeze({
  meadow: Object.freeze({id:'meadow',name:'Meadow',credit:null}),
  minecraft: Object.freeze({id:'minecraft',name:'Minecraft',credit:'Short editable example from “Minecraft” by C418'}),
});
export const normalizePreset = value => value === 'minecraft' ? 'minecraft' : 'meadow';
export function patternsFor(presetOrBand) {
  const preset = typeof presetOrBand === 'string' ? presetOrBand : presetOrBand?.preset;
  return normalizePreset(preset) === 'minecraft' ? MINECRAFT_PATTERNS : PATTERNS;
}
// Speeds in beats per minute (Slow, Steady, Fast) and the phrase forms a band can take.
export const TEMPOS = [60, 90, 120];
export const FORMS = ['A', 'AB', 'ABA'];
const clamp = (value, fallback) => Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : fallback;
export function createBandPreset(value) {
  const preset=normalizePreset(value),minecraft=preset==='minecraft',patterns=patternsFor(preset);
  return {kind:'music',preset,tempo:90,form:'A',masterVolume:.65,tracks:TRACK_IDS.map((id,i)=>({id,enabled:!minecraft||id!=='percussion',pattern:0,notes:[...patterns[id][0]],volume:(minecraft?[.65,.55,.8,.28]:[.8,.65,.55,.6])[i]}))};
}
export const createDefaultBand = () => createBandPreset('meadow');
export function sanitizeBandSnapshot(value) {
  const band = createBandPreset(value?.preset),patterns=patternsFor(band);
  if(!value || typeof value!=='object') return band;
  band.tempo=TEMPOS.includes(value.tempo)?value.tempo:band.tempo;
  band.form=FORMS.includes(value.form)?value.form:'A';
  band.masterVolume=clamp(value.masterVolume,band.masterVolume);
  band.tracks=band.tracks.map(base=>{
    const track=Array.isArray(value.tracks)?value.tracks.find(t=>t?.id===base.id):null;
    if(!track) return base;
    const pattern=track.pattern===1?1:0;
    return {...base,enabled:typeof track.enabled==='boolean'?track.enabled:base.enabled,pattern,volume:clamp(track.volume,base.volume),notes:Array.isArray(track.notes)&&track.notes.length===8?track.notes.map(n=>Number.isInteger(n)&&n>=0&&n<=4?n:null):[...patterns[base.id][pattern]]};
  });
  return band;
}
// A form is a row of 8-beat phrases: "A" repeats one phrase, "AB" and "ABA" bring in a
// second phrase where the melodic friends swap to their other tune and Cricket keeps
// the steady part. The period of a band is 8 * form.length beats.
export const phraseLength = band => 8 * ((FORMS.includes(band?.form) ? band.form : 'A').length);
export function phraseAt(band,beat) {
  const form=FORMS.includes(band?.form)?band.form:'A';
  return form[Math.floor(beat/8)%form.length];
}
export function phraseNotes(track,letter,preset='meadow') {
  if(letter!=='B'||track.id==='percussion') return [...track.notes];
  return [...patternsFor(preset)[track.id][(track.pattern===1?1:0)^1]];
}
export function notesForBeat(band,beat) {
  const letter=phraseAt(band,beat);
  return band.tracks.filter(t=>t.enabled&&t.volume>0).map(t=>({id:t.id,pitch:phraseNotes(t,letter,band.preset)[beat%8],volume:t.volume,preset:normalizePreset(band.preset)})).filter(n=>n.pitch!==null);
}
// Mute, volume and tempo change on the very next beat; notes, patterns and form wait
// for the start of a phrase so a tune never changes mid-sentence.
export function applyBeatChanges(current,pending,beat) {
  return {...pending,preset:normalizePreset(beat%8===0?pending.preset:current.preset),form:beat%8===0?pending.form:current.form,tracks:pending.tracks.map(t=>{
    const old=current.tracks.find(x=>x.id===t.id);
    return beat%8===0?{...t,notes:[...t.notes]}:{...t,pattern:old.pattern,notes:[...old.notes]};
  })};
}
export const BAND_MIX_GAIN = 10 ** (10 / 20);
export const BAND_MIX_HEADROOM = .8;
export function createBandMix(context,destination) {
  const input=context.createGain(),compressor=context.createDynamicsCompressor(),headroom=context.createGain();
  input.gain.value=BAND_MIX_GAIN;
  headroom.gain.value=BAND_MIX_HEADROOM;
  // Lift the deliberately soft instrument envelopes by 10 dB. Compression acts
  // only near loud peaks; the user's volume gain remains downstream and exact.
  compressor.threshold.value=-6;compressor.knee.value=6;compressor.ratio.value=8;
  compressor.attack.value=.003;compressor.release.value=.15;
  // Measured full-volume transients can exceed the compressor threshold. Leave
  // another 1.94 dB after compression; net ordinary-level lift is about 8 dB.
  input.connect(compressor);compressor.connect(headroom);headroom.connect(destination);
  return {input,destroy(){input.disconnect();compressor.disconnect();headroom.disconnect();}};
}
export function bandNoteFrequency(id,pitch,preset='meadow') {
  const scale=[0,2,4,7,9];
  const minecraft=normalizePreset(preset)==='minecraft';
  const base=(minecraft?{bass:65.4064,voice:130.8128,melody:261.6256,percussion:110}:{bass:130.8128,voice:261.6256,melody:523.2511,percussion:110})[id];
  return base*2**((scale[pitch]+(minecraft&&id!=='percussion'?6:0))/12);
}
function playPianoNote(context,destination,{id,pitch,volume,preset},time,register) {
  const frequency=bandNoteFrequency(id,pitch,preset),amplitude=volume*{bass:.09,voice:.065,melody:.07}[id];
  if(amplitude<=0)return;
  // A quick hammer attack and independently decaying harmonics make a soft piano
  // voice. Every part is synthesized; no recording plays beneath the editable notes.
  for(const [multiple,weight,duration] of [[1,.76,2.4],[2,.16,1.8],[3,.06,1.25],[4,.02,.85]]) {
    const oscillator=context.createOscillator(),envelope=context.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency*multiple,time);
    envelope.gain.setValueAtTime(0,time);
    envelope.gain.linearRampToValueAtTime(amplitude*weight,time+.006);
    envelope.gain.exponentialRampToValueAtTime(.00001,time+duration);
    oscillator.connect(envelope);envelope.connect(destination);register(oscillator);
    oscillator.start(time);oscillator.stop(time+duration+.025);
    oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
  }
}
// Exported seam also accepts OfflineAudioContext for rendering/listening to a score.
export function playBandNote(context,destination,{id,pitch,volume,preset='meadow'},time,register=()=>{}) {
  if(normalizePreset(preset)==='minecraft'&&id!=='percussion')return playPianoNote(context,destination,{id,pitch,volume,preset},time,register);
  const frequency=bandNoteFrequency(id,pitch,'meadow');
  const envelope=context.createGain();
  envelope.connect(destination);
  const duration=id==='bass'?.48:id==='voice'?.6:id==='melody'?.28:.13;
  const amplitude=volume*(id==='bass'?.18:id==='voice'?.095:id==='melody'?.065:.11);
  envelope.gain.setValueAtTime(0,time);
  envelope.gain.linearRampToValueAtTime(amplitude,time+.018);
  if(id==='voice')envelope.gain.linearRampToValueAtTime(amplitude*.78,time+.24);
  envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
  const oscillator=context.createOscillator();
  oscillator.type=id==='bass'?'triangle':'sine';
  oscillator.frequency.setValueAtTime(id==='percussion'?(pitch===0?145:650):frequency,time);
  if(id==='percussion') oscillator.frequency.exponentialRampToValueAtTime(pitch===0?48:230,time+duration);
  if(id==='voice') { oscillator.frequency.setValueAtTime(frequency*.96,time); oscillator.frequency.exponentialRampToValueAtTime(frequency,time+.065); }
  oscillator.connect(envelope); register(oscillator);
  oscillator.start(time); oscillator.stop(time+duration+.025);
  oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
  if(id==='voice') {
    // A soft harmonic reed passes through moving "oo" formants. The sine
    // fundamental above keeps the vowel rounded instead of buzzy.
    const reed=context.createOscillator(),blend=context.createGain();
    reed.type='sawtooth';reed.frequency.setValueAtTime(frequency*.96,time);reed.frequency.exponentialRampToValueAtTime(frequency,time+.065);
    blend.gain.value=.32;
    const formants=[context.createBiquadFilter(),context.createBiquadFilter()];
    formants.forEach((filter,i)=>{filter.type='bandpass';filter.Q.value=i?4:2.8;filter.frequency.setValueAtTime(i?1200:520,time);filter.frequency.exponentialRampToValueAtTime(i?850:360,time+.2);reed.connect(filter);filter.connect(blend);});
    blend.connect(envelope);register(reed);reed.start(time);reed.stop(time+duration);
    reed.onended=()=>{reed.disconnect();blend.disconnect();formants.forEach(f=>f.disconnect());};
  }
  if(id==='percussion'&&pitch!==0) {
    // A tiny deterministic noise brush adds Cricket's dry, woody sh-sh texture.
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.09),context.sampleRate),samples=buffer.getChannelData(0);
    let seed=173;
    for(let i=0;i<samples.length;i++){seed=(seed*16807)%2147483647;samples[i]=(seed/1073741823.5-1);}
    const brush=context.createBufferSource(),filter=context.createBiquadFilter(),level=context.createGain();
    brush.buffer=buffer;filter.type='bandpass';filter.frequency.value=2100;filter.Q.value=.8;level.gain.value=.42;
    brush.connect(filter);filter.connect(level);level.connect(envelope);register(brush);brush.start(time);brush.stop(time+.095);
    brush.onended=()=>{brush.disconnect();filter.disconnect();level.disconnect();};
  }
  // Rounded vowel harmonics give Nori a warm "doo"; bird has a soft whistle overtone.
  if(id==='voice'||id==='melody') {
    const harmonic=context.createOscillator(),gain=context.createGain();
    harmonic.type='sine';harmonic.frequency.setValueAtTime(frequency*(id==='voice'?2:3),time);
    gain.gain.value=id==='voice'?.22:.06;harmonic.connect(gain);gain.connect(envelope);register(harmonic);
    harmonic.start(time);harmonic.stop(time+duration);harmonic.onended=()=>{harmonic.disconnect();gain.disconnect();};
  }
}
export async function renderBandPreview(snapshot,{phrases=2,sampleRate=44100}={}) {
  const band=sanitizeBandSnapshot(snapshot),Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Offline)throw new Error('Offline audio rendering is unavailable in this browser.');
  // `phrases` counts 8-beat phrases, rounded up to whole runs of the form so every letter
  // is heard: "A" and "AB" render 16 beats for phrases:2, "ABA" renders 24.
  const period=phraseLength(band),count=Math.ceil(Math.max(1,Math.min(8,Math.floor(phrases)||2))*8/period)*period,step=60/band.tempo;
  const tail=band.preset==='minecraft'?3:1;
  const context=new Offline(2,Math.ceil((count*step+tail)*sampleRate),sampleRate),master=context.createGain();
  master.gain.value=band.masterVolume;master.connect(context.destination);
  const mix=createBandMix(context,master);
  for(let beat=0;beat<count;beat++)for(const note of notesForBeat(band,beat))playBandNote(context,mix.input,note,.05+beat*step);
  return context.startRendering();
}
export function encodeWav(buffer) {
  const channels=buffer.numberOfChannels,frames=buffer.length,sampleRate=buffer.sampleRate;
  if(!Number.isInteger(channels)||channels<1||channels>2||!Number.isInteger(frames)||frames<0||!Number.isFinite(sampleRate)||sampleRate<1)throw new Error('Invalid audio buffer');
  const bytes=new ArrayBuffer(44+frames*channels*2),view=new DataView(bytes);
  const word=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  word(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,frames*channels*2,true);
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++){
    const raw=data[channel][frame],sample=Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;
    view.setInt16(44+(frame*channels+channel)*2,Math.round(sample*(sample<0?32768:32767)),true);
  }
  return bytes;
}
export function createBandEngine({onBeat=()=>{},onStatus=()=>{}}={}) {
  let context=null,master=null,timer=null,frame=null,running=false,destroyed=false,epoch=0;
  let mix=null;
  let pending=createDefaultBand(),active=pending,nextTime=0,nextBeat=0,visuals=[];
  let beatLimit=Infinity,scheduledBeats=0,completionTime=Infinity,onComplete=null,ducked=false,volume=pending.masterVolume;
  const outputVolume=()=>volume*(ducked ? .25 : 1);
  const sources=new Set();
  const status=value=>onStatus(value);
  function stop() {
    epoch++;running=false;clearInterval(timer);timer=null;
    if(frame!==null) cancelAnimationFrame(frame);frame=null;visuals=[];
    for(const source of sources) {try{source.stop();source.disconnect();}catch{ /* already ended */ }}
    sources.clear();status('stopped');
  }
  function contextStateChanged() {
    if(running&&context.state!=='running'){
      stop();status('interrupted');
    }
  }
  function schedule() {
    if(!running)return;
    while(scheduledBeats<beatLimit&&nextTime<context.currentTime+.11) {
      active=applyBeatChanges(active,pending,nextBeat);
      // A shorter form adopted at a phrase start restarts at its A, so the beat never
      // points past the new form (ABA -> AB at beat 16 becomes beat 0, not phrase 2).
      nextBeat%=phraseLength(active);
      const notes=notesForBeat(active,nextBeat);
      for(const note of notes) playBandNote(context,mix.input,note,nextTime,source=>{
        sources.add(source);source.addEventListener('ended',()=>sources.delete(source),{once:true});
      });
      visuals.push({time:nextTime,beat:nextBeat,notes,phrase:phraseAt(active,nextBeat),phraseIndex:Math.floor(nextBeat/8)});
      nextTime+=60/active.tempo;nextBeat=(nextBeat+1)%phraseLength(active);
      scheduledBeats++;
      if(scheduledBeats===beatLimit)completionTime=nextTime;
    }
  }
  function paint() {
    if(!running)return;
    while(visuals.length&&visuals[0].time<=context.currentTime)onBeat(visuals.shift());
    if(running&&context.currentTime>=completionTime){
      const complete=onComplete;stop();complete?.();return;
    }
    if(running)frame=requestAnimationFrame(paint);
  }
  const hidden=()=>{if(document.hidden)stop();};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  if(typeof window!=='undefined')window.addEventListener('pagehide',stop);
  return {
    async start(snapshot,{beats,onComplete:complete}={}) {
      if(destroyed)return false;
      stop();const token=epoch;
      try {
        if(!context) {
          const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
          if(!Audio){status('unavailable');return false;}
          context=new Audio();context.onstatechange=contextStateChanged;
          master=context.createGain();master.connect(context.destination);
          mix=createBandMix(context,master);
        }
        pending=sanitizeBandSnapshot(snapshot);
        await context.resume();
        if(token!==epoch||destroyed)return false;
        if(context.state!=='running'){status('unavailable');return false;}
        active=pending;
        volume=pending.masterVolume;master.gain.setValueAtTime(outputVolume(),context.currentTime);
        beatLimit=Number.isInteger(beats)&&beats>0?beats:Infinity;scheduledBeats=0;completionTime=Infinity;onComplete=typeof complete==='function'?complete:null;
        nextTime=context.currentTime+.055;nextBeat=0;running=true;
        schedule();timer=setInterval(schedule,25);paint();status('playing');return true;
      }catch{if(token!==epoch||destroyed)return false;stop();status('unavailable');return false;}
    },
    update(snapshot){pending=sanitizeBandSnapshot(snapshot);this.setVolume(pending.masterVolume);},
    setVolume(value){volume=clamp(value,.65);if(master)master.gain.setTargetAtTime(outputVolume(),context.currentTime,.025);},
    setDucked(value){ducked=Boolean(value);if(master)master.gain.setTargetAtTime(outputVolume(),context.currentTime,.025);},
    stop,
    destroy(){stop();destroyed=true;if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);if(typeof window!=='undefined')window.removeEventListener('pagehide',stop);mix?.destroy();if(context){context.onstatechange=null;context.close().catch(()=>{});}},
  };
}
