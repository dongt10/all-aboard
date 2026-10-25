import { gradeBand } from '../encounters.js';
import pizza from './activities/pizza.js';
import chain from './activities/chain.js';
import helpday from './activities/helpday.js';
import tales from './activities/tales.js';
import cart from './activities/cart.js';
import ice from './activities/ice.js';
import story from './activities/story.js';
import banner from './activities/banner.js';
import square from './activities/square.js';
import sign from './activities/sign.js';

/*
The Activity contract. Each module in src/ui/activities/ default-exports one.

  Activity = {
    kind, title, help,                                   // help: 1–4 short steps, the last one naming the finish command
    rewardLabel?,                                      // optional item-get name; defaults to the character reward
    notReadyLine?,                                       // optional: said when an action with no line makes the creation unready
    start(snapshot, { chapter, grade }) → { state, ui }, // state = normalizeEncounterSnapshot(kind, snapshot, grade, chapter)
    opening(state, ui, grade) → string,
    commands(state, ui, grade) → Command[],
    act(state, ui, action, grade) → { state, ui, line? },
    mountField(host, { grade, dispatch }) → { update(state, ui), destroy() },
  }

- Resolve with activityFor(kind, rawGrade) before start(). Band activities normalize their own
  snapshots and use an activity discriminator.
- `state` is the saved creation; `ui` is everything else the screen needs (tool choice, last roll …).
- `commands` returns at most 4 commands (see menu.js for the Command shape). Each has an icon or art and a
  label of at most 12 characters (9 or fewer keeps the full font size). At most one is the finish
  (`finish: true`, icon `check`): it is LAST, shown from the start, and disabled until encounterReady(state).
  (K–2 reading is the one exception: its four picture choices fill the menu, so it may omit the finish until
  ready.) The encounter scene handles the finish command itself and pads shorter menus so the finish
  always renders bottom-right (menu.js arrangeCommands).
- `act` is pure. An action is `{ type: 'command', id }` or `{ type: 'field', … }` (the field's own shape).
  It returns the same `state` object when nothing saved changed, so the scene can skip saving.
- `start`, `opening`, `commands` and `act` never touch the DOM. `mountField` builds its DOM once inside
  the 520×268 field host, calls `dispatch(action)` for taps, and updates in place.
*/
export const ACTIVITIES = { math: cart, science: ice, art: banner, reading: story, writing: sign, community: square };

export const BANDED = {
  math: { 3: pizza },
  science: { 3: chain },
  community: { 3: helpday },
  reading: { 3: tales },
};

export function activityFor(id, grade) {
  return BANDED[id]?.[gradeBand(grade)] ?? ACTIVITIES[id];
}
