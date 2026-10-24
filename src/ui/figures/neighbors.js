// The seven subject neighbors, in CHARACTERS order. They wander, so each has a side view with walk steps.
const WANDER_VIEWS = ['front', 'left', 'right'];
const neighbor = (id, name, species) => ({ id, name, species, sheet: `assets/figures/${id}.png`, views: WANDER_VIEWS, walks: true, joy: true });

export const NEIGHBORS = [
  neighbor('math', 'Taro', 'tanuki'),
  neighbor('science', 'Momo', 'rabbit'),
  neighbor('art', 'Yuki', 'cat'),
  neighbor('reading', 'Sora', 'otter'),
  neighbor('writing', 'Fumi', 'fox'),
  neighbor('community', 'Hana', 'deer'),
  neighbor('music', 'Kiko', 'sparrow'),
];
