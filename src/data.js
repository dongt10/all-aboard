// Local sample lessons. These demonstrate an interaction, not a full curriculum.
export const CHARACTERS = [
  { id: 'math', name: 'Taro', species: 'tanuki', subject: 'Math', location: 'Workshop', color: '#c5773b', description: 'An inventive carpenter building a festival cart.', greeting: 'Hello, builder! Will you help me check my cart?', position: { x: 17, y: 48 }, reward: { label: 'Festival cart', icon: '🛒' } },
  { id: 'science', name: 'Momo', species: 'rabbit', subject: 'Science', location: 'Festival kitchen', color: '#78ad9b', description: 'A curious chef exploring summer treats.', greeting: 'Welcome! Let’s notice something together.', position: { x: 23, y: 76 }, reward: { label: 'Fruit ice display', icon: '🍧' } },
  { id: 'art', name: 'Yuki', species: 'cat', subject: 'Art', location: 'Design studio', color: '#a28ac5', description: 'An observant designer making colorful banners.', greeting: 'Your ideas belong here. Let’s make something!', position: { x: 83, y: 48 }, reward: { label: 'Handmade banner', icon: '🎨' } },
  { id: 'reading', name: 'Sora', species: 'otter', subject: 'Reading', location: 'Reading nook', color: '#639dc4', description: 'An expressive storyteller collecting village tales.', greeting: 'Come sit with me. There’s a little story to explore.', position: { x: 50, y: 15 }, reward: { label: 'Story display', icon: '📖' } },
  { id: 'writing', name: 'Fumi', species: 'fox', subject: 'Writing', location: 'Writing booth', color: '#51a2a2', description: 'A thoughtful writer helping neighbors share ideas.', greeting: 'Let’s find words for our festival!', position: { x: 80, y: 18 }, reward: { label: 'Welcome sign', icon: '✉️' } },
  { id: 'community', name: 'Hana', species: 'deer', subject: 'Community', location: 'Map kiosk', color: '#789b58', description: 'A friendly guide who helps everyone find their place.', greeting: 'Welcome, neighbor. Let’s make the festival welcoming.', position: { x: 20, y: 18 }, reward: { label: 'Welcome map', icon: '🗺️' } },
  { id: 'music', name: 'Kiko', species: 'sparrow', subject: 'Music', location: 'Music stage', color: '#c6a044', description: 'An enthusiastic musician exploring visible rhythm patterns.', greeting: 'We can explore music with our eyes, too!', position: { x: 77, y: 76 }, reward: { label: 'Rhythm card display', icon: '🎵' } },
];

// The first row in each subject is kindergarten; rows 1–5 are elementary samples.
// Choice answers refer to an option index. Order answers refer to all indices once.
const LESSONS = {
  math: [
    ['Count the wheels', 'Taro puts two wheels beside his cart.', 'Count: ● ●', ['1', '2', '3'], 1, 'Touch or point to each dot once.'],
    ['More lanterns', 'Taro hangs 4 lanterns, then adds 3.', 'How many lanterns are there now?', ['6', '7', '8'], 1, 'Start at 4 and count on 3.'],
    ['Cart supplies', 'Taro has 24 pegs. He uses 9.', 'How many pegs are left?', ['15', '17', '33'], 0, 'Subtract 4 to reach 20, then subtract 5 more.'],
    ['Equal rows', 'Taro sets out 4 rows of 6 tiles.', 'How many tiles are there altogether?', ['10', '20', '24'], 2, 'Add 6 four times, or use 4 × 6.'],
    ['Banner pieces', 'Taro joins two strips: 1/4 meter and 2/4 meter.', 'What is their total length?', ['3/8 meter', '3/4 meter', '2/4 meter'], 1, 'The pieces are all fourths. Add the number of fourths.'],
    ['Measure the stall', 'Taro plans a rectangular stall 2.5 meters long and 2 meters wide.', 'What is its area?', ['4.5 square meters', '5 square meters', '9 square meters'], 1, 'Multiply length by width: 2.5 × 2.'],
  ],
  science: [
    ['Notice the ice', 'Momo puts an ice cube in a warm bowl.', 'What can ice turn into?', ['Liquid water', 'A wooden spoon', 'A stone'], 0, 'Think about ice warming up.'],
    ['Choose a tool', 'Momo wants to compare the lengths of two spoons.', 'Which tool helps measure length?', ['A ruler', 'A cup', 'A clock'], 0, 'Look for a tool with length marks.'],
    ['A thirsty plant', 'Momo puts one plant near a window and waters it.', 'What do most plants need to grow?', ['Only darkness', 'Water and light', 'Only a pot'], 1, 'Think about what reaches the roots and leaves.'],
    ['A fair ice test', 'Momo tests whether ice melts faster in sun or shade.', 'What should stay the same?', ['The size of each ice cube', 'The amount of sunlight', 'The place of each bowl'], 0, 'Change the sunlight while keeping the ice cubes alike.'],
    ['Water in the air', 'Drops appear outside Momo’s cold cup. The cup has no leak.', 'Where did those drops come from?', ['Water vapor in the air', 'The glass becoming water', 'Ice passing through glass'], 0, 'Water vapor can cool into liquid on a cold surface.'],
    ['Read the results', 'Momo tests equal ice cubes. After 10 minutes, the sunny bowl has more melted water than the shaded bowl.', 'Which claim fits this test?', ['Shade always melts ice faster', 'Sunlight helped the ice melt faster in this test', 'All ice melts in exactly 10 minutes'], 1, 'Use what these two bowls show; avoid claims about every situation.'],
  ],
  art: [
    ['Pick a banner', 'Yuki has a blank festival banner.', 'Choose a color you like.', ['Ocean blue', 'Leaf green', 'Sunshine yellow'], null, 'Any of these colors can be your choice.'],
    ['Choose a line', 'Yuki invites you to design a banner border.', 'Which kind of line will you use?', ['Wavy lines', 'Zigzag lines', 'Curved loops'], null, 'Imagine tracing each line in the air. Choose your favorite.'],
    ['Build a pattern', 'Yuki is making repeating decorations.', 'Choose a pattern for your banner.', ['Circle, star, circle, star', 'Leaf, leaf, flower, leaf, leaf, flower', 'Stripe, dot, dot, stripe, dot, dot'], null, 'Each design repeats a small group. Any design works.'],
    ['Set the mood', 'Yuki wants your banner to express a feeling.', 'Choose a color palette and mood.', ['Blue and green: calm', 'Red and yellow: lively', 'Purple and blue: dreamy'], null, 'Colors can suggest different feelings to different people. Your choice counts.'],
    ['Create a focal point', 'Yuki asks what visitors should notice first.', 'Choose a way to make one star stand out.', ['One large star among small stars', 'One yellow star on a dark blue background', 'One star surrounded by open space'], null, 'Size, color, and space can each draw attention.'],
    ['Design with balance', 'Yuki is ready to display your final banner.', 'Choose a balanced arrangement to explore.', ['Matching shapes on both sides', 'One large shape balanced by several small ones', 'Shapes arranged around a central circle'], null, 'Balance can use symmetry, different sizes, or a circular layout.'],
  ],
  reading: [
    ['Find the cat', 'Sora shows a picture label: CAT.', 'Which word matches CAT?', ['DOG', 'CAT', 'SUN'], 1, 'Look for C, then A, then T.'],
    ['A little visit', 'Pip has a red bag. He puts a map in the bag.', 'What does Pip put in his bag?', ['A map', 'A drum', 'A cake'], 0, 'Look at what Pip puts inside.'],
    ['Before the rain', 'Nori saw dark clouds. She took an umbrella to the festival.', 'Why did Nori take an umbrella?', ['She expected rain', 'She wanted to cook', 'She needed a ruler'], 0, 'The dark clouds give a clue.'],
    ['A tricky word', 'Pip was weary after carrying parcels all morning. He sat down to rest.', 'What does “weary” mean here?', ['Very tired', 'Very loud', 'Very tiny'], 0, 'His long morning and need to rest give clues.'],
    ['The main idea', 'Neighbors planted flowers, picked up litter, and repaired a bench. By sunset, the square was ready for visitors.', 'Which sentence best gives the main idea?', ['A bench was made of wood', 'Neighbors worked together to prepare the square', 'Visitors arrived in the morning'], 1, 'Choose the idea that connects all three jobs.'],
    ['Use the evidence', 'Pip checked the address twice, wrapped the parcel carefully, and carried it with both wings.', 'Which description of Pip is best supported?', ['He is being careful with the delivery', 'He dislikes every festival', 'He has forgotten the parcel'], 0, 'Look for a description supported by several actions.'],
  ],
  writing: [
    ['A welcome label', 'Fumi makes a two-word sign.', 'Put “Hello” before “friend!”', ['friend!', 'Hello'], [1, 0], 'Start with the greeting: Hello.'],
    ['Make a sentence', 'Fumi writes about the festival.', 'Arrange the words into a sentence.', ['glow.', 'Lanterns'], [1, 0], 'Start with the word that has a capital letter.'],
    ['Add a detail', 'Fumi wants a clear sentence for the sign.', 'Build: “The bright lanterns glow.”', ['glow.', 'bright', 'The', 'lanterns'], [2, 1, 3, 0], 'Start with The. Put bright just before lanterns.'],
    ['Tell what happened', 'Fumi records how Nori made a banner.', 'Arrange the steps in time order.', ['Finally, she hung the banner.', 'First, she chose fabric.', 'Next, she painted a star.'], [1, 2, 0], 'Look for First, Next, and Finally.'],
    ['Explain a reason', 'Fumi writes a suggestion with a reason.', 'Build the sentence from these parts.', ['because everyone needs room to pass.', 'Let’s keep the path clear', 'during the festival'], [1, 2, 0], 'Start with the suggestion. End with the reason beginning because.'],
    ['Build a paragraph', 'Fumi explains why the village needs a welcome map.', 'Arrange the idea, supporting detail, and conclusion.', ['A clear map will help guests feel welcome.', 'The festival needs a welcome map.', 'It can show the stalls, quiet nook, and open paths.'], [1, 2, 0], 'Introduce the map, give a specific use, then close with its benefit.'],
  ],
  community: [
    ['Take turns', 'Hana and Nori both want the same crayon.', 'What helps them share?', ['Take turns', 'Hide the crayon', 'Grab it'], 0, 'Each neighbor can have a turn.'],
    ['Find a helper', 'Hana sees a visitor looking for the music stage.', 'What could Hana do?', ['Offer to show the map', 'Hide the signs', 'Walk away laughing'], 0, 'Think of a kind way to share information.'],
    ['Read a map key', 'Hana’s map key says: ★ = music stage; ● = kitchen.', 'Which symbol marks the kitchen?', ['★ Star', '● Circle', '▲ Triangle'], 1, 'Match the place to the symbol in the key.'],
    ['Make room', 'Hana notices a box blocking a wide path.', 'What helps neighbors move through the square?', ['Move the box to a storage spot', 'Add more boxes to the path', 'Cover the path sign'], 0, 'Keep the route open for people moving in different ways.'],
    ['Listen to neighbors', 'Neighbors have different ideas for the festival square.', 'What is a fair first step?', ['Hear people’s ideas and needs', 'Let only the loudest person speak', 'Ignore all suggestions'], 0, 'Gather perspectives before deciding together.'],
    ['Plan together', 'Hana has room for three benches. Neighbors request places to rest near the entrance, stage, and quiet nook.', 'Which plan best responds to the shared needs?', ['Put all benches behind a locked shed', 'Discuss access and place benches where people can use them', 'Choose locations without asking anyone'], 1, 'Use the requests and check whether the benches will be reachable.'],
  ],
  music: [
    ['A visible beat', 'Kiko shows this pattern: CLAP · REST · CLAP · REST.', 'What comes next?', ['CLAP', 'REST', 'Two rests'], 0, 'The two cards CLAP and REST repeat.'],
    ['Repeat a rhythm', 'Kiko shows: TAP · TAP · REST | TAP · TAP · REST.', 'Which group repeats?', ['TAP · REST · REST', 'TAP · TAP · REST', 'REST · REST · TAP'], 1, 'Look at one group between the separators.'],
    ['Arrange rhythm cards', 'Kiko writes three numbered cards. Each card takes one beat.', 'Place beat 1, then beat 2, then beat 3.', ['Beat 3: REST', 'Beat 1: TAP', 'Beat 2: CLAP'], [1, 2, 0], 'Use the printed beat numbers. No sound is needed.'],
    ['Count the beats', 'Kiko’s chart says: TAP = 1 beat; HOLD = 2 beats.', 'How many beats are in TAP · HOLD · TAP?', ['3 beats', '4 beats', '5 beats'], 1, 'Add the printed values: 1 + 2 + 1.'],
    ['Follow a melody map', 'Kiko’s cards show a melody moving upward: C → D → E.', 'Arrange the labeled cards in that order.', ['E: high', 'C: low', 'D: middle'], [1, 2, 0], 'Follow the arrow from C to D to E. You can read the labels.'],
    ['Read a rhythm phrase', 'Kiko’s chart says: quarter note = 1 beat; half note = 2 beats; quarter rest = 1 silent beat.', 'Which phrase fills exactly 4 beats?', ['Half note + quarter note + quarter rest', 'Half note + half note + quarter rest', 'Quarter note + quarter rest'], 0, 'Count silence too: a quarter rest takes one beat.'],
  ],
};

export function getActivity(subjectId, chapter, grade = 1) {
  if (!CHARACTERS.some(character => character.id === subjectId)) {
    throw new RangeError(`Unknown subject: ${subjectId}`);
  }
  if (chapter !== 0 && chapter !== 1) {
    throw new RangeError('Chapter must be 0 or 1.');
  }
  if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
    throw new RangeError('Grade must be an integer from 1 to 5.');
  }
  const level = chapter === 0 ? 0 : grade;
  const [title, story, prompt, labels, answer, hint] = LESSONS[subjectId][level];
  const type = subjectId === 'art' ? 'create' : Array.isArray(answer) ? 'order' : 'choice';
  const optionId = index => `option-${index + 1}`;
  const character = CHARACTERS.find(item => item.id === subjectId);
  return {
    id: `${subjectId}-chapter-${chapter}-grade-${level}`,
    subjectId, chapter, grade: level, type, title, story, prompt,
    options: labels.map((label, index) => ({ id: optionId(index), label })),
    correct: answer === null ? null : Array.isArray(answer) ? answer.map(optionId) : optionId(answer),
    hint,
    success: type === 'create'
      ? 'Your design has a place at the festival. Thanks for sharing your idea!'
      : `You helped ${character.name} bring an idea to the festival!`,
    reward: { ...character.reward },
  };
}
