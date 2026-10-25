# All Aboard · Summer Festival

**A learning adventure in an animal village**

All Aboard is a playable village adventure for **Kindergarten and grades 1–5**, designed with neurodivergent children in mind. Explore Willow Bay as it gets ready for a Japanese summer festival, meet animal neighbors in handheld-game encounter scenes, and put your own creations into the village and its parade.

## Quick start — play on your computer

### 1. Install Node.js

Install the **LTS version** from [nodejs.org](https://nodejs.org/en/download), then reopen Terminal. The project requires Node.js 20 or newer; npm comes with the Node.js installer.

### 2. Get the project and start it

Open Terminal and paste:

```sh
git clone https://github.com/dongt10/all-abroad.git
cd all-abroad
npm run dev
```

**Already have the project?** Open Terminal in its folder and run `npm run dev`.

**Don’t use Git?** Select **Code → Download ZIP** on this page, unzip it, open the extracted folder in Terminal, and run `npm run dev`.

There are no packages to install, API keys to add, or accounts to create.

### 3. Open the game

Open **[http://127.0.0.1:4173](http://127.0.0.1:4173)** in your browser. Keep Terminal running while you play; press **Control + C** in Terminal to stop the server. This address works on the computer running the game.

<details>
<summary><strong>Having trouble starting?</strong></summary>

- **“node” or “npm” command not found:** install Node.js using the link above and reopen Terminal. Run `node --version` and `npm --version` to check the installation.
- **“git” command not found:** use **Code → Download ZIP** instead.
- **Can’t find `package.json`:** run the command from the extracted or cloned project folder, where `package.json` is located.
- **Port 4173 is already in use:** the demo may already be running. Try opening the game link above. To use another port on macOS or Linux, run `PORT=4174 npm run dev`, then open `http://127.0.0.1:4174`.

</details>

## How to play

- **Pick who you are** (boy or girl) and your grade: **Kindergarten** or **1–5**. Then press **▶ Start**.
- **Pip says hello at the pier:** “Welcome to Willow Bay! Tap a neighbor to help them make something.” He says it on every visit until you make your first thing in that grade.
- **Walk around Willow Bay.** The seven neighbors stroll near their stalls. Tap one, or walk up and press Enter, to start their activity. A stall marked **!** has something new to make; **...** means you started it and can continue. Pip and Nori wander between the stalls and say hello.
- **Open the Guide** (top right) to meet the whole cast. It is the Matsuri Guide, “the town’s character book.” Each neighbor’s page says what you’ll learn, and shows the stamp once you make their thing. Choose **Find** for an arrow that leads you to them, or **Visit** to go straight to their activity. The header counts your stamps, “0 of 7 stamps.”
- **Help each neighbor make something** in a handheld-style encounter: balance Taro’s cart, shade Momo’s ice, pack Sora’s story bag, stamp Yuki’s banner, plan Hana’s square, write Fumi’s sign, or make a band with Kiko. Every encounter has at most four commands, and the green finish command (**Send cart**, **Serve ice**, **Share story**, **Hang banner**, **Open square**, **Put up sign**, **Send band**) is always the last one. It stays gray until your creation is ready. A wrong try explains why and keeps your work. Finishing shows what you made, then puts it at that neighbor’s stall.
- **Festival board** (bottom left) reads “Festival board · 0 of 7” and fills in as you make things. After your first creation, the **Parade** button appears beside it.
- **Parade.** Everyone who helped marches with what you made. **Play band** plays your band if you made one with Kiko. After two laps (right away with Calm motion) the line stops and the dialogue says “The parade is over. Make more, and march again!” **March again** restarts it.
- **The finale at seven.** With all seven made, the board says “7 of 7 · Festival complete!” and the parade ends with “Everyone marched! You made the whole festival.”
- **Back to the start:** **Pause** (top right) has **Keep playing** and **Title screen**. Who you are and your grade live on the title screen.

Everything saves in this browser, separately for Kindergarten and each grade.

### Controls

| Action | Keyboard | Touch or mouse |
| :--- | :--- | :--- |
| Move | Arrow keys or WASD | Tap a neighbor to walk over |
| Choose (A) | Enter, Space, or Z | Tap a command |
| Back (B) | Esc, X, or Backspace | ← Village, or a window’s close button |
| Next page | A | Tap the dialogue |

Every dialogue box has a **Hear** tab that reads the current line and a **Help** tab with numbered steps for that screen. In a text field (Fumi’s sign), only Esc acts as Back; every other key types.

### Comfort settings

On the title screen and in **Comfort** (top right in the village):

- **Bigger words** makes every word larger.
- **Calm motion** stops walking, bobbing, marching and screen wipes. It also follows your device’s reduce-motion setting.
- **Read to me** reads each new line aloud. **Hear** reads the current line any time.

> **Prototype scope:** seven creative encounters with grade-aware prompts and controls, an explorable village, a parade, and local saving. This is an interaction prototype, not a full curriculum. It has no accounts or remote backend, and every line a child reads was written by hand. Read aloud uses available browser voices; music uses browser audio and can remain silent.

### Kiko’s music stage, by grade

Choose Kiko to open the Sound Garden. The four commands are the same at every grade: **Play** (then **Stop**), **See beat** (lights the lanterns with no sound, then **Stop**), **Sounds** (opens the window below), and **Send band**, the finish, which stays gray until you change something or press Play once. Tap a friend to invite or rest them. The **Speed** sign in the top row cycles **Slow · Steady · Fast** at every grade. What the eight lanterns do depends on the grade:

| Grade | What the child does on the stage | Kiko’s opening line |
| :--- | :--- | :--- |
| Kindergarten | The lanterns light up as the band plays. Tap Speed for Slow, Steady, or Fast. Each friend’s line says who sings low, in the middle, or high. The Sounds window has Loud and Soft buttons for each friend. | Tap a friend to join. Who sings low? Who whistles high? Try Slow and Fast! |
| Grade 1 | Cricket’s rhythm is on the lanterns. Tap a lantern to switch it between a sound and a rest. Kiko counts: “Five sounds and three rests. Nice spacing!” | Tap a lantern: sound or rest. Rests are part of the rhythm too! |
| Grade 2 | Same lanterns, plus an **Echo** sign. Kiko plays an 8-beat rhythm and flashes it on the lanterns, the lanterns clear, and you copy it. When it matches, Kiko asks for one back. | Press Echo. I play a rhythm, then you copy it on the lanterns! |
| Grade 3 | Kiko’s tune is on the lanterns. Each tap climbs Rest → Do → Re → Mi → Sol → La → Rest, and each lantern hangs at the height of its note, so the string becomes a staircase. Kiko says whether the tune goes up, down, stays the same, or goes up and down. | Tap a lantern to climb: Do, Re, Mi, Sol, La. Does your tune go up or down? |
| Grade 4 | The same staircase. Cricket wears a “steady part” badge and keeps the same rhythm while the tune changes. The band plays two phrases, A B: your tune, then each friend’s other tune. The Form sign shows A B and is locked. | Cricket repeats the steady part. Change my tune above it! |
| Grade 5 | The same staircase, plus the **Form** sign: tap it for A → A B → A B A. The band starts on A B A, so the first part comes back at the end. | Make tune A, then tap Form for A B A. Which part comes back? |

**Help** on the stage has four steps per grade, and the last one always names Send band.

**Sounds window:** one tab per friend. Each tab has **Tune 1 / Tune 2** (with a small preview of the beats) and that friend’s volume. Kindergarten gets **Loud / Soft** buttons instead of a slider and no beat grid. From grade 1, a friend who is not on the lanterns gets a beat editor in the window: sound or rest at grades 1–2 (and always for Cricket), the note staircase for Sora and Nori at grades 3–5. The friend who is on the lanterns (Cricket at 1–2, Kiko at 3–5) only gets a line, “Edit Cricket’s rhythm on the lanterns,” so the window never wipes the lantern work.

**Recording:** the WAV download is no longer in the kid’s window. Open the **Guide**, choose **Kiko**, and once a band has been sent, **Save recording** downloads two phrases of the band as `my-festival-band.wav`.

### What changes by grade

Grades come in three bands tonight: Kindergarten, grades 1–2, and grades 3–5. Music also tells grades 4 and 5 apart. The Guide’s “You’ll learn” stamp changes with the band too.

| Subject | Kindergarten | Grades 1–2 | Grades 3–5 |
| :--- | :--- | :--- | :--- |
| Math · Taro’s cart | Taro loads two crates on the left. Load the same on the right. Crates weigh 1. | The left side starts at 3 (a 2 and a 1). Crates of 1 and 2. | The left side starts at 8 (a 5 and a 3). Crates of 1, 2, 3 and 5, so several sums work. |
| Science · Momo’s ice | Ice in words: Lots of ice, Less ice, Water. | Same words. Grade 2 adds the number beside them. | Momo asks which tray will keep more ice. Your first Shade pick is your guess, and after 10 minutes she says whether it matched. |
| Reading · Sora’s story | One word to read: Key, Umbrella, Book. | A short line that names the thing to pack. | Clues that only imply it: “Gray clouds roll over the bay. Sora does not want to get wet.” |
| Writing · Fumi’s sign | Four word tiles, no typing box. | Eight word tiles, plus a box to type your own. | Five phrase tiles, plus typing. Remove word takes back a whole tile. The goal is the same at every grade. |
| Art · Yuki’s banner | The same at every grade: six paints, four stamps, Turn, Fill cloth, Undo. | Same | Same |
| Community · Hana’s square | A bench off the path. | A bench, plus a garden by the quiet trees. | A bench, a garden, and a sign next to the stage. |
| Music · Kiko’s band | See the table above. | | |

Art and Writing have no grade goal yet. The roadmap lists what each grade should learn there.

<details>
<summary><strong>Build, checks, and where to make changes</strong></summary>

```sh
npm test
npm run build
```

The build produces a static site in `dist/`, ready for a static web server. Serve the game over HTTP rather than opening `index.html` directly. The **[style guide](styleguide.html)** (`/styleguide.html` while the dev server runs) shows the palette, type, pixel windows, icons, the cast, and live controls.

| File | Purpose |
| :--- | :--- |
| `src/main.js` | Starts the game and connects the screens |
| `src/ui/stage.js`, `tokens.css`, `kit.css`, `palette.js` | The 960×540 stage, colors, fonts, and pixel windows |
| `src/ui/figures/` and `assets/figures/` | Character sprite sheets and how they are drawn |
| `src/ui/input.js`, `menu.js`, `dialogue.js`, `window.js`, `scenes.js`, `voice.js` | Keys, the command menu, dialogue, windows, scene changes, and read aloud |
| `src/ui/screens/` | Title, village, encounter, music, sounds (the Sounds window), parade, and windows (Comfort, Pause, Guide, Help) |
| `src/ui/activities/` | The six subject activities: cart, ice, story, banner, square, sign |
| `src/ui/registry.js` | Which activity each neighbor opens |
| `src/ui/band.js` | Music rules by grade: lead musician, speed, form, melody shape, echo, Kiko’s lines |
| `src/ui/village-map.js`, `parade-lineup.js` | Stall states, the festival board label, who marches and when the parade ends |
| `src/ui/guide.js` | The Matsuri Guide’s entries and stamps |
| `src/data.js`, `src/encounters.js`, `src/reading.js` | Neighbors, activity rules by grade band, and the packing story |
| `src/progress.js` | Saving, drafts, creations, and grade scopes |
| `src/music.js` and `src/audio.js` | Band playback, tempo and form, and WAV export |
| `tests/` | Logic, save, art, and interface checks |

</details>

### [Read the Character and Art Plan](docs/All_Aboard_Character_and_Art_Plan.md)

The plan covers the **10-character cast**, village layout, front-end screens, sprite sizes, and the first batch of artwork to create.

## Our first chapters

| Chapter | Audience |
| :--- | :--- |
| **Chapter 0** | Kindergarten |
| **Chapter 1** | Grades 1–5 |

Both chapters share the same village and cast. Players can choose among **math, science, reading, writing, art, social studies and community, and music** in any order, switch subjects, and return to unfinished activities.

## The village

![Village layout with the festival square and player’s stall at the center, surrounded by the seven subject locations and the arrival pier.](docs/assets/village-layout.svg)

See the [full art guide](docs/All_Aboard_Character_and_Art_Plan.md#asset-guide) for export sizes and the [first art batch](docs/All_Aboard_Character_and_Art_Plan.md#first-art-batch) for the initial checklist.
