import { icon } from './icons.js';

// How many characters one page holds before it would crowd the 472×136 dialogue box.
export const PAGE_CHARS = { normal: 96, large: 56 };

const SENTENCE_END = /(?<=[.!?…]["'”’)\]]*)\s+/;

// Joins parts with spaces, starting a new line whenever the next part would pass the limit.
// A part that is longer than the limit ends up alone.
const pack = (parts, maxChars) => parts.reduce((lines, part) => {
  if (lines.length && lines.at(-1).length + 1 + part.length <= maxChars) lines[lines.length - 1] += ` ${part}`;
  else lines.push(part);
  return lines;
}, []);

// Pages break between sentences. A sentence that is too long for one page breaks between words.
export function paginate(text, maxChars) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const units = clean.split(SENTENCE_END).flatMap(sentence => sentence.length <= maxChars ? [sentence] : pack(sentence.split(' '), maxChars));
  return pack(units, maxChars);
}

// A dialogue box: a speaker tab, one short page of text, ▼ More when a page follows, and Hear / Help tabs.
export function createDialogue(host, { speak = () => false, onHelp = () => {}, isLarge = () => false, autoRead = () => false } = {}) {
  const root = document.createElement('div');
  root.className = 'dlg';
  root.tabIndex = -1;   // where focus lands if the More button disappears under it
  root.innerHTML = `<div class="px-frame dlg__frame">
      <p class="dlg__text" aria-live="polite" aria-atomic="true"></p>
      <button type="button" class="px-chip dlg__more" hidden><span class="dlg__arrow" aria-hidden="true"></span><span>More</span></button>
    </div>
    <span class="px-chip px-name dlg__speaker" hidden></span>
    <div class="dlg__tabs">
      <button type="button" class="px-chip dlg__tab" data-act="hear">${icon('hear')}<span>Hear</span></button>
      <button type="button" class="px-chip dlg__tab" data-act="help">${icon('help')}<span>Help</span></button>
    </div>`;
  const text = root.querySelector('.dlg__text');
  const more = root.querySelector('.dlg__more');
  const tab = root.querySelector('.dlg__speaker');
  const limit = () => isLarge() ? PAGE_CHARS.large : PAGE_CHARS.normal;
  let queue = [], large = Boolean(isLarge());   // queue[0] is the page on screen

  function render() {
    text.textContent = queue[0] ?? '';
    const hasMore = queue.length > 1;
    if (!hasMore && document.activeElement === more) root.focus();   // never leave focus on a hidden button
    more.hidden = !hasMore;
  }
  function show() {
    render();
    if (queue[0] && autoRead()) speak(queue[0]);
  }
  function next() {
    if (queue.length < 2) return false;
    queue.shift();
    show();
    return true;
  }
  more.addEventListener('click', next);
  root.addEventListener('click', event => {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act === 'hear' && queue[0]) speak(queue[0]);
    if (act === 'help') onHelp();
    if (event.target === text) next();   // tapping the words turns the page too
  });

  // Bigger words can flip while a page is showing, so the pages still to read are re-cut to fit.
  const watch = new MutationObserver(() => {
    if (Boolean(isLarge()) === large) return;
    large = Boolean(isLarge());
    queue = paginate(queue.join(' '), limit());
    render();
  });
  for (let el = host; el; el = el.parentElement) watch.observe(el, { attributes: true, attributeFilter: ['class'] });
  host.append(root);

  return {
    say(speaker, words) {
      tab.textContent = speaker ?? '';
      tab.hidden = !speaker;
      large = Boolean(isLarge());
      queue = paginate(words, limit());
      show();
    },
    next,
    hasMore: () => queue.length > 1,
    current: () => queue[0] ?? '',
    destroy() { watch.disconnect(); root.remove(); },
  };
}
