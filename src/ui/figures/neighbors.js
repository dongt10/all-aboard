// The seven subject neighbors, in CHARACTERS order. All have side walks; Yuki and Fumi also have back walks.
const WANDER_VIEWS = ['front', 'left', 'right'];
const ALL_VIEWS = [...WANDER_VIEWS, 'back'];
const neighbor = (id, name, species, views = WANDER_VIEWS) => ({ id, name, species, sheet: `assets/figures/${id}.png`, views, walks: true, joy: true });

export const NEIGHBORS = [
  neighbor('math', 'Taro', 'tanuki'),
  neighbor('science', 'Momo', 'rabbit'),
  neighbor('art', 'Yuki', 'cat', ALL_VIEWS),
  neighbor('reading', 'Sora', 'otter'),
  neighbor('writing', 'Fumi', 'fox', ALL_VIEWS),
  neighbor('community', 'Hana', 'deer'),
  neighbor('music', 'Kiko', 'sparrow'),
];
