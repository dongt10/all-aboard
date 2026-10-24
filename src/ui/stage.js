// The whole game lives on one 960×540 stage, scaled to fit the window like a handheld screen.
export const STAGE = { width: 960, height: 540 };
const PLAY_ANYWAY_KEY = 'all-aboard-play-anyway';

// The bound axis is set exactly, so the stage never drifts a fraction of a pixel off-center.
export function fitStage(viewportWidth, viewportHeight) {
  const byHeight = viewportWidth / viewportHeight >= STAGE.width / STAGE.height;
  const scale = byHeight ? viewportHeight / STAGE.height : viewportWidth / STAGE.width;
  const width = byHeight ? STAGE.width * scale : viewportWidth;
  const height = byHeight ? viewportHeight : STAGE.height * scale;
  return { scale, width, height, left: (viewportWidth - width) / 2, top: (viewportHeight - height) / 2, portrait: viewportHeight > viewportWidth };
}

export function applySettings(stage, settings = {}) {
  stage.classList.toggle('large-text', Boolean(settings.largeText));
  stage.classList.toggle('calm', Boolean(settings.reducedMotion));
}

const playAnyway = {
  get() { try { return sessionStorage.getItem(PLAY_ANYWAY_KEY) === 'yes'; } catch { return false; } },
  set() { try { sessionStorage.setItem(PLAY_ANYWAY_KEY, 'yes'); } catch { /* the card stays dismissed until reload */ } },
};

export function mountStage(root) {
  const viewport = document.createElement('div');
  viewport.className = 'stage-viewport';
  const stage = document.createElement('div');
  stage.className = 'stage';
  const card = document.createElement('div');
  card.className = 'rotate-card';
  card.hidden = true;
  card.innerHTML = '<div class="px-frame rotate-card__frame" role="dialog" aria-modal="true" aria-labelledby="rotate-title"><p id="rotate-title">Turn your device sideways</p><p class="rotate-card__note">All Aboard fits best when your screen is wide.</p><button type="button" class="px-button">Play anyway</button></div>';
  let dismissed = playAnyway.get();
  const button = card.querySelector('button');
  function fit() {
    const box = fitStage(window.innerWidth, window.innerHeight);
    stage.style.transform = `translate(${box.left}px, ${box.top}px) scale(${box.scale})`;
    root.dataset.portrait = String(box.portrait);
    const showCard = box.portrait && !dismissed;
    stage.inert = showCard;   // the card is modal: the game behind it can't take focus
    if (showCard && card.hidden) { card.hidden = false; button.focus(); }
    if (!showCard && !card.hidden) { card.hidden = true; stage.querySelector('button:not(:disabled), [tabindex]:not([tabindex="-1"])')?.focus(); }
  }
  button.addEventListener('click', () => { dismissed = true; playAnyway.set(); fit(); });
  viewport.append(stage, card);
  root.append(viewport);
  window.addEventListener('resize', fit);
  fit();
  return { stage, destroy() { window.removeEventListener('resize', fit); viewport.remove(); } };
}
