const words = text => text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) ?? [];

function scenario(data) {
  const tiles = Object.freeze({
    phrases: Object.freeze([...data.tiles.phrases]),
    describing: Object.freeze([...data.tiles.describing]),
  });
  const seen = new Set();
  const vocabulary = [...data.vocabulary, ...[...tiles.phrases, ...tiles.describing, data.example].flatMap(words)]
    .filter(word => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return Object.freeze({ ...data, grades: Object.freeze([...data.grades]), tiles, vocabulary: Object.freeze(vocabulary) });
}

// IDs are saved with a child's sign. Keep them even when revising the words.
export const SIGN_SCENARIOS = Object.freeze([
  scenario({
    id: 'hello-momo', grades: [0], title: 'Hello, Momo',
    prompt: 'Make Momo a hello sign with two words.', reader: 'Momo',
    tiles: { phrases: ['Hello', 'Momo!', 'Welcome', 'friend!'], describing: [] },
    vocabulary: ['Momo', 'rabbit', 'hello', 'welcome', 'friend'],
    example: 'Hello Momo!', goal: 'words',
  }),
  scenario({
    id: 'taro-cart', grades: [0], title: "Taro's cart",
    prompt: "Label Taro's cart with two words.", reader: 'Taro',
    tiles: { phrases: ['Big', 'cart', 'Taro', 'wheels'], describing: [] },
    vocabulary: ['Taro', 'cart', 'wheels', 'wood', 'crates'],
    example: 'Big cart', goal: 'words',
  }),
  scenario({
    id: 'momo-menu', grades: [0], title: "Momo's menu",
    prompt: "Make a two-word menu for Momo's hungry neighbors.", reader: 'hungry neighbors',
    tiles: { phrases: ['Warm', 'stew', 'Sweet', 'beans'], describing: [] },
    vocabulary: ['Momo', 'menu', 'bowl', 'food', 'beans', 'stew'],
    example: 'Warm stew', goal: 'words',
  }),
  scenario({
    id: 'thank-pip', grades: [0], title: 'Thanks, Pip',
    prompt: 'Thank Pip for the mail with two words.', reader: 'Pip',
    tiles: { phrases: ['Thank', 'you!', 'Pip', 'kind'], describing: [] },
    vocabulary: ['Pip', 'mail', 'letter', 'thanks', 'duck'],
    example: 'Thank you!', goal: 'words',
  }),
  scenario({
    id: 'cheer-kiko', grades: [0], title: 'Go, Kiko',
    prompt: 'Make a two-word cheer for Kiko and the band.', reader: 'Kiko and the band',
    tiles: { phrases: ['Go,', 'Kiko!', 'Play', 'drums!'], describing: [] },
    vocabulary: ['Kiko', 'Cricket', 'band', 'music', 'drum'],
    example: 'Go, Kiko!', goal: 'words',
  }),
  scenario({
    id: 'welcome-nori', grades: [0], title: 'Welcome, Nori',
    prompt: 'Welcome Nori to the festival with two words.', reader: 'Nori',
    tiles: { phrases: ['Welcome', 'Nori!', 'Hello', 'friend!'], describing: [] },
    vocabulary: ['Nori', 'turtle', 'festival', 'friend'],
    example: 'Welcome Nori!', goal: 'words',
  }),
  scenario({
    id: 'invite-momo', grades: [1, 2], title: 'An invite for Momo',
    prompt: 'Say hello to Momo. Invite her to the festival.', reader: 'Momo',
    tiles: { phrases: ['Hello,', 'Momo!', 'Come', 'to', 'our', 'festival.', 'play', 'please.'], describing: [] },
    vocabulary: ['Momo', 'hello', 'invite', 'welcome', 'friend', 'festival'],
    example: 'Hello, Momo! Come to our festival.', goal: 'sentence',
  }),
  scenario({
    id: 'thank-pip-note', grades: [1, 2], title: 'A thank-you for Pip',
    prompt: 'Thank Pip for bringing the festival mail.', reader: 'Pip',
    tiles: { phrases: ['Thank', 'you,', 'Pip!', 'You', 'bring', 'our', 'mail.', 'Hi,'], describing: [] },
    vocabulary: ['Pip', 'mail', 'letter', 'letters', 'thanks', 'help'],
    example: 'Thank you, Pip! You bring our mail.', goal: 'sentence',
  }),
  scenario({
    id: 'taro-pizza', grades: [1, 2], title: "Taro's pizza stall",
    prompt: "Tell hungry neighbors about Taro's pizza.", reader: 'hungry neighbors',
    tiles: { phrases: ['Taro', 'has', 'hot', 'pizza.', 'Come', 'eat', 'with', 'us!'], describing: [] },
    vocabulary: ['Taro', 'pizza', 'slice', 'slices', 'cheese', 'stall'],
    example: 'Taro has hot pizza.', goal: 'sentence',
  }),
  scenario({
    id: 'parade-path', grades: [1, 2], title: 'The parade path',
    prompt: 'Tell the neighbors where to meet for the parade.', reader: 'the neighbors',
    tiles: { phrases: ['Meet', 'at', 'the', 'square.', 'Come', 'to', 'parade.', 'Walk'], describing: [] },
    vocabulary: ['Hana', 'parade', 'square', 'map', 'path', 'neighbors'],
    example: 'Meet at the square.', goal: 'sentence',
  }),
  scenario({
    id: 'warm-stew', grades: [1, 2], title: "Momo's stew menu",
    prompt: 'Help Momo tell neighbors what is in her stew.', reader: 'hungry neighbors',
    tiles: { phrases: ['Momo', 'makes', 'warm', 'stew', 'with', 'beans.', 'Come', 'eat!'], describing: [] },
    vocabulary: ['Momo', 'menu', 'stew', 'beans', 'bowl', 'carrot', 'carrots'],
    example: 'Momo makes warm stew with beans.', goal: 'sentence',
  }),
  scenario({
    id: 'lost-hat', grades: [1, 2], title: 'A lost hat',
    prompt: 'Tell Nori where to find his lost hat.', reader: 'Nori',
    tiles: { phrases: ['Nori,', 'your', 'hat', 'is', 'at', 'the', 'kiosk.', 'Hello!'], describing: [] },
    vocabulary: ['Nori', 'Hana', 'hat', 'lost', 'found', 'kiosk', 'map'],
    example: 'Hello! Nori, your hat is at the kiosk.', goal: 'sentence',
  }),
  scenario({
    id: 'band-cheer', grades: [1, 2], title: 'A cheer for Kiko',
    prompt: 'Give Kiko and the band a cheer.', reader: 'Kiko and the band',
    tiles: { phrases: ['Go,', 'Kiko!', 'We', 'like', 'your', 'big', 'drum.', 'band!'], describing: [] },
    vocabulary: ['Kiko', 'Cricket', 'band', 'cheer', 'music', 'drum'],
    example: 'Go, Kiko! We like your big drum.', goal: 'sentence',
  }),
  scenario({
    id: 'hello-sora', grades: [1, 2], title: 'Hello, Sora',
    prompt: 'Say hello to Sora. Ask him to tell a story.', reader: 'Sora',
    tiles: { phrases: ['Hello,', 'Sora!', 'Please', 'tell', 'us', 'a', 'story.', 'funny'], describing: [] },
    vocabulary: ['Sora', 'story', 'stories', 'tale', 'book', 'otter'],
    example: 'Hello, Sora! Please tell us a funny story.', goal: 'sentence',
  }),
  scenario({
    id: 'invite-yuki', grades: [3, 4, 5], title: 'An invite for Yuki',
    prompt: 'Ask Yuki to bring her banner. Tell her why.', reader: 'Yuki',
    tiles: {
      phrases: ['Yuki, join our parade!', 'Bring your banner because', 'its colors are', 'The parade will be'],
      describing: ['bright.', 'big.', 'bold.', 'colorful.', 'lovely.', 'cheerful.'],
    },
    vocabulary: ['Yuki', 'banner', 'design', 'paint', 'parade', 'colors'],
    example: 'Yuki, join our parade! Bring your banner because its colors are bright.', goal: 'reason',
  }),
  scenario({
    id: 'thank-nori', grades: [3, 4, 5], title: 'A thank-you for Nori',
    prompt: 'Thank Nori for helping. Give him a reason.', reader: 'Nori',
    tiles: {
      phrases: ['Thank you, Nori!', 'We like your help because', 'you are', 'Our festival is'],
      describing: ['kind.', 'helpful.', 'careful.', 'patient.', 'gentle.', 'happy.'],
    },
    vocabulary: ['Nori', 'help', 'helper', 'thanks', 'festival', 'friends'],
    example: 'Thank you, Nori! We like your help because you are kind.', goal: 'reason',
  }),
  scenario({
    id: 'parade-guide', grades: [3, 4, 5], title: 'The parade route',
    prompt: 'Tell the neighbors why to meet in the square.', reader: 'the neighbors',
    tiles: {
      phrases: ['Meet us in the square.', 'We can all fit because', 'the square is', 'Walk with Hana.'],
      describing: ['big.', 'wide.', 'open.', 'roomy.', 'flat.', 'bright.'],
    },
    vocabulary: ['Hana', 'parade', 'square', 'map', 'route', 'path'],
    example: 'Meet us in the square. We can all fit because the square is big.', goal: 'reason',
  }),
  scenario({
    id: 'stew-warning', grades: [3, 4, 5], title: 'A stew warning',
    prompt: "Tell little kids why to let Momo's stew cool.", reader: 'little kids',
    tiles: {
      phrases: ['Let the stew cool.', 'Wait before eating because', 'the pot is', 'Ask Momo for help.'],
      describing: ['hot.', 'warm.', 'steamy.', 'full.', 'heavy.', 'big.'],
    },
    vocabulary: ['Momo', 'stew', 'cool', 'pot', 'bowl', 'wait', 'steam'],
    example: 'Let the stew cool. Wait before eating because the pot is hot.', goal: 'reason',
  }),
  scenario({
    id: 'cricket-drum', grades: [3, 4, 5], title: "Cricket's lost drum",
    prompt: 'Cricket lost a small drum. Say why this may be his.', reader: 'Cricket',
    tiles: {
      phrases: ['Cricket, we found a drum!', 'It may be yours because', 'the drum is', 'Ask at the map kiosk.'],
      describing: ['small.', 'red.', 'round.', 'shiny.', 'bright.', 'loud.'],
    },
    vocabulary: ['Cricket', 'Hana', 'drum', 'lost', 'found', 'kiosk', 'map'],
    example: 'Cricket, we found a drum! It may be yours because the drum is small.', goal: 'reason',
  }),
  scenario({
    id: 'band-invite', grades: [3, 4, 5], title: 'A band invitation',
    prompt: "Tell the neighbors why to come see Kiko's band.", reader: 'the neighbors',
    tiles: {
      phrases: ['Come see Kiko play!', 'Join us because', 'the band is', 'Meet us by the lanterns.'],
      describing: ['lively.', 'loud.', 'happy.', 'gentle.', 'soft.', 'fun.'],
    },
    vocabulary: ['Kiko', 'Cricket', 'band', 'lanterns', 'music', 'rhythm'],
    example: 'Come see Kiko play! Join us because the band is lively.', goal: 'reason',
  }),
  scenario({
    id: 'taro-crates', grades: [3, 4, 5], title: 'A sign for helpers',
    prompt: "Tell Taro's helpers why to carry a crate together.", reader: "Taro's helpers",
    tiles: {
      phrases: ['Carry this with a friend.', 'Ask for help because', 'the crate is', 'Taro can help us.'],
      describing: ['heavy.', 'big.', 'wide.', 'full.', 'solid.', 'bulky.'],
    },
    vocabulary: ['Taro', 'cart', 'crate', 'crates', 'carry', 'lift', 'together'],
    example: 'Carry this with a friend. Ask for help because the crate is heavy.', goal: 'reason',
  }),
  scenario({
    id: 'lantern-walk', grades: [3, 4, 5], title: 'A lantern walk',
    prompt: 'Tell Sora why to join our lantern walk.', reader: 'Sora',
    tiles: {
      phrases: ['Sora, join our walk!', 'We love it because', 'the lanterns are', 'Meet us at the square.'],
      describing: ['bright.', 'golden.', 'colorful.', 'glowing.', 'lovely.', 'round.'],
    },
    vocabulary: ['Sora', 'lantern', 'lanterns', 'walk', 'square', 'light'],
    example: 'Sora, join our walk! We love it because the lanterns are bright.', goal: 'reason',
  }),
  scenario({
    id: 'little-kids-map', grades: [5], title: 'For little kids',
    prompt: 'Tell little kids where to find Hana. Use easy words.', reader: 'little kids',
    tiles: {
      phrases: ['Find Hana by the map.', 'She can help you.', 'The path is', 'Ask her where to go.'],
      describing: ['wide.', 'clear.', 'flat.', 'bright.', 'short.', 'open.'],
    },
    vocabulary: ['Hana', 'map', 'path', 'kiosk', 'help', 'kids'],
    example: 'Find Hana by the map. The path is wide.', goal: 'two-sentences-describing',
  }),
  scenario({
    id: 'grown-ups-menu', grades: [5], title: 'A menu for grown-ups',
    prompt: 'Tell grown-ups what Momo serves and how it tastes.', reader: 'grown-ups',
    tiles: {
      phrases: ['Momo serves bean stew.', 'Its flavor is', 'Try a bowl at her stall.', 'The bread is'],
      describing: ['rich.', 'mild.', 'warm.', 'fresh.', 'sweet.', 'tasty.'],
    },
    vocabulary: ['Momo', 'menu', 'bean', 'beans', 'stew', 'flavor', 'bread', 'bowl', 'stall'],
    example: 'Momo serves bean stew. Its flavor is rich.', goal: 'two-sentences-describing',
  }),
]);

export function scenariosFor(grade) {
  return SIGN_SCENARIOS.filter(item => item.grades.includes(grade));
}

function randomFor(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let bits = Math.imul(value ^ (value >>> 15), value | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 0x100000000;
  };
}

export function scenarioOrder(grade, seed) {
  const ids = scenariosFor(grade).map(item => item.id);
  const random = randomFor(seed);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function nextScenario(grade, { seed, current, seen = [] } = {}) {
  const ids = scenarioOrder(grade, seed);
  if (!ids.length) return null;
  const start = (ids.indexOf(current) + 1) % ids.length;
  const visited = new Set(seen);
  for (let step = 0; step < ids.length; step++) {
    const id = ids[(start + step) % ids.length];
    if (!visited.has(id)) return scenarioById(id, grade);
  }
  return scenarioById(ids[start], grade);
}

export function scenarioById(id, grade) {
  return SIGN_SCENARIOS.find(item => item.id === id && item.grades.includes(grade)) ?? null;
}

export function tilesFor(item, grade) {
  if (!item?.grades?.includes(grade)) return { phrases: [], describing: [] };
  return { phrases: [...item.tiles.phrases], describing: [...item.tiles.describing] };
}

export function newSeed() {
  return Math.floor(Math.random() * 0x100000000);
}
