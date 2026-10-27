import test from 'node:test';
import assert from 'node:assert/strict';
import { createBandEngine, createDefaultBand } from '../src/audio.js';

function harness() {
  const original={AudioContext:globalThis.AudioContext,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  let interval, frame, context, onsets=[];
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){},addEventListener(){}});
  globalThis.AudioContext=class {
    constructor(){context=this;this.currentTime=0;this.state='running';this.destination={};this.gains=[];}
    createGain(){const n=node();this.gains.push(n);return n;}
    createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
    createOscillator(){const n=node();n.start=time=>onsets.push(time);return n;}
    createBiquadFilter(){return node();}
    createBuffer(){return {getChannelData:()=>new Float32Array(4000)};}
    createBufferSource(){return node();}
    resume(){return Promise.resolve();} close(){return Promise.resolve();}
  };
  globalThis.setInterval=fn=>(interval=fn,1);globalThis.clearInterval=()=>{};
  globalThis.requestAnimationFrame=fn=>(frame=fn,1);globalThis.cancelAnimationFrame=()=>{};
  return {get context(){return context;},get onsets(){return onsets;},tick(time){context.currentTime=time;interval();},paint(){frame();},restore(){Object.assign(globalThis,original);}};
}

test('finite playback schedules only eight beats and completes at the boundary',async()=>{
  const h=harness(), beats=[];let completed=0;
  try {
    const engine=createBandEngine({onBeat:event=>beats.push(event.beat)});
    const band=createDefaultBand();
    band.tracks=band.tracks.map(t=>({...t,enabled:t.id==='percussion',notes:Array(8).fill(0)}));
    await engine.start(band,{beats:8,onComplete:()=>completed++});
    // Run the scheduler ahead of painting, including the ninth onset's time.
    h.tick(5.5);h.paint();
    assert.deepEqual(beats,[0,1,2,3,4,5,6,7]);
    assert.equal(h.onsets.length,8);
    assert.ok(h.onsets.every(time=>time<5.055));
    assert.equal(completed,1);
    engine.destroy();
  } finally {h.restore();}
});

test('ordinary playback loops and ducking restores the latest volume',async()=>{
  const h=harness(),beats=[];
  try {
    const engine=createBandEngine({onBeat:event=>beats.push(event.beat)}), band=createDefaultBand();
    await engine.start(band);
    engine.setDucked(true);assert.equal(h.context.gains[0].gain.value,band.masterVolume*.25);
    engine.update({...band,masterVolume:.4});assert.equal(h.context.gains[0].gain.value,.1);
    engine.setDucked(false);assert.equal(h.context.gains[0].gain.value,.4);
    h.tick(5.5);h.paint();assert.deepEqual(beats.slice(0,9),[0,1,2,3,4,5,6,7,0]);
    engine.destroy();
  } finally {h.restore();}
});
