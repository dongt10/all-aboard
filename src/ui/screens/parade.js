import { CHARACTERS } from '../../data.js';
import { getCreations } from '../../progress.js';
import { createBandEngine } from '../../audio.js';
import { createPlaybackController } from '../../music.js';
import { figureMarkup, playerFigureId } from '../figures/index.js';
import { creationMarkup } from '../creations.js';
import { createCommandMenu } from '../menu.js';
import { createDialogue } from '../dialogue.js';
import { onceAtATime } from '../scenes.js';
import { paradeLineup, paradeCommands, paradeStatus, paradeBackdropMarkup } from '../parade-lineup.js';

const STAGE_WIDTH = 960;
const SPACING = 112;          // one marcher per slot; eight slots fill the stage for the still line-up
const FEET_Y = 372;           // feet on the street, just above the dialogue
const WALK = [1, 0, 2, 0];    // walk frames, one every 160 ms
const STEP_MS = 160;
const BUNTING = 18;
const HELP_STEPS = [
  'Watch your friends march with what you made.',
  'Play band plays the band you saved with Kiko.',
  'March again starts the parade from the beginning.',
  'Village takes you back to the village.',
];

// Feet at (fx, FEET_Y) inside a marcher slot: left = fx − 32·s, top = fy − 57·s, at scale 1.
const figureSlot = html => `<span class="parade-figure" style="left:${SPACING / 2 - 32}px;top:${FEET_Y - 57}px">${html}</span>`;

export function createParadeScene(ctx) {
  let root, menu, dialogue, engine, playback, ticker = null, tick = 0, marchers = [], destroyed = false;
  const creations = getCreations(ctx.getState());
  const lineup = paradeLineup(creations);
  const band = creations.music ?? null;
  const settings = () => ctx.getState().settings ?? {};
  const calm = () => Boolean(settings().reducedMotion) || Boolean(root?.closest('.calm'))
    || Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const playing = () => Boolean(playback?.active);
  const refreshCommands = () => menu.set(paradeCommands({ hasBand: Boolean(band), playing: playing() }));

  // Marchers face right and walk; with Calm motion they stand still facing front, step 0.
  function paintMarchers() {
    const still = calm();
    const step = still ? 0 : WALK[tick % WALK.length];
    const facing = still ? 'front' : 'right';
    root.classList.toggle('is-still', still);
    for (const marcher of marchers) {
      const key = `${facing}${step}`;
      if (marcher.key === key) continue;
      marcher.key = key;
      marcher.el.innerHTML = figureMarkup(marcher.id, { facing, step });
    }
  }
  function startTicker() {
    clearInterval(ticker);
    ticker = setInterval(() => { tick++; paintMarchers(); }, STEP_MS);
  }
  // Restarts the CSS march from the left edge.
  function marchAgain() {
    const line = root.querySelector('.parade-line');
    line.classList.remove('is-marching');
    void line.offsetWidth;   // reflow, so the animation starts over
    line.classList.add('is-marching');
    tick = 0;
    paintMarchers();
  }

  function streetMarkup() {
    const count = lineup.length + 1;
    const width = count * SPACING;
    // The leader is rightmost, then the neighbors follow in subject order.
    const leaderX = (count - 1) * SPACING;
    const player = `<div class="parade-marcher parade-marcher--leader" style="left:${leaderX}px">${figureSlot(figureMarkup(playerFigureId(ctx.getState()), { pose: 'joy' }))}</div>`;
    const neighbors = lineup.map(({ id, creation }, i) => `<div class="parade-marcher" style="left:${(count - 2 - i) * SPACING}px">
        <div class="parade-float" style="--float:var(--${id})"><div class="parade-float__art">${creationMarkup(id, creation)}</div></div>
        <span class="parade-pole"></span>
        ${figureSlot('')}
      </div>`).join('');
    const lanterns = Array.from({ length: BUNTING }, (_, i) => `<span class="parade-lantern" style="left:${24 + i * 52}px"></span>`).join('');
    const names = lineup.map(({ id }) => CHARACTERS.find(c => c.id === id)).filter(Boolean)
      .map(c => `${c.name} with the ${c.reward.label.replace(/^Your /, '').toLowerCase()}`);
    const label = names.length ? `You lead the parade. Behind you: ${names.join(', ')}.` : 'You lead the parade.';
    return `<div class="parade-street" role="img" aria-label="${label}">
        ${paradeBackdropMarkup()}${lanterns}
        <div class="parade-line is-marching" style="--line-w:${width}px;--line-x:${(STAGE_WIDTH - width) / 2}px;width:${width}px">${player}${neighbors}</div>
      </div>`;
  }

  function choose(id) {
    if (id === 'play' && band && !playing()) playback.toggle(band);
    else if (id === 'stop') playback.stop();
    else if (id === 'march') marchAgain();
    else if (id === 'village') leave();
  }
  const silence = () => { if (playing()) playback.stop(); };
  const leave = onceAtATime(() => { silence(); return ctx.go('village', { focus: 'music' }); });

  return {
    mount() {
      root = document.createElement('section');
      root.className = 'parade';
      root.setAttribute('aria-labelledby', 'parade-title');
      root.innerHTML = `${streetMarkup()}
        <h2 class="px-chip px-name parade-title" id="parade-title" tabindex="-1">Festival parade</h2>
        <div class="parade-dialogue"></div><div class="parade-menu"></div>`;
      ctx.stage.append(root);
      const slots = root.querySelectorAll('.parade-marcher:not(.parade-marcher--leader) .parade-figure');
      marchers = lineup.map(({ id }, i) => ({ id, key: '', el: slots[i] }));

      dialogue = createDialogue(root.querySelector('.parade-dialogue'), {
        speak: text => ctx.speak(text),
        onHelp: () => ctx.open.help('Parade', HELP_STEPS),
        isLarge: () => Boolean(settings().largeText),
        autoRead: () => Boolean(settings().autoRead),
      });
      menu = createCommandMenu(root.querySelector('.parade-menu'), { onChoose: choose });

      engine = createBandEngine({ onStatus: message => { if (message === 'stopped') playback?.engineStopped(); } });
      playback = createPlaybackController(engine, { onState: (phase, reason) => {
        if (destroyed) return;
        refreshCommands();
        dialogue.say(null, paradeStatus(phase, reason, band));
      } });

      refreshCommands();
      dialogue.say(null, 'Your parade! Every idea belongs here.');
      paintMarchers();
      startTicker();
      menu.focus();
    },
    handleIntent(intent) {
      if (intent === 'b') { leave(); return true; }
      if (intent === 'a' && dialogue.hasMore()) return dialogue.next();
      return menu.handleIntent(intent);
    },
    // A window opened: the band goes quiet. The march keeps going under the dimmed stage.
    pause() { silence(); },
    destroy() {
      destroyed = true;   // no status lines or menu updates while tearing down
      playback?.stop();
      engine?.destroy();
      clearInterval(ticker); ticker = null;
      menu?.destroy(); dialogue?.destroy();
      root?.remove();
    },
  };
}
