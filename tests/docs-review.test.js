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

test('art plan protects every manifest reference and records the current transforms', () => {
  const plan = read('docs/All_Aboard_Character_and_Art_Plan.md');
  const manifest = JSON.parse(read('docs/art/source/neighbors/manifest.json'));
  for (const reference of Object.values(manifest.characters)) {
    assert.ok(plan.includes(`${reference.name} (\`${reference.composite}\`)`));
    assert.ok(plan.includes(`${reference.name} −${-reference.shift[1]}`));
    if (reference.colorSwap) assert.ok(plan.includes(`${reference.name} ${reference.colorSwap.from} → ${reference.colorSwap.to}`));
  }
  for (const phrase of ['4 × 4', 'offset (0, 0)', 'swatch box', 'border-connected', 'threshold of 128',
    '21, 22, 24, 26 and 48', '56 and 57', 'rows 48–56', 'eye box', 'right-mirror columns',
    'pending team confirmation', 'All nine characters require intentional source-reference, pinned-hash and manifest derivation updates',
    'The boy and girl use separate source layers']) assert.ok(plan.includes(phrase), phrase);
  assert.doesNotMatch(plan, /never redrawn or recolored|for other characters, edit their PNG/);
});

test('readme distinguishes optional pollen help and illustrative energy transfer', () => {
  const readme = read('README.md');
  assert.match(readme, /add Seed, Sun, and Water to the bed card; Bee is an optional pollen helper/);
  assert.match(readme, /5000 → 500 → 50 in this 10% example\./);
  const context = 'For the sunbeam charts, the numbers are pretend energy units comparing new growth across groups over the same time. Each example uses 10% at each feeding step; real transfer varies.';
  assert.ok(readme.includes(context));
  assert.ok(readme.indexOf(context) < readme.indexOf('| Subject | K |'));
  assert.doesNotMatch(readme, /add Seed, Sun, Water and Bee|and “10%\.”/);
});
