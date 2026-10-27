// Keep the 960×540 playfield inside the visible, safe part of the screen.
export const STAGE = { width: 960, height: 540 };
const PLAY_ANYWAY_KEY = 'all-aboard-play-anyway';

// The bound axis is set exactly, so the stage never drifts a fraction of a pixel off-center.
export function fitStage(viewportWidth, viewportHeight, safeArea = {}) {
  const inset = side => Math.max(0, Number(safeArea[side]) || 0);
  const left = inset('left'), top = inset('top');
  const availableWidth = Math.max(0, viewportWidth - left - inset('right'));
  const availableHeight = Math.max(0, viewportHeight - top - inset('bottom'));
  const byHeight = availableWidth >= availableHeight * STAGE.width / STAGE.height;
  const scale = byHeight ? availableHeight / STAGE.height : availableWidth / STAGE.width;
  const width = byHeight ? STAGE.width * scale : availableWidth;
  const height = byHeight ? availableHeight : STAGE.height * scale;
  return { scale, width, height, left: left + (availableWidth - width) / 2, top: top + (availableHeight - height) / 2, portrait: viewportHeight > viewportWidth };
}

export function visibleViewport(host) {
  const view = host.visualViewport;
  return view
    ? { width: view.width, height: view.height, left: view.offsetLeft, top: view.offsetTop, scale: view.scale ?? 1 }
    : { width: host.innerWidth, height: host.innerHeight, left: 0, top: 0, scale: 1 };
}

export function applySettings(stage, settings = {}) {
  stage.classList.toggle('large-text', Boolean(settings.largeText));
  stage.closest('.stage-viewport')?.classList.toggle('large-text', Boolean(settings.largeText));
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
  let opener = null;
  let box = null;
  const button = card.querySelector('button');
  const usable = el => {
    if (!el?.isConnected || !stage.contains(el) || el.disabled || !el.getClientRects().length) return false;
    for (let at = el; at; at = at.parentElement) if (at.inert || at.hidden) return false;
    return true;
  };
  function fit() {
    let view = visibleViewport(window);
    // Resizing while pinched would shrink the game again and undo low-vision magnification.
    // Leave the last layout in place so native pinch zoom and panning work normally.
    if (view.width > 0 && view.height > 0 && !(view.scale > 1.01 && box)) {
      // A restored tab may already be zoomed before the first fit. Establish its unzoomed
      // layout once, then let the browser magnify and pan it like any other page.
      if (view.scale > 1.01) view = { ...view, width: view.width * view.scale, height: view.height * view.scale, left: 0, top: 0 };
      viewport.style.left = `${view.left}px`;
      viewport.style.top = `${view.top}px`;
      viewport.style.width = `${view.width}px`;
      viewport.style.height = `${view.height}px`;
      const padding = window.getComputedStyle?.(viewport) ?? {};
      box = fitStage(view.width, view.height, {
        left: parseFloat(padding.paddingLeft), right: parseFloat(padding.paddingRight),
        top: parseFloat(padding.paddingTop), bottom: parseFloat(padding.paddingBottom),
      });
      stage.style.transform = `translate(${box.left}px, ${box.top}px) scale(${box.scale})`;
      // Phone backdrops extend the scene's flat color bands without changing its coordinates.
      viewport.style.setProperty('--stage-top', `${box.top}px`);
      viewport.style.setProperty('--stage-height', `${box.height}px`);
    }
    if (!box) return;
    root.dataset.portrait = String(box.portrait);
    const showCard = box.portrait && !dismissed;
    if (showCard && card.hidden) opener = document.activeElement;
    stage.inert = showCard;   // the card is modal: the game behind it can't take focus
    if (showCard && card.hidden) { card.hidden = false; button.focus(); }
    if (!showCard && !card.hidden) {
      card.hidden = true;
      const scope = stage.querySelector('.win-backdrop, .item-get') ?? stage;
      const fallback = () => [...scope.querySelectorAll('button, input, textarea, select, [tabindex]')]
        .find(el => el.tabIndex >= 0 && usable(el));
      (usable(opener) ? opener : fallback())?.focus();
      opener = null;
    }
  }
  card.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
  });
  button.addEventListener('click', () => { dismissed = true; playAnyway.set(); fit(); });
  viewport.append(stage, card);
  root.append(viewport);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener('resize', fit);
  visualViewport?.addEventListener('scroll', fit);
  fit();
  return { stage, destroy() {
    window.removeEventListener('resize', fit);
    window.removeEventListener('orientationchange', fit);
    visualViewport?.removeEventListener('resize', fit);
    visualViewport?.removeEventListener('scroll', fit);
    viewport.remove();
  } };
}
