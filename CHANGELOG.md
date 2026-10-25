# Changelog

Changes to All Aboard, grouped by release.

## Unreleased

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
