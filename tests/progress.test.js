import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, scopeKey, loadState, saveState, normalizeState, cleanCreation, saveDraft, publishCreation, getCompleted, getCreations, getDraft, canStartParade, STORAGE_KEY } from '../src/progress.js';
import { normalizeEncounterSnapshot } from '../src/encounters.js';
import { createDefaultBand } from '../src/audio.js';
const memoryStorage = () => { const map = new Map(); return { getItem:key=>map.get(key)??null, setItem:(key,value)=>map.set(key,value) }; };
const sign = text => ({kind:'writing',text,chapter:0,grade:0});
const banner = {kind:'art',chapter:0,grade:0,background:'#fff1cf',stamps:[{shape:'star',color:'#e96163',x:25,y:45,rotation:90}]};

test('drafts survive without granting completion; publish preserves actual creation', () => {
  const original = createState();
  const draft = saveDraft(original,'art',banner);
  assert.deepEqual(getCompleted(draft),[]);
  assert.deepEqual(getDraft(draft,'art'),banner);
  assert.deepEqual(getCreations(draft),{});
  const published = publishCreation(draft,'art',banner);
  assert.deepEqual(getCompleted(published),['art']);
  assert.deepEqual(getCreations(published).art,banner);
  assert.deepEqual(original,createState());
  const edited = saveDraft(published,'art',{...banner,stamps:[]});
  assert.equal(getCreations(edited).art.stamps.length,1,'an unfinished edit does not replace the published design');
});

test('chapter and grade changes keep independent drafts and creations', () => {
  let state = publishCreation(createState(),'writing',sign('Hello!'));
  state.chapter=1;state.grade=2;
  state=publishCreation(state,'writing',{...sign('Grade two welcomes you'),chapter:1,grade:2});
  state.grade=5;state=saveDraft(state,'music',createDefaultBand());
  assert.deepEqual(getCompleted(state),[]);
  assert.equal(getDraft(state,'music').tracks.length,4);
  state.grade=2;assert.equal(getCreations(state).writing.text,'Grade two welcomes you');
  state.chapter=0;assert.equal(getCreations(state).writing.text,'Hello!');
  assert.equal(scopeKey(0,0),'chapter-0');
  assert.throws(()=>scopeKey(1,0),RangeError);
});

test('published creations and settings round-trip through local storage', () => {
  const storage=memoryStorage(); let state=publishCreation(createState(),'music',createDefaultBand());
  state=publishCreation(state,'art',banner);state.settings={largeText:true,reducedMotion:true};
  assert.equal(saveState(state,storage),true);
  assert.deepEqual(loadState(storage),state);
  const read=getCreations(state);read.art.stamps[0].color='#000';
  assert.equal(getCreations(state).art.stamps[0].color,'#e96163','reads are independent copies');
});

test('v1 migrates settings and completions without inventing creations or removing legacy save', () => {
  const storage=memoryStorage();
  const legacy={version:1,hasStarted:true,chapter:1,grade:3,settings:{largeText:true,reducedMotion:true},progress:{'chapter-1-grade-3':{art:{activityId:'art-c1-g3',reward:{label:'Handmade banner',icon:'🎨'},creation:'Ocean blue',completedAt:'2026-10-24T10:00:00Z'}}}};
  storage.setItem('all-aboard-demo-v1',JSON.stringify(legacy));
  const state=loadState(storage);
  assert.equal(state.version,2);assert.equal(state.grade,3);assert.deepEqual(getCompleted(state),['art']);
  assert.deepEqual(getCreations(state),{});assert.equal(state.settings.largeText,true);
  saveState(state,storage);assert.equal(JSON.parse(storage.getItem('all-aboard-demo-v1')).version,1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version,2);
});

test('corrupt, unsupported, and denied storage stay playable', () => {
  const storage=memoryStorage();storage.setItem(STORAGE_KEY,'{broken');
  assert.deepEqual(loadState(storage),createState());
  storage.setItem(STORAGE_KEY,'{"version":99}');assert.deepEqual(loadState(storage),createState());
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
  assert.deepEqual(loadState(denied),createState());assert.equal(saveState(createState(),denied),false);
  assert.deepEqual(loadState(null),createState());
});

test('invalid fields, oversized payloads, and prototype keys cannot become world markup', () => {
  const text=cleanCreation('writing',sign('<img src=x>hello\u0000'));
  assert.equal(text.text,'<img src=x>hello\u0000', 'sign text is retained; renderers escape it as text');
  assert.equal(cleanCreation('art',{...banner,background:'url(https://example.com)'}).background,'#fff1cf');
  const art=cleanCreation('art',{...banner,stamps:[{shape:'star',color:'#fff1cf',x:999,y:-1,rotation:NaN}]});
  assert.equal(art.stamps[0].x,95);assert.equal(art.stamps[0].y,5);
  assert.equal(cleanCreation('__proto__',{kind:'__proto__'}),null);
  const corrupted=JSON.parse('{"version":2,"drafts":{"__proto__":{"polluted":true},"chapter-0":{"constructor":{"kind":"writing"}}}}');
  assert.deepEqual(normalizeState(corrupted).drafts,{});assert.equal({}.polluted,undefined);
});

test('re-publishing updates one contribution and never duplicates it', () => {
  let state=publishCreation(createState(),'writing',sign('First'));
  state=publishCreation(state,'writing',sign('Second'));
  assert.deepEqual(getCompleted(state),['writing']);assert.equal(getCreations(state).writing.text,'Second');
});


test('persisted encounter snapshots obey controller limits and reopen without loss', () => {
  const cases = {
    math: {left:[99, ...Array(10).fill(5)],right:[1,2,3,5],rolled:true},
    science: {canopy:'left',time:100},
    art: {...banner,stamps:[...Array(35)].map(()=>({...banner.stamps[0],x:999,y:-10,rotation:500}))},
    reading: {found:['key','unknown','key','umbrella','book']},
    writing: {text:'Hello <neighbor>! '.repeat(10)},
    community: {placements:Array.from({length:16},()=>({item:'bench',x:0,y:100})),tried:true},
  };
  for (const [kind, data] of Object.entries(cases)) {
    const snapshot = cleanCreation(kind,{...data,kind,chapter:0,grade:0});
    assert.deepEqual(normalizeEncounterSnapshot(kind,snapshot,0,0),snapshot,kind);
    const storage=memoryStorage();
    const state=publishCreation(createState(),kind,snapshot);
    saveState(state,storage);
    assert.deepEqual(getDraft(loadState(storage),kind),snapshot,kind);
    assert.deepEqual(getCreations(loadState(storage))[kind],snapshot,kind);
  }
  assert.equal(cleanCreation('math',{kind:'math',...cases.math}).left.length,8);
  assert.equal(cleanCreation('art',{kind:'art',...cases.art}).stamps.length,30);
});


test('parade requires a published creation in the current grade, not a legacy visit or draft', () => {
  let state=normalizeState({version:1,chapter:0,progress:{'chapter-0':{reading:{completedAt:'2026-10-24T10:00:00Z',creation:'old text'}}}});
  assert.deepEqual(getCompleted(state),['reading']);
  assert.equal(canStartParade(state),false);
  state=saveDraft(state,'writing',sign('Welcome'));
  assert.equal(canStartParade(state),false);
  state=publishCreation(state,'writing',sign('Welcome'));
  assert.equal(canStartParade(state),true);
  state.chapter=1;state.grade=1;
  assert.equal(canStartParade(state),false);
  state.chapter=0;
  assert.equal(canStartParade(state),true);
});


test('reading preserves known discoveries in canonical order and replay leaves published story intact', () => {
  const reading = found => ({kind:'reading',chapter:0,grade:0,found});
  assert.deepEqual(cleanCreation('reading',reading(['book','key','book','unknown'])).found,['key','book']);
  assert.deepEqual(cleanCreation('reading',reading(['book'])).found,['book']);
  let state=publishCreation(createState(),'reading',reading(['book','umbrella','key']));
  state=saveDraft(state,'reading',reading([]));
  const storage=memoryStorage();saveState(state,storage);state=loadState(storage);
  assert.deepEqual(getDraft(state,'reading').found,[]);
  assert.deepEqual(getCreations(state).reading.found,['key','umbrella','book']);
  assert.deepEqual(getCompleted(state),['reading']);
});
