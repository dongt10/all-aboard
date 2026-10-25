import { icon } from './icons.js';

// Character caps are an upper bound; rendered text must also fit the dialogue box.
export const PAGE_CHARS = { normal: 96, large: 56 };

const SENTENCE_END = /(?<=[.!?…]["'”’)\]]*)\s+/;

const cleanText = text => String(text ?? '').replace(/\s+/g, ' ').trim();

// Joins parts with spaces only when the combined page still fits.
const pack = (parts, fits) => parts.reduce((lines, part) => {
  if (lines.length && fits(`${lines.at(-1)} ${part}`)) lines[lines.length - 1] += ` ${part}`;
  else lines.push(part);
  return lines;
}, []);

// Prefer sentences, then words; a word wider than a page continues on the next one.
export function paginate(text, maxChars, fitsRendered = () => true) {
  const clean = cleanText(text);
  if (!clean) return [];
  const fits = page => page.length <= maxChars && fitsRendered(page);
  const units = clean.split(SENTENCE_END).flatMap(sentence => {
    const parts = [];
    let rest = sentence;
    while (rest && !fits(rest)) {
      const chars = Array.from(rest);
      let low = 1, high = Math.min(chars.length, maxChars), end = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (fits(chars.slice(0, mid).join(''))) { end = mid; low = mid + 1; }
        else high = mid - 1;
      }
      let part = chars.slice(0, end).join('');
      const space = part.lastIndexOf(' ');
      if (space > 0 && rest[part.length] !== ' ') part = part.slice(0, space);
      parts.push(part.trimEnd());
      rest = rest.slice(part.length).trimStart();
    }
    if (rest) parts.push(rest);
    return parts;
  });
  return pack(units, fits);
}

// A dialogue box: a speaker tab, one short page of text, ▼ More when a page follows, and Hear / Help tabs.
export function createDialogue(host, { speak = () => false, onHelp = () => {}, isLarge = () => false, autoRead = () => false, onPage = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'dlg';
  root.tabIndex = -1;   // where focus lands if the More button disappears under it
  root.innerHTML = `<div class="px-frame dlg__frame">
      <p class="dlg__text" aria-live="polite" aria-atomic="true"></p>
      <p class="dlg__text dlg__measure" aria-hidden="true"></p>
      <button type="button" class="px-chip dlg__more" hidden><span class="dlg__arrow" aria-hidden="true"></span><span>More</span></button>
    </div>
    <span class="px-chip px-name dlg__speaker" hidden></span>
    <div class="dlg__tabs">
      <button type="button" class="px-chip dlg__tab" data-act="hear">${icon('hear')}<span>Hear</span></button>
      <button type="button" class="px-chip dlg__tab" data-act="help">${icon('help')}<span>Help</span></button>
    </div>`;
  const text = root.querySelector('.dlg__text');
  const measure = root.querySelector('.dlg__measure');
  const fonts = document.fonts;
  const more = root.querySelector('.dlg__more');
  const tab = root.querySelector('.dlg__speaker');
  const limit = () => isLarge() ? PAGE_CHARS.large : PAGE_CHARS.normal;
  let queue = [], remaining = '', large = Boolean(isLarge());   // queue[0] is the page on screen
  let speech = null;
  const reportPage = () => onPage({ text: queue[0] ?? '', hasMore: queue.length > 1, speech });
  const fitsRendered = page => {
    measure.textContent = page;
    return !measure.clientHeight || measure.scrollHeight <= measure.clientHeight;
  };

  function render() {
    text.textContent = queue[0] ?? '';
    const hasMore = queue.length > 1;
    if (!hasMore && document.activeElement === more) root.focus();   // never leave focus on a hidden button
    more.hidden = !hasMore;
  }
  function show() {
    render();
    speech = queue[0] && autoRead() ? speak(queue[0]) : null;
    reportPage();
  }
  function next() {
    if (queue.length < 2) return false;
    remaining = remaining.slice(queue[0].length).trimStart();
    queue.shift();
    show();
    return true;
  }
  more.addEventListener('click', next);
  root.addEventListener('click', event => {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act === 'hear' && queue[0]) { speech = speak(queue[0]); reportPage(); }
    if (act === 'help') onHelp();
    if (event.target === text) next();   // tapping the words turns the page too
  });

  // Bigger words can flip while a page is showing, so the pages still to read are re-cut to fit.
  function repaginate() {
    queue = paginate(remaining, limit(), fitsRendered);
    render();
    reportPage();
  }
  const watch = new MutationObserver(() => {
    if (Boolean(isLarge()) === large) return;
    large = Boolean(isLarge());
    repaginate();
  });
  for (let el = host; el; el = el.parentElement) watch.observe(el, { attributes: true, attributeFilter: ['class'] });
  fonts?.addEventListener('loadingdone', repaginate);
  host.append(root);

  return {
    say(speaker, words) {
      tab.textContent = speaker ?? '';
      tab.hidden = !speaker;
      large = Boolean(isLarge());
      remaining = cleanText(words);
      queue = paginate(remaining, limit(), fitsRendered);
      show();
    },
    next,
    hasMore: () => queue.length > 1,
    current: () => queue[0] ?? '',
    destroy() { watch.disconnect(); fonts?.removeEventListener('loadingdone', repaginate); root.remove(); },
  };
}
