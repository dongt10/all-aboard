# Changelog

Changes to All Aboard, grouped by release.

## Unreleased

### Added

- Taro’s crate rows for grade 2: build equal rows, read their sum, pair crates to see odd or even, and Send cart when the rows match the order.
- Momo’s bean test for grade 2: change one cup’s water or sunlight, compare two weeks of growth, and build a garden bed card with Seed, Sun, Water and Bee before Plant bed.
- Hana’s compass errands for grade 2: follow three map clues, learn whose job each delivery helps, and Hang map after all three errands.
- Sora’s story ribbon for grade 2: two five-line stories with why questions, beginning/middle/end cards and lesson tags, saved with Share ribbon.
- Pattern and mirror goals for Yuki’s banner, from free stamping in K to six matching stamps in two colors in grades 4–5.
- Sentence and describing-word goals for Fumi’s sign, with phrase/word tiles and a short hint for the next step.
- The grade-4 pond food chain and Help Day set B, with Momo, Sora, Yuki and Fumi in four new jobs.
- Finished tales can be reread from their labels or filled book slots, with all three lines visible and the proof highlighted.
- Grade-2 activity routing, saves, creation pictures and Guide stamps, while older untagged creations keep their original pictures and learned statements.

### Changed

- Send band waits for each grade’s music lesson: a changed sound/rest rhythm at grade 1, a matched Echo at grade 2, and a changed melody at grades 3–5. Kindergarten keeps its play-or-edit rule, and published bands stay ready.
- Food-chain energy starts at the plant, with ÷10 arrows between feeding levels. The Sun supplies sunlight without a number. The three placed numbers are 1000 → 100 → 10 in grade 3, 2000 → 200 → 20 in grade 4, and 5000 → 500 → 50 in grade 5.
- Grade 5 pizzas use six or ten slices and require a cut into halves before Serve pizza; older saved pizzas still load and render.
- Pizza Help asks for every slice or piece to be handed out, with a cutting step at grade 5. The grade-4 stamp reads “Sharing equally is dividing: 12 ÷ 4 = 3 each.”
- Saved banner positions and sign text stay intact under the new completion goals. Grade-4 legacy charts and Help Day pictures remain visible; reopening starts the current pond or set-B task.

### Art

- Yuki and Fumi now come from the team's drawings, with side and back views, and the reference drawings are pinned so they can never be swapped silently.
- Yuki's and Fumi's right-facing profiles are drawn as their own view, not a mirror, so the calico patch and the pocket tag stay on the correct side.

### Fixed

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
