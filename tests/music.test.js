import test from 'node:test';
import assert from 'node:assert/strict';
const mockCompressor=()=>({threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){},disconnect(){}});
import {createDefaultBand,sanitizeBandSnapshot,notesForBeat,applyBeatChanges,createBandEngine,encodeWav} from '../src/audio.js';
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
 band.tracks.forEach(track=>{track.enabled=true;track.notes.fill(null);});assert.match(bandPlaybackMessage(band),/Everyone is resting/);assert.match(bandPlaybackMessage(band,{quiet:true}),/Quiet play: everyone is resting/);
 band.tracks[0].notes[0]=0;band.tracks[0].volume=0;assert.match(bandPlaybackMessage(band),/friends are muted/);
 band.tracks[0].volume=.5;band.masterVolume=0;assert.match(bandPlaybackMessage(band),/sound off/);assert.match(bandPlaybackMessage(band,{quiet:true}),/watch the beat without sound/);
 assert.equal(sanitizeBandSnapshot(band).masterVolume,0);band.masterVolume=.5;assert.match(bandPlaybackMessage(band),/Your band is playing/);
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
