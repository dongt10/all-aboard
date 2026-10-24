import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data.js';
import { normalizeEncounterSnapshot, encounterReady } from '../src/encounters.js';
import { cleanCreation } from '../src/progress.js';

test('all six hands-on subjects have compatible new draft and save contracts', () => {
  assert.deepEqual(CHARACTERS.map(c=>c.id).sort(),['art','community','math','music','reading','science','writing']);
  for(const chapter of [0,1]) for(const grade of chapter===0?[0]:[1,2,3,4,5]) {
    for(const character of CHARACTERS.filter(c=>c.id!=='music')) {
      const draft=normalizeEncounterSnapshot(character.id,null,grade,chapter);
      assert.ok(cleanCreation(character.id,draft),`${character.id} save is supported`);
      assert.equal(encounterReady(draft),false,`${character.id} does not start completed`);
    }
  }
});
