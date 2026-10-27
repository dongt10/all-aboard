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

// A small window on a tablet or desktop is not a phone. Require a phone-like
// user agent as well as touch, and exclude iPadOS's desktop-style user agent.
export function isPhone(host, view, box) {
  const ua = host.navigator?.userAgent ?? '';
  const ipad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && (host.navigator?.maxTouchPoints ?? 0) > 1);
  const mobile = /iPhone|iPod|Android.+Mobile/i.test(ua);
  const screen = host.screen;
  const screenShort = Math.min(screen?.width || Infinity, screen?.height || Infinity);
  return !ipad && mobile && screenShort < 600 && Boolean(host.matchMedia?.('(pointer: coarse)').matches)
    && (box.scale < 0.75 || Math.min(view.width, view.height) < 600);
}

export function visibleViewport(host) {
  const view = host.visualViewport;
  const visible = view
    ? { width: view.width, height: view.height, left: view.offsetLeft, top: view.offsetTop, scale: view.scale ?? 1 }
    : { width: host.innerWidth, height: host.innerHeight, left: 0, top: 0, scale: 1 };
  const active = host.document?.activeElement;
  const editing = active?.matches('input, textarea, select') || active?.isContentEditable;
  const standalone = host.navigator?.standalone || host.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (standalone && visible.scale === 1 && !editing) {
    const screen = host.screen;
    const direction = screen?.orientation?.type;
    if (/iPhone|iPod/.test(host.navigator?.userAgent ?? '') &&
        screen?.width > 0 && screen?.height > 0 && /^(portrait|landscape)-/.test(direction)) {
      // On iPhone Home Screen cold launches, inner/visual/client height and 100dvh
      // can ALL exclude the portrait status bar (956x378 on a 956x440 screen).
      // screen dimensions stay portrait-based on iOS; orientation is independent
      // of the stale web viewport, including after background/rotation.
      const short = Math.min(screen.width, screen.height), long = Math.max(screen.width, screen.height);
      const landscape = direction.startsWith('landscape');
      visible.width = landscape ? long : short;
      visible.height = landscape ? short : long;
      visible.screenSized = true;
    } else {
      visible.height = Math.max(visible.height, host.document?.documentElement?.clientHeight || 0);
    }
    visible.left = 0;
    visible.top = 0;
  }
  return visible;
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
  const body = document.body;
  const bodySize = { width: body.style.width, height: body.style.height };
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
  let lastMeasurement = '';
  let frame = null;
  let timers = [];
  const coarse = window.matchMedia?.('(pointer: coarse)');
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
      const padding = window.getComputedStyle?.(viewport) ?? {};
      const safeArea = {
        left: parseFloat(padding.paddingLeft), right: parseFloat(padding.paddingRight),
        top: parseFloat(padding.paddingTop), bottom: parseFloat(padding.paddingBottom),
      };
      const measurement = [view.width, view.height, view.left, view.top, view.screenSized, ...Object.values(safeArea)].join(',');
      if (measurement !== lastMeasurement) {
        // A fixed body remains clipped to WebKit's stale launch viewport even
        // with an explicit height. Put this screen-sized body in document flow.
        body.classList.toggle('standalone-screen', Boolean(view.screenSized));
        body.style.width = view.screenSized ? `${view.width}px` : bodySize.width;
        body.style.height = view.screenSized ? `${view.height}px` : bodySize.height;
        viewport.style.left = `${view.left}px`;
        viewport.style.top = `${view.top}px`;
        viewport.style.width = `${view.width}px`;
        viewport.style.height = `${view.height}px`;
        box = fitStage(view.width, view.height, safeArea);
        stage.style.transform = `translate(${box.left}px, ${box.top}px) scale(${box.scale})`;
        stage.style.setProperty('--stage-scale', String(box.scale));
        viewport.style.setProperty('--stage-scale', String(box.scale));
        // Phone backdrops extend the scene's flat color bands without changing its coordinates.
        viewport.style.setProperty('--stage-top', `${box.top}px`);
        viewport.style.setProperty('--stage-height', `${box.height}px`);
        lastMeasurement = measurement;
      }
    }
    if (!box) return;
    const phone = isPhone(window, view, box);
    stage.classList.toggle('phone', phone);
    viewport.classList.toggle('phone', phone);
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
  function stopSettling() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    timers.forEach(timer => clearTimeout(timer));
    timers = [];
  }
  function settle() {
    stopSettling();
    fit();
    // Launch, restore, and rotation can finish changing the viewport without a resize event.
    frame = requestAnimationFrame(() => { frame = null; fit(); });
    timers = [100, 300, 700, 1500].map(delay => setTimeout(fit, delay));
  }
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') settle();
    else stopSettling();
  }
  card.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
  });
  button.addEventListener('click', () => { dismissed = true; playAnyway.set(); fit(); });
  viewport.append(stage, card);
  root.append(viewport);
  window.addEventListener('resize', fit);
  window.addEventListener('load', settle);
  window.addEventListener('pageshow', settle);
  window.addEventListener('orientationchange', settle);
  window.addEventListener('visibilitychange', onVisibilityChange, true);
  const orientation = window.screen?.orientation;
  orientation?.addEventListener('change', settle);
  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener('resize', fit);
  visualViewport?.addEventListener('scroll', fit);
  coarse?.addEventListener?.('change', fit);
  settle();
  return { stage, destroy() {
    stopSettling();
    window.removeEventListener('resize', fit);
    window.removeEventListener('load', settle);
    window.removeEventListener('pageshow', settle);
    window.removeEventListener('orientationchange', settle);
    window.removeEventListener('visibilitychange', onVisibilityChange, true);
    orientation?.removeEventListener('change', settle);
    visualViewport?.removeEventListener('resize', fit);
    visualViewport?.removeEventListener('scroll', fit);
    coarse?.removeEventListener?.('change', fit);
    body.style.width = bodySize.width;
    body.style.height = bodySize.height;
    body.classList.remove('standalone-screen');
    viewport.remove();
  } };
}
