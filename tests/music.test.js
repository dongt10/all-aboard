import test from 'node:test';
import assert from 'node:assert/strict';
const mockCompressor=()=>({threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){},disconnect(){}});
import {createDefaultBand,sanitizeBandSnapshot,notesForBeat,applyBeatChanges,createBandEngine,encodeWav,PATTERNS} from '../src/audio.js';
test('default band has four available musicians and eight original notes per phrase',()=>{
 const a=createDefaultBand(),b=createDefaultBand();assert.equal(a.tracks.length,4);assert.ok(a.tracks.every(t=>t.enabled&&t.notes.length===8));a.tracks[0].notes[0]=4;assert.equal(b.tracks[0].notes[0],0);
});
test('saved scores sanitize unknown tracks, unsafe notes, tempo and volume',()=>{
 const score=sanitizeBandSnapshot({tempo:999,masterVolume:4,tracks:[{id:'voice',notes:[0,1,2,3,4,-1,'4',null],enabled:false,volume:-1}]});
 assert.equal(score.tempo,90);assert.equal(score.masterVolume,1);assert.deepEqual(score.tracks[1].notes,[0,1,2,3,4,null,null,null]);assert.equal(score.tracks[1].volume,0);assert.equal(score.tracks[1].enabled,false);
});
test('mute changes on the next scheduled beat; phrase changes wait for beat one',()=>{
 const current=createDefaultBand(),pending=createDefaultBand();pending.tracks[0].enabled=false;pending.tracks[1].notes[0]=4;pending.tracks[1].pattern=1;
 const mid=applyBeatChanges(current,pending,3);assert.equal(mid.tracks[0].enabled,false);assert.equal(mid.tracks[1].notes[0],2);
 const boundary=applyBeatChanges(mid,pending,0);assert.equal(boundary.tracks[1].notes[0],4);assert.equal(boundary.tracks[1].pattern,1);
});
test('rests, zero volume and uninvited friends never schedule notes',()=>{
 const band=createDefaultBand();band.tracks[0].enabled=false;band.tracks[1].volume=0;assert.deepEqual(notesForBeat(band,0).map(t=>t.id),['percussion']);assert.deepEqual(notesForBeat(band,8),notesForBeat(band,0));
});
test('engine safely reports missing browser audio and permits repeated cleanup',async()=>{
 const statuses=[],engine=createBandEngine({onStatus:s=>statuses.push(s)});assert.equal(await engine.start(createDefaultBand()),false);assert.equal(statuses.at(-1),'unavailable');engine.stop();engine.destroy();engine.destroy();assert.equal(await engine.start(createDefaultBand()),false);
});
test('stop cancels already scheduled voices and destroy closes the shared context',async()=>{
 const original={AudioContext:globalThis.AudioContext,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 const oscillators=[];let contexts=0,closed=0,cancelled=0;
 const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 globalThis.AudioContext=class {
   constructor(){contexts++;this.currentTime=0;this.state='running';this.destination={};}
   resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}
   createDynamicsCompressor(){return mockCompressor();}
   createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
   createBiquadFilter(){return {frequency:parameter(),Q:parameter(),connect(){},disconnect(){}};}
   createOscillator(){const osc={frequency:parameter(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stops=(this.stops||0)+1;},addEventListener(){}};oscillators.push(osc);return osc;}
 };
 globalThis.requestAnimationFrame=()=>123;globalThis.cancelAnimationFrame=()=>cancelled++;
 try {
   const engine=createBandEngine();assert.equal(await engine.start(createDefaultBand()),true);assert.ok(oscillators.length>=3);
   engine.stop();assert.ok(oscillators.every(o=>o.stops===2&&o.disconnected));assert.equal(cancelled,1);
   assert.equal(await engine.start(createDefaultBand()),true);assert.equal(contexts,1);engine.destroy();assert.equal(closed,1);
 }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('WAV encoder writes stereo PCM header, interleaves channels and clips safely',()=>{
 const buffer={numberOfChannels:2,length:3,sampleRate:44100,getChannelData:i=>i?[.5,NaN,-.5]:[1,-2,0]};
 const bytes=encodeWav(buffer),view=new DataView(bytes);
 assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(view.getUint32(4,true),48);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),44100);assert.equal(view.getUint32(40,true),12);
 assert.deepEqual(Array.from({length:6},(_,i)=>view.getInt16(44+i*2,true)),[32767,16384,-32768,0,0,-16384]);
});
test('a pending audio resume cannot restart after stop',async()=>{
 const old=globalThis.AudioContext;let resume;
 globalThis.AudioContext=class{constructor(){this.destination={};}createDynamicsCompressor(){return mockCompressor();}createGain(){return{gain:{},connect(){},disconnect(){}};}resume(){return new Promise(resolve=>resume=resolve);}close(){return Promise.resolve();}};
 try{const engine=createBandEngine(),started=engine.start(createDefaultBand());engine.stop();resume();assert.equal(await started,false);engine.destroy();}
 finally{if(old===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=old;}
});
test('edits during a pending audio resume reach the first scheduled beat and master gain',async()=>{
 const original={AudioContext:globalThis.AudioContext,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 let resume,oscillators=0,engine;const volumes=[];
 const parameter=()=>({value:0,setValueAtTime(value){volumes.push(value);},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 globalThis.AudioContext=class{
   constructor(){this.currentTime=0;this.state='running';this.destination={};}
   resume(){return new Promise(resolve=>resume=resolve);}close(){return Promise.resolve();}
   createDynamicsCompressor(){return mockCompressor();}
   createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
   createOscillator(){oscillators++;return {frequency:parameter(),connect(){},disconnect(){},start(){},stop(){},addEventListener(){}};}
 };
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 try{
   const band=createDefaultBand();band.tracks.forEach(t=>{t.enabled=t.id==='bass';});
   engine=createBandEngine();const started=engine.start(band);
   const edited={...band,masterVolume:.2,tracks:band.tracks.map(t=>({...t,enabled:false}))};
   engine.update(edited);resume();
   assert.equal(await started,true);
   assert.equal(oscillators,0,'the first beat uses the edits made while resume was pending');
   assert.deepEqual(volumes,[.2],'startup preserves the latest band volume');
 }finally{engine?.destroy();for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('Play controller makes a second press cancel pending resume without a second start',async()=>{
 const {createPlaybackController}=await import('../src/music.js');
 let resolveStart,starts=0,stops=0;const events=[];
 const controller=createPlaybackController({start(){starts++;return new Promise(resolve=>resolveStart=resolve);},stop(){stops++;}},{onState:(state,reason)=>events.push([state,reason])});
 const pending=controller.toggle(createDefaultBand());assert.equal(controller.starting,true);assert.equal(controller.active,true);assert.deepEqual(events.at(-1),['starting','starting']);
 await controller.toggle(createDefaultBand());assert.equal(starts,1);assert.equal(stops,1);assert.equal(controller.active,false);
 const count=events.length;resolveStart(true);assert.equal(await pending,false);assert.equal(events.length,count);assert.deepEqual(events.at(-1),['stopped','stopped']);
});
test('a canceled old start cannot overwrite a newer successful Play state',async()=>{
 const {createPlaybackController}=await import('../src/music.js');
 const resumes=[],events=[];
 const controller=createPlaybackController({start(){return new Promise(resolve=>resumes.push(resolve));},stop(){}},{onState:(state,reason)=>events.push([state,reason])});
 const old=controller.toggle(createDefaultBand());controller.stop();const current=controller.toggle(createDefaultBand());
 resumes[1](true);assert.equal(await current,true);assert.deepEqual(events.at(-1),['playing','playing']);
 const count=events.length;resumes[0](false);assert.equal(await old,false);assert.equal(events.length,count);assert.equal(controller.active,true);
 controller.engineStopped();assert.equal(controller.active,false);assert.deepEqual(events.at(-1),['stopped','stopped']);
});

test('silent creative scores remain valid and playback distinguishes rests, mute and quiet mode',async()=>{
 const {bandPlaybackMessage}=await import('../src/music.js');
 const band=createDefaultBand();band.tracks.forEach(track=>track.enabled=false);
 const saved=sanitizeBandSnapshot(band);assert.ok(saved.tracks.every(track=>!track.enabled));assert.match(bandPlaybackMessage(saved),/Everyone is resting/);
 band.tracks.forEach(track=>{track.enabled=true;track.notes.fill(null);});assert.match(bandPlaybackMessage(band),/Everyone is resting/);assert.match(bandPlaybackMessage(band,{quiet:true}),/See beat: everyone is resting/);
 band.tracks[0].notes[0]=0;band.tracks[0].volume=0;assert.match(bandPlaybackMessage(band),/friends are muted/);
 band.tracks[0].volume=.5;band.masterVolume=0;assert.match(bandPlaybackMessage(band),/sound off/);assert.match(bandPlaybackMessage(band,{quiet:true}),/watch the beat without sound/);
 assert.equal(sanitizeBandSnapshot(band).masterVolume,0);band.masterVolume=.5;assert.match(bandPlaybackMessage(band),/Your band is playing/);
});
test('playback status includes phrase B notes and their volumes for AB and ABA',async()=>{
 const {bandPlaybackMessage}=await import('../src/music.js');
 for(const form of ['AB','ABA']){
   const band=createDefaultBand();band.form=form;band.tracks.forEach(t=>t.notes.fill(null));
   assert.deepEqual(notesForBeat(band,0),[]);
   assert.deepEqual(notesForBeat(band,8).map(({id,pitch})=>[id,pitch]),[['bass',0],['voice',3]]);
   assert.match(bandPlaybackMessage(band),/Your band is playing/);
   assert.match(bandPlaybackMessage(band,{quiet:true}),/watch the beat without sound/);
   band.tracks.forEach(t=>{t.volume=0;});
   assert.match(bandPlaybackMessage(band),/friends are muted/);
   assert.match(bandPlaybackMessage(band,{quiet:true}),/friend volumes are at zero/);
   band.tracks.forEach(t=>{t.volume=1;t.enabled=t.id==='percussion';});
   assert.match(bandPlaybackMessage(band),/Everyone is resting/,'Cricket keeps its rests in B');
   band.tracks[0].enabled=true;band.masterVolume=0;
   assert.match(bandPlaybackMessage(band),/sound off/);
   band.form='A';assert.match(bandPlaybackMessage(band),/Everyone is resting/,'unused B notes do not count');
 }
});

test('unexpected context suspension stops stale playback and never resumes automatically',async()=>{
 const original={AudioContext:globalThis.AudioContext,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 let context,cancelled=0,resumes=0;const statuses=[];
 globalThis.AudioContext=class{
   constructor(){context=this;this.state='running';this.currentTime=0;this.destination={};}
   resume(){resumes++;this.state='running';return Promise.resolve();}
   createDynamicsCompressor(){return mockCompressor();}
   createGain(){return {gain:{setValueAtTime(){}},connect(){},disconnect(){}};}
   close(){return Promise.resolve();}
 };
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>cancelled++;
 try{
   const band=createDefaultBand();band.tracks.forEach(t=>t.enabled=false);
   const engine=createBandEngine({onStatus:s=>statuses.push(s)});assert.equal(await engine.start(band),true);
   context.state='suspended';context.onstatechange();assert.deepEqual(statuses.slice(-2),['stopped','interrupted']);assert.equal(cancelled,1);
   context.state='running';context.onstatechange();assert.equal(resumes,1);assert.equal(statuses.at(-1),'interrupted');
   assert.equal(await engine.start(band),true);assert.equal(resumes,2);engine.destroy();assert.equal(context.onstatechange,null);
 }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('shared loudness stage sits before user volume and cleans up its audio nodes',async()=>{
 const {createBandMix,BAND_MIX_GAIN,BAND_MIX_HEADROOM}=await import('../src/audio.js');
 const destination={gain:{value:.37}},connections=[];let disconnected=0;
 const input={gain:{value:1},connect:node=>connections.push(['input',node]),disconnect:()=>disconnected++};
 const compressor={...mockCompressor(),connect:node=>connections.push(['compressor',node]),disconnect:()=>disconnected++};
 const headroom={gain:{value:1},connect:node=>connections.push(['headroom',node]),disconnect:()=>disconnected++};let gains=0;
 const mix=createBandMix({createGain:()=>gains++?headroom:input,createDynamicsCompressor:()=>compressor},destination);
 assert.equal(mix.input,input);assert.equal(input.gain.value,BAND_MIX_GAIN);assert.ok(input.gain.value>3&&input.gain.value<3.2);
 assert.deepEqual(connections,[['input',compressor],['compressor',headroom],['headroom',destination]]);assert.equal(headroom.gain.value,BAND_MIX_HEADROOM);assert.equal(destination.gain.value,.37);
 assert.ok(compressor.ratio.value>1);mix.destroy();assert.equal(disconnected,3);
});

test('speed and form are whitelisted: known values stay, anything else falls back to Steady and A',async()=>{
 const {TEMPOS,FORMS}=await import('../src/audio.js');
 assert.deepEqual(TEMPOS,[60,90,120]);assert.deepEqual(FORMS,['A','AB','ABA']);
 assert.deepEqual([createDefaultBand().tempo,createDefaultBand().form],[90,'A']);
 assert.equal(sanitizeBandSnapshot({tempo:60}).tempo,60);assert.equal(sanitizeBandSnapshot({tempo:120}).tempo,120);
 assert.equal(sanitizeBandSnapshot({form:'ABA'}).form,'ABA');assert.equal(sanitizeBandSnapshot({form:'AB'}).form,'AB');
 assert.equal(sanitizeBandSnapshot({tempo:75}).tempo,90);assert.equal(sanitizeBandSnapshot({tempo:'90'}).tempo,90);
 assert.equal(sanitizeBandSnapshot({form:'BAB'}).form,'A');assert.equal(sanitizeBandSnapshot({form:'aba'}).form,'A');
});
test('form AB brings the other tune for the melodic friends while Cricket keeps the steady part',async()=>{
 const {phraseAt,phraseNotes,phraseLength,PATTERNS}=await import('../src/audio.js');
 const band=createDefaultBand();band.form='AB';
 assert.equal(phraseLength(band),16);assert.deepEqual([0,7,8,15,16,24].map(b=>phraseAt(band,b)),['A','A','B','B','A','B']);
 const aba=createDefaultBand();aba.form='ABA';assert.deepEqual([0,8,16,24].map(b=>phraseAt(aba,b)),['A','B','A','A']);assert.equal(phraseLength(aba),24);
 const melody=band.tracks.find(t=>t.id==='melody'),drum=band.tracks.find(t=>t.id==='percussion');
 assert.deepEqual(phraseNotes(melody,'A'),PATTERNS.melody[0]);assert.deepEqual(phraseNotes(melody,'B'),PATTERNS.melody[1]);
 assert.deepEqual(phraseNotes(drum,'B'),drum.notes);
 melody.pattern=1;melody.notes=[...PATTERNS.melody[1]];assert.deepEqual(phraseNotes(melody,'B'),PATTERNS.melody[0],'the other preset of whichever tune is picked');
 melody.pattern=0;melody.notes=[...PATTERNS.melody[0]];
 const at=(beat,id)=>notesForBeat(band,beat).find(n=>n.id===id)?.pitch??null;
 assert.equal(at(8,'voice'),PATTERNS.voice[1][0]);assert.notEqual(at(8,'voice'),at(0,'voice'));
 assert.equal(at(9,'melody'),PATTERNS.melody[1][1]);assert.equal(at(1,'melody'),PATTERNS.melody[0][1]);assert.notEqual(at(9,'melody'),at(1,'melody'));
 for(let i=0;i<8;i++)assert.equal(at(8+i,'percussion'),at(i,'percussion'),`Cricket beat ${i}`);
 for(let i=0;i<8;i++)assert.deepEqual(notesForBeat(band,16+i),notesForBeat(band,i),'A comes back after B');
 const plain=createDefaultBand();for(let i=0;i<8;i++)assert.deepEqual(notesForBeat(plain,8+i),notesForBeat(plain,i),'form A repeats one phrase');
});
test('a new speed takes the very next beat; a new form waits for the start of a phrase',()=>{
 const current=createDefaultBand(),pending=createDefaultBand();pending.tempo=120;pending.form='ABA';
 const mid=applyBeatChanges(current,pending,3);assert.equal(mid.tempo,120);assert.equal(mid.form,'A');
 const later=applyBeatChanges(mid,pending,5);assert.equal(later.form,'A');
 const boundary=applyBeatChanges(mid,pending,0);assert.equal(boundary.tempo,120);assert.equal(boundary.form,'ABA');
 const nextPhrase=applyBeatChanges(mid,pending,8);assert.equal(nextPhrase.form,'ABA','any phrase start counts, not only beat 0');
 pending.form='A';const back=applyBeatChanges(boundary,pending,2);assert.equal(back.form,'ABA');assert.equal(applyBeatChanges(boundary,pending,16).form,'A');
});
test('the engine steps by the band speed, wraps at the form length and tells each beat its phrase',async()=>{
 const original={AudioContext:globalThis.AudioContext,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 const starts=[],beats=[];let context,paint=null,schedule=null;
 const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 globalThis.AudioContext=class{
   constructor(){context=this;this.currentTime=0;this.state='running';this.destination={};}
   resume(){return Promise.resolve();}close(){return Promise.resolve();}
   createDynamicsCompressor(){return mockCompressor();}
   createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
   createOscillator(){return {frequency:parameter(),connect(){},disconnect(){},start(time){starts.push(time);},stop(){},addEventListener(){}};}
 };
 globalThis.requestAnimationFrame=callback=>{paint=callback;return 1;};globalThis.cancelAnimationFrame=()=>{paint=null;};
 // Capture the scheduler instead of waiting on a real timer so a busy machine cannot flake the test.
 globalThis.setInterval=callback=>{schedule=callback;return 1;};globalThis.clearInterval=()=>{schedule=null;};
 try{
   const band=createDefaultBand();band.tempo=120;band.form='AB';band.tracks.forEach(t=>{t.enabled=t.id==='bass';});
   const engine=createBandEngine({onBeat:b=>beats.push(b)});assert.equal(await engine.start(band),true);
   assert.ok(schedule);context.currentTime=30;schedule();
   const gaps=starts.slice(1).map((t,i)=>+(t-starts[i]).toFixed(3));
   assert.ok(starts.length>=8,`bass played ${starts.length} notes`);assert.ok(gaps.every(g=>g%.5===0&&g>0),`every gap is a whole number of half-second beats at 120 bpm: ${gaps.join(',')}`);
   assert.deepEqual(starts.slice(0,4).map(t=>+(t-.055).toFixed(3)),[0,1.5,2,3],'bass pattern 0 sounds on beats 0, 3, 4 and 6');
   assert.ok(paint);paint();
   assert.ok(beats.length>=16,`${beats.length} beats were painted`);
   assert.deepEqual(beats.slice(0,17).map(b=>b.beat),[...Array(16).keys(),0],'the beat counter wraps at 16 for form AB');
   assert.deepEqual(beats.slice(0,17).map(b=>b.phrase),[...'AAAAAAAABBBBBBBBA']);
   assert.deepEqual(beats.slice(0,17).map(b=>b.phraseIndex),[...Array(8).fill(0),...Array(8).fill(1),0]);
   assert.equal(beats[8].notes.find(n=>n.id==='bass').pitch,PATTERNS.bass[1][0],'the B phrase plays the other bass tune');
   engine.destroy();
 }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('a shorter form picked mid-song restarts at A and never reports a beat past the new form',async()=>{
 const original={AudioContext:globalThis.AudioContext,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 let context,paint=null,schedule=null;
 globalThis.AudioContext=class{
   constructor(){context=this;this.currentTime=0;this.state='running';this.destination={};}
   resume(){return Promise.resolve();}close(){return Promise.resolve();}
   createDynamicsCompressor(){return mockCompressor();}
   createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
   createOscillator(){return {frequency:parameter(),connect(){},disconnect(){},start(){},stop(){},addEventListener(){}};}
 };
 globalThis.requestAnimationFrame=callback=>{paint=callback;return 1;};globalThis.cancelAnimationFrame=()=>{paint=null;};
 globalThis.setInterval=callback=>{schedule=callback;return 1;};globalThis.clearInterval=()=>{schedule=null;};
 const {phraseLength}=await import('../src/audio.js');
 // Beats land at .055 + .5 * k at 120 bpm; the scheduler looks .11 s ahead, so a clock of
 // .5 * k + .3 schedules beats 0..k and leaves k + 1 for the next call.
 async function run(from,to,switchAfterBeat) {
   const beats=[];
   const band=createDefaultBand();band.tempo=120;band.form=from;band.tracks.forEach(t=>{t.enabled=t.id==='bass';});
   const engine=createBandEngine({onBeat:b=>beats.push(b)});assert.equal(await engine.start(band),true);
   context.currentTime=.5*switchAfterBeat+.3;schedule();
   const changed={...band,form:to};engine.update(changed);
   context.currentTime=60;schedule();paint();engine.destroy();
   return beats;
 }
 try{
   let beats=await run('ABA','A',7);
   assert.ok(beats.length>24,`${beats.length} beats painted`);
   assert.deepEqual(beats.slice(0,9).map(b=>b.beat),[0,1,2,3,4,5,6,7,0],'beat 8 under the new form A is beat 0 again');
   assert.ok(beats.slice(0,8).every(b=>b.beat<phraseLength({form:'ABA'})&&b.phraseIndex<3),'before the switch every payload fits ABA');
   assert.ok(beats.slice(8).every(b=>b.beat<phraseLength({form:'A'})&&b.phraseIndex===0&&b.phrase==='A'),'after the switch every payload stays inside A');
   beats=await run('ABA','AB',15);
   assert.deepEqual(beats.slice(0,17).map(b=>b.beat),[...Array(16).keys(),0],'beat 16 under the new form AB wraps to 0, not phrase 2');
   assert.ok(beats.slice(16).every(b=>b.beat<16&&b.phraseIndex<2&&'AB'.includes(b.phrase)),'after the switch every payload stays inside AB');
   assert.deepEqual(beats.slice(16,33).map(b=>b.phraseIndex),[...Array(8).fill(0),...Array(8).fill(1),0]);
 }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('the listen preview renders whole forms at the band speed into an offline buffer',async()=>{
 const {renderBandPreview}=await import('../src/audio.js');
 const old=globalThis.OfflineAudioContext;const made=[];let starts=[];
 const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 globalThis.OfflineAudioContext=class{
   constructor(channels,length,sampleRate){made.push({channels,length,sampleRate});this.sampleRate=sampleRate;this.length=length;this.destination={};}
   createDynamicsCompressor(){return mockCompressor();}
   createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
   createOscillator(){return {frequency:parameter(),connect(){},disconnect(){},start(time){starts.push(time);},stop(){}};}
   startRendering(){return Promise.resolve({rendered:true,length:this.length});}
 };
 try{
   const band=createDefaultBand();band.tempo=120;band.form='AB';band.tracks.forEach(t=>{t.enabled=t.id==='bass';});
   const out=await renderBandPreview(band,{phrases:2});
   assert.equal(out.rendered,true);assert.equal(made.length,1);assert.equal(made[0].channels,2);assert.equal(made[0].sampleRate,44100);
   assert.equal(made[0].length,Math.ceil((16*60/120+1)*44100),'two 8-beat phrases of AB at Fast is 16 half-second beats plus a tail');
   const beats=starts.map(t=>+((t-.05)/.5).toFixed(3));
   assert.deepEqual(beats,[0,3,4,6,8,10,12,14],'bass tune 0 in A, then its other tune in B, every start a whole beat apart at 60/120 s');
   starts=[];const aba=createDefaultBand();aba.form='ABA';aba.tempo=90;aba.tracks.forEach(t=>{t.enabled=t.id==='bass';});
   await renderBandPreview(aba,{phrases:2});
   assert.equal(made[1].length,Math.ceil((24*60/90+1)*44100),'phrases:2 rounds up to one whole ABA run (24 beats), not 2 runs');
   assert.equal(Math.max(...starts),.05+22*(60/90),'the last bass note is beat 22 of the 24-beat run, spaced 60/90 s apart');
   starts=[];const plain=createDefaultBand();plain.tracks.forEach(t=>{t.enabled=t.id==='bass';});
   await renderBandPreview(plain,{phrases:2});
   assert.equal(made[2].length,Math.ceil((16*60/90+1)*44100),'form A at Steady still renders 16 beats as before');
   assert.equal(starts.length,8);
 }finally{if(old===undefined)delete globalThis.OfflineAudioContext;else globalThis.OfflineAudioContext=old;}
});
