import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('roadmap assigns an implementation status to every subject and grade', () => {
  const roadmap = read('ROADMAP.md');
  const subjects = [...roadmap.matchAll(/^### (Math|Science|Reading|Writing|Art|Community|Music) ·[^\n]*\n([\s\S]*?)(?=^### |^## )/gm)];
  assert.equal(subjects.length, 7);
  for (const [, name, body] of subjects) {
    const rows = [...body.matchAll(/^\| (K|[1-5]) \| ([^|]+)\|/gm)];
    assert.deepEqual(rows.map(row => row[1]), ['K', '1', '2', '3', '4', '5'], name);
    for (const row of rows) assert.match(row[2], /^\*\*(Available|Partial|Planned)\*\* · /, `${name} ${row[1]}`);
  }
  for (const subject of ['Math', 'Reading', 'Community']) {
    const body = subjects.find(match => match[1] === subject)[2];
    assert.match(body, /^\| 3 \| \*\*Available\*\*/m, `${subject} grade 3`);
  }
  assert.match(roadmap, /Educator review is pending or not recorded for all rows/);
  assert.doesNotMatch(roadmap, /docs\/superpowers\/|### Now · UI remake/);
});

test('readme documents the play entry and recorded reference color swaps', () => {
  const readme = read('README.md');
  const manifest = JSON.parse(read('docs/art/source/neighbors/manifest.json'));
  assert.match(readme, /\[Play now\]\(https:\/\/playallaboard\.com\)/);
  assert.match(readme, /git clone https:\/\/github\.com\/dongt10\/all-aboard\.git\ncd all-aboard/);
  for (const id of ['math', 'science']) {
    const { name, colorSwap } = manifest.characters[id];
    assert.ok(readme.includes(`${name} ${colorSwap.from} → ${colorSwap.to}`));
  }
  assert.equal(Object.keys(manifest.characters).length, 9);
  assert.match(readme, /seven neighbors plus Pip and Nori/);
});

test('changelog describes preset choice, undo and saved tunes', () => {
  const changelog = read('CHANGELOG.md');
  assert.match(changelog, /Fresh bands start with the editable Minecraft preset/);
  assert.match(changelog, /Meadow Band remains available/);
  assert.match(changelog, /Undo preset restores the previous score/);
  assert.match(changelog, /existing saved tunes retain their notes and sounds/);
});
