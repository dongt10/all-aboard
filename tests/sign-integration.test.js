import test from 'node:test';
import assert from 'node:assert/strict';
import { Doc, Event, Target } from './helpers/dom.js';
import { createEncounterScene } from '../src/ui/screens/encounter.js';
import { createState, getDraft, getCreations, saveDraft, saveState, loadState } from '../src/progress.js';
import { scenariosFor, tilesFor } from '../src/sign-scenarios.js';

const doc = new Doc();
doc.fonts = new Target();
Object.assign(globalThis, { document: doc, window: new Target(), MutationObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const storage = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }; };
function setup(grade, large = false, initial = null, store = storage()) {
  doc.body.children = []; doc._active = null;
  const stage = doc.createElement('div'); doc.body.append(stage);
  if (large) stage.classList.add('large-text');
  let state = initial ?? { ...createState(), chapter: grade === 0 ? 0 : 1, grade };
  const ctx = { stage, gone: [], spoken: [], getState: () => state, commit(next) { state = next; assert.ok(saveState(state, store)); },
    go(name, params) { this.gone.push([name, params]); return Promise.resolve(true); }, speak(text) { this.spoken.push(text); }, open: { help() {} } };
  const scene = createEncounterScene(ctx, { id: 'writing' }); scene.mount();
  return { ctx, scene, store };
}
const slot = (stage, id) => stage.querySelectorAll('.cmd-slot').find(button => button.dataset.id === id);
const type = (stage, text) => { const face = stage.querySelector('textarea'); face.value = text; face.dispatchEvent(new Event('input')); };
const draft = ctx => getDraft(ctx.getState(), 'writing');
const checks = stage => stage.querySelectorAll('.sign-check');
function currentScenario(stage, grade) {
  const labels = stage.querySelectorAll('.sign-tile').map(tile => tile.textContent);
  return scenariosFor(grade).find(s => JSON.stringify((grade >= 3 ? [...tilesFor(s, grade).describing, ...tilesFor(s, grade).phrases] : tilesFor(s, grade).phrases).sort()) === JSON.stringify([...labels].sort()));
}
function feedback(stage) {
  const slots = stage.querySelectorAll('.cmd-slot').filter(button => button.dataset.id);
  assert.ok(slots.length <= 4);
  for (const button of slots) assert.ok(button.textContent.trim().length <= 12, button.textContent);
  const line = stage.querySelector('.dlg__text').textContent;
  assert.ok(line.length <= 56, line);
  assert.doesNotMatch(line, /\bwrong\b/i);
}

for (const grade of [0, 1, 2, 3, 4, 5]) for (const large of [false, true]) {
  test(`writing grade ${grade}, ${large ? 'large' : 'normal'}: every scenario publishes its example`, async t => {
    for (const scenario of scenariosFor(grade)) {
      const base = { ...createState(), chapter: grade === 0 ? 0 : 1, grade };
      const initial = saveDraft(base, 'writing', { kind: 'writing', chapter: base.chapter, grade, scenario: scenario.id, text: '' });
      const { ctx, scene, store } = setup(grade, large, initial); t.after(() => { scene.destroy(); ctx.stage.remove(); });
      assert.equal(currentScenario(ctx.stage, grade)?.id, scenario.id);
      {
        let remaining = scenario.example;
        while (remaining) {
          const tile = ctx.stage.querySelectorAll('.sign-tile').find(button => remaining === button.textContent || remaining.startsWith(`${button.textContent} `));
          assert.ok(tile, `${scenario.id}: ${remaining} must be built from visible tiles`);
          remaining = remaining.slice(tile.textContent.length).trimStart(); tile.click();
        }
      }
      feedback(ctx.stage);
      assert.equal(slot(ctx.stage, 'finish').disabled, false, `${scenario.id}: ${scenario.example}`);
      slot(ctx.stage, 'finish').click(); ctx.stage.querySelector('.item-get__go').click(); await tick();
      const published = getCreations(loadState(store)).writing;
      assert.deepEqual(published.tiles, draft(ctx).tiles);
      assert.deepEqual(getDraft(loadState(store), 'writing').tiles, draft(ctx).tiles);
      assert.equal(published.scenario, scenario.id); assert.equal(published.text, scenario.example);
      assert.deepEqual(ctx.gone.at(-1), ['village', { focus: 'writing', celebrate: 'writing' }]);
      scene.destroy(); ctx.stage.remove();
    }
  });
}

for (const grade of [1, 2, 3, 4, 5]) for (const large of [false, true]) test(`writing grade ${grade}, ${large ? 'large' : 'normal'}: editing and reload`, async t => {
  const store = storage(); let mounted = setup(grade, large, null, store); t.after(() => { mounted.scene.destroy(); mounted.ctx.stage.remove(); });
  let { ctx } = mounted;
  const initial = currentScenario(ctx.stage, grade).id;
  slot(ctx.stage, 'next').click(); const next = currentScenario(ctx.stage, grade).id; assert.notEqual(next, initial);
  type(ctx.stage, 'wellcome frend!');
  slot(ctx.stage, 'next').click(); assert.equal(currentScenario(ctx.stage, grade).id, next); assert.equal(draft(ctx).text, 'wellcome frend!');
  assert.ok(checks(ctx.stage).some(b => b.dataset.fix !== undefined));
  while (ctx.stage.querySelectorAll('.sign-check').some(b => b.dataset.fix !== undefined)) {
    ctx.stage.querySelectorAll('.sign-check').find(b => b.dataset.fix !== undefined).click();
  }
  assert.match(draft(ctx).text, /Welcome friend!/i);
  for (const [input, misspelling] of [['come to the fesival', 'fesival'], ['Hello momo!', 'momo']]) {
    type(ctx.stage, input);
    const hint = checks(ctx.stage).find(b => b.dataset.hint !== undefined && b.getAttribute('aria-label') === `Hint for ${misspelling}`);
    assert.ok(hint, `hint for ${misspelling}`); hint.click(); feedback(ctx.stage);
    const line = ctx.stage.querySelector('.dlg__text').textContent;
    ctx.stage.querySelector('[data-act="hear"]').click();
    assert.equal(ctx.spoken.at(-1), line, 'Hear speaks the chosen word hint');
    const fix = checks(ctx.stage).find(b => b.dataset.fix !== undefined && b.getAttribute('aria-label') === `Fix ${misspelling}`);
    assert.ok(fix, `fix for ${misspelling}`); fix.click();
    assert.ok(!draft(ctx).text.includes(misspelling));
    if (misspelling === 'fesival') assert.equal(draft(ctx).text, 'come to the festival');
  }
  type(ctx.stage, 'Hello Zephyr!');
  const keep = checks(ctx.stage).find(b => b.dataset.keep?.toLowerCase() === 'zephyr'); assert.ok(keep); keep.click();
  assert.ok(draft(ctx).kept.includes('zephyr')); feedback(ctx.stage);
  mounted.scene.destroy(); mounted = setup(grade, large, loadState(store), store); ctx = mounted.ctx;
  assert.equal(ctx.stage.querySelector('textarea').value, 'Hello Zephyr!'); assert.equal(draft(ctx).scenario, next);
  assert.ok(!checks(ctx.stage).some(b => b.dataset.keep?.toLowerCase() === 'zephyr'));
  slot(ctx.stage, 'remove').click(); assert.equal(draft(ctx).text, 'Hello');
  slot(ctx.stage, 'clear').click(); assert.equal(draft(ctx).text, '');
  slot(ctx.stage, 'next').click(); assert.notEqual(currentScenario(ctx.stage, grade).id, next);
  const publishedScenario = currentScenario(ctx.stage, grade).id;
  const text = `${scenariosFor(grade).find(s => s.id === publishedScenario).example} Hello Zephyr!`;
  type(ctx.stage, text);
  const keepAgain = checks(ctx.stage).find(b => b.dataset.keep?.toLowerCase() === 'zephyr'); if (keepAgain) keepAgain.click();
  assert.equal(slot(ctx.stage, 'finish').disabled, false, text);
  slot(ctx.stage, 'finish').click(); ctx.stage.querySelector('.item-get__go').click(); await tick();
  const published = getCreations(loadState(store)).writing;
  assert.equal(published.scenario, publishedScenario); assert.equal(published.text, text); assert.ok(published.kept.includes('zephyr'));
});

test('writing: legacy draft gains a scenario without losing text', t => {
  const state = { ...createState(), chapter: 1, grade: 2 };
  const old = saveDraft(state, 'writing', { kind: 'writing', chapter: 1, grade: 2, text: 'Hello friend!' });
  const { ctx, scene } = setup(2, false, old); t.after(() => scene.destroy());
  assert.equal(ctx.stage.querySelector('textarea').value, 'Hello friend!');
  type(ctx.stage, 'Hello friend! ');
  assert.ok(scenariosFor(2).some(s => s.id === draft(ctx).scenario));
  assert.equal(draft(ctx).text, 'Hello friend! ');
});
