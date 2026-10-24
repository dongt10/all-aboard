import { CHARACTERS } from '../../data.js';
import { encounterReady } from '../../encounters.js';
import { getDraft, saveDraft, publishCreation } from '../../progress.js';
import { ACTIVITIES } from '../registry.js';
import { withScope } from '../save.js';
import { creationMarkup } from '../creations.js';
import { figureMarkup, playerFigureId } from '../figures/index.js';
import { icon } from '../icons.js';
import { SUBJECT_THEME } from '../palette.js';
import { createCommandMenu } from '../menu.js';
import { createDialogue } from '../dialogue.js';
import { onceAtATime } from '../scenes.js';
import { showItemGet } from './item-get.js';

// Stand a figure with its feet at stage point (fx, fy): the feet sit at x 32, y 57 of the 64×64 frame.
const feetAt = (fx, fy, scale) => `left:${fx - 32 * scale}px;top:${fy - 57 * scale}px`;
const NEIGHBOR = { x: 848, y: 240, scale: 2 };
const PLAYER = { x: 120, y: 436, scale: 3 };
const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// The Pokémon-battle frame: plate, neighbor on its platform, the player's back, the field, dialogue and menu.
export function createEncounterScene(ctx, { id } = {}) {
  const character = CHARACTERS.find(item => item.id === id);
  const activity = ACTIVITIES[id];
  if (!character || !activity) throw new RangeError(`No encounter for ${id}`);
  const theme = SUBJECT_THEME[id];
  let root, field, menu, dialogue, state, ui, grade, finishing = false;

  const scoped = () => withScope(state, ctx.getState());
  const saveNow = () => ctx.commit(saveDraft(ctx.getState(), id, scoped()));
  const say = line => dialogue.say(character.name, line);
  const inField = () => root.querySelector('.enc__field').contains(document.activeElement);

  function dispatch(action) {
    if (finishing) return;
    const result = activity.act(state, ui, action, grade);
    const changed = result.state !== state;
    state = result.state;
    ui = result.ui;
    if (changed) saveNow();
    field.update(state, ui);
    menu.set(activity.commands(state, ui, grade));
    if (result.line) say(result.line);
  }

  const finish = onceAtATime(async () => {
    if (finishing || !encounterReady(state)) return;
    finishing = true;
    saveNow();
    await showItemGet(ctx.stage, {
      name: character.reward.label,
      artHTML: creationMarkup(id, scoped()),
      figureHTML: figureMarkup(id, { pose: 'joy', scale: 2 }),
    });
    ctx.commit(publishCreation(ctx.getState(), id, scoped()));
    await ctx.go('village', { focus: id, celebrate: id });
  });
  const leave = onceAtATime(async () => {
    if (finishing) return;
    saveNow();
    await ctx.go('village', { focus: id });
  });

  return {
    mount() {
      const app = ctx.getState();
      grade = app.chapter === 0 ? 0 : app.grade;
      ({ state, ui } = activity.start(getDraft(app, id), { chapter: app.chapter, grade }));

      root = document.createElement('div');
      root.className = `enc enc--${id}`;
      root.style.setProperty('--subject', theme.color);
      root.innerHTML = `<div class="enc__backdrop" aria-hidden="true"><i class="enc__platform enc__platform--neighbor"></i><i class="enc__platform enc__platform--player"></i></div>
        <div class="enc__neighbor" style="${feetAt(NEIGHBOR.x, NEIGHBOR.y, NEIGHBOR.scale)}" aria-hidden="true">${figureMarkup(id, { scale: NEIGHBOR.scale })}</div>
        <div class="enc__player" style="${feetAt(PLAYER.x, PLAYER.y, PLAYER.scale)}" aria-hidden="true">${figureMarkup(playerFigureId(app), { facing: 'back', scale: PLAYER.scale })}</div>
        <header class="px-frame enc__plate">
          <button type="button" class="px-icon-button enc__back">${icon('back')}<span>Village</span></button>
          <div class="enc__who"><h1 class="px-name enc__name"></h1><span class="enc__grade"></span></div>
          <span class="px-chip enc__subject">${icon(theme.icon, { size: 18 })}<span></span></span>
        </header>
        <section class="enc__field" aria-label=""></section>
        <div class="enc__dialogue"></div>
        <div class="enc__menu"></div>`;
      root.querySelector('.enc__name').textContent = character.name;
      root.querySelector('.enc__subject span').textContent = theme.label;
      root.querySelector('.enc__grade').textContent = grade === 0 ? 'Kindergarten' : `Grade ${grade}`;
      root.querySelector('.enc__field').setAttribute('aria-label', activity.title);
      root.querySelector('.enc__back').addEventListener('click', () => leave());
      ctx.stage.append(root);

      field = activity.mountField(root.querySelector('.enc__field'), { grade, dispatch });
      dialogue = createDialogue(root.querySelector('.enc__dialogue'), {
        speak: text => ctx.speak(text),
        onHelp: () => ctx.open.help(activity.title, activity.help),
        isLarge: () => ctx.stage.classList.contains('large-text'),
        autoRead: () => Boolean(ctx.getState().settings?.autoRead),
      });
      menu = createCommandMenu(root.querySelector('.enc__menu'), {
        onChoose: commandId => (commandId === 'finish' ? finish() : dispatch({ type: 'command', id: commandId })),
      });
      field.update(state, ui);
      menu.set(activity.commands(state, ui, grade));
      say(activity.opening(state, ui, grade));
      menu.focus();
    },
    handleIntent(intent) {
      if (finishing) return false;   // the item-get card handles its own A
      if (intent === 'b') {
        if (inField() && TYPING.has(document.activeElement.tagName)) { menu.focus(); return true; }
        leave();
        return true;
      }
      if (intent === 'a') {
        if (dialogue.hasMore()) { dialogue.next(); return true; }
        if (!inField()) { menu.focus(); return true; }
        return false;
      }
      if (inField()) return false;
      return menu.handleIntent(intent);
    },
    pause() {},
    destroy() {
      field?.destroy();
      dialogue?.destroy();
      menu?.destroy();
      root?.remove();
      root = null;
    },
  };
}
