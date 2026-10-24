# All Aboard

**Summer Remix — a learning adventure in an animal village**

Summer Remix is a playable village adventure for **Kindergarten and grades 1–5**, designed with neurodivergent children in mind. Explore Willow Bay as it prepares for a Japanese summer festival, meet animal neighbors in handheld-game encounter scenes, and put your own creations into the village and its parade.

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
- **Walk around Willow Bay.** The seven neighbors stroll near their stalls. Walk up to one, or tap them, to start their activity. Pip and Nori wander between the stalls and say hello.
- **Help each neighbor make something** in a handheld-style encounter: balance Taro’s cart, shade Momo’s ice, pack Sora’s story bag, stamp Yuki’s banner, plan Hana’s square, or write Fumi’s sign. Finishing shows what you made, then puts it at that neighbor’s stall.
- **Make a band with Kiko** in the Sound Garden: tap musicians to join or rest, change their tunes, and save your band.
- **Start the parade** from the festival board once you’ve made something. Everyone who helped marches with what you made.
- **Open the Matsuri Guide** to meet the whole cast. Each neighbor’s page shows the stamp you earned and what you learned. Choose **Find** to get an arrow to them, or **Visit** to go straight to their activity.

Everything saves in this browser, separately for Kindergarten and each grade.

### Controls

| Action | Keyboard | Touch or mouse |
| :--- | :--- | :--- |
| Move | Arrow keys or WASD | Tap a neighbor to walk over |
| Choose (A) | Enter, Space, or Z | Tap a command |
| Back (B) | Esc, X, or Backspace | ← Village, or a window’s close button |
| Next page | A | Tap the dialogue |

### Comfort settings

On the title screen and in **Comfort** (top right in the village):

- **Bigger words** makes every word larger.
- **Calm motion** stops walking, bobbing, marching and screen wipes. It also follows your device’s reduce-motion setting.
- **Read to me** reads each new line aloud. **Hear** reads the current line any time.

> **Prototype scope:** seven creative encounters with grade-aware prompts and controls, an explorable village, a parade, and local saving. This is an interaction prototype, not a full curriculum. It has no accounts, remote backend, or AI-generated lessons. Read aloud uses available browser voices; music uses browser audio and can remain silent.

### Music controls by grade

Choose **Tunes** in the Sound Garden. Every grade can invite or rest musicians, pick tunes, adjust volume, and use Quiet play.

| Grade | Editing controls |
| :--- | :--- |
| Kindergarten | Choose Sprout or Flower for each musician. |
| Grades 1–2 | Also switch each of the eight beats between a sound and a rest. |
| Grades 3–5 | Also choose Do, Re, Mi, Sol, La, or Rest for melodic parts. Percussion uses sound/rest buttons. |

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
| `src/ui/screens/` | Title, village, encounter, music, parade, and windows |
| `src/ui/activities/` | The six subject activities |
| `src/ui/guide.js` | The Matsuri Guide’s entries and stamps |
| `src/data.js`, `src/encounters.js`, `src/reading.js` | Neighbors, activity rules, and the packing story |
| `src/progress.js` | Saving, drafts, creations, and grade scopes |
| `src/music.js` and `src/audio.js` | Band playback and WAV export |
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
