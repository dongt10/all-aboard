import test from 'node:test';
import assert from 'node:assert/strict';
import { Doc, El, Target, pressKey } from './helpers/dom.js';
import { createApp } from '../src/ui/app.js';
import { createState, STORAGE_KEY, getDraft, saveDraft } from '../src/progress.js';

function setup(raw, key = STORAGE_KEY) {
  const doc = new Doc();
  Object.assign(globalThis, {
    document: doc, window: Object.assign(new Target(), { innerWidth: 1920, innerHeight: 1080 }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    speechSynthesis: { cancels: 0, spoken: [], cancel() { this.cancels++; }, speak(utterance) { this.spoken.push(utterance.text); }, getVoices() { return [{ name: 'Samantha', lang: 'en-US', localService: true }]; } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } addEventListener() {} },
  });
  const host = doc.createElement('div');
  doc.body.append(host);
  const values = new Map([[key, raw]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return { doc, host, storage, app: createApp(host, { storage }) };
}

for (const [name, raw] of [
  ['damaged JSON', '  {broken 😺\n'],
  ['future version', '{"version":99,"drafts":{"keep":"this"}}'],
  ['unknown activity', JSON.stringify({ ...createState(), drafts: { 'chapter-0': { math: { kind: 'math', activity: 'future' } } } })],
  ['cleaner failure', JSON.stringify({ ...createState(), drafts: { 'chapter-1-grade-3': { math: { kind: 'math', activity: 'constructor', chapter: 1, grade: 3 } } } })],
]) test(`app protects ${name} through load, commit and reload`, async () => {
  const { app, doc, host, storage } = setup(raw);
  let reloaded;
  try {
    assert.equal(app.saveOk, false, 'warn before the first change');
    assert.equal(app.stage.querySelector('.save-off').hidden, false);
    assert.equal(doc.body.querySelector('[role="status"]').textContent, 'Old save kept. New play is not saved.');
    await app.go('title');
    const dialog = app.stage.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(dialog.querySelector('.win__title').textContent, 'Old save');
    assert.ok(dialog.querySelectorAll('button').length <= 4);
    for (const button of dialog.querySelectorAll('button')) assert.ok(button.textContent.length <= 12);
    for (const p of dialog.querySelectorAll('p')) assert.ok(p.textContent.length <= 56);
    dialog.querySelectorAll('button').find(button => button.textContent === 'Hear').click();
    assert.match(speechSynthesis.spoken.at(-1), /New play in this tab will not be saved/);
    const cancellations = speechSynthesis.cancels;
    dialog.querySelector('.win__close').click();
    assert.equal(speechSynthesis.cancels, cancellations + 1, 'closing also stops the recovery narration');
    app.stage.querySelector('.save-off button').click();
    assert.ok(app.stage.querySelector('[role="dialog"]'), 'the copy remains reachable after closing');
    app.stage.querySelector('.win__close').click();
    const next = saveDraft(app.getState(), 'writing', { kind: 'writing', chapter: 0, grade: 0, text: 'New work' });
    app.commit(next);
    assert.equal(getDraft(app.getState(), 'writing').text, 'New work', 'local play still works');
    assert.equal(app.saveOk, false);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    app.destroy();
    reloaded = createApp(host, { storage });
    reloaded.commit({ ...reloaded.getState(), avatar: 'girl' });
    assert.equal(reloaded.saveOk, false);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  } finally { app.destroy(); reloaded?.destroy(); }
});

test('migration refuses to shadow a legacy save changed by another tab', () => {
  const legacy = JSON.stringify({ ...createState(), version: 1 });
  const { app, storage } = setup(legacy, 'all-aboard-demo-v1');
  const newer = JSON.stringify({ ...createState(), version: 1, avatar: 'girl' });
  try {
    storage.setItem('all-aboard-demo-v1', newer);
    app.commit({ ...app.getState(), hasStarted: true });
    assert.equal(app.saveOk, false);
    assert.equal(storage.getItem(STORAGE_KEY), null);
    assert.equal(storage.getItem('all-aboard-demo-v1'), newer);
  } finally { app.destroy(); }
});

test('recovery exports the original text by keyboard without unlocking writes', async t => {
  const raw = '  {broken 😺\n';
  const { app, storage } = setup(raw, 'all-aboard-demo-v1');
  const blobs = [], downloads = [];
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:save-copy'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const originalClick = El.prototype.click;
  t.mock.method(El.prototype, 'click', function () {
    if (this.tagName === 'A') downloads.push({ name: this.download, url: this.href });
    return originalClick.call(this);
  });
  try {
    await app.go('title');
    const copy = app.stage.querySelectorAll('button').find(button => button.textContent === 'Keep copy');
    copy.focus();
    pressKey(copy, 'keydown', 'Enter');
    assert.deepEqual(downloads, [{ name: 'all-aboard-demo-v1-recovery.txt', url: 'blob:save-copy' }]);
    assert.equal(await blobs[0].text(), raw);
    app.commit({ ...app.getState(), avatar: 'girl' });
    assert.equal(app.saveOk, false);
    assert.equal(storage.getItem('all-aboard-demo-v1'), raw);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  } finally { app.destroy(); }
});

test('failed recovery export reports failure and leaves the saved bytes intact', async t => {
  const raw = '{broken';
  const { app, storage } = setup(raw);
  t.mock.method(URL, 'createObjectURL', () => { throw Error('unavailable'); });
  try {
    await app.go('title');
    app.stage.querySelectorAll('button').find(button => button.textContent === 'Keep copy').click();
    assert.equal(app.stage.querySelector('[role="status"]').textContent, 'Copy did not work. Your old save is still kept.');
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(app.saveOk, false);
  } finally { app.destroy(); }
});
