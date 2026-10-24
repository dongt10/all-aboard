# All Aboard

**A learning adventure in an animal village**

We’re building a 2D pixel-art game for neurodivergent children, set in a village preparing for a Japanese summer festival. A human player meets animal neighbors, chooses which subjects to explore, and adds their creations to a festival stall. This repository includes the playable rough draft for **Kindergarten and grades 1–5**.

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

- Choose **Kindergarten** or **Elementary, grades 1–5**.
- Visit any animal by clicking a village location or a neighbor in the sidebar.
- Try a short activity and add its creation to your festival stall. All seven subjects are open from the start.
- To walk, focus the village and use **arrow keys / WASD**. Press **E or Space** near a neighbor to talk.
- Use **Read aloud**, **Show a hint**, **One step at a time**, **Comfort settings**, or **Take a break** whenever helpful.

Progress is saved in this browser on this device, separately for Kindergarten and each elementary grade. Returning to an unfinished activity starts that activity again.

> **Prototype scope:** 42 sample activities, original placeholder artwork, and local progress saving. This is a playable interaction draft, not a full curriculum. It has no accounts, remote backend, or AI-generated lessons. Read aloud uses available browser voices.

<details>
<summary><strong>Build, checks, and where to make changes</strong></summary>

```sh
npm test
npm run build
```

The build produces a static site in `dist/`, ready for a static web server. Serve the game over HTTP rather than opening `index.html` directly.

| File | Purpose |
| :--- | :--- |
| `src/data.js` | Characters and the 42 sample activities |
| `src/progress.js` | Local save format and chapter/grade progress |
| `src/village.js` and `src/village.css` | Village, placeholder character artwork, and movement |
| `src/activity.js` and `src/activity.css` | Activities, feedback, and help controls |
| `src/app.js` and `src/styles.css` | Main screen, chapter selection, settings, and festival stall |

Replace the placeholder art as the character and environment assets become available. The activity data and progress module are separate from the screen code to make a future backend easier to connect.

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
