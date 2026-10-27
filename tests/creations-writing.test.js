import test from 'node:test';
import assert from 'node:assert/strict';
import { creationMarkup } from '../src/ui/creations.js';

test('published scenario signs and legacy signs show their escaped saved text', () => {
  const cases = [
    [{ kind: 'writing', scenario: 'stew-warning', text: 'Wait & let <stew> cool!' }, 'Wait &amp; let &lt;stew&gt; cool!'],
    [{ kind: 'writing', sentence: 'Hello, <friend>!' }, 'Hello, &lt;friend&gt;!'],
    [{ kind: 'writing', message: 'Come & play!' }, 'Come &amp; play!'],
  ];
  for (const [creation, expected] of cases) {
    assert.equal(creationMarkup('writing', creation), `<span class="creation creation--writing world-sign">${expected}</span>`);
  }
});
