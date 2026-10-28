# Changelog

Changes to All Aboard, grouped by release.

## 2026-10-28 · v0.4.0

### Added

- Pip zips and Nori crawls: Pip wanders at 48 px/s with a quick stride, Nori at 12 px/s with a slow one, the seven neighbors as before. Inside the stop radius both turn toward the player and show their joy frame while the Talk chip names them, and both cheer for 1.5 s when the child comes back with something made. Calm motion keeps them home on standing frames.
- Pip’s next stop: after a creation’s reaction closes, Pip names one neighbor who still has something to make, a started stall first, then the first new stall in board order, then a second request, with a **Visit** chip that names the neighbor (**Visit Taro**) and **Not now**, and after a creation the offer opens with “Saved!” once the save went through; talking to Pip gives the same offer any time instead of the welcome forever (the welcome stays until the first creation). Visit walks to the neighbor and opens the encounter on arrival, instant in Calm motion. The offer never fires on a plain mount, while another dialogue or window is open, or before the road is ready. With nothing left to suggest, Pip offers the parade instead, with a **Parade** chip.
- Pip and Nori march in the parade: Pip just ahead of the leader inside the leader’s slot, Nori trailing the last marcher with a slower stride and settling in last (“Nori is on the way.” for two seconds), so “Nori made it!” closes every parade only after she lands. Calm motion shows the full still line-up at once.
- Their own jobs, said at the stall: the reaction after Add to town is spoken by whoever did the work, Pip for Hana’s second compass request, Nori for a complete Help Day set A crew, and Pip or Nori for their own solved tale in Sora’s decks. Every creation beside a stall is now a button that replays its line for four seconds with Hear, without moving, sparkling or changing the save.
- Pip delivers your sign: back in the village after Put up sign, Pip carries a small copy of the sign along the road to its reader (or to his own spot for his own mail) and the reader’s read-back line opens when he arrives; any key or tap skips the walk, group readers and Calm motion keep the instant line, and a delivering Pip is left out of the Talk chip. Asked afterwards, Pip says where the sign went.
- Lantern night at seven of seven: with every stall made in a grade the village lamps are lit, and talking to Nori offers **Light lanterns**: the lamps go dark and glow one by one at her pace, then “Lantern night in Hanabi Bay. You made it all.” Lit lamps come from the saved creations, so they stay lit for that grade with no new save field and no date gate; the lighting is replayable from Nori, Calm motion lights everything at once, and right after the seventh creation Pip points the child to Nori. Warm glows only, no tint over the painting.

### Changed

- The start screen opens Hanabi Bay at dusk: an evening sky, four paper lanterns with a stepped pixel glow, the village painting behind the whole cast waiting on the cobblestones (they cheer when a grade is picked), the lit logo over "an evening in Hanabi Bay", one paper panel with Who are you? and Your grade, then Full screen, one green Start / Continue and Credits, with the comfort toggles in a quieter footer. Boy and Girl stand above their names, every tile word sits on one bottom line at 20 px and the K and 1 to 5 numbers share one top line. Calm motion and the device's reduce-motion setting stop the lantern glow; phones keep 64 px controls.

## 2026-10-27 · v0.3.0

### Added

- Neighbors react to what you made. Back in the village, the neighbor whose creation you just added says one true thing about it: Taro counts the crates or the plates and slices, Momo names the shaded tray or the cup you changed, Sora lists what you packed, Yuki counts the stamps and names the colors, Hana names the bench, garden and sign, the errands or the crew, and Kiko names the friends who play, the speed, the tune's direction and the form. A short sign is read back word for word by its reader (Momo, Taro, Pip, Nori, Sora, Yuki or Kiko) when the sign was for them. Every line comes from the saved creation; when the save cannot support a detail, the neighbor just says thank you.
- Try another: once a neighbor's thing is made, the encounter offers a second request for every activity except music: a different starting load, crate target or slice count, the other cup condition, a tray that starts shaded, the pond or bay chain, three different things to pack, the other story or a new tale deck, a new pattern or mirror count, a new sign prompt, a new square goal, a different errand set, the other Help Day set. The request is saved with the draft, the stamp stays, and the creation at the stall stays until the new one is finished. Old saves open as the first request.
- Show me: Help in every encounter has a Show me button that plays the neighbor's short example on separate work (two to six steps, said aloud with Read to me), then hands the turn back with the child's exact work restored. Next and Stop chips, A advances and B stops; Calm motion and the device's reduce-motion setting step on tap instead of a timer.
- Help shows one step at a time: a big Step 1 of 4, the step's picture, Hear, Back and Next (Got it on the last step).
- A Now / Next / Finish picture strip beside every activity field: the current step and the next one with a picture each, the finish command's name, and a green Finish once the work is ready. The step comes from the saved work, so it moves as the child goes.
- Phones: a new save on a phone starts with Bigger words on (Comfort can turn it off and the choice is kept); nothing a child reads is smaller than 20 logical pixels on a phone; title toggles, HUD buttons, the command menu, the More chip, window buttons, music lanterns and Sounds controls grow to 56 or 64 logical pixels inside their existing boxes, without moving any part of the 960×540 scene.
- A title-screen Full screen toggle on supported browsers, with a readable message if the browser refuses; iPhone Safari instead shows a dismissible, remembered Add to Home Screen tip with Hear.
- A landscape Home Screen manifest and 192, 512 and Apple 180 px icons made from Pip’s existing standing sprite.
- Taro’s crate rows for grade 2: build equal rows, read their sum, pair crates to see odd or even, and Send cart when the rows match the order.
- Momo’s bean test for grade 2: change one cup’s water or sunlight, compare two weeks of growth, and build a garden bed card with Seed, Sun, Water and Bee before Plant bed.
- Hana’s compass errands for grade 2: follow three map clues, learn whose job each delivery helps, and Hang map after all three errands.
- Sora’s story ribbon for grade 2: two five-line stories with why questions, beginning/middle/end cards and lesson tags, saved with Share ribbon.
- Pattern and mirror goals for Yuki’s banner, from free stamping in K to six matching stamps in two colors in grades 4–5.
- Scenario-based writing for Fumi’s signs, with reader-specific prompts, word and sentence hints, reasons in grades 3–5, and different readers in grade 5. Children can fix or keep marked words and try another prompt.
- The grade-4 pond food chain and Help Day set B, with Momo, Sora, Yuki and Fumi in four new jobs.
- Finished tales can be reread from their labels or filled book slots, with all three lines visible and the proof highlighted.
- Grade-2 activity routing, saves, creation pictures and Guide stamps, while older untagged creations keep their original pictures and learned statements.

### Changed

- The village is now Hanabi Bay (it was Willow Bay).
- Fresh bands start with the editable Minecraft preset based on C418’s “Minecraft”; Meadow Band remains available as an alternative. Undo preset restores the previous score, and existing saved tunes retain their notes and sounds.
- The team’s hand-drawn village background replaces the old drawn map with a cobblestone crossroads.
- All characters—the player, Pip, Nori and the seven neighbors—walk only on the road, using the road mask and path finding for taps.
- Send band waits for each grade’s music lesson: a changed sound/rest rhythm at grade 1, a matched Echo at grade 2, and a changed melody at grades 3–5. Kindergarten keeps its play-or-edit rule, and published bands stay ready.
- Food-chain energy starts at the plant, with ÷10 arrows between feeding levels. The Sun supplies sunlight without a number. The three placed numbers are 1000 → 100 → 10 in grade 3, 2000 → 200 → 20 in grade 4, and 5000 → 500 → 50 in grade 5.
- Grade 5 pizzas use six or ten slices and require a cut into halves before Serve pizza; older saved pizzas still load and render.
- Pizza Help asks for every slice or piece to be handed out, with a cutting step at grade 5. The grade-4 stamp reads “Sharing equally is dividing: 12 ÷ 4 = 3 each.”
- Saved banner positions and sign text stay intact under the new completion goals. Grade-4 legacy charts and Help Day pictures remain visible; reopening starts the current pond or set-B task.

### Art

- The seven stalls are drawn as their own pixel sprites in the characters' outline style: Taro's workshop, Momo's kitchen, Yuki's studio, Sora's reading nook, Fumi's writing booth, Hana's map kiosk and Kiko's stage.
- Hana, Kiko and Sora rebuilt from the team's drawings with true left, right and back views.
- Pip and Nori redrawn from approved concept designs in the team's style, with true left and right profiles; the references are pinned and the sheets are derived from them.
- Yuki and Fumi now come from the team's drawings, with side and back views, and the reference drawings are pinned so they can never be swapped silently.
- Yuki's and Fumi's right-facing profiles are drawn as their own view, not a mirror, so the calico patch and the pocket tag stay on the correct side.

### Fixed

- The Home Screen app (Add to Home Screen) uses the whole screen on a cold launch; iOS reported the height minus the portrait status bar, so the stage now sizes from the screen there.
- An overnight pass on the 2026-10-27 review: Enter talks to the focused neighbor; unread dialogue pages come before any key press can answer; the reward card accepts only on its button and can be heard; the Guide reads its pages and speech failures show a notice; only local voices are used; stamps say We explored; Echo keeps a partial rhythm and its credit survives leaving; the quiet choice holds through Echo and presets; the no-water seed stays a seed and the bee is pollination, not a growth rule; energy numbers are pretend units; Next story keeps each story's draft; compass starts and distances match the map; finished banners drop the working fold and mirror checks respect flipped stamps; an unreadable or newer save is kept and can be exported, never overwritten; HEAD requests read no file bodies; village name chips never overlap.
- Phone stage fitting follows the visible viewport and safe-area insets as browser bars move or the device rotates. Pinch zoom keeps its magnification, touch no longer triggers double-tap zoom, and phone margins use the scene’s palette while the central 960×540 playfield stays intact.
- Read-aloud selects a preferred local English voice and uses a calm pace with neutral pitch.
- The Enter walking hint closes after three seconds and chooses a clear dialogue position when available, otherwise the position with less player overlap. Read to me finishes speaking before the closing delay.
- Taro’s starting crates stay tied to the cart; crates added by the child can still be removed.
- Older grade-4 bands that load with Form A open as A B, preserving notes and mix settings. Form stays locked.
- The west compass clue shows “← 2,” matching the stage’s position two squares west of the kiosk.
- Music control rows keep one Tab stop each, with arrow-key navigation between controls.
- Enter, Space and Z in the village talk only to the neighbor you are standing next to. They never jump you to a far stall any more; with nobody near, Pip says "Walk up to a neighbor, then press Enter."
- The welcome and the celebration box close by themselves a few seconds after their last page, so Pip, Nori and Sora's stall are not hidden behind them when you come back from an activity.

## 2026-10-25 · Cal Hacks build

### Added

- Added an eight-lantern rail to Kiko's music stage: sound and rest for grades 1–2, and a Do, Re, Mi, Sol, La staircase for grades 3–5. (05414a4)
- Added a Speed sign with Slow, Steady and Fast at every grade.
- Added Echo at grade 2: watch and hear an eight-beat rhythm, copy it, then make one back.
- Added Cricket's steady part under A B at grade 4 and a Form sign for A, A B or A B A at grade 5.
- Added Taro's pizza party for grades 3–5: share slices equally among four friends, with leftover halves at grade 5. (6e4fab8)
- Added Momo's sunbeam chart for grades 3–5: build a food chain and place the energy numbers using a one-tenth model.
- Added Hana's Help Day for grades 3–5: match four helpers' strengths to four festival jobs.
- Added Whose tale is this? for grades 3–5: name the neighbor and choose the line that proves it, with a different starting deck per grade.
- Grew the test suite from 168 to 542 tests across activities, music, saves, keyboard controls, layout, movement and reference art. All 542 pass. (7e11ab5)

### Changed

- Kept one finish command last, gray until ready and green when ready; Share story appears after all three items are packed. (05414a4)
- Replaced unclear labels with kid words such as Serve ice, Try it, Next part, Turn and Send band.
- Made Help name the finish command for each activity, including Send band at every grade.
- Replaced stale dialogue with readiness lines that name what to do next.
- Replaced Tunes with a Sounds window for each friend's part and volume, with Loud and Soft buttons in Kindergarten.
- Moved WAV recording to Kiko's Guide page after sending a band; the recording follows the saved Speed and Form.
- Added Pip's welcome line until the first creation in each grade and placed it above the square, clear of the stalls. (05414a4, b0697ca)
- Labeled the Festival board, marked started stalls with three dots, and showed each new creation at its stall, in the Guide and in the parade.
- Ended the parade after two laps, or immediately with Calm motion, with a closing line and March again; all seven creations earn a festival-complete board and finale line.
- Added Title screen to Pause so players can return to their character and grade choices.

### Fixed

- Added activity tags to saved work, rejected unknown tags and mismatched grade scopes, and kept legacy creations readable. (6e4fab8, efb51f4, 117badb)
- Protected a save written by another tab from being overwritten. (117badb)
- Cancelled reward cards on scene changes and checked the chapter and grade before saving a finished creation. (0ed619a)
- Fixed keyboard focus in Grade, reward and portrait windows, restored focus when controls disappear, and let X or Backspace close Sounds from a volume slider.
- Blocked keyboard activation during scene wipes, kept native button activation on held keys, and made arrow keys interrupt tap-walking.
- Fixed Bigger words clipping in commands, activity labels, the Sounds window, Guide pages and long signs; dialogue now paginates by rendered width.
- Improved finish-button hover contrast, announced activity and save feedback, read the story passage aloud, and stopped Help speech when its window closes.
- Kept hidden tabs silent, cancelled late recordings, preserved edits while audio starts, and made Echo retries replay the same rhythm in time with its lights.
- Fixed Help Day Undo, reopened banner Undo, whole-tile sign removal and whole-slice pizza removal at grade 5.
- Sped up the player's walking stride to 80 ms per frame at base speed; neighbors keep their slower stroll and Calm motion keeps standing frames. (7e11ab5)
- Made the water a wall: keyboard steps stop at the shore, water taps land on the nearest shore or pier point, and the wider pier stays walkable. (7e11ab5)

### Art

- Restored the team's reference drawings for Taro and Momo, with only the recorded sprite-sheet transforms. (148f372)
- Set the rule “original design overrides all”; `tests/figures-references.test.js` rebuilds the front frames from the references and checks the side frames, joy eyes, walking legs and mirrored views. (0913702, 0ed619a)
- Drew the kids' side views from their own front and back art, keeping their colors, proportions and moving legs. (462d747)
- Drew true side profiles for Taro and Momo in their reference style, preserving the front and joy frames. (0531ba4)
- Put every word in Pixelify Sans, including dialogue, commands and windows, with Andika as the fallback. (3b58bc0)
- Redrew the props, activity objects, village scenery, parade pieces and music stage with ink outlines, flat shading and crisp pixel steps. (f5f0064)
