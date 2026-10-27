# All Aboard

**Character and Art Plan** · Chapters 0 and 1

A human child explores a village of animal neighbors preparing for a **Japanese summer festival**. This is the art reference for the first cast, village, screens, and game assets.

[Overview](#overview) · [Characters](#characters) · [Village](#village) · [Screens](#screens) · [Asset guide](#asset-guide) · [First art batch](#first-art-batch)

## Overview

| Chapter | Audience |
| :--- | :--- |
| **Chapter 0** | Kindergarten |
| **Chapter 1** | Grades 1–5 |

**One shared village. Ten character designs.** Reuse the same cast across both chapters: one human player, seven main NPCs, and two recurring side characters.

**Player choice:** All seven subjects are available within each chapter. Players choose their order, switch subjects, and return to unfinished activities. Each chapter ends when its seven subject tracks are complete.

### Visual direction

Use **small pixel-art characters viewed from slightly above**, with large heads, compact bodies, and clear front, back, left, and right views. This is the viewpoint established by the sprite reference.

Build the world with visible building fronts and winding paths. Give each main character a distinct silhouette and prop so they stay recognizable at actual game size.

## Characters

### Cast at a glance

| Character | Subject | Home base |
| :--- | :--- | :--- |
| **[Taro](#taro)** the tanuki | Math | Workshop |
| **[Momo](#momo)** the rabbit | Science | Festival kitchen |
| **[Yuki](#yuki)** the cat | Art | Design studio |
| **[Sora](#sora)** the otter | Reading | Reading nook |
| **[Fumi](#fumi)** the fox | Writing | Writing booth |
| **[Hana](#hana)** the deer | Social studies and community | Map kiosk |
| **[Kiko](#kiko)** the sparrow | Music | Music stage |

The [human player](#the-human-player), [Pip](#pip), and [Nori](#nori) complete the cast.

### Taro

**Tanuki · Math · Workshop**

An inventive carpenter who wants to build a sturdy festival cart. Measures with his tail and invites the player to check his work.

- **Look:** Round brown body, dark facial markings, small ears, rust-orange work apron, rolled sleeves. Broad, recognizable silhouette.
- **Props:** Wooden ruler, pencil, tool belt, unfinished cart.
- **Subject icon:** Counting blocks.

### Momo

**Rabbit · Science · Festival kitchen**

A curious chef experimenting with summer treats. Asks what the player thinks will happen before trying something.

- **Look:** Cream fur, peach inner ears, mint apron, strawberry pin. Tall ears distinguish her at small sizes.
- **Props:** Bowl, spoon, fruit, ice tray.
- **Subject icon:** A simple flask.

### Yuki

**Cat · Art · Design studio**

An observant designer who wants every stall to express its owner’s personality. Notices the player’s choices.

- **Look:** Cream-and-calico fur, triangular ears, lavender work smock, colorful fabric patches.
- **Props:** Fabric roll, brush, patterned banner.
- **Subject icon:** Paint palette.

### Sora

**Otter · Reading · Reading nook**

An expressive storyteller who gathers stories about the village. Enjoys letting the player discover what happens next.

- **Look:** Warm brown fur, pale muzzle, blue vest, book satchel. Rounded head and small ears.
- **Props:** Open book, cushions, low bookshelf.
- **Subject icon:** Open book.

### Fumi

**Fox · Writing · Writing booth**

A thoughtful letter writer who helps neighbors express their ideas. Gets excited about finding the right words.

- **Look:** Orange fur, cream muzzle and tail tip, pointed ears, teal vest, pencil tucked into a pocket.
- **Props:** Pencil, paper, envelopes, blank signs.
- **Subject icon:** Pencil.

### Hana

**Deer · Social studies and community · Map kiosk**

A friendly village guide who knows the places, jobs, and people that keep the town running.

- **Look:** Warm brown coat, large ears, small antlers, leaf-green scarf, crossbody map bag.
- **Props:** Folded map, signposts, community noticeboard.
- **Subject icon:** Map pin.

### Kiko

**Sparrow · Music · Music stage**

An enthusiastic musician preparing the festival’s welcome tune. Likes experimenting with different patterns.

- **Look:** Small rounded body, brown-and-cream feathers, golden-yellow festival coat, tiny drum strap.
- **Props:** Drum, rhythm cards, small instruments.
- **Subject icon:** Musical note.

### The human player

Design a school-age child with a large, readable head and compact proportions matching the sprite reference.

- **Outfit:** Cream summer shirt, teal shorts, comfortable shoes, and a small red backpack.
- **Variations:** One consistent body and outfit for the prototype, with a few hair and skin-tone variations.
- **Consistency:** Keep the same sprite dimensions and walking poses across variations.

### Pip

**Duck courier · Recurring side character**

Energetic and easily distracted by interesting discoveries.

- **Look:** White feathers, orange bill, blue delivery cap, oversized mailbag.
- **Quest connections:** Counting deliveries, reading an address, writing a message, decorating a parcel, or finding a route.

### Nori

**Turtle festival helper · Recurring side character**

Patient, practical, and fond of trying other people’s creations.

- **Look:** Green skin, rounded brown shell, peach vest, small basket.
- **Quest connections:** Visiting stalls, testing recipes, requesting decorations, listening to stories, and joining music activities.

#### How side quests connect

Pip and Nori can appear in multiple subject quests. **Every request must work independently**, so visiting Momo never requires finishing Taro first. References to earlier adventures appear only when the player has actually completed them.

## Village

The village is now the team’s drawing of a cobblestone crossroads. The road is the only walkable ground for the player, Pip, Nori and the seven neighbors, and the stalls stand along the road’s edges.

## Screens

The rough front end needs five views.

### Welcome and chapter selection

**Shows:** New game, continue, Chapter 0, and Chapter 1.  
**Art needed:** Village title background and two chapter illustrations.

### Village exploration

**Shows:** Human player, seven subject locations, recurring neighbors, and the cobblestone crossroads.\
**Art needed:** Environment, character sprites, props, and subject icons.

### Conversation

**Shows:** NPC portrait, short dialogue, response choices, and support buttons.  
**Art needed:** Character portraits and expression variants.

### Activity

**Shows:** The current task, movable or selectable objects, and visible feedback.  
**Art needed:** Reusable subject props such as blocks, fruit, books, pattern pieces, and rhythm cards.

### Progress and pause

**Shows:** Seven subject markers, saved progress, resume, settings, and break controls.  
**Art needed:** Subject badges and simple UI icons.

### Connecting the backend

In the current static game, “backend” means the in-browser game logic that supplies the chapter, grade, activity content, dialogue, available supports, and progress. There is no remote application server or cloud save service. The [architecture guide](architecture.md) explains grade registration, local drafts and completed creations, and the static build.

**Keep text, numbers, and lesson instructions separate from the artwork.** This lets the front end display different languages and difficulty levels.

## Asset guide

### Reference art is the source of truth

The original design overrides all. All nine manifest characters come from the team’s reference drawings in [docs/art/source/neighbors](art/source/neighbors): Taro (`ref-03.png`), Momo (`ref-08.png`), Yuki (`ref-21.png`), Fumi (`ref-22.png`), Sora (`ref-27.png`), Hana (`ref-25.png`), Kiko (`ref-26.png`), Pip (`ref-23.png`) and Nori (`ref-24.png`). Their sheets follow the recorded derivations in [manifest.json](art/source/neighbors/manifest.json). The references are pinned by hash; [tests/figures-references.test.js](../tests/figures-references.test.js) checks the drawings and derived pixels.

The recorded transforms sample each 4 × 4 source block at offset (0, 0), remove the listed swatch box, and remove either all matching background pixels (Taro) or only the border-connected background (the other eight). Alpha is snapped at the manifest’s threshold of 128. Momo drops sampled rows 21, 22, 24, 26 and 48; Hana drops rows 56 and 57. After row removal, the vertical shifts are Taro −4, Momo −1, Yuki −5, Fumi −5, Sora −5, Hana −4, Kiko −1, Pip −5 and Nori −4; horizontal shifts are zero. Feet end on row 56.

Frame transforms keep walking changes within the recorded leg columns on rows 48–56 and joy changes within each eye box. Side stands have pinned hashes: Taro and Kiko use right-mirror columns [0, 1, 2], Momo uses [2, 1, 0], and Yuki, Fumi, Sora, Hana, Pip and Nori have separate right-side views. Yuki, Fumi, Sora, Hana and Kiko also have pinned back stands. The recorded color swaps are Taro #efa54e → #ff9a3c and Momo #aee2d6 → #3fcfbf; the other seven references keep their colors. These recorded transforms and color substitutions are pending team confirmation; this describes the current assets, not new permission to redraw or recolor them.

All nine characters require intentional source-reference, pinned-hash and manifest derivation updates for art changes. Keep existing source drawings intact; do not directly edit a protected neighbor’s PNG to resolve a documentation inconsistency.

### Sprite sheets in the game (current)

Every character is drawn on the team’s **64 × 64 chibi canvas**, the one the boy and girl designs use, and ships as one sheet.

| Asset | Size | Rules |
| :--- | :--- | :--- |
| **Frame** | **64 × 64 px** | Transparent; the body base sits at cols 14–49, with the feet on **row 56** in every frame. |
| **Sheet** | **256 × 256 px** | Four columns × four rows of frames. |
| **Rows** | Front, left, right, back | Characters without a view leave that row empty; the game falls back to the front. |
| **Columns** | Step A, stand, step B, joy | Joy is the happy face on the front row only. Non-walkers fill only the stand column. |
| **Pixels** | Fully opaque or fully clear | No soft edges. Silhouette edges are dark outlines. |

Sheets live in `assets/figures/` (`player-boy.png`, `player-girl.png`, then one per neighbor). For all nine manifest characters, intentionally update the source-reference, pinned hash and manifest derivation before regenerating a sheet. `npm test` checks the reference hashes and transforms, size, feet row, outlines, and that no two characters share a silhouette.

The boy and girl use separate source layers in `docs/art/source/`; edit those layers while preserving the player-sheet layout. Their source-layer workflow does not authorize direct edits to the nine protected neighbors’ PNGs.

### Original proposal

These were the **proposed production sizes** before the team’s 64 × 64 designs arrived.

| Asset | Size | Export notes |
| :--- | :--- | :--- |
| **Overworld frame** | **32 × 48 px** | Transparent PNG; feet aligned near the bottom. |
| **Walking sheet** | **96 × 192 px** | Three columns × four rows of 32 × 48 frames. |
| **Dialogue portrait** | **128 × 128 px** | Transparent background; head and shoulders. |
| **Subject and UI icons** | **32 × 32 px** | Transparent backgrounds; readable silhouettes. |
| **Environment tiles** | **32 × 32 px** | Larger structures and props use multiples of this grid. |

### Walking sheet layout

**Rows, top to bottom:** Down → Left → Right → Up.  
**Columns, left to right:** Step A → Standing → Step B.  
**Animation loop:** Step A → Standing → Step B → Standing.

### Portrait expressions

Start with **neutral and attentive** and **happy**. Once the designs are consistent, add **thinking**, **explaining**, and **encouraging**.

### Clean exports

Deliver each character separately. Keep name labels, white backgrounds, selection borders, and reference-sheet decorations out of the exported game assets. Preserve crisp pixel edges when enlarging artwork.

<details>
<summary><strong>Example filenames</strong></summary>

Use predictable filenames:

```text
taro_idle_down.png
taro_walk.png
taro_portrait_neutral.png
taro_portrait_happy.png

player_walk.png
pip_idle_down.png
subject_math.png
workshop_exterior.png
```

</details>

## First art batch

Make these first so the front end can establish the game’s appearance before connecting the backend:

- [ ] One front-facing overworld pose for **all 10 characters**.
- [ ] One neutral portrait for **each of the seven main NPCs**.
- [ ] **Seven subject icons**.
- [ ] **One rough village composition** showing the locations above.
- [ ] **One conversation screen with Taro** and **one math activity screen**.

Once this batch looks consistent, extend the designs into directional walking sheets, additional portraits, buildings, and activity props.

### Before integration

- [ ] Every character uses the same viewpoint, lighting direction, and general scale.
- [ ] Walking frames keep the feet in the same position and fit their canvas.
- [ ] Ears, tails, hats, and instruments stay inside their frames.
- [ ] Characters remain distinguishable at actual game size.
- [ ] Each subject has an icon and label; identification does not depend on color alone.
- [ ] Dialogue panels leave room for larger text and translated sentences.
- [ ] Music activities have visual rhythm assets as well as optional sound.
- [ ] Artwork supports both chapters without a second cast or separate village.

[Back to top](#all-aboard)
