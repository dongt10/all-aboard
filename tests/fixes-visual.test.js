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

