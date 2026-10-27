import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRoad, road, setRoad, PLAYER_START } from '../src/ui/village-map.js';
import { ROAD_MASK } from '../src/ui/village-layout.js';
import { readPNG } from './helpers/png.js';

const pixels = readPNG(new URL(`../${ROAD_MASK}`, import.meta.url));

function pendingImages(t) {
  const images = [];
  const globals = {
    Image: class {
      constructor() {
        this.naturalWidth = pixels.width;
        this.naturalHeight = pixels.height;
        images.push(this);
      }
    },
    document: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        return {
          getContext: () => ({
            drawImage() {},
            getImageData: () => ({ width: pixels.width, height: pixels.height, data: pixels.rgba }),
          }),
        };
      },
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => prior ? Object.defineProperty(globalThis, name, prior) : delete globalThis[name]);
  }
  setRoad(null);
  t.after(() => setRoad(null));
  return images;
}

test('a road image arriving after ten seconds still enables the village', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const images = pendingImages(t);
  let settled = false;
  const pending = loadRoad();
  pending.then(() => { settled = true; }, () => { settled = true; });
  t.mock.timers.tick(10000);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false, 'elapsed time does not discard an in-flight image');
  assert.equal(road(), null, 'walking stays locked until a valid map arrives');
  assert.equal(typeof images[0].onload, 'function');
  images[0].onload();
  const loaded = await pending;
  assert.equal(loaded, road());
  assert.equal(loaded.isWalkable(PLAYER_START), true);
  assert.equal(images[0].onload, null);
  assert.equal(images[0].onerror, null);
});

test('an actual image error rejects and a fresh attempt can recover', async t => {
  const images = pendingImages(t);
  const failed = assert.rejects(loadRoad(), /could not be loaded/);
  const staleLoad = images[0].onload;
  images[0].onerror();
  await failed;
  assert.equal(road(), null);
  assert.equal(images[0].onload, null);
  const retry = loadRoad();
  assert.equal(images.length, 2);
  staleLoad();
  assert.equal(road(), null, 'an old callback cannot install a failed attempt');
  images[1].onload();
  assert.equal((await retry).isWalkable(PLAYER_START), true);
});

test('concurrent callers keep sharing a slow image request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const images = pendingImages(t);
  const first = loadRoad();
  t.mock.timers.tick(10000);
  const second = loadRoad();
  assert.equal(images.length, 1);
  images[0].onload();
  const maps = await Promise.all([first, second]);
  for (const map of maps) assert.equal(map.isWalkable(PLAYER_START), true);
  await loadRoad();
  assert.equal(images.length, 1, 'successful requests remain cached');
});
