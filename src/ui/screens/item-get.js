import { keyIntent } from '../input.js';
import { icon } from '../icons.js';
import { fitSignPreviews } from '../creations.js';

let serial = 0;

// Resolves true only when the child accepts, or false on cancellation. Callers must opt in
// to editing again and reset their finishing state after a false result.
// artHTML and figureHTML are trusted markup; the name is set as text.
export function showItemGet(stage, { name, artHTML = '', figureHTML = '', allowEdit = false } = {}) {
  let cancel;
  const promise = new Promise(resolve => {
    const opener = document.activeElement;
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
        <button type="button" class="px-button item-get__inspect">Look closer</button>
        <p class="item-get__description" aria-live="polite">Look closer at your creation, or add it to the festival.</p>
        <div class="item-get__actions">
          <button type="button" class="px-button px-button--finish item-get__go">${icon('play', { size: 22 })}<span>Add to fest</span></button>
          ${allowEdit ? '<button type="button" class="px-button item-get__edit">Keep editing</button>' : ''}
        </div>
      </section>`;
    backdrop.querySelector('.item-get__name').textContent = `${name ?? ''}!`;
    const card = backdrop.firstElementChild;
    const button = card.querySelector('.item-get__go');
    const inspect = card.querySelector('.item-get__inspect');
    const edit = card.querySelector('.item-get__edit');
    const controls = [inspect, button, ...(edit ? [edit] : [])];
    const dimmed = [...stage.children].filter(child => !child.inert);   // the scene behind can't take focus
    dimmed.forEach(child => { child.inert = true; });

    let done = false;
    let disposeSign = () => {};
    function finish(accepted) {
      if (done) return;
      done = true;
      disposeSign();
      backdrop.remove();
      dimmed.forEach(child => { child.inert = false; });
      if (opener?.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
      resolve(accepted);
    }
    cancel = () => finish(false);
    button.addEventListener('click', () => finish(true));
    edit?.addEventListener('click', () => finish(false));
    inspect.addEventListener('click', () => {
      const art = card.querySelector('.item-get__art');
      const description = art.querySelector('[aria-label]')?.getAttribute('aria-label');
      card.querySelector('.item-get__description').textContent = description || `Your ${name ?? 'creation'} is ready to see.`;
    });
    card.querySelector('.item-get__art').addEventListener('click', () => inspect.click());
    card.addEventListener('keydown', event => {
      const intent = keyIntent(event);
      if (event.key === 'Tab') {
        event.preventDefault();
        const index = controls.indexOf(document.activeElement);
        const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next].focus();
      } else if (intent === 'b') {
        event.preventDefault(); event.stopPropagation();
        if (allowEdit && !event.repeat) finish(false);
      } else if (['left', 'right', 'up', 'down'].includes(intent)) {
        event.preventDefault(); event.stopPropagation();
        const index = controls.indexOf(document.activeElement);
        const step = intent === 'left' || intent === 'up' ? -1 : 1;
        controls[index < 0 ? 0 : (index + step + controls.length) % controls.length].focus();
      } else if (intent === 'a') {
        event.stopPropagation();
        if (event.repeat) event.preventDefault();
        else if (event.key !== 'Enter' && event.key !== ' ') {
          event.preventDefault();
          if (controls.includes(document.activeElement)) document.activeElement.click();
        }
      }
    });
    stage.append(backdrop);
    disposeSign = fitSignPreviews(card.querySelector('.item-get__art'), 240, 164);
    button.focus({ preventScroll: true });
  });
  promise.cancel = cancel;
  return promise;
}
