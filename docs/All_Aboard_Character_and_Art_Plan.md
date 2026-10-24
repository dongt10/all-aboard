# All Aboard Character and Art Brief

## Visual direction

Your reference establishes the style: **small pixel-art characters viewed from slightly above, with large heads, compact bodies, and clear front, back, left, and right views.**

Use that viewpoint for a human child exploring a village of animal neighbors. The world should have visible building fronts, winding paths, and a Japanese summer festival setting.

The initial cast has **10 character designs: one player, seven main NPCs, and two recurring side characters.** Reuse this cast across:

- **Chapter 0:** kindergarten.
- **Chapter 1:** grades 1–5.

All seven subjects are available within each chapter. Players choose their order, switch subjects, and return to unfinished activities. Each chapter ends when its seven subject tracks are complete.

## Character roster

Keep Taro, Momo, Yuki, and Sora. Add Fumi, Hana, and Kiko to cover the expanded subjects.

| Character | Role and personality | Visual design | Location and identifying prop |
|---|---|---|---|
| **Taro — tanuki** | **Math.** An inventive carpenter who wants to build a sturdy festival cart. Measures with his tail and invites the player to check his work. | Round brown body, dark facial markings, small ears, rust-orange work apron, rolled sleeves. Broad, recognizable silhouette. | **Workshop.** Wooden ruler, pencil, tool belt, unfinished cart. Subject icon: counting blocks. |
| **Momo — rabbit** | **Science.** A curious chef experimenting with summer treats. Asks what the player thinks will happen before trying something. | Cream fur, peach inner ears, mint apron, strawberry pin. Tall ears distinguish her at small sizes. | **Festival kitchen.** Bowl, spoon, fruit, ice tray. Subject icon: a simple flask. |
| **Yuki — cat** | **Art.** An observant designer who wants every stall to express its owner’s personality. Notices the player’s choices. | Cream-and-calico fur, triangular ears, lavender work smock, colorful fabric patches. | **Design studio.** Fabric roll, brush, patterned banner. Subject icon: paint palette. |
| **Sora — otter** | **Reading.** An expressive storyteller who gathers stories about the village. Enjoys letting the player discover what happens next. | Warm brown fur, pale muzzle, blue vest, book satchel. Rounded head and small ears. | **Reading nook.** Open book, cushions, low bookshelf. Subject icon: open book. |
| **Fumi — fox** | **Writing.** A thoughtful letter writer who helps neighbors express their ideas. Gets excited about finding the right words. | Orange fur, cream muzzle and tail tip, pointed ears, teal vest, pencil tucked into a pocket. | **Writing booth.** Pencil, paper, envelopes, blank signs. Subject icon: pencil. |
| **Hana — deer** | **Social studies and community.** A friendly village guide who knows the places, jobs, and people that keep the town running. | Warm brown coat, large ears, small antlers, leaf-green scarf, crossbody map bag. | **Map kiosk.** Folded map, signposts, community noticeboard. Subject icon: map pin. |
| **Kiko — sparrow** | **Music.** An enthusiastic musician preparing the festival’s welcome tune. Likes experimenting with different patterns. | Small rounded body, brown-and-cream feathers, golden-yellow festival coat, tiny drum strap. | **Music stage.** Drum, rhythm cards, small instruments. Subject icon: musical note. |

Give every main character a distinct silhouette and prop. Their identity should remain recognizable when the sprite is small.

**The human player**

Design a school-age child with a large, readable head and compact proportions matching your reference. Use a cream summer shirt, teal shorts, comfortable shoes, and a small red backpack.

Create one consistent body and outfit for the prototype, with a few hair and skin-tone variations. Keep the same sprite dimensions and walking poses across variations.

**Recurring side characters**

| Character | Design | How they connect the village |
|---|---|---|
| **Pip — duck courier** | White feathers, orange bill, blue delivery cap, oversized mailbag. Energetic and easily distracted by interesting discoveries. | Needs help counting deliveries, reading an address, writing a message, decorating a parcel, or finding a route. |
| **Nori — turtle festival helper** | Green skin, rounded brown shell, peach vest, small basket. Patient, practical, and fond of trying other people’s creations. | Visits different stalls, tests recipes, requests decorations, listens to stories, and joins music activities. |

Pip and Nori can appear in multiple subject quests. **Each request must work independently**, so visiting Momo never requires finishing Taro first. References to earlier adventures appear only when the player has actually completed them.

## Village and rough front end

Arrange the village around a central festival square. Use open paths between all subject locations.

```text
       HANA                 SORA                 FUMI
     Map kiosk          Reading nook          Writing booth
          \                  |                    /
           \                 |                   /
       TARO -------- FESTIVAL SQUARE -------- YUKI
     Workshop          Player’s stall       Design studio
           \                 |                   /
            \                |                  /
       MOMO              ARRIVAL PIER           KIKO
  Festival kitchen       Human player        Music stage
```

Add trees, a shoreline, flower beds, benches, and a quiet resting nook. Keep the main paths visually clear. The central stall displays the player’s creations as they progress.

You only need three substantial building fronts initially: Taro’s workshop, Momo’s kitchen, and Yuki’s studio. The other locations can be outdoor stalls or small gathering spaces.

The rough front end needs these views:

| View | What it shows | Artwork needed |
|---|---|---|
| **Welcome and chapter selection** | New game, continue, Chapter 0, and Chapter 1. | Village title background and two chapter illustrations. |
| **Village exploration** | Human player, seven subject locations, recurring neighbors, and the festival square. | Environment, character sprites, props, and subject icons. |
| **Conversation** | NPC portrait, short dialogue, response choices, and support buttons. | Character portraits and expression variants. |
| **Activity** | The current task, movable or selectable objects, and visible feedback. | Reusable subject props such as blocks, fruit, books, pattern pieces, and rhythm cards. |
| **Progress and pause** | Seven subject markers, saved progress, resume, settings, and break controls. | Subject badges and simple UI icons. |

The backend will supply the chapter, grade, activity content, dialogue, available supports, and progress. **Keep text, numbers, and lesson instructions separate from the artwork** so the front end can display different languages and difficulty levels.

## Asset sizes and delivery

Use these as the working export conventions. They are proposed production sizes, not measurements taken from the reference image.

| Asset | Working specification |
|---|---|
| **Overworld character frame** | **32 × 48 px**, transparent PNG. Keep the feet aligned near the bottom of the frame. |
| **Walking sheet** | **96 × 192 px:** three columns and four rows of 32 × 48 frames. |
| **Walking rows** | Down, left, right, up. |
| **Walking columns** | Step A, standing, Step B. The game can repeat them as A → standing → B → standing. |
| **Dialogue portrait** | **128 × 128 px**, transparent background, head and shoulders. |
| **Subject and UI icons** | **32 × 32 px**, readable silhouettes with transparent backgrounds. |
| **Environment tiles** | **32 × 32 px** tiles. Larger structures and props use multiples of this grid. |

For portraits, create these expressions:

- Neutral and attentive.
- Happy.
- Thinking.
- Explaining.
- Encouraging.

For the first pass, neutral and happy are enough. Add the other expressions after the designs are consistent.

Use predictable filenames, for example:

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

Deliver each character separately. Keep name labels, white backgrounds, selection borders, and reference-sheet decorations out of the exported game assets. Preserve crisp pixel edges when enlarging artwork.

## What to draw first and how to check it

**First art batch**

1. One front-facing overworld pose for all 10 characters.
2. One neutral portrait for each of the seven main NPCs.
3. Seven subject icons.
4. One rough village composition showing the locations above.
5. One example conversation screen with Taro and one example math activity.

Once that batch looks consistent, extend the designs into directional walking sheets, additional portraits, buildings, and activity props.

**Checks before integration**

- Every character uses the same viewpoint, lighting direction, and general scale.
- All walking frames keep the feet in the same position and fit their canvas.
- Ears, tails, hats, and instruments stay inside their frames.
- Characters remain distinguishable at actual game size.
- Each subject has an icon and label; identification does not depend on color alone.
- Dialogue panels have enough room for larger text and translated sentences.
- Music activities have visual rhythm assets as well as optional sound.
- Artwork supports either chapter without requiring a second cast or separate village.

This first batch gives you a concrete art target and gives the front end enough material to establish the game’s appearance before connecting the backend.
