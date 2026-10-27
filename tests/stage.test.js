import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitStage, visibleViewport, mountStage, applySettings } from '../src/ui/stage.js';
import { Doc, Target, Event } from './helpers/dom.js';
import { readPNG } from './helpers/png.js';
import { serve } from '../server.js';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
const phones = [
  ['iPhone 17 Pro Max', 956, 440, 62],
  ['iPhone Air', 956, 440, 62],
  ['iPhone 17e', 874, 402, 47],
  ['small iPhone', 667, 375, 0],
];
// Insets and toolbar heights are fixtures, not a table of browser/device constants.
// Production always reads the viewport and CSS env values from the device.
for (const [name, width, height, side] of phones) {
  for (const bars of [0, 100]) test(`${name}: visible viewport with ${bars}px browser chrome keeps every stage edge safe`, () => {
    const view = visibleViewport({ innerWidth: width, innerHeight: height,
      visualViewport: { width, height: height - bars, offsetLeft: 0, offsetTop: bars / 2, scale: 1 } });
    const safe = { left: side, right: side, top: 0, bottom: side ? 21 : 0 };
    const box = fitStage(view.width, view.height, safe);
    closeTo(box.scale, (height - bars - safe.bottom) / 540);
    assert.ok(box.left >= safe.left);
    assert.ok(box.top >= safe.top);
    assert.ok(box.left + box.width <= width - safe.right + 1e-8);
    assert.ok(box.top + box.height <= view.height - safe.bottom + 1e-8);
    closeTo(box.width / box.height, 960 / 540);
    assert.equal(box.portrait, false);
  });
}

test('asymmetric notch and top/bottom insets center inside the safe rectangle', () => {
  const box = fitStage(956, 440, { left: 62, right: 0, top: 12, bottom: 21 });
  closeTo(box.top, 12);
  closeTo(box.height, 407);
  closeTo(box.left - 62, 956 - box.left - box.width);
});

test('desktop and iPad without insets retain their existing fit', () => {
  const ipad = fitStage(1210, 834);
  closeTo(ipad.scale, 1210 / 960);
  closeTo(ipad.top, (834 - 1210 * 540 / 960) / 2);
  assert.equal(ipad.left, 0);
  assert.deepEqual(fitStage(960, 540), { scale: 1, width: 960, height: 540, left: 0, top: 0, portrait: false });
  closeTo(fitStage(1366, 657).scale, 657 / 540);
  assert.equal(fitStage(390, 844, { top: 47, bottom: 34 }).portrait, true);
  assert.equal(fitStage(0, 0).scale, 0);
});

function install(t, visual = true) {
  const doc = new Doc(), win = new Target(), viewport = new Target();
  const orientation = new Target(), frames = new Map(), timers = new Map();
  let nextId = 0, now = 0;
  doc.documentElement = { clientHeight: 440 };
  doc.visibilityState = 'visible';
  Object.assign(viewport, { width: 956, height: 340, offsetLeft: 8, offsetTop: 50, scale: 1 });
  Object.assign(win, { innerWidth: 956, innerHeight: 440, document: doc, screen: { orientation },
    requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, delay) => { timers.set(++nextId, { fn, at: now + delay }); return nextId; },
    clearTimeout: id => timers.delete(id),
    getComputedStyle: () => ({ paddingLeft: '62px', paddingRight: '62px', paddingTop: '0px', paddingBottom: '21px' }),
    ...(visual ? { visualViewport: viewport } : {}),
  });
  for (const [key, value] of Object.entries({ document: doc, window: win, sessionStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: win.cancelAnimationFrame,
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
  })) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => { if (before) Object.defineProperty(globalThis, key, before); else delete globalThis[key]; });
  }
  const paint = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const tick = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  };
  return { doc, win, viewport, orientation, frames, timers, paint, tick };
}

test('mounted stage follows visible resize and scroll offsets, applies safe areas, and tears down', t => {
  const { doc, win, viewport, orientation, frames, timers } = install(t);
  const handle = mountStage(doc.body), host = handle.stage.parentElement;
  const expectFit = () => {
    const box = fitStage(viewport.width, viewport.height, { left: 62, right: 62, bottom: 21 });
    assert.equal(host.style.width, `${viewport.width}px`);
    assert.equal(host.style.height, `${viewport.height}px`);
    assert.equal(host.style.left, `${viewport.offsetLeft}px`);
    assert.equal(host.style.top, `${viewport.offsetTop}px`);
    assert.equal(handle.stage.style.transform, `translate(${box.left}px, ${box.top}px) scale(${box.scale})`);
  };
  expectFit();
  viewport.height = 419; viewport.fire(new Event('resize')); expectFit();
  viewport.offsetTop = 0; viewport.offsetLeft = 0; viewport.fire(new Event('scroll')); expectFit();
  viewport.width = 874; viewport.height = 302; win.fire(new Event('resize')); expectFit();
  viewport.height = 402; win.fire(new Event('orientationchange')); expectFit();
  applySettings(handle.stage, { largeText: true });
  assert.equal(handle.stage.classList.contains('large-text'), true);
  expectFit(); // Bigger words never changes the safe frame.
  handle.destroy();
  for (const [target, events] of [[win, ['resize', 'orientationchange', 'load', 'pageshow', 'visibilitychange']],
    [viewport, ['resize', 'scroll']], [orientation, ['change']]]) {
    for (const event of events) assert.equal(target.listeners[event].length, 0);
  }
  assert.equal(frames.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(doc.body.children.length, 0);
});

test('startup settling corrects stale measurements without resize and skips unchanged layouts', t => {
  const { doc, win, viewport, paint, tick, frames, timers } = install(t);
  win.navigator = { standalone: true };
  doc.documentElement.clientHeight = 340;
  const handle = mountStage(doc.body), host = handle.stage.parentElement;
  assert.equal(host.style.height, '340px');
  let writes = 0;
  handle.stage.style = new Proxy(handle.stage.style, {
    set(target, key, value) { writes++; target[key] = value; return true; },
  });
  paint(); tick(100);
  assert.equal(writes, 0);
  doc.documentElement.clientHeight = 400;
  tick(200);
  assert.equal(host.style.height, '400px');
  doc.documentElement.clientHeight = 440;
  tick(1200);
  assert.equal(host.style.height, '440px');
  assert.equal(writes, 2);
  assert.equal(frames.size, 0);
  assert.equal(timers.size, 0, 'settling ends after 1.5 seconds');
  viewport.height = 440;
  viewport.fire(new Event('resize'));
  assert.equal(writes, 2, 'visual viewport catching up needs no duplicate layout');
  handle.destroy();
});

for (const event of ['load', 'pageshow', 'visibilitychange', 'orientationchange', 'orientation change']) {
  test(`${event} refits immediately and settles later viewport changes`, t => {
    const { doc, win, viewport, orientation, tick } = install(t);
    const handle = mountStage(doc.body), host = handle.stage.parentElement;
    tick(1500);
    viewport.height = 400;
    if (event === 'visibilitychange') {
      doc.visibilityState = 'hidden'; win.fire(new Event(event, { target: doc }), true);
      assert.equal(host.style.height, '340px');
      doc.visibilityState = 'visible'; win.fire(new Event(event, { target: doc }), true);
    } else if (event === 'orientation change') orientation.fire(new Event('change'));
    else win.fire(new Event(event, { persisted: event === 'pageshow' }));
    assert.equal(host.style.height, '400px');
    viewport.height = 440;
    tick(1500);
    assert.equal(host.style.height, '440px');
    handle.destroy();
  });
}

for (const mode of ['Apple standalone', 'standalone', 'fullscreen']) {
  test(`${mode} uses 956x440 with a 21px bottom inset and discards stale launch offsets`, t => {
    const { doc, win, viewport } = install(t);
    if (mode === 'Apple standalone') win.navigator = { standalone: true };
    else win.matchMedia = query => ({ matches: query.includes(`(display-mode: ${mode})`) });
    viewport.offsetTop = -4;
    const handle = mountStage(doc.body), host = handle.stage.parentElement;
    assert.equal(host.style.height, '440px');
    assert.equal(host.style.width, '956px');
    assert.equal(host.style.top, '0px');
    assert.equal(host.style.left, '0px');
    const box = fitStage(956, 440, { left: 62, right: 62, bottom: 21 });
    closeTo(box.height, 419);
    closeTo(box.top, (440 - 21 - box.height) / 2);
    closeTo(box.left, (956 - box.width) / 2);
    assert.equal(handle.stage.style.transform, `translate(${box.left}px, 0px) scale(${419 / 540})`);
    win.getComputedStyle = () => ({ paddingLeft: '62px', paddingRight: '62px', paddingTop: '12px', paddingBottom: '21px' });
    viewport.fire(new Event('resize'));
    assert.equal(host.style.top, '0px');
    assert.equal(host.style['--stage-top'], '12px', 'top inset applies once, inside the viewport');
    assert.equal(host.style['--stage-height'], '407px');
    handle.destroy();
  });
}

test('standalone keeps keyboard viewport sizes and offsets for focused fields', t => {
  const { doc, win, viewport } = install(t);
  win.navigator = { standalone: true };
  const handle = mountStage(doc.body), host = handle.stage.parentElement;
  for (const tag of ['input', 'textarea', 'select', 'div']) {
    const field = doc.createElement(tag);
    if (tag === 'div') { field.isContentEditable = true; field.tabIndex = 0; }
    handle.stage.append(field); field.focus();
    viewport.fire(new Event('resize'));
    assert.equal(host.style.height, '340px', tag);
    assert.equal(host.style.top, '50px', tag);
    assert.equal(host.style.left, '8px', tag);
    field.remove();
  }
  viewport.fire(new Event('resize'));
  assert.equal(host.style.height, '440px');
  assert.equal(host.style.top, '0px');
  handle.destroy();
});

test('standalone height recovery requires scale 1 and never cancels pinch magnification', t => {
  const { doc, win, viewport, tick } = install(t);
  win.navigator = { standalone: true };
  viewport.scale = 1.005;
  assert.equal(visibleViewport(win).height, 340);
  Object.assign(viewport, { scale: 2, width: 478, height: 170 });
  const handle = mountStage(doc.body), host = handle.stage.parentElement;
  assert.equal(host.style.height, '340px', 'restored zoom uses its original base layout');
  Object.assign(viewport, { scale: 1, width: 956, height: 340 });
  viewport.fire(new Event('resize'));
  assert.equal(host.style.height, '440px');
  const transform = handle.stage.style.transform;
  Object.assign(viewport, { scale: 2, width: 478, height: 220, offsetTop: 80 });
  win.fire(new Event('pageshow')); tick(1500);
  assert.equal(handle.stage.style.transform, transform);
  assert.equal(host.style.height, '440px');
  assert.equal(host.style.top, '0px');
  handle.destroy();
});

test('pinch magnification keeps the last layout so fitting does not cancel native zoom or panning', t => {
  const { doc, viewport } = install(t);
  const handle = mountStage(doc.body), host = handle.stage.parentElement;
  const transform = handle.stage.style.transform;
  Object.assign(viewport, { scale: 2, width: 478, height: 170, offsetTop: 80, offsetLeft: 100 });
  viewport.fire(new Event('resize')); viewport.fire(new Event('scroll'));
  assert.equal(handle.stage.style.transform, transform);
  assert.equal(host.style.width, '956px');
  assert.equal(host.style.left, '8px');
  Object.assign(viewport, { scale: 1, width: 956, height: 440, offsetLeft: 0, offsetTop: 0 });
  viewport.fire(new Event('resize'));
  assert.notEqual(handle.stage.style.transform, transform);
  assert.equal(host.style.height, '440px');
  Object.assign(viewport, { width: 440, height: 956 }); viewport.fire(new Event('resize'));
  assert.equal(host.querySelector('.rotate-card').hidden, false);
  Object.assign(viewport, { scale: 2, width: 220, height: 478 }); viewport.fire(new Event('resize'));
  host.querySelector('.rotate-card button').click();
  assert.equal(host.querySelector('.rotate-card').hidden, true, 'Play anyway works even while magnified');
  assert.equal(handle.stage.inert, false);
  handle.destroy();
});

test('fallback viewport, portrait card, focus restoration, and Play anyway survive rotation', t => {
  const { doc, win } = install(t, false);
  assert.deepEqual(visibleViewport(win), { width: 956, height: 440, left: 0, top: 0, scale: 1 });
  const handle = mountStage(doc.body), host = handle.stage.parentElement;
  const play = doc.createElement('button'); handle.stage.append(play); play.focus();
  Object.assign(win, { innerWidth: 440, innerHeight: 956 }); win.fire(new Event('orientationchange'));
  const card = host.querySelector('.rotate-card'), button = card.querySelector('button');
  assert.equal(card.hidden, false); assert.equal(handle.stage.inert, true); assert.equal(doc.activeElement, button);
  Object.assign(win, { innerWidth: 956, innerHeight: 440 }); win.fire(new Event('orientationchange'));
  assert.equal(card.hidden, true); assert.equal(handle.stage.inert, false); assert.equal(doc.activeElement, play);
  Object.assign(win, { innerWidth: 440, innerHeight: 956 }); win.fire(new Event('resize'));
  button.click();
  assert.equal(card.hidden, true); assert.equal(handle.stage.inert, false);
  win.fire(new Event('resize')); assert.equal(card.hidden, true);
  handle.destroy();
});

test('a tab restored while magnified still establishes a usable base layout', t => {
  const { doc, viewport } = install(t);
  Object.assign(viewport, { scale: 2, width: 478, height: 170, offsetLeft: 100, offsetTop: 40 });
  const handle = mountStage(doc.body);
  assert.equal(handle.stage.parentElement.style.width, '956px');
  assert.equal(handle.stage.parentElement.style.height, '340px');
  const expected = fitStage(956, 340, { left: 62, right: 62, bottom: 21 });
  assert.equal(handle.stage.style.transform, `translate(${expected.left}px, ${expected.top}px) scale(${expected.scale})`);
  viewport.offsetLeft = 200; viewport.fire(new Event('scroll'));
  assert.equal(handle.stage.parentElement.style.left, '0px');
  handle.destroy();
});

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
test('Home Screen manifest and Apple metadata resolve to actual, correctly sized PNGs', () => {
  const html = read('index.html').toString();
  const path = html.match(/rel="manifest" href="([^"]+)"/)[1];
  const manifest = JSON.parse(read(path));
  assert.match(manifest.display, /^(standalone|fullscreen)$/);
  assert.equal(manifest.orientation, 'landscape');
  const url = new URL(path, 'https://example.test/festival/index.html');
  assert.equal(new URL(manifest.start_url, url).pathname, '/festival/index.html');
  assert.equal(new URL(manifest.scope, url).pathname, '/festival/');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    assert.equal(icon.type, 'image/png');
    const image = readPNG(new URL(`../assets/${icon.src}`, import.meta.url));
    assert.deepEqual([image.width, image.height], [size, size]);
    assert.deepEqual([...image.rgba.slice(0, 4)], [159, 220, 255, 255]);
  }
  const applePath = html.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/)[1];
  const apple = readPNG(new URL(`../${applePath}`, import.meta.url));
  assert.deepEqual([apple.width, apple.height], [180, 180]);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
});

test('the real server handler serves manifest and all icons with correct MIME, bytes and HEAD behavior', async () => {
  for (const [path, mime] of [
    ['assets/manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
    ...['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(name => [`assets/${name}`, 'image/png']),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      let status, headers, body;
      await serve({ method, url: `/${path}` }, { writeHead(code, values) { status = code; headers = values; }, end(value) { body = value; } });
      assert.equal(status, 200, `${method} ${path}`);
      assert.equal(headers['Content-Type'], mime);
      assert.equal(headers['X-Content-Type-Options'], 'nosniff');
      if (method === 'HEAD') assert.equal(body, undefined);
      else assert.deepEqual(body, read(path));
    }
  }
});
