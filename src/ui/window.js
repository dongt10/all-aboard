import { icon } from './icons.js';
import { keyIntent } from './input.js';

const TABBABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
let serial = 0;
const windows = new WeakMap();

// App teardown must run each window's cleanup, not just detach its DOM.
export function closeWindow(stage) { windows.get(stage)?.close(); }

// An in-stage modal window. `body` is an HTML string, a node, or an array of nodes. `initialFocus` is a
// selector inside the body, an element, or a function that returns one; by default the first control.
// Only one window opens at a time (null if one is already open). Escape/B closes it and focus returns
// to whatever opened it.
export function openWindow(stage, { title, body, onClose, initialFocus } = {}) {
  if (stage.querySelector('.win-backdrop')) return null;
  const opener = document.activeElement;
  const titleId = `win-title-${++serial}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'win-backdrop';
  backdrop.innerHTML = `<section class="px-frame win" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <header class="win__head"><h2 class="win__title" id="${titleId}"></h2><button type="button" class="px-icon-button win__close">${icon('back')}<span>Close</span></button></header>
      <div class="win__body"></div>
    </section>`;
  const dialog = backdrop.firstElementChild;
  const content = dialog.querySelector('.win__body');
  const closeButton = dialog.querySelector('.win__close');
  dialog.querySelector('.win__title').textContent = title ?? '';
  if (typeof body === 'string') content.innerHTML = body;
  else if (body) content.append(...(Array.isArray(body) ? body : [body]));

  const dimmed = [...stage.children].filter(child => !child.inert);   // the scene behind can't take focus
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    windows.delete(stage);
    backdrop.remove();
    dimmed.forEach(child => { child.inert = false; });
    if (opener?.isConnected && !opener.disabled) opener.focus();
    onClose?.();
  }
  // Tab wraps at the window's edges; anywhere else the browser moves focus on its own.
  function trapTab(event) {
    const items = [...dialog.querySelectorAll(TABBABLE)].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
    const active = document.activeElement;
    const inside = dialog.contains(active);
    const atEdge = event.shiftKey ? active === items[0] || active === dialog : active === items.at(-1);
    if (items.length && inside && !atEdge) return;
    event.preventDefault();
    (!items.length ? dialog : event.shiftKey && inside ? items.at(-1) : items[0]).focus();
  }
  backdrop.addEventListener('keydown', event => {
    if (event.key === 'Tab') trapTab(event);
    else if (keyIntent(event) === 'b') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) close(); }
  });
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) event.preventDefault(); });   // keep focus in the window
  closeButton.addEventListener('click', close);

  dimmed.forEach(child => { child.inert = true; });
  stage.append(backdrop);
  const first = typeof initialFocus === 'function' ? initialFocus() : typeof initialFocus === 'string' ? content.querySelector(initialFocus) : initialFocus;
  (first ?? content.querySelector(TABBABLE) ?? closeButton).focus();
  const handle = { close };
  windows.set(stage, handle);
  return handle;
}
