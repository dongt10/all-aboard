import cart from './activities/cart.js';
import ice from './activities/ice.js';
import story from './activities/story.js';
import banner from './activities/banner.js';
import square from './activities/square.js';
import sign from './activities/sign.js';

/*
The Activity contract. Each module in src/ui/activities/ default-exports one.

  Activity = {
    kind, title, help,                                   // help: 1–4 short steps
    start(snapshot, { chapter, grade }) → { state, ui }, // state = normalizeEncounterSnapshot(kind, snapshot, grade, chapter)
    opening(state, ui, grade) → string,
    commands(state, ui, grade) → Command[],
    act(state, ui, action, grade) → { state, ui, line? },
    mountField(host, { grade, dispatch }) → { update(state, ui), destroy() },
  }

- `state` is the saved creation; `ui` is everything else the screen needs (tool choice, last roll …).
- `commands` returns at most 4 commands (see menu.js for the Command shape). Each has an icon or art and a
  label of at most 12 characters. At most one is the finish (`finish: true`, icon `check`), and it is
  enabled only when encounterReady(state). The encounter scene handles the finish command itself.
- `act` is pure. An action is `{ type: 'command', id }` or `{ type: 'field', … }` (the field's own shape).
  It returns the same `state` object when nothing saved changed, so the scene can skip saving.
- `start`, `opening`, `commands` and `act` never touch the DOM. `mountField` builds its DOM once inside
  the 520×268 field host, calls `dispatch(action)` for taps, and updates in place.
*/
export const ACTIVITIES = { math: cart, science: ice, art: banner, reading: story, writing: sign, community: square };
