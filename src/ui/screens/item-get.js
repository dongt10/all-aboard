import { keyIntent } from '../input.js';
import { icon } from '../icons.js';

let serial = 0;

// The item-get card: "You made… {name}!", the creation drawn large beside the neighbor's joy pose, and
// a Put it in the festival button with the play icon like every other button. A (or any click on the
// card) resolves the promise once. artHTML and
// figureHTML are trusted markup from creations.js and figures; the name is set as text.
export function showItemGet(stage, { name, artHTML = '', figureHTML = '' } = {}) {
  return new Promise(resolve => {
    const titleId = `item-get-title-${++serial}`;
    const backdrop = document.createElement('div');
    backdrop.className = 'item-get';
    backdrop.innerHTML = `<section class="px-frame item-get__card" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <i class="item-get__spark item-get__spark--a" aria-hidden="true"></i><i class="item-get__spark item-get__spark--b" aria-hidden="true"></i><i class="item-get__spark item-get__spark--c" aria-hidden="true"></i>
        <p class="item-get__lead">You made…</p>
        <h2 class="px-title item-get__name" id="${titleId}"></h2>
        <div class="item-get__row">
          <div class="px-frame item-get__art">${artHTML}</div>
          <div class="item-get__figure">${figureHTML}</div>
        </div>
        <button type="button" class="px-button px-button--finish item-get__go">${icon('play', { size: 22 })}<span>Put it in the festival</span></button>
      </section>`;
    backdrop.querySelector('.item-get__name').textContent = `${name ?? ''}!`;
    const card = backdrop.firstElementChild;
    const button = card.querySelector('.item-get__go');
    const dimmed = [...stage.children].filter(child => !child.inert);   // the scene behind can't take focus
    dimmed.forEach(child => { child.inert = true; });

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      backdrop.remove();
      dimmed.forEach(child => { child.inert = false; });
      resolve();
    }
    card.addEventListener('click', finish);
    card.addEventListener('keydown', event => {
      const intent = keyIntent(event);
      if (intent === 'a' && !event.repeat) { event.preventDefault(); event.stopPropagation(); finish(); }
      else if (event.key === 'Tab') { event.preventDefault(); button.focus(); }   // one control: Tab stays on it
    });
    stage.append(backdrop);
    button.focus({ preventScroll: true });
  });
}
