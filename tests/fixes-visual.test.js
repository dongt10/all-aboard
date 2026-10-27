import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = paths => paths.map(read).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
// Declarations of every rule whose selector list contains `selector` exactly.
const rulesFor = (text, selector) => [...text.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, sel]) => sel.split(',').map(s => s.trim()).includes(selector)).map(([, , body]) => body).join(';');

test('speech status reserves stage space and Guide actions can wrap at Bigger words', async () => {
  const styles = css(['src/ui/screens/windows.css']);
  assert.match(rulesFor(styles, '.voice-status'), /position:\s*fixed/);
  assert.match(rulesFor(styles, '.voice-status'), /bottom:\s*0/);
  assert.match(rulesFor(styles, '.voice-status'), /pointer-events:\s*none/);
  assert.match(rulesFor(styles, '.stage-viewport'), /padding-bottom:\s*calc\(env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*var\(--voice-status-height,\s*0px\)\)/);
  assert.match(rulesFor(styles, 'body:has(.large-text) .voice-status'), /font-size:\s*20px/);
  assert.match(rulesFor(styles, '.guide-page__actions'), /flex-wrap:\s*wrap/);
  const { fitStage } = await import('../src/ui/stage.js');
  for (const [width, height] of [[960, 540], [844, 390], [390, 844]]) {
    for (const statusHeight of [48, 96, 144]) {
      const fit = fitStage(width, height, { bottom: statusHeight });
      assert.ok(fit.top + fit.height <= height - statusHeight + 0.001, 'the game fits above the measured status');
    }
  }
});

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

test('completed reward signs expose their whole board and fit by measured scaling', async () => {
  const all = css(['src/ui/screens/encounter.css']);
  const body = rulesFor(all, '.item-get__art > span.world-sign');
  assert.match(body, /width:\s*240px/);
  assert.match(body, /height:\s*auto/);
  assert.match(body, /max-width:\s*none/);
  assert.match(body, /max-height:\s*none/);
  assert.match(body, /overflow:\s*visible/);
  assert.match(body, /overflow-wrap:\s*anywhere/);
  assert.match(body, /zoom:\s*1/);
  assert.match(body, /scale\(var\(--sign-scale/);
  const art = rulesFor(all, '.item-get__art');
  const width = Number(art.match(/width:\s*([\d.]+)px/)[1]) - 2 * 8 - 2 * 4;
  const height = Number(art.match(/height:\s*([\d.]+)px/)[1]) - 2 * 8 - 2 * 4;
  assert.deepEqual([width, height], [240, 164]);
  const { fitSignPreviews } = await import('../src/ui/creations.js');
  for (const naturalHeight of [77, 123, 246, 400]) {
    const sign = {
      offsetWidth: 240, offsetHeight: naturalHeight,
      style: { setProperty(key, value) { this[key] = value; } },
    };
    const dispose = fitSignPreviews({ querySelectorAll: () => [sign], ownerDocument: {} }, width, height);
    const scale = Number(sign.style['--sign-scale']);
    assert.equal(scale, Math.min(1, width / sign.offsetWidth, height / sign.offsetHeight));
    assert.ok(sign.offsetWidth * scale <= width + 1e-6);
    assert.ok(sign.offsetHeight * scale <= height + 1e-6);
    dispose();
  }
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
