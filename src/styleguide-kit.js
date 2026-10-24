// Live demo of the interaction kit, appended to the style guide.
import { createDialogue } from './ui/dialogue.js';
import { createCommandMenu } from './ui/menu.js';
import { openWindow } from './ui/window.js';
import { keyIntent, routeIntent } from './ui/input.js';
import { wipe } from './ui/scenes.js';
import { speak } from './ui/voice.js';

const section = document.createElement('section');
section.className = 'guide-section';
section.innerHTML = `<h2 class="px-title guide-heading">Dialogue, menu, windows</h2>
  <p class="guide-note">Tab to the menu, then use the arrows and Enter or Z. “Send cart” opens after “Load left” twice. Escape closes the window.</p>
  <div class="guide-row">
    <button class="px-toggle" type="button" data-toggle="large-text" aria-pressed="false">Bigger words <span class="px-toggle__state">Off</span></button>
    <button class="px-toggle" type="button" data-toggle="calm" aria-pressed="false">Calm motion <span class="px-toggle__state">Off</span></button>
    <button class="px-button" type="button" data-act="window">Open window</button>
    <button class="px-button" type="button" data-act="wipe">Play wipe</button>
  </div>
  <div class="kit-demo" style="position:relative;width:960px;max-width:100%;height:220px;overflow:hidden;background:var(--sky);border:4px solid var(--ink);font-size:var(--text-body)">
    <div class="kit-demo__dlg" style="position:absolute;left:16px;bottom:28px"></div>
    <div class="kit-demo__menu" style="position:absolute;left:504px;bottom:28px"></div>
  </div>`;
document.querySelector('#guide').append(section);

const stage = section.querySelector('.kit-demo');
const LINES = {
  hello: 'Hello, builder! My cart tips over when one side is heavier. Will you help me load it so both sides weigh the same? Choose a command below.',
  left: 'One crate on the left.',
  right: 'One crate on the right.',
  ready: 'Two crates on the left! Now you can send the cart.',
  sent: 'Off it goes! Thank you, builder.',
};
const help = () => openWindow(stage, { title: 'How to play', body: '<p>Choose a command with the arrows, then press Enter or Z.</p><p style="margin-top:8px"><button class="px-button" type="button">Got it</button></p>' });
const dialogue = createDialogue(section.querySelector('.kit-demo__dlg'), { speak, onHelp: help, isLarge: () => stage.classList.contains('large-text'), autoRead: () => false });

let left = 0, right = 0;
const menu = createCommandMenu(section.querySelector('.kit-demo__menu'), { onChoose: id => {
  if (id === 'load-left') left++;
  if (id === 'load-right') right++;
  if (id === 'undo') { left = 0; right = 0; }
  dialogue.say('Kiko', id === 'finish' ? LINES.sent : id === 'load-left' ? (left === 2 ? LINES.ready : LINES.left) : id === 'load-right' ? LINES.right : LINES.hello);
  render();
} });
function render() {
  menu.set([
    { id: 'load-left', label: 'Load left', icon: 'crate' },
    { id: 'load-right', label: 'Load right', icon: 'crate' },
    { id: 'undo', label: 'Start over', icon: 'undo', disabled: !left && !right },
    { id: 'finish', label: 'Send cart', icon: 'check', finish: true, disabled: left < 2 },
  ]);
}
render();
dialogue.say('Kiko', LINES.hello);

// The demo stands in for the game's key router.
stage.addEventListener('keydown', event => {
  const route = routeIntent(event);
  if (route === 'click-target') { event.preventDefault(); event.target.click(); return; }
  if (route !== 'scene') return;
  const intent = keyIntent(event);
  if (event.target.closest('.cmd-menu') ? menu.handleIntent(intent) : intent === 'a' && dialogue.next()) event.preventDefault();
});

const transition = wipe(stage, { calm: () => stage.classList.contains('calm') });
section.addEventListener('click', event => {
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
    const on = stage.classList.toggle(toggle.dataset.toggle);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.querySelector('.px-toggle__state').textContent = on ? 'On' : 'Off';
  }
  const act = event.target.closest('[data-act]')?.dataset.act;
  if (act === 'window') openWindow(stage, { title: 'A window', body: '<p>Tab stays inside. Escape closes me.</p><p style="margin-top:8px;display:flex;gap:12px"><button class="px-button" type="button">One</button><button class="px-button" type="button">Two</button></p>' });
  if (act === 'wipe') transition(() => dialogue.say('Kiko', LINES.hello));
});
