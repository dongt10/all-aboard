// The seven subject neighbors, in CHARACTERS order. All have side walks; Yuki, Sora, Fumi, Hana and Kiko also have back walks.
const WANDER_VIEWS = ['front', 'left', 'right'];
const ALL_VIEWS = [...WANDER_VIEWS, 'back'];
const neighbor = (id, name, species, views = WANDER_VIEWS) => ({ id, name, species, sheet: `assets/figures/${id}.png`, views, walks: true, joy: true });

export const NEIGHBORS = [
  neighbor('math', 'Taro', 'tanuki'),
  neighbor('science', 'Momo', 'rabbit'),
  neighbor('art', 'Yuki', 'cat', ALL_VIEWS),
  neighbor('reading', 'Sora', 'otter', ALL_VIEWS),
  neighbor('writing', 'Fumi', 'fox', ALL_VIEWS),
  neighbor('community', 'Hana', 'deer', ALL_VIEWS),
  neighbor('music', 'Kiko', 'sparrow', ALL_VIEWS),
];
