import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = paths => paths.map(read).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
// Declarations of every rule whose selector list contains `selector` exactly.
const rulesFor = (text, selector) => [...text.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, sel]) => sel.split(',').map(s => s.trim()).includes(selector)).map(([, , body]) => body).join(';');

test('every scene root is its own stacking context, so windows, item-get and the wipe sit above it', () => {
  const all = css(['src/ui/screens/title.css', 'src/ui/screens/village.css', 'src/ui/screens/encounter.css', 'src/ui/screens/music.css', 'src/ui/screens/parade.css']);
  for (const root of ['.scene', '.village', '.enc', '.music', '.parade']) {
    assert.match(rulesFor(all, root), /isolation:\s*isolate/, `${root} needs isolation: isolate`);
  }
});

test('pictures in command cells are sized, not left at 0×0', () => {
  const body = rulesFor(css(['src/ui/interaction.css']), '.cmd-slot__pic svg');
  assert.match(body, /width:\s*\d+px/);
  assert.match(body, /height:\s*\d+px/);
  assert.match(body, /flex:\s*none/);
});

test('the parade backdrop is a sunset street: a sun, lit houses and triangle bunting', async () => {
  const { paradeBackdropMarkup } = await import('../src/ui/parade-lineup.js');
  assert.equal(typeof paradeBackdropMarkup, 'function');
  const html = paradeBackdropMarkup();
  assert.equal((html.match(/class="parade-sun"/g) ?? []).length, 1);
  assert.ok((html.match(/class="parade-house"/g) ?? []).length >= 5, 'at least five houses');
  assert.ok((html.match(/class="parade-window"/g) ?? []).length >= 5, 'lit windows');
  assert.ok((html.match(/class="parade-flag/g) ?? []).length >= 10, 'triangle bunting');
  assert.match(html, /shape-rendering="crispEdges"/);
  assert.doesNotMatch(html, /gradient|<image|url\(/i);
});

test('index.html leaves the live region to app.js', () => {
  assert.equal((read('index.html').match(/id="announcements"/g) ?? []).length, 0);
});
