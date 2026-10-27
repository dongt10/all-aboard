import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVillageChipLayout, neighborMarkup } from '../src/ui/screens/village.js';
import { CHARACTERS } from '../src/data.js';
import { hotspotRect, overlaps, VILLAGE_SPOTS, SIDE_SPOTS, wanderBounds } from '../src/ui/village-map.js';
import { Doc, Target, Event } from './helpers/dom.js';
import { declarations, resolveVars } from './helpers/css.js';

const css = readFileSync(new URL('../src/ui/screens/village.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
const kit = readFileSync(new URL('../src/ui/kit.css', import.meta.url), 'utf8');
const phoneCSS = readFileSync(new URL('../src/ui/phone.css', import.meta.url), 'utf8');

// The fake DOM has no font renderer. Supply deliberately roomy border-box fixtures;
// runtime uses actual offset sizes, never these estimates. CSS determines both text sizes.
function fixture(specs, large = false, phone = false) {
  const doc = new Doc(), fonts = new Target();
  let reads = 0;
  const variables = () => ({ ...declarations(tokens, ':root'), ...(large ? declarations(tokens, '.large-text') : {}),
    ...(phone ? declarations(phoneCSS, '.phone') : {}), ...(phone && large ? declarations(phoneCSS, '.phone.large-text') : {}) });
  const fontSize = () => parseFloat(resolveVars(declarations(css, '.village-name')['font-size'], variables()));
  let extraWidth = 0;
  const measure = (el, isTalk = false) => {
    Object.defineProperties(el, {
      offsetWidth: { get() { reads++; return Math.ceil(el.textContent.length * fontSize() * .65 + 24 + extraWidth); } },
      offsetHeight: { get() { reads++; return Math.max(isTalk && phone ? parseFloat(declarations(phoneCSS, '.phone .village-talk')['min-height']) : 0, Math.ceil(fontSize() * Number(declarations(kit, '.px-chip')['line-height']) + 12)); } },
    });
    return el;
  };
  const actors = specs.map(({ id, x, y }) => {
    const host = doc.createElement('div');
    const character = CHARACTERS.find(c => c.id === id);
    host.innerHTML = character ? neighborMarkup(character) : `<button><span class="village-name">${id}</span></button>`;
    const el = host.firstElementChild;
    measure(el.querySelector('.village-name'));
    return { id, el, pos: { x, y } };
  });
  const talk = measure(doc.createElement('button'), true);
  talk.textContent = 'Enter · Talk to Pip';
  const layout = createVillageChipLayout(actors, talk, () => large, fonts);
  const boxes = (near = null) => actors.map(a => {
    const el = a.id === near ? talk : a.el.querySelector('.village-name');
    const parent = a.id === near ? { x: 0, y: 0 } : hotspotRect(a.id, a.pos);
    return { x: parent.x + parseFloat(el.style.left) - el.offsetWidth / 2, y: parent.y + parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight };
  });
  return { actors, talk, layout, boxes, fonts, reads: () => reads, fontSize,
    setLarge: value => { large = value; }, widen: () => { extraWidth = 35; fonts.fire(new Event('loadingdone')); } };
}
const check = boxes => boxes.forEach((box, i) => {
  assert.ok(box.x >= 8 && box.y >= 8 && box.x + box.w <= 952 && box.y + box.h <= 532, JSON.stringify(box));
  boxes.slice(i + 1).forEach(other => assert.equal(overlaps(box, other), false, JSON.stringify([box, other])));
});

for (const phone of [false, true]) for (const large of [false, true]) {
  test(`close Sora/Yuki chips stagger with ${large ? 'Bigger' : 'normal'} words${phone ? ' on phone' : ''}`, () => {
    const f = fixture([{ id: 'reading', x: 400, y: 250 }, { id: 'art', x: 480, y: 250 }], large, phone);
    assert.equal(f.fontSize(), phone ? 20 : (large ? 20 : 16));
    f.layout.update(null);
    const boxes = f.boxes();
    check(boxes);
    assert.notEqual(boxes[0].y, boxes[1].y);
    boxes.forEach((b, i) => assert.equal(b.x + b.w / 2, f.actors[i].pos.x));
    f.actors[1].pos.x = 750;
    f.layout.update(null);
    assert.equal(f.boxes()[1].y, 254, 'rejoins the first row after wandering apart');
    f.layout.destroy();
  });

  test(`lone chip stays centred with ${large ? 'Bigger' : 'normal'} words${phone ? ' on phone' : ''}`, () => {
    const f = fixture([{ id: 'reading', x: 400, y: 250 }], large, phone);
    f.layout.update(null);
    const [box] = f.boxes();
    assert.equal(box.x + box.w / 2, 400);
    assert.equal(box.y, 254);
    f.layout.destroy();
  });

  test(`Talk replaces Pip's name and avoids other chips with ${large ? 'Bigger' : 'normal'} words${phone ? ' on phone' : ''}`, () => {
    const f = fixture([{ id: 'reading', x: 400, y: 250 }, { id: 'pip', x: 470, y: 252 }, { id: 'art', x: 550, y: 250 }], large, phone);
    f.layout.update('pip');
    check(f.boxes('pip'));
    assert.equal(parseFloat(f.talk.style.left), 470);
    assert.equal(parseFloat(f.talk.style.top), 254);
    f.layout.update(null);
    check(f.boxes());
    f.layout.update('art');
    check(f.boxes('art'));
    f.layout.destroy();
  });

  test(`stage edges and crowded rows stay readable with ${large ? 'Bigger' : 'normal'} words${phone ? ' on phone' : ''}`, () => {
    for (const x of [10, 480, 950]) {
      const f = fixture(CHARACTERS.map(c => ({ id: c.id, x, y: 510 })), large, phone);
      f.layout.update(null);
      check(f.boxes());
      f.layout.destroy();
    }
  });

  test(`all village wander bounds avoid chip collisions with ${large ? 'Bigger' : 'normal'} words${phone ? ' on phone' : ''}`, () => {
    const f = fixture(Object.entries({ ...VILLAGE_SPOTS, ...SIDE_SPOTS }).map(([id, p]) => ({ id, ...p })), large, phone);
    for (const tx of [0, .5, 1]) for (const ty of [0, .5, 1]) {
      f.actors.forEach(a => {
        const b = wanderBounds(a.id);
        a.pos = { x: b.minX + (b.maxX - b.minX) * tx, y: b.minY + (b.maxY - b.minY) * ty };
      });
      for (const near of [null, ...f.actors.map(a => a.id)]) {
        f.layout.update(near);
        check(f.boxes(near));
      }
    }
    f.layout.destroy();
  });
}

test('movement and unchanged frames reuse sizes; Bigger words and font loading remeasure', () => {
  const f = fixture([{ id: 'reading', x: 400, y: 250 }, { id: 'art', x: 560, y: 250 }]);
  f.layout.update(null);
  const measured = f.reads();
  for (let i = 0; i < 10; i++) f.layout.update(null);
  assert.equal(f.reads(), measured);
  f.actors[1].pos.x = 410;
  f.layout.update(null);
  assert.equal(f.reads(), measured, 'movement must not read layout');
  check(f.boxes());
  f.setLarge(true);
  const beforeLarge = f.reads();
  f.layout.update(null);
  assert.ok(f.reads() > beforeLarge);
  check(f.boxes());
  f.widen();
  const beforeFont = f.reads();
  f.layout.update(null);
  assert.ok(f.reads() > beforeFont);
  check(f.boxes());
  f.layout.destroy();
  assert.equal(f.fonts.listeners.loadingdone.length, 0);
});

test('chips use intrinsic widths and keep complete single-line text', () => {
  for (const selector of ['.village-name', '.village-talk']) {
    const style = declarations(css, selector);
    assert.equal(style.width, 'max-content');
    assert.equal(style['white-space'], 'nowrap');
    assert.notEqual(style.overflow, 'hidden');
    assert.notEqual(style['text-overflow'], 'ellipsis');
  }
});
