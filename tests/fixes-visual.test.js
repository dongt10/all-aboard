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

test('the item-get card draws box-style creations large, not at their easel size', () => {
  const body = rulesFor(css(['src/ui/screens/encounter.css']), '.item-get__art > span.creation');
  const zoom = Number(body.match(/zoom:\s*([\d.]+)/)?.[1]);
  assert.ok(zoom >= 2, `zoom ${zoom}`);
});

test('completed signs fit the item-get art content height and remain scrollable at both text sizes', () => {
  const all = css(['src/ui/screens/encounter.css']);
  const body = rulesFor(all, '.item-get__art > span.world-sign');
  const zoom = Number(body.match(/zoom:\s*([\d.]+)/)?.[1]);
  const height = Number(body.match(/max-height:\s*([\d.]+)px/)?.[1]);
  const art = rulesFor(all, '.item-get__art');
  const available = Number(art.match(/height:\s*([\d.]+)px/)[1]) - 2 * 8 - 2 * 4;
  assert.ok(height > 0 && height * zoom <= available, 'zoomed sign stays within the 164px content height');
  assert.match(body, /overflow-y:\s*auto/, 'long text can be scrolled instead of painting outside the card');
});

test('Guide signs fit the creation frame after zoom at either text size', () => {
  const all = css(['src/ui/screens/windows.css']);
  const body = rulesFor(all, '.guide-creation > span.world-sign');
  const zoom = Number(rulesFor(all, '.guide-creation > span.creation').match(/zoom:\s*([\d.]+)/)[1]);
  const height = Number(body.match(/max-height:\s*([\d.]+)px/)?.[1]);
  const width = Number(body.match(/max-width:\s*([\d.]+)px/)?.[1]);
  assert.ok(height > 0 && height * zoom <= 68, 'fits the frame content height');
  assert.ok(width > 0 && width * zoom <= 108, 'fits the frame content width');
  assert.match(body, /overflow-y:\s*auto/);
});

test('portrait heading and note follow the reading-size variables', () => {
  const all = css(['src/ui/kit.css']);
  assert.match(rulesFor(all, '.rotate-card__frame'), /font-size:\s*var\(--text-command\)/);
  assert.match(rulesFor(all, '.rotate-card__note'), /font-size:\s*var\(--text-small\)/);
});

test('dialogue measurement shares the visible text inset without joining its live region', () => {
  const all = css(['src/ui/interaction.css']);
  const body = rulesFor(all, '.dlg__measure');
  assert.match(body, /position:\s*absolute/);
  assert.match(body, /inset:\s*10px 14px 8px/);
  assert.match(body, /height:\s*auto/);
  assert.match(body, /visibility:\s*hidden/);
});
