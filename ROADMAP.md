# All Aboard

**Roadmap** · Learning goals, v1 scope, and milestones

This roadmap turns the Project Brief and the [Character and Art Plan](docs/All_Aboard_Character_and_Art_Plan.md) into what each grade should learn, what ships in v1, and the order of work. It picks up from the UI remake planned for Cal Hacks judging on October 25.

**Status:** draft for team and educator review · October 2026

[Starting point](#starting-point) · [Decisions](#decisions-to-make) · [Principles](#principles) · [Learning goals](#learning-goals-by-grade) · [Definition of done](#definition-of-done) · [v1 scope](#v1-scope) · [Milestones](#milestones) · [Housekeeping](#housekeeping)

## Starting point

All Aboard · Summer Festival is a playable prototype with seven creative encounters, saves for each grade, and a parade. The UI remake for Cal Hacks replaced the screens and the cast and kept the saves. See [the Cal Hacks milestone](#now--ui-remake-for-cal-hacks).

**Shipped 2026-10-24** (the evening before judging), on top of the remake:

- The clarity pass: four commands at most, a green finish command last and gray until the creation is ready, a “try it” verb where a check exists, Help steps that name the finish, and kid words throughout (Serve ice, Turn, Next step, Try it, Send band). The story bag shows Share story only after all three things are packed.
- Four new activities for grades 3–5: **Taro’s pizza party** (share slices equally), **Momo’s sunbeam chart** (build a food chain and choose energy numbers), **Hana’s Help Day** (match helpers’ strengths to jobs), and **Whose tale is this?** (name a neighbor and choose the line that proves it). At that point, Kindergarten and grades 1–2 kept the cart, ice test, square and story bag. The registry, saves, creation displays and Guide stamps followed the selected activity.
- Music that grows with the grade: Speed at every grade, Cricket’s sound-and-rest lanterns at 1–2 with Echo at 2, Kiko’s note staircase at 3–5 with the steady part at 4 and Form A B A at 5. Tempo and form are saved. The WAV recording moved to the Guide’s Kiko page.
- Two rebuilt neighbors: Taro and Momo, drawn from the team’s reference art in `docs/art/source/neighbors` on the shared cast body.
- The loop closes: Pip’s welcome line, a labeled festival board, started stalls look started, the parade ends in a line-up, a finale line at seven of seven, and Title screen from Pause.

**Added 2026-10-25:**

- All seven neighbors plus Pip and Nori now come from the team's reference drawings in `docs/art/source/neighbors/`.
- Four grade-2 activities: **Taro’s crate rows**, **Momo’s bean test**, **Hana’s compass errands**, and **Sora’s story ribbon**, with their own saves, village creations and Guide stamps. Kindergarten and grade 1 keep their earlier activities.
- Banner goals now grow from free stamps to shape/color patterns and mirror designs. Sign goals grow from two words to complete sentences and describing words.
- Grade 4 has a pond food chain and Help Day set B. Food-chain numbers start at the plant, and feeding arrows show ÷10. Grade 5 must cut pizza halves; finished tales can be reread with their proof highlighted.
- Send band waits for the grade’s lesson. Older grade-4 Form A saves open as A B. The walking hint closes itself and stays clear of the player; Taro’s starting crates stay tied down.

Still thin:

- Grade 2 now has distinct math, science, reading and community tasks. Grades 4–5 still share the grade-3 activity types, with a pond chain and new jobs at grade 4, required pizza halves and hidden strengths at grade 5, and different tale decks. These remain a small set of tasks rather than full grade coverage.
- Art and Writing now have grade-based completion goals. More pattern types, writing for different readers, revision and coordinate designs remain planned; grades 3–5 share the two-sentence writing goal.
- The finale is one line on the board and in the parade, not a lantern night.
- Several supports from the brief are missing or partial. See [v1 scope](#v1-scope).
- Every on-screen word is written into the code, so content can’t change by grade or language without code changes.

## Decisions to make

Each decision has a recommendation, and the rest of this roadmap assumes it.

| Decision | Recommended | Alternative |
| :--- | :--- | :--- |
| **Who v1 is for** | Kindergarten–grade 3, about ages 5–9, matching the brief’s ages 6–9. The grade 4 and 5 tiles stay, labeled **Preview**, so existing saves keep working. | Full K–5 in v1, which adds two more grades of content to every subject. |
| **The player’s stall** | After the demo, add the brief’s empty stall on the grass beside the crossroads, so the whole game has one thing to fill. | Keep creations at neighbors’ stalls with the remake’s festival board, and update the plan. |
| **Standards** | Use the US anchors in the tables below as starting points, reviewed by an educator. | Another framework, if the first pilots happen outside the US. |
| **Backend** | None in v1. A content file fills the plan’s “backend supplies content” role. | Revisit if teachers need to assign or track work. |

**Already decided by the UI remake:**

- **Art:** 64×64 PNG frames in 256×256 sprite sheets. Rows are front, left, right, back; columns are step A, stand, step B, joy, with feet on row 56.
- **Cast:** 11 character identities in 12 sprite sheets: two player looks, seven neighbors, and three side characters, with Cricket on rhythm.
- **Screen:** one landscape 960×540 stage. Portrait phones get a “turn sideways” card.
- **Fonts:** Andika and Pixelify Sans, self-hosted.

## Principles

These come from the brief, which centers neurodivergent children and children with speech or communication disabilities. Every milestone keeps them.

- **Any order.** Every request works on its own, and no subject waits on another.
- **Every creation belongs.** Wrong tries explain why and keep the work. No timers, lives, or fail screens.
- **Support is always there,** including when speech or sound doesn’t work.
- **No single way in.** Nothing requires voice, reading, dragging, or sound to finish.
- **Children’s data stays on the device.** No accounts, no third-party requests, and logging only when a grown-up turns it on.

The UI remake adds interaction rules on top: one dialogue page at a time, at most four choices in the same place, and color, icon, and word on every choice.

## Learning goals by grade

The four grade 3–5 activities shipped on 2026-10-24. The four grade-2 activities, banner/sign goals and grade-4 content were added on 2026-10-25. Rows marked **Shipped** describe the current task; other rows remain learning targets. Full-depth grade 4–5 work is still planned after v1.

Every task has to fit the remake’s encounter frame: at most four commands of 12 characters or fewer, and dialogue pages of 96 characters or fewer (56 with Bigger words).

Anchors are starting points from US frameworks: Common Core (CCSS), the Next Generation Science Standards (NGSS), the National Core Arts Standards, and the C3 Framework for social studies. An educator should confirm each row before it ships.

### Math · Taro’s cart, crate rows and pizza party

**Equal means fair shares.** Kindergarten and grade 1 balance the cart; grade 2 builds equal crate rows; grades 3–5 share a pizza among four friends.

| Grade | Learning goal | In Taro’s workshop | Anchor |
| :--- | :--- | :--- | :--- |
| K | Tell when two groups are equal by matching and counting to 10. | Load single crates until both sides match. Taro counts aloud with you. | CCSS K.CC.C.6 |
| 1 | Understand the equal sign: different sums can be equal. | Crates of 1 and 2. Taro writes the cart as 3 + 2 = 4 + 1 and asks, “True?” | CCSS 1.OA.D.7 |
| 2 | Use equal rows for repeated addition and pair objects to see odd or even. | **Shipped: Taro’s crate rows.** Make equal, gap-free rows for 12, 10, 8 or 6 crates. Read the sum, use Pair up, then Send cart when the rows match the order. | CCSS 2.OA.C.3 / 2.OA.C.4 |
| 3 | Interpret division as equal sharing; connect equal parts to fractions. | **Taro’s pizza party:** share 8 slices among 4 friends. Choose Dig in! to check, then Serve pizza. New pizza also offers 12 or 4 slices. | CCSS 3.OA.A.2 / 3.NF.A.1 |
| 4 | Practice the same equal-sharing goal with more slices. | **Shipped:** pizza starts with 12 slices for 4 friends; New pizza also offers 8 or 4. Hand out every slice, check, then Serve pizza. The stamp reads 12 ÷ 4 = 3 each. | CCSS 3.OA.A.2 / 3.NF.A.1 (shared foundation) |
| 5 | Interpret division with a fractional share. | **Shipped:** use 6 or 10 slices for 4 friends. Cut into halves, share every piece equally, check, then Serve pizza. A cut is required. | CCSS 5.NF.B.3 |

Grade 2’s larger sums, adding tens and skip-counting by 5s remain planned.

### Science · Momo’s ice test, bean test and food chains

**Observe and explain.** Kindergarten and grade 1 compare shaded ice; grade 2 changes one condition for a bean cup; grades 3–5 model energy moving through a food chain.

| Grade | Learning goal | In the festival kitchen | Anchor |
| :--- | :--- | :--- | :--- |
| K | Sunlight warms things, and shade keeps them cooler. | Predict which tray keeps more ice, shade one, wait, then check the prediction. | NGSS K-PS3-1, K-PS3-2 |
| 1 | Different materials block different amounts of light. | Choose a canopy of cloth, paper, or clear plastic, and compare the ice. | NGSS 1-PS4-3 |
| 2 | Test how sunlight and water help plants grow; notice a bee’s role. | **Shipped: Momo’s bean test.** Change only water or sunlight for cup B, compare two weeks of growth, then build a bed card with Seed, Sun, Water and Bee. Plant bed finishes both tasks. | NGSS 2-LS2-1 / 2-LS2-2 (introductory model) |
| 3 | Model food energy as originating in sunlight. | **Shipped: Momo’s sunbeam chart.** Place Sea plant, Little fish, then Otter or Gull, with 1000 → 100 → 10. Choose Shine!, then Pin chart. | NGSS 5-PS3-1 / 5-LS2-1 (introductory model) |
| 4 | Apply the food-chain energy model in a pond. | **Shipped:** Pondweed → Snail → Koi or Frog, with 2000 → 200 → 20. Place all three numbers, choose Shine!, then Pin chart. | NGSS 5-PS3-1 / 5-LS2-1 (introductory model) |
| 5 | Model energy moving from the sun through a food chain. | **Shipped:** the bay chart uses 5000 → 500 → 50 and says “10%.” Place all three numbers, choose Shine!, then Pin chart. | NGSS 5-PS3-1 / 5-LS2-1 |

The Sun supplies sunlight without a number. The plant holds the largest number, and each feeding arrow shows ÷10. Reversible kitchen changes and habitat comparisons remain planned.

### Reading · Sora’s packing story, story ribbon and tales

**Read for a reason.** Kindergarten and grade 1 pack Sora’s story bag; grade 2 follows a whole story’s cause, order and lesson; grades 3–5 name the neighbor in a tale and choose the line that proves it.

| Grade | Learning goal | In the reading nook | Anchor |
| :--- | :--- | :--- | :--- |
| K | Decode short words and match them to pictures. | Short-vowel words such as HAT, CUP, FAN, and MAP replace KEY, UMBRELLA, and BOOK. | CCSS RF.K.3 |
| 1 | Read short sentences and answer questions about key details. | Today’s short passages, with a “what” question for each item. | CCSS RL.1.1 |
| 2 | Answer why, retell the beginning/middle/end, and find a lesson. | **Shipped: Sora’s story ribbon.** Two five-line stories about Taro’s sandal and Kiko’s drum stay available throughout. Answer why, order three events and choose the lesson, then Share ribbon. One finished story is enough. | CCSS RL.2.1 / RL.2.2 / RL.2.5 |
| 3 | Use a detail in the text to support an answer. | **Whose tale is this?** Read three lines, name the neighbor, then choose the line that proves it. Name three tales to Share tales. Starts with Momo, Taro and Kiko. | CCSS RL.3.1 |
| 4 | Infer a character’s identity from text details. | **Shipped:** the tale-and-proof task starts with Hana, Pip and Yuki. Start over cycles decks; named tales and filled book slots reopen all three lines with the proof highlighted. | CCSS RL.4.1 |
| 5 | Select the exact line that supports an inference. | The same tale-and-proof task starts with Fumi, Nori and Sora. Choose the evidence line for each before Share tales. | CCSS RL.5.1 |

### Writing · Fumi’s welcome sign

**Write for a reader.** Fumi gives a short next-step hint until the sign meets its grade’s goal. Kindergarten needs two words; grades 1–2 need complete sentences; grades 3–5 need two complete sentences and a describing word. Every sentence starts with a capital and ends with . or !. Every grade can use tiles; grades 1–5 can also type.

| Grade | Learning goal | In the writing booth | Anchor |
| :--- | :--- | :--- | :--- |
| K | Compose a message with word tiles and pictures, with spaces between words. | Word tiles plus picture stamps. Hear reads the sign back. | CCSS W.K.2, RF.K.1 |
| 1 | Capitalize names, and end a sentence with punctuation. | Invite a neighbor by name: “Come play, Momo!” Fumi notices the capital and the end mark. | CCSS L.1.2 |
| 2 | Start a sentence with a capital and finish it with punctuation. | **Shipped:** make a complete sentence with eight word tiles or typing, then Put up sign. Place names and greeting commas remain planned. | CCSS L.2.2 (foundation) |
| 3 | State an opinion and give a reason. | “Come to the festival because…” Fumi asks for one reason. | CCSS W.3.1 |
| 4 | Use complete sentences and describing words; develop writing for a reader. | **Shipped foundation:** two complete sentences with a describing word, using phrase/word tiles or typing. Reader cards and writing for different purposes remain planned. | CCSS W.4.4 (longer-term target) |
| 5 | Revise the same message for a different audience. | Rewrite the sign for grown-ups, then for little kids, and compare the word choices. | CCSS W.5.4, W.5.5 |

### Art · Yuki’s banner

**Make choices on purpose, and talk about them.** The current banner needs any stamp in K, a finished shape pattern in grade 1, a color pattern in grade 2, and mirror pairs in grades 3–5. Grade 3 needs four matching stamps; grades 4–5 need six in two colors.

| Grade | Learning goal | In the design studio | Anchor |
| :--- | :--- | :--- | :--- |
| K | Explore color and shape, and continue an AB pattern. | Stamp freely, then continue the red-blue pattern Yuki starts. | Arts: Creating |
| 1 | Make and name repeating patterns such as AB, ABB, and ABC. | Stamp a pattern row along the banner’s edge. Yuki names your pattern. | Arts: Creating |
| 2 | Continue a repeating color pattern. | **Shipped:** Yuki starts coral, blue, coral flowers. Complete blue, coral, blue across the top row, then Hang banner. Choosing colors for a feeling remains planned. | Arts: Creating |
| 3 | Plan a design, then revise it. | Sketch on a small cloth, then make the final banner. Yuki asks about one change. | Arts: Creating |
| 4 | Recognize and make line symmetry. | **Shipped:** stamp both sides of the fold yourself. Make at least six matching stamps in two colors; unmatched stamps show a mirror cue. Hang banner finishes. | CCSS 4.G.A.3 |
| 5 | Place shapes by coordinates, and follow two pattern rules. | Stamp at points such as (2, 3). Rules like “x + 1, y + 2” make a stamp trail. | CCSS 5.G.A.1, 5.OA.B.3 |

### Community · Hana’s square, compass errands and Help Day

**Everyone has a part.** Kindergarten and grade 1 plan the square; grade 2 follows compass errands and sees how neighbors’ jobs connect; grades 3–5 match neighbors’ strengths to festival jobs.

| Grade | Learning goal | At the map kiosk | Anchor |
| :--- | :--- | :--- | :--- |
| K | Use position words such as next to, near, far, above, and below. | Follow Hana’s spoken directions: “Put a bench next to the path.” | C3 Geography |
| 1 | Read a simple map with symbols. | Match items to a map key. Find the quiet trees and the stage. | C3 Geography |
| 2 | Use north, south, east and west on a map, and notice how neighbors’ jobs connect. | **Shipped: Hana’s compass errands.** Tap three destinations from the kiosk: north 1, west 2, then east 2 and south 1 past the lantern shed to Taro’s workshop. Each delivery explains whose job it helps; Hang map finishes all three. | C3 D2.Geo.2.K-2 / D2.Geo.3.K-2 / D2.Eco.3.K-2 |
| 3 | Connect individual strengths and responsibilities to a shared goal. | **Hana’s Help Day:** match Kiko to lanterns, Taro to the drum, Nori to the gate, and Pip to invitations. Ask and Next job give clues; Start day finishes when all four fit. | C3 D2.Civ.2.3-5 / D2.Civ.6.3-5 |
| 4 | Match different strengths to a new set of group needs. | **Shipped: Help Day set B.** Momo cooks stew, Sora tells a tale, Yuki paints the banner and Fumi writes signs. Strength labels are shown; all four fits are needed for Start day. | C3 D2.Civ.2.3-5 / D2.Civ.6.3-5 |
| 5 | Infer or ask about strengths before assigning responsibilities. | The same Help Day task hides the strength labels. Ask a helper or use the clues to fill every job, then Start day. | C3 D2.Civ.2.3-5 / D2.Civ.6.3-5 |

### Music · Kiko’s band

**See it, hear it, change it.** Quiet play keeps every goal reachable without sound.

| Grade | Learning goal | On the music stage | Anchor |
| :--- | :--- | :--- | :--- |
| K | Keep a steady beat, and hear loud and soft, fast and slow, high and low. | Tap along as the lanterns light up. Who plays low? Who plays high? | Arts: Performing |
| 1 | Rests are part of rhythm. | Switch each beat between sound and rest. | Arts: Creating |
| 2 | Echo and create 8-beat rhythms. | **Shipped:** Kiko plays a pattern to echo, then you make one for Kiko. Send band waits for a matched Echo rhythm. | Arts: Performing, Creating |
| 3 | Melodies move up, move down, or stay the same, using Do, Re, Mi, Sol, and La. | Choose notes. Kiko asks whether your tune goes up or down. | Arts: Creating |
| 4 | Layer a repeating part, an ostinato, under a melody. | **Shipped:** change Kiko’s melody above Cricket’s steady part before Send band. Form stays A B; older saves that load as A open as A B with their notes and mix intact. | Arts: Creating |
| 5 | Compose in ABA form and explain your choices. | Write phrases A and B, arrange them A–B–A, then give the song a title and a reason. | Arts: Creating, Presenting |

**Shipped 2026-10-24:** the K row (Speed sign with Slow, Steady and Fast at 60, 90 and 120 beats per minute; Loud and Soft per friend; lines that say who sings low, middle and high), the grade 1 row (Cricket’s rhythm on the lanterns, sound or rest, with Kiko counting them), the grade 2 row (Echo: Kiko plays and flashes an 8-beat rhythm, the child copies it, then makes one for Kiko), the grade 3 row (Kiko’s tune on the lanterns as a staircase of Do, Re, Mi, Sol, La, and Kiko says whether it goes up, down, stays the same, or both), the grade 4 row (Cricket’s steady part badge under the changing tune, Form fixed at A B), and the grade 5 Form sign (A, A B, A B A). Tempo and form are saved with the band.

In A B and A B A, phrase B plays each tune’s other preset while Cricket keeps the same rhythm, so grade 4 hears the steady part under a melody that changes between phrases.

Send band now waits for the lesson: K starts Play band or See beat, or makes an edit; grade 1 changes Cricket’s sound/rest rhythm; grade 2 matches an Echo; grades 3–5 change Kiko’s melody from the selected preset. Volume, Speed, Form and other friends’ edits do not finish grades 1–5. Published bands stay ready in their own grade.

**Still planned:** a phrase B the child writes (today it is the other preset), grade 5’s title and reason for the song, and the beat-tapping check for K.

## Definition of done

A subject is done for a grade when:

- [ ] The encounter asks for that grade’s goal from the tables above, and the finished creation shows it.
- [ ] A child who can’t read yet can find the next step from pictures or Hear.
- [ ] Help offers **One step at a time** and **Show me**, and Hear reads everything on screen.
- [ ] Wrong tries explain why and keep the child’s work. The finish command stays disabled until the creation is ready.
- [ ] Everything works with taps or a keyboard alone, with no dragging or timing.
- [ ] Nothing overflows with **Bigger words** on, and text stays readable on a phone held sideways.
- [ ] All words come from the content file, and tests cover the grade’s goal rule and the remake’s text limits.
- [ ] An educator has reviewed the goal and the task.

## v1 scope

v1 is a pilot build for testing with children, caregivers, and educators.

### In v1

- Kindergarten–grade 3 at full depth in all seven subjects.
- The supports in the table below.
- The festival loop: the player’s stall, neighbors who remember your work, and a finale when all seven are made.
- Pip quests that reuse a skill from math, reading, or community, for the pilot’s “apply it elsewhere” question.
- A grown-up corner to reset a grade, export and import saves, and turn on a session log.
- Offline play once loaded, with no third-party requests.

### Supports from the brief

| Support | Today | After the remake | v1 |
| :--- | :--- | :--- | :--- |
| Read aloud and “Say it again” | Six encounters, not music or the village | Hear on every dialogue page, plus a Read to me setting | Slower for K–1 |
| Pictures and symbols for choices | ✅ | Color, icon, and word on every choice | ✅ |
| Keyboard, large buttons, no dragging | ✅ | ✅ plus tap-to-walk in the village | ✅ |
| Adjustable text | Everywhere but the village | Everywhere, but browser zoom has no effect | A bigger step for low vision |
| Adjustable motion and breaks | ✅ | Calm motion and Pause | ✅ |
| Adjustable sound | Music studio only | Music stage only | A volume setting for the whole game |
| “Show me” | ❌ | ❌ | A short demo in every encounter |
| “One step at a time” | ❌ Help lists every step | One dialogue page at a time, but Help still lists every step | Help shows one step, then Next |
| Captions | Spoken lines are on screen | Spoken lines are on screen | Highlight each word as it’s read, where the browser allows |
| Speech input | ❌ | ❌ | After v1 |
| More languages | ❌ | ❌ | After v1. The content file prepares for it. |

### After v1

- Grades 4–5 at full depth.
- A second language.
- Speech input that uses on-device recognition only. Many browsers send recognition audio to a server, which doesn’t fit a children’s product.
- Pip and Nori quests for every subject.

**Not planned:** child accounts, ads, analytics that leave the device, and chat between players.

## Milestones

The Cal Hacks remake comes first. M0–M5 make up v1, and M2 and M3 can run at the same time.

### Now · UI remake for Cal Hacks

Judging is October 25 at 10:30 AM. The remake’s design and its 16-task plan are local working docs in `docs/superpowers/`.

- A handheld-game UI on one 960×540 stage, with a new cast, Pokémon-style encounters, a My Singing Monsters–style music stage, and a marching parade.
- The demo path covers the stage, cast, title, village, Taro’s cart, music, and parade. The other five subjects follow if time allows, and then the new UI replaces the old one.
- Learning logic, saves, and content don’t change.

**Done when** the design’s acceptance list passes and GitHub matches the demo build.

### M0 · Finish the remake and carry fixes forward

The remake already plans fixes for the old UI’s tiny text, Google Fonts request, and village text that ignored **Bigger words**. This is what’s left:

- [x] Finish any subjects, or the entry swap, that were cut for the demo. Done 2026-10-24: all seven subjects use the new screens; grades 3–5 select the four new activities.
- [x] Give the music stage Help steps. Done 2026-10-24: four steps per grade, the last names Send band.
- [x] Rename **Save band** to **Send band**. Done 2026-10-24; updated 2026-10-25 to wait for each grade’s lesson, with Kindergarten’s play-or-edit rule preserved.
- [x] Let Escape in a text field leave the field first instead of the whole activity. Done 2026-10-24: focus moves to the commands; a second Escape leaves.
- [x] Make word tiles undo whole tiles instead of single words. Done 2026-10-24: Remove word takes back one whole tile at grades 3–5.
- [ ] Add a bigger text step. The scaled stage ignores browser zoom, so **Bigger words** is the only way to enlarge text, and a phone held sideways shrinks everything by about 30%.
- [ ] Keep one module for every save format. The remake still has two copies.
- [ ] Set up CI to run `npm test`, a browser smoke test from start to parade, and an automated accessibility check.

**Done when** CI passes and one encounter has been checked by hand with VoiceOver, including that neighbor speech is announced.

### M1 · Content foundation

Make words and tasks into data, as the art plan asks.

- Every line a child sees moves to `src/content/en.js`, organized by subject and grade.
- Each grade’s task is described as data: the available pieces, the goal rule, hint steps, and demo steps.
- Tests fail when a subject or grade is missing content, or when a line breaks the remake’s text limits.

**Done when** editing a passage or hint needs no change to screen code. **Depends on** M0.

### M2 · Learning goals for K–3

- Build the K–3 rows of every subject table, starting with Science’s prediction step and Reading’s decodable words.
- Extend Fumi’s sentence and describing-word feedback with support for ideas, readers and revision.

**Done when** every subject meets the definition of done for K, 1, 2, and 3. **Depends on** M1.

### M3 · Supports and comfort

- **Show me** and **One step at a time** in every encounter.
- A volume setting, slower read-aloud for K–1, and word highlighting.
- Hair and skin-tone choices for the player figure.
- The grown-up corner, including the opt-in session log.

**Done when** every v1 row in the supports table is true. **Depends on** M1.

### M4 · Festival loop

- An empty player’s stall on the grass beside the crossroads that fills with each creation.
- Neighbors mention creations the player has actually made.
- Pip quests from the art plan: balancing parcels (math), reading an address (reading), and finding a route (community).
- A lantern-night finale when all seven pips on the festival board are full.

**Done when** a player can go from arrival to finale in any order, and every mention of past work is earned. **Depends on** M2.

### M5 · Pilot

- Sessions with children, caregivers, and educators, built around the brief’s questions: Do players understand the next step? Can they find and use support? Can they apply an idea in another activity?
- The session log records time to first action, Help and Hear use, retries, and Pip quest results.

**Done when** the findings are written up and the next milestones are re-ranked from them. **Depends on** M0–M4.

### After v1

| Milestone | Goal |
| :--- | :--- |
| M6 | Grades 4–5 at full depth |
| M7 | A second language |
| M8 | Speech input, on-device only |

## Housekeeping

- Add the Project Brief to `docs/`. It isn’t in the repository yet.
- Keep one copy of the art plan aligned with the shipped contract: 64×64 PNG frames, 256×256 sheets, and 11 character identities across 12 sprite sheets.
- Link this roadmap from the README once the remake’s README rewrite lands.

[Back to top](#all-aboard)
