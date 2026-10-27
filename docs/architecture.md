# Game architecture

All Aboard is a static browser game. Its activity rules, dialogue, grade selection and saved progress run in the browser. The project's **backend** team credit refers to this game logic; the current game has no remote application server, player accounts or cloud save service.

## From page load to an activity

[`src/main.js`](../src/main.js) creates the app, registers the title, village, encounter, music and parade scenes, and opens the title screen. [`src/ui/app.js`](../src/ui/app.js) owns the current state, shared input, scene transitions, settings and save status. [`src/ui/stage.js`](../src/ui/stage.js) scales the shared 960 × 540 stage to the browser window.

The village opens the selected neighbor's encounter. [`src/ui/screens/encounter.js`](../src/ui/screens/encounter.js) resolves the activity for the current grade, restores its saved draft, mounts its controls and sends actions to the activity. Music has its own [scene](../src/ui/screens/music.js).

## Grade registration and activity rules

[`src/ui/registry.js`](../src/ui/registry.js) selects activities in this order: an exact grade entry, a grade-band entry, then the default activity. Kindergarten is passed as grade `0`; chapter 1 uses grades `1` through `5`. [`gradeBand()`](../src/encounters.js) groups grades 1–2 and 3–5, but exact grade-2 registrations take priority.

| Subject | Default (K–1) | Grade 2 | Grades 3–5 |
| :--- | :--- | :--- | :--- |
| Math | Cart | Crate rows | Pizza |
| Science | Ice | Beans | Food chain |
| Reading | Story bag | Story ribbon | Tales |
| Community | Square | Compass | Help Day |

Art and writing use the banner and sign activities across grades, with grade-specific rules. Music's grade behavior lives in [`src/ui/band.js`](../src/ui/band.js).

Each module in [`src/ui/activities/`](../src/ui/activities/) implements the contract documented at the top of the registry. `state` holds the saved creation; `ui` holds temporary choices. `start`, `opening`, `commands` and `act` do not touch the DOM; `mountField` owns the activity's visible field. Commands are limited to four, with the finish command last and disabled until ready. The K–1 story menu can omit its finish command until the story is ready.

[`src/encounters.js`](../src/encounters.js) connects snapshot normalization and readiness checks to the activity rule modules. When adding a grade-specific activity, keep the registry, activity discriminator, `ACTIVITY_GRADES`, normalization, readiness and saved-creation cleaning consistent. A new screen alone does not make a saved activity valid for another grade.

## Drafts, completed creations and local saving

[`src/progress.js`](../src/progress.js) stores normalized JSON under the localStorage key `all-aboard-demo-v2`. It can load the older `all-aboard-demo-v1` format. Progress and drafts are independent for `chapter-0` and each `chapter-1-grade-1` through `chapter-1-grade-5` scope.

- `saveDraft()` stores unfinished work without granting completion.
- `publishCreation()` retains the draft and adds or replaces the subject's completed record, including its creation, reward and completion time.
- `getDraft()` prefers unfinished work and otherwise returns the published creation.
- `getCreations()` reads published creations in the current scope; the parade requires at least one.
- `normalizeState()` and the creation cleaners restrict saved fields, validate activity/grade compatibility and reject snapshots from another scope.

In the encounter scene, saved-state changes trigger a draft save. The scene checks `encounterReady()` before finishing, then publishes only after the reward is accepted and the chapter/grade still match. `publishCreation()` itself sanitizes the snapshot; callers remain responsible for the activity's completion gate.

The app compares localStorage with its last saved snapshot before writing. If another tab changed or cleared the save, or storage is unavailable, local play continues and the game shows **“Saving is off. Keep this tab open.”** Reloading starts from the stored snapshot. Saves belong to that browser's site origin, so different domains, browsers and devices have separate progress; there is no synchronization endpoint.

## Local server and static build

[`server.js`](../server.js) is a development file server, started by `npm run dev` or `npm start`. It binds to `127.0.0.1`, uses port `4173` unless `PORT` is set, serves `GET` and `HEAD`, and rejects other methods. It has no gameplay or save API.

[`scripts/build.js`](../scripts/build.js), run by `npm run build`, recreates `dist/`, copies the root HTML files, and copies `src/` and `assets/`. Static hosting serves those files; it does not run `server.js`. Documentation and tests are not included in this output.

## Checks when changing game logic

Run from the repository root:

```sh
node --test tests/progress.test.js tests/encounters.test.js
npm test
npm run build
```

The progress tests cover drafts versus completion, grade isolation, normalization, legacy saves and storage failures. Encounter tests cover activity rules and readiness; the full suite also checks the UI and grade-specific activities. In the browser, exercise a fresh activity, leave and resume it, finish it, reload, and switch grades to confirm that each grade keeps its own work.
