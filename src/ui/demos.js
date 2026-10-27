// "Show me": a short demo the neighbor plays on a separate example, never on the child's own draft.
//
//   demoFor(activity, grade) → null | { snapshot, intro?, steps: [{ action, line }], done }
//
//   activity  the resolved Activity (registry.js activityFor), so a demo can key on activity.kind and
//             activity.title, and tests can run the demo through activity.start / activity.act.
//   snapshot  a creation snapshot for the example: activity.start(snapshot, { chapter, grade }) sets it up.
//   intro     what the neighbor says before the first step (optional).
//   steps     applied in order with activity.act(state, ui, action, grade); `line` is said with that step.
//             An action is { type: 'command', id } or { type: 'field', … } exactly as the activity's field
//             dispatches it. Every line is 56 characters or fewer (one Bigger-words page) and kid words.
//   done      the closing line, which ends with the child's turn (for example "Your turn!").
//
// The encounter scene runs the demo (src/ui/demo.js), then restores the child's work. Nothing here saves.
import { activityFor } from './registry.js';
import { stampPosition } from '../banner-rules.js';

const field = (props, line) => ({ action: { type: 'field', ...props }, line });
const command = (id, line) => ({ action: { type: 'command', id }, line });
const example = (kind, grade, fields) => ({ kind, grade, chapter: grade === 0 ? 0 : 1, request: 1, ...fields });
const done = label => `Choose ${label} when yours is ready. Your turn!`;

function cartDemo(grade) {
  return {
    snapshot: example('math', grade, { left: [grade === 0 ? 1 : 2], right: [], rolled: false }),
    intro: 'Watch me match a different load. Then you can try.',
    steps: [
      ...(grade === 1 ? [field({ weight: 2 }, 'I pick a 2 to match the left side.')] : []),
      command('load-right', 'I put a matching crate on the right.'),
      command('roll', 'The sides match. I roll to check the cart!'),
    ],
    done: done('Send cart'),
  };
}

function rowsDemo(grade) {
  return {
    snapshot: example('math', grade, { activity: 'rows', target: 6, crates: [0, 1, 5, 6] }),
    intro: 'My order is 6 crates. I put 4 on my cart already.',
    steps: [
      field({ slot: 2 }, 'I add one crate to make 3 in the top row.'),
      field({ slot: 7 }, 'I add one below. Both rows have 3 now.'),
      command('pair', 'I pair them up. There are 3 pairs, or 6 crates.'),
    ],
    done: done('Send cart'),
  };
}

function pizzaDemo(grade) {
  const halves = grade === 5;
  return {
    snapshot: example('math', grade, {
      activity: 'pizza', slices: halves ? 10 : 4, halves: false,
      plates: halves ? [4, 4, 4, 4] : [0, 0, 0, 0], tried: false,
    }),
    intro: halves
      ? 'Each friend has 2 slices. Watch me share the last 2.'
      : 'Watch me share a different pizza with 4 slices.',
    steps: [
      ...(halves ? [field({ pizza: true }, 'I cut the last 2 slices into halves to share.')] : []),
      ...['Sora', 'Nori', 'Kiko', 'Pip'].map((name, give) => field({ give },
        `I give ${name} ${halves ? 'a half' : 'one slice'} so each gets a turn.`)),
      command('try', halves ? 'I check. Each friend has 2 and a half.' : 'I check. Each friend has one slice.'),
    ],
    done: done('Serve pizza'),
  };
}

function iceDemo(grade) {
  return {
    snapshot: example('science', grade, { canopy: 'left', time: 0 }),
    intro: 'My example shades tray A. Watch me try tray B.',
    steps: [
      field({ tray: 'right' }, 'I move the shade to B to keep the sun off.'),
      command('wait', 'I move the clock 5 minutes to compare the ice.'),
      command('wait', 'Ten minutes! The shaded tray kept more ice.'),
    ],
    done: done('Serve ice'),
  };
}

function beansDemo(grade) {
  return {
    snapshot: example('science', grade, { activity: 'beans', change: 'none', weeks: 0, bed: ['bee'] }),
    intro: 'A bee is already in my bed card. Watch me test light.',
    steps: [
      field({ change: 'dark' }, 'I put cup B in a dark box to test light.'),
      command('wait', 'I check after one week. Cup B is pale.'),
      command('wait', 'Two weeks. Cup A is tall; cup B is weak and pale.'),
      field({ tile: 'seed' }, 'I add a seed to start a plant.'),
      field({ tile: 'sun' }, 'I add sun. Plants need sunlight to grow well.'),
      field({ tile: 'water' }, 'I add water. Plants need water too.'),
    ],
    done: done('Plant bed'),
  };
}

function chainDemo(grade) {
  const pond = grade === 4, top = grade === 3 ? 1000 : pond ? 2000 : 5000;
  return {
    snapshot: example('science', grade, {
      activity: 'chain', chain: [pond ? 'pondweed' : 'plant', null, null],
      energy: [top, null, null], shone: false,
    }),
    intro: 'My plant has its number already. Watch my food chain.',
    steps: [
      field({ card: pond ? 'snail' : 'fish' }, pond ? 'I add a snail. It eats pondweed.' : 'I add a little fish. It eats sea plants.'),
      field({ energy: top / 10 }, `I pick ${top / 10}. This chart uses one tenth.`),
      field({ card: pond ? 'frog' : 'gull' }, pond ? 'I add a frog. It eats snails.' : 'I add a gull. It eats little fish.'),
      field({ energy: top / 100 }, `I pick ${top / 100}, one tenth again. Real amounts vary.`),
      command('shine', 'I choose Shine! to check the whole chain.'),
    ],
    done: done('Pin chart'),
  };
}

function storyDemo(grade) {
  return {
    snapshot: example('reading', grade, { found: ['key'] }),
    intro: 'My key is packed. Watch me pack for rain and a story.',
    steps: [
      command('pick-umbrella', 'I pack the umbrella to keep me dry.'),
      command('next', 'I turn the page to read the last part.'),
      command('pick-book', 'I pack the book for a story to share.'),
    ],
    done: done('Share story'),
  };
}

function ribbonDemo(grade) {
  return {
    snapshot: example('reading', grade, {
      activity: 'ribbon', found: [], story: 1, why: false, steps: 0, lesson: false,
    }),
    intro: 'Watch me read a different story, about Kiko’s drum.',
    steps: [
      field({ why: 'fast' }, 'I pick too fast. The band could not keep up.'),
      field({ card: 'drum' }, 'First, I put Kiko playing the drum.'),
      field({ card: 'stop' }, 'Next, I put the band stopping.'),
      field({ card: 'together' }, 'Last, I put the band playing together.'),
      field({ lesson: 'steady' }, 'I pick going steady. It helped the band play.'),
    ],
    done: done('Share ribbon'),
  };
}

function talesDemo(grade) {
  const deck = grade === 4 ? 2 : 1;
  return {
    snapshot: example('reading', grade, {
      activity: 'tales', found: [], deck, solved: [deck === 1 ? 'hana-path' : 'fumi-booth'],
    }),
    intro: 'I named one of my tales. Watch me name the other two.',
    steps: deck === 1 ? [
      command('pick-pip', 'I pick Pip. The webbed feet are my clue.'),
      field({ line: 0 }, 'I mark this line. It tells us about the feet.'),
      command('next', 'I turn to the next tale to find a new clue.'),
      command('pick-art', 'I pick Yuki. A purr is a cat clue.'),
      field({ line: 2 }, 'I mark the line about the purr to show why.'),
    ] : [
      command('pick-nori', 'I pick Nori. The hard shell is my clue.'),
      field({ line: 2 }, 'I mark this line. It tells us about the shell.'),
      command('next', 'I turn to the next tale to find a new clue.'),
      command('pick-reading', 'I pick me! I swim and have whiskers.'),
      field({ line: 1 }, 'I mark the line about the swimmer to show why.'),
    ],
    done: done('Share tales'),
  };
}

const CORAL = '#e96163', BLUE = '#559fc7', GOLD = '#f4bf4f';
const stamp = (cell, shape, color) => ({ shape, color, ...stampPosition(cell), rotation: 0, flipped: false });

function bannerDemo(grade) {
  // The first three pattern stamps belong to Yuki's field, not to the saved cloth.
  const stamps = grade === 1 ? [stamp(3, 'circle', CORAL), stamp(4, 'star', CORAL)]
    : grade === 2 ? [stamp(3, 'flower', BLUE), stamp(4, 'flower', CORAL)]
      : grade >= 4 ? [stamp(0, 'star', BLUE), stamp(5, 'star', BLUE)] : [];
  return {
    snapshot: example('art', grade, { background: GOLD, stamps }),
    intro: grade === 1 || grade === 2
      ? 'My gold cloth needs one more stamp. Watch the pattern.'
      : grade >= 4 ? 'I made a blue pair on gold cloth. Watch two more pairs.'
        : 'Watch me make a banner on my gold cloth.',
    steps: grade === 0 ? [
      field({ shape: 'flower' }, 'I pick a flower for my banner.'),
      field({ color: BLUE }, 'I pick blue paint for my flower.'),
      field({ cell: 14 }, 'I tap the cloth to stamp my flower.'),
    ] : grade === 1 ? [
      field({ shape: 'circle' }, 'A circle comes next in my pattern.'),
      field({ cell: 5 }, 'I stamp the last spot to finish my pattern.'),
    ] : grade === 2 ? [
      field({ shape: 'flower' }, 'I pick the flower to keep my pattern.'),
      field({ color: BLUE }, 'Blue comes next after coral.'),
      field({ cell: 5 }, 'I stamp the last spot to finish my pattern.'),
    ] : [
      field({ cell: 1 }, 'I stamp a star to start a matching pair.'),
      field({ cell: 4 }, 'I match it on the other side.'),
      field({ cell: 6 }, 'I add another star to start the next pair.'),
      field({ cell: 11 }, 'I match that star across the cloth.'),
    ],
    done: done('Hang banner'),
  };
}

function signDemo(grade) {
  const scenario = grade === 0 ? 'taro-cart' : grade < 3 ? 'taro-pizza' : 'stew-warning';
  const words = grade === 0 ? [
    ['Big', 'I pick Big to tell about the cart.'],
    ['cart', 'I add cart so Taro knows what I mean.'],
  ] : grade < 3 ? [
    ['Taro', 'I start with Taro to name whose pizza it is.'],
    ['has', 'I add has to tell what Taro has.'],
    ['hot', 'I add hot to tell about the pizza.'],
    ['pizza.', 'I add pizza and a dot to end my sentence.'],
  ] : [
    ['Let the stew cool.', 'I tell kids to let the stew cool.'],
    ['Wait before eating because', 'I add because to start a reason for waiting.'],
    ['the pot is', 'I name the pot to tell what is hot.'],
    ['hot.', 'Hot tells why. The dot ends my sentence.'],
  ];
  return {
    snapshot: example('writing', grade, { text: '', scenario, tiles: [] }),
    intro: grade === 0 ? 'Watch me label Taro’s cart with my own sign.'
      : grade < 3 ? 'Watch me make my own sign about Taro’s pizza.'
        : 'Watch my sign tell little kids why to let stew cool.',
    steps: words.map(([word, line]) => field({ word }, line)),
    done: done('Put up sign'),
  };
}

function squareDemo(grade) {
  return {
    snapshot: example('community', grade, { placements: [{ item: 'sign', x: 90, y: 30 }], tried: false }),
    intro: 'My square has a sign. Watch me add a place to rest.',
    steps: [
      field({ cell: 18 }, 'A bench off the path gives someone a rest.'),
      ...(grade === 0 ? [] : [
        field({ tool: 'quiet' }, 'I pick a garden for a quiet place.'),
        field({ cell: 5 }, 'By the trees is a calm spot for the garden.'),
      ]),
      command('invite', 'Let’s walk it to check the path.'),
    ],
    done: done('Open square'),
  };
}

function compassDemo(grade) {
  return {
    snapshot: example('community', grade, { activity: 'compass', done: ['north'] }),
    intro: 'My flour trip is done. Watch my next two map trips.',
    steps: [
      field({ cell: 11 }, 'I go one west to start the drum trip.'),
      field({ cell: 10 }, 'One more west takes the drum to the stage.'),
      field({ cell: 13 }, 'I go one east to start the lantern trip.'),
      field({ cell: 14 }, 'One more east takes us to the shed.'),
      field({ cell: 19 }, 'One south takes the lantern to the workshop.'),
    ],
    done: done('Hang map'),
  };
}

function helpdayDemo(grade) {
  const paint = grade === 4;
  return {
    snapshot: example('community', grade, {
      activity: 'helpday', crew: paint
        ? [{ job: 'stew', helper: 'momo' }, { job: 'tale', helper: 'sora' }]
        : [{ job: 'lanterns', helper: 'kiko' }, { job: 'drum', helper: 'taro' }],
    }),
    intro: 'Two helpers are on my team. Watch me match the rest.',
    steps: paint ? [
      field({ helper: 'yuki' }, 'I pick Yuki for her steady painting hand.'),
      field({ job: 'banner' }, 'I give Yuki the banner. It needs that steady hand.'),
      field({ helper: 'fumi' }, 'I pick Fumi for neat words.'),
      field({ job: 'signs' }, 'Fumi gets the signs so everyone can read them.'),
    ] : [
      field({ helper: 'nori' }, 'I pick Nori. Nori is patient and likes saying hello.'),
      field({ job: 'gate' }, 'Nori gets the gate to greet neighbors all day.'),
      field({ helper: 'pip' }, 'I pick Pip for fast trips.'),
      field({ job: 'mail' }, 'Pip gets the mail to take around town.'),
    ],
    done: done('Start day'),
  };
}

const DEMOS = {
  math: [cartDemo, cartDemo, rowsDemo, pizzaDemo, pizzaDemo, pizzaDemo],
  science: [iceDemo, iceDemo, beansDemo, chainDemo, chainDemo, chainDemo],
  reading: [storyDemo, storyDemo, ribbonDemo, talesDemo, talesDemo, talesDemo],
  art: Array(6).fill(bannerDemo),
  writing: Array(6).fill(signDemo),
  community: [squareDemo, squareDemo, compassDemo, helpdayDemo, helpdayDemo, helpdayDemo],
};

export function demoFor(activity, rawGrade) {
  if (!activity || !['number', 'string'].includes(typeof rawGrade) || String(rawGrade).trim() === '') return null;
  const grade = Number(rawGrade);
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) return null;
  // A cart passed with grade 2 must not receive the rows script. Music has its own scene.
  if (!Object.hasOwn(DEMOS, activity.kind) || activityFor(activity.kind, grade) !== activity) return null;
  // Builders return fresh objects, so replay cannot retain a previous demo's work or UI.
  return DEMOS[activity.kind][grade](grade);
}
