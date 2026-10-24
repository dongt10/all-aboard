# All Aboard

**Summer Remix — a learning adventure in an animal village**

Summer Remix is a playable village adventure for **Kindergarten and grades 1–5**, designed with neurodivergent children in mind. Explore Willow Bay as it prepares for a Japanese summer festival, meet animal neighbors in Game Boy Advance–inspired encounter scenes, and put your own creations into the village and its parade.

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

- Choose **Kindergarten** or an elementary grade from **1–5**.
- Choose a labeled subject in the village, or open **Subjects** for large subject cards. Each subject has its own color and symbol. All seven subjects are open from the start.
- Balance Taro’s cart, compare shade and melting ice, stamp a banner, read with Sora and choose what to pack, write a welcome sign, or arrange a welcoming square. Publish a creation to see it in the village.
- With Kiko, combine **four musical voices**, change looping patterns and notes, adjust volumes, or explore in quiet mode. Export your arrangement as a **WAV file** on your device.
- Start a parade after publishing a creation. A saved band can play during the parade when you choose **Play our band**.
- Use **Hear**, **Help**, **Settings**, or **Pause** when helpful.

Drafts and published creations save in this browser on this device, separately for Kindergarten and each elementary grade. Return to a neighbor to continue your draft; unfinished edits do not replace the version already displayed in the village. Older saves retain completion markers without inventing a creation.

> **Prototype scope:** seven creative encounters with grade-aware prompts and controls, an explorable village, a parade, and local saving. This is an interaction prototype, not a full curriculum. It has no accounts, remote backend, or AI-generated lessons. Read aloud uses available browser voices; music uses browser audio and can remain silent.

### Music controls by grade

Open **Edit tunes & notes** to find the controls for the selected grade. Every grade can invite or rest musicians, choose preset tunes, adjust volume, and use Quiet play.

| Grade | Editing controls |
| :--- | :--- |
| Kindergarten | Choose between two preset tunes for each musician. |
| Grades 1–2 | Also switch each of the eight beats between a sound and a rest. |
| Grades 3–5 | Also choose Do, Re, Mi, Sol, La, or Rest for melodic parts. Percussion uses sound/rest buttons. |

The musicians, starting tunes, eight-beat loop, and tempo are shared across grades. These are three editing tiers; individual grades do not yet have separate music lessons or learning goals.

<details>
<summary><strong>Build, checks, and where to make changes</strong></summary>

```sh
npm test
npm run build
```

The build produces a static site in `dist/`, ready for a static web server. Serve the game over HTTP rather than opening `index.html` directly.

| File | Purpose |
| :--- | :--- |
| `src/data.js` | Neighbor identities, subjects, and rewards |
| `src/progress.js` | Local drafts, published creations, grade scopes, and older-save migration |
| `src/characters.js` | Shared character artwork |
| `src/world.js` and `src/world.css` | Village, saved creations, and parade |
| `src/encounters.js` and `src/encounters.css` | Six creative subject encounters |
| `src/reading.js` | Festival packing story, picture choices, and reading progression |
| `src/music.js`, `src/music.css`, and `src/audio.js` | Four-voice band controls, playback, and WAV export |
| `src/app.js` and `src/styles.css` | Screen navigation, chapter selection, settings, and shared layout |
| `tests/` | Persistence, encounter, and audio checks |

The scene controllers and persistence module keep editable drafts separate from published festival contributions.

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
