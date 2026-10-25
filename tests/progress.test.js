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
  state.grade=5;state=saveDraft(state,'music',{...createDefaultBand(),chapter:1,grade:5});
  assert.deepEqual(getCompleted(state),[]);
  assert.equal(getDraft(state,'music').tracks.length,4);
  state.grade=2;assert.equal(getCreations(state).writing.text,'Grade two welcomes you');
  state.chapter=0;assert.equal(getCreations(state).writing.text,'Hello!');
  assert.equal(scopeKey(0,0),'chapter-0');
  assert.throws(()=>scopeKey(1,0),RangeError);
});

test('published creations and settings round-trip through local storage', () => {
  const storage=memoryStorage(); let state=publishCreation(createState(),'music',createDefaultBand());
  state=publishCreation(state,'art',banner);state.settings={largeText:true,reducedMotion:true,autoRead:true};state.avatar='girl';
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

test('Read to me defaults off and round-trips', () => {
  assert.equal(createState().settings.autoRead, false);
  const storage = memoryStorage(); const state = createState(); state.settings.autoRead = true;
  assert.equal(saveState(state, storage), true);
  assert.equal(loadState(storage).settings.autoRead, true);
});

test('the chosen kid round-trips and anything else falls back to the boy', () => {
  assert.equal(createState().avatar, 'boy');
  const storage = memoryStorage(); const state = createState(); state.avatar = 'girl';
  saveState(state, storage);
  assert.equal(loadState(storage).avatar, 'girl');
  for (const junk of ['player', 7, null, undefined, '<b>']) assert.equal(normalizeState({ ...createState(), avatar: junk }).avatar, 'boy');
});

test('a saved band keeps its speed and form, and unknown values fall back to Steady and A', () => {
  const band = { ...createDefaultBand(), tempo: 120, form: 'AB', chapter: 1, grade: 4 };
  const clean = cleanCreation('music', band);
  assert.equal(clean.tempo, 120); assert.equal(clean.form, 'AB'); assert.equal(clean.tracks.length, 4);
  const storage = memoryStorage(); const state = createState(); state.chapter = 1; state.grade = 4;
  saveState(publishCreation(state, 'music', band), storage);
  const loaded = loadState(storage);
  assert.equal(getCreations(loaded).music.tempo, 120); assert.equal(getCreations(loaded).music.form, 'AB');
  assert.deepEqual(getDraft(loaded, 'music'), clean);
  const junk = cleanCreation('music', { ...createDefaultBand(), tempo: 75, form: 'BAB' });
  assert.equal(junk.tempo, 90); assert.equal(junk.form, 'A');
  const old = cleanCreation('music', { kind: 'music', tracks: [] });
  assert.equal(old.tempo, 90); assert.equal(old.form, 'A', 'a save from before forms still loads');
  for (const value of ['60', 0, null, 121]) assert.equal(cleanCreation('music', { kind: 'music', tempo: value }).tempo, 90);
});

test('all four banded creations repair junk and round-trip through drafts and published saves', async () => {
  const { HELP_FITS } = await import('../src/helpday.js');
  const { expectedEnergy } = await import('../src/chain.js');
  const crew = Object.entries(HELP_FITS).map(([job, helper]) => ({ job, helper }));
  for (const grade of [3, 4, 5]) {
    const cases = [
      ['math', 'pizza', [
        { slices: 7, halves: 'yes', plates: [99, -1, 'x', 3, 3], tried: true },
        { slices: 8, halves: false, plates: [4, 4, 4, 4], tried: true },
      ]],
      ['science', 'chain', [
        { chain: ['<script>', 'fish', 'gull'], energy: [Infinity, -1, 'x'], shone: true },
        { chain: ['plant', 'fish', 'gull'], energy: expectedEnergy(grade), shone: true },
      ]],
      ['community', 'helpday', [
        { crew: [null, { job: 'bad', helper: 'pip' }, ...crew, crew[0]] },
        { crew },
      ]],
      ['reading', 'tales', [
        { deck: 1, found: ['key'], solved: ['hana-path', 'momo-kitchen'] },
        { deck: 0, solved: ['momo-kitchen', 'taro-pier', 'kiko-stage'] },
      ]],
    ];
    for (const [kind, activity, inputs] of cases) for (const values of inputs) {
      const snapshot = cleanCreation(kind, { kind, activity, chapter: 1, grade, ...values });
      assert.equal(snapshot.activity, activity);
      assert.deepEqual(normalizeEncounterSnapshot(kind, snapshot, grade, 1), snapshot);
      const storage = memoryStorage();
      const published = publishCreation({ ...createState(), chapter: 1, grade }, kind, snapshot);
      assert.equal(saveState(published, storage), true);
      const loaded = loadState(storage);
      assert.deepEqual(loaded, published);
      assert.deepEqual(getDraft(loaded, kind), snapshot);
      assert.deepEqual(getCreations(loaded)[kind], snapshot);
      assert.deepEqual(getCreations({ ...loaded, grade: grade === 3 ? 4 : 3 }), {});
      if (activity === 'tales' && values.deck === 1) assert.deepEqual(snapshot.solved, ['hana-path']);
      if (activity === 'helpday') assert.deepEqual(snapshot.crew, crew);
      if (activity === 'chain' && values.chain[0] === '<script>') {
        assert.deepEqual(snapshot.chain, [null, null, null]);
        assert.equal(snapshot.shone, false);
      }
    }
    const ice = { kind: 'science', chapter: 1, grade, canopy: 'left', time: 10 };
    assert.deepEqual(cleanCreation('science', ice), ice, 'legacy ice is never migrated by grade');
  }
});

test('saved maps snap and deduplicate cells, require a fresh trial, and round-trip', () => {
  const input = { kind: 'community', chapter: 1, grade: 1, tried: true, placements: [
    { item: 'bench', x: 11, y: 50 }, { item: 'quiet', x: 12, y: 49 },
    { item: 'quiet', x: -10, y: 11 }, { item: 'sign', x: 999, y: 30 },
  ] };
  const clean = cleanCreation('community', input);
  assert.deepEqual(clean.placements, [
    { item: 'bench', x: 10, y: 50 }, { item: 'quiet', x: 10, y: 10 }, { item: 'sign', x: 90, y: 30 },
  ]);
  assert.equal(clean.tried, false);
  assert.equal(input.tried, true, 'input is unchanged');
  assert.equal(input.placements.length, 4);
  assert.deepEqual(normalizeEncounterSnapshot('community', input, 1, 1), clean);
  const valid = { ...clean, tried: true };
  assert.deepEqual(cleanCreation('community', valid), valid, 'an unchanged map keeps its trial');
  const storage = memoryStorage();
  saveState(saveDraft({ ...createState(), chapter: 1, grade: 1 }, 'community', input), storage);
  assert.deepEqual(getDraft(loadState(storage), 'community'), clean);
});

test('only an absent activity discriminator uses the legacy save format', () => {
  const cart = { kind: 'math', chapter: 0, grade: 0, left: [2], right: [1, 1], rolled: true };
  const state = publishCreation(createState(), 'math', cart);
  for (const activity of ['unknown', 'chain', '', null, false, 0, undefined]) {
    const unsupported = { ...cart, activity, left: [1], right: [1] };
    assert.equal(cleanCreation('math', unsupported), null);
    const loaded = normalizeState({ ...state, drafts: { 'chapter-0': { math: unsupported } } });
    assert.deepEqual(getDraft(loaded, 'math'), cart, 'invalid draft falls back to the published cart');
  }
  for (const kind of ['science', 'art', 'reading', 'writing', 'community', 'music']) {
    assert.equal(cleanCreation(kind, { kind, activity: 'unknown' }), null, kind);
  }
  assert.deepEqual(cleanCreation('math', cart), cart);
});

test('drafts and progress reject snapshots from another chapter or grade', async () => {
  const { chainReady } = await import('../src/chain.js');
  const chain = { kind: 'science', activity: 'chain', chapter: 1, grade: 3,
    chain: ['plant', 'fish', 'gull'], energy: [100, 10, 1], shone: true };
  assert.equal(chainReady(chain), true);
  const record = { creation: chain, completedAt: '2026-10-24T10:00:00Z' };
  for (const [chapter, grade] of [[1, 5], [0, 1]]) {
    const scope = scopeKey(chapter, grade), state = { ...createState(), chapter, grade };
    const loaded = normalizeState({ ...state, drafts: { [scope]: { science: chain } }, progress: { [scope]: { science: record } } });
    assert.equal(getDraft(loaded, 'science'), null);
    assert.deepEqual(getCompleted(loaded), []);
    assert.deepEqual(getCreations(loaded), {});
    assert.deepEqual(saveDraft(state, 'science', chain), state);
    assert.deepEqual(publishCreation(state, 'science', chain), state);
  }
  const scoped = { ...createState(), chapter: 1, grade: 3 };
  for (const wrong of [{ ...chain, grade: 2 }, { ...chain, chapter: 0, grade: 0 }]) {
    const repaired = normalizeState({ ...scoped, drafts: { 'chapter-1-grade-3': { science: wrong } }, progress: { 'chapter-1-grade-3': { science: { ...record, creation: wrong } } } });
    assert.equal(getDraft(repaired, 'science'), null, 'activity clamping cannot hide the wrong scope');
    assert.deepEqual(getCompleted(repaired), []);
  }
  const valid = normalizeState({ ...scoped, drafts: { 'chapter-1-grade-3': { science: chain } }, progress: { 'chapter-1-grade-3': { science: record } } });
  assert.deepEqual(getDraft(valid, 'science'), chain);
  assert.equal(chainReady(getCreations(valid).science), true);
  const mixed = normalizeState({ ...valid, grade: 5, drafts: { 'chapter-1-grade-5': { science: chain } } });
  assert.equal(getDraft(mixed, 'science'), null);
  assert.equal(chainReady(getCreations({ ...mixed, grade: 3 }).science), true, 'valid grade remains intact');
});

test('tagged upper-grade activities are rejected in K–2 through every save path', () => {
  for (const [kind, activity] of [['math', 'pizza'], ['science', 'chain'], ['reading', 'tales'], ['community', 'helpday']]) {
    for (const [chapter, grade] of [[0, 0], [1, 1], [1, 2]]) {
      const creation = { kind, activity, chapter, grade, crew: [{ job: 'lanterns', helper: 'kiko' }] };
      const state = { ...createState(), chapter, grade: grade || 1 }, scope = scopeKey(chapter, grade);
      assert.equal(cleanCreation(kind, creation), null, `${activity} in ${scope}`);
      assert.deepEqual(saveDraft(state, kind, creation), state);
      assert.deepEqual(publishCreation(state, kind, creation), state);
      const storage = memoryStorage();
      storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, drafts: { [scope]: { [kind]: creation } },
        progress: { [scope]: { [kind]: { creation, completedAt: '2026-10-24T10:00:00Z' } } } }));
      const loaded = loadState(storage);
      assert.equal(getDraft(loaded, kind), null);
      assert.deepEqual(getCreations(loaded), {});
      const legacy = { ...creation }; delete legacy.activity;
      assert.ok(cleanCreation(kind, legacy), 'untagged legacy saves remain accepted');
    }
  }
});

test('writing tile runs are grade-validated, bounded, independent and preserved across save paths', () => {
  const phrase = 'Welcome, neighbors!';
  const snapshot = { kind: 'writing', chapter: 1, grade: 5, text: `Hi ${phrase} Come explore`, tiles: [phrase, 'Come explore'] };
  const original = { ...createState(), chapter: 1, grade: 5 };
  const storage = memoryStorage();
  const saved = publishCreation(saveDraft(original, 'writing', snapshot), 'writing', snapshot);
  saveState(saved, storage);
  const loaded = loadState(storage);
  assert.deepEqual(getDraft(loaded, 'writing'), snapshot);
  assert.deepEqual(getCreations(loaded).writing, snapshot);
  assert.deepEqual(normalizeEncounterSnapshot('writing', snapshot, 5, 1), snapshot);
  getDraft(loaded, 'writing').tiles.pop();
  assert.deepEqual(getDraft(loaded, 'writing').tiles, snapshot.tiles);
  const cases = [
    [{ ...snapshot, tiles: ['<img>', 'Come explore'] }, []],
    [{ ...snapshot, tiles: [null, {}] }, []],
    [{ ...snapshot, tiles: 'Come explore' }, []],
    [{ ...snapshot, tiles: ['Welcome'] }, []],
    [{ ...snapshot, text: 'Hi Welcome, neighbors! now' }, []],
    [{ ...snapshot, text: 'Hi Come explore' }, ['Come explore']],
    [{ ...snapshot, grade: 2 }, []],
    [{ ...snapshot, text: 'HelloCome explore', tiles: ['Come explore'] }, []],
    [{ kind: 'writing', chapter: 0, grade: 0, text: Array(60).fill('♡').join(' '), tiles: Array(500).fill('♡') }, Array(60).fill('♡')],
  ];
  for (const [input, tiles] of cases) {
    const clean = cleanCreation('writing', input);
    assert.deepEqual(clean.tiles, tiles);
    assert.deepEqual(normalizeEncounterSnapshot('writing', input, input.grade, input.chapter), clean);
    assert.deepEqual(cleanCreation('writing', clean), clean, 'validation is idempotent');
  }
  assert.deepEqual(cleanCreation('writing', { ...snapshot, tiles: [] }).tiles, [], 'typed text keeps an explicitly empty run');
  const legacy = { ...snapshot }; delete legacy.tiles;
  assert.equal(Object.hasOwn(cleanCreation('writing', legacy), 'tiles'), false, 'missing history stays distinct from typed text');
});

test('the deployed v2 storage key loads an independent save and receives new writes', () => {
  const fixture = {
    version: 2, hasStarted: true, chapter: 0, grade: 1, avatar: 'girl',
    settings: { largeText: true, reducedMotion: false, autoRead: true },
    progress: { 'chapter-0': { writing: {
      activityId: 'writing-festival', completedAt: '2026-10-24T10:00:00.000Z',
      creation: { kind: 'writing', chapter: 0, grade: 0, text: 'Hello!' },
    } } }, drafts: {},
  };
  const values = new Map([['all-aboard-demo-v2', JSON.stringify(fixture)]]), writes = [];
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push(key); values.set(key, value); },
  };
  const loaded = loadState(storage);
  assert.equal(getCreations(loaded).writing?.text, 'Hello!');
  assert.equal(loaded.avatar, 'girl');
  assert.deepEqual(loaded.settings, fixture.settings);
  loaded.settings.reducedMotion = true;
  assert.equal(saveState(loaded, storage), true);
  assert.deepEqual(writes, ['all-aboard-demo-v2']);
  const saved = JSON.parse(values.get('all-aboard-demo-v2'));
  assert.equal(saved.settings.reducedMotion, true);
  assert.equal(saved.progress['chapter-0'].writing.creation.text, 'Hello!');
});
