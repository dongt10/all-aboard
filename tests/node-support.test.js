import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the advertised Node minimum supports the timer API used by the tests', t => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const version = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(pkg.engines.node);
  assert.ok(version, 'declare a complete minimum Node version');
  const [, major, minor] = version.map(Number);
  assert.ok(major > 20 || (major === 20 && minor >= 11), 'object-form mock timers need Node 20.11.0 or later');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fired = false;
  setTimeout(() => { fired = true; }, 25);
  t.mock.timers.tick(24);
  assert.equal(fired, false);
  t.mock.timers.tick(1);
  assert.equal(fired, true);
});
