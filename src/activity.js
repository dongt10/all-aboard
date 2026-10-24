import { avatarMarkup } from './village.js';

let nextDialogId = 0;

/** Keep answer checking independent of the screen and never accept an empty answer. */
export function isActivityAnswerCorrect(activity, selectedIds) {
  const options = activity.options ?? [];
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return false;
  if (new Set(selectedIds).size !== selectedIds.length) return false;
  if (!selectedIds.every((id) => options.some((option) => option.id === id))) return false;
  if (activity.type === 'create') return selectedIds.length === 1;
  if (activity.type === 'order') {
    return Array.isArray(activity.correct)
      && selectedIds.length === activity.correct.length
      && selectedIds.every((id, index) => id === activity.correct[index]);
  }
  return selectedIds.length === 1 && selectedIds[0] === activity.correct;
}

function bannerAppearance(option) {
  const label = option.label.toLowerCase();
  const color = label.includes('purple') ? 'purple' : label.includes('blue') ? 'blue'
    : label.includes('green') ? 'green' : label.includes('yellow') ? 'yellow' : 'peach';
  let mark = '✦';
  if (label.includes('wavy')) mark = '∿ ∿ ∿';
  else if (label.includes('zigzag')) mark = '⋀ ⋁ ⋀ ⋁';
  else if (label.includes('loops')) mark = '⌁ ⌁ ⌁';
  else if (label.includes('circle, star')) mark = '● ★ ● ★';
  else if (label.includes('leaf, leaf')) mark = '❧ ❧ ✿ ❧ ❧ ✿';
  else if (label.includes('stripe, dot')) mark = '┃ ● ● ┃ ● ●';
  else if (label.includes('large star')) mark = '· ★ ·';
  else if (label.includes('yellow star')) mark = '★';
  else if (label.includes('open space')) mark = '    ☆    ';
  else if (label.includes('matching')) mark = '◆ ● ◆';
  else if (label.includes('large shape')) mark = '◯ · · ·';
  else if (label.includes('central circle')) mark = '❋ ◎ ❋';
  return { color, mark: option.visual || mark };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mount one accessible conversation, activity, and reward flow. */
export function mountActivity(host, { character, activity, onComplete, onClose, settings = {} }) {
  const dialogId = `activity-${++nextDialogId}`;
  const events = new AbortController();
  const selectedIds = [];
  const options = activity.options ?? [];
  let stage = 'story';
  let disposed = false;
  let finished = false;
  let supportShown = false;
  let speech = null;
  const dialog = element('dialog', 'activity-dialog');
  dialog.classList.toggle('activity-large-text', Boolean(settings.largeText));
  dialog.classList.toggle('activity-reduced-motion', Boolean(settings.reducedMotion));
  dialog.setAttribute('aria-labelledby', `${dialogId}-title`);
  const shell = element('div', 'activity-shell');
  dialog.append(shell);

  function listen(node, type, callback) {
    node.addEventListener(type, callback, { signal: events.signal });
  }

  function button(text, className, callback) {
    const node = element('button', `lesson-button ${className || ''}`.trim(), text);
    node.type = 'button';
    listen(node, 'click', callback);
    return node;
  }

  function stopSpeaking() {
    if (speech && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    speech = null;
  }

  function destroy() {
    if (disposed) return;
    disposed = true;
    stopSpeaking();
    events.abort();
    if (dialog.open) dialog.close();
    dialog.remove();
  }

  function close() {
    if (disposed || finished) return;
    finished = true;
    destroy();
    onClose?.();
  }

  const header = element('header', 'activity-header');
  const portrait = element('div', 'activity-portrait');
  portrait.setAttribute('aria-hidden', 'true');
  // Only the project's authored SVG helper produces HTML in this modal.
  portrait.innerHTML = avatarMarkup(character.id, { size: 92 });
  const neighbor = element('div', 'activity-neighbor');
  neighbor.append(element('p', 'activity-eyebrow', character.subject));
  const title = element('h2', 'activity-neighbor-name', character.name);
  title.id = `${dialogId}-title`;
  neighbor.append(title, element('p', 'activity-location', character.location));
  const closeButton = button('Back to village', 'lesson-button-quiet activity-close', close);
  header.append(portrait, neighbor, closeButton);
  const body = element('div', 'activity-body');
  const stageLabel = element('p', 'activity-eyebrow', 'A little festival favor');
  const activityTitle = element('h3', 'activity-title', activity.title);
  activityTitle.tabIndex = -1;
  body.append(stageLabel, activityTitle);
  const content = element('div', 'activity-content');
  body.append(content);
  const feedback = element('p', 'activity-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.setAttribute('aria-atomic', 'true');
  const supportPanel = element('aside', 'activity-support-panel');
  supportPanel.setAttribute('aria-label', 'Help with this activity');
  const hint = element('p', 'activity-hint', activity.hint || 'Take your time. Look at each choice and try one.');
  hint.id = `${dialogId}-hint`;
  hint.hidden = true;
  const steps = element('div', 'activity-steps');
  steps.id = `${dialogId}-steps`;
  steps.hidden = true;
  steps.append(element('p', 'activity-support-title', 'One small step at a time'));
  const stepList = element('ol', 'activity-step-list');
  const instructions = activity.type === 'order'
    ? ['Read or look at the choices.', 'Tap the pieces in the order you want. Use Undo to change the last piece.', 'When your row is ready, choose Check.']
    : activity.type === 'create'
      ? ['Look at the colors and patterns.', 'Choose one to see it on your banner.', 'When you like it, choose Make my banner.']
      : ['Read or look at the question.', 'Choose the answer you think fits.', 'Choose Check. You can always try again.'];
  for (const instruction of instructions) stepList.append(element('li', '', instruction));
  steps.append(stepList);
  const supportButtons = element('div', 'activity-support-buttons');
  const speechStatus = element('p', 'activity-speech-status');
  speechStatus.setAttribute('role', 'status');
  const readButton = button('Read aloud', 'lesson-button-support', () => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      speechStatus.textContent = 'Read aloud is unavailable here. All instructions are on the screen.';
      return;
    }
    stopSpeaking();
    try {
      const words = stage === 'story'
        ? `${character.name}. ${activity.title}. ${activity.story}`
        : `${activity.story}. ${activity.prompt}. ${options.map((option) => option.label).join('. ')}. ${hint.hidden ? '' : hint.textContent}`;
      speech = new SpeechSynthesisUtterance(words);
      const utterance = speech;
      speech.lang = 'en-US';
      speech.rate = 0.88;
      speechStatus.textContent = 'Reading aloud…';
      speech.onend = () => {
        if (speech !== utterance) return;
        if (!disposed) speechStatus.textContent = '';
        speech = null;
      };
      speech.onerror = () => {
        if (speech !== utterance) return;
        if (!disposed) speechStatus.textContent = 'The voice could not play. You can still use every activity on the screen.';
        speech = null;
      };
      window.speechSynthesis.speak(speech);
    } catch {
      speech = null;
      speechStatus.textContent = 'The voice could not play. All instructions are on the screen.';
    }
  });
  const hintButton = button('Show a hint', 'lesson-button-support', () => {
    hint.hidden = !hint.hidden;
    hintButton.setAttribute('aria-expanded', String(!hint.hidden));
    hintButton.textContent = hint.hidden ? 'Show a hint' : 'Hide hint';
  });
  hintButton.setAttribute('aria-controls', hint.id);
  hintButton.setAttribute('aria-expanded', 'false');
  const stepsButton = button('One step at a time', 'lesson-button-support', () => {
    supportShown = !supportShown;
    steps.hidden = !supportShown;
    stepsButton.setAttribute('aria-expanded', String(supportShown));
  });
  stepsButton.setAttribute('aria-controls', steps.id);
  stepsButton.setAttribute('aria-expanded', 'false');
  supportButtons.append(readButton, hintButton, stepsButton);
  supportPanel.append(supportButtons, hint, steps, speechStatus);
  body.append(feedback, supportPanel);
  shell.append(header, body);

  function setFeedback(text, kind = '') {
    feedback.textContent = text;
    feedback.className = `activity-feedback ${kind ? `activity-feedback-${kind}` : ''}`;
  }

  function showSuccess() {
    if (stage !== 'activity' || disposed) return;
    stage = 'success';
    stopSpeaking();
    content.replaceChildren();
    stageLabel.textContent = 'Ready for the festival';
    supportPanel.hidden = true;
    setFeedback('');
    const success = element('div', 'activity-success');
    const reward = activity.reward ?? character.reward ?? { label: 'A festival creation', icon: '✦' };
    const icon = element('span', 'activity-reward-icon', reward.icon);
    icon.setAttribute('aria-hidden', 'true');
    const successTitle = element('h4', 'activity-success-title', 'You made something wonderful.');
    successTitle.tabIndex = -1;
    success.append(icon, successTitle, element('p', 'activity-success-copy', activity.success || 'Thank you for helping our village get ready!'));
    const rewardCard = element('div', 'activity-reward-card');
    rewardCard.append(element('span', 'activity-reward-caption', 'For your festival stall'), element('strong', 'activity-reward-label', reward.label));
    success.append(rewardCard);
    const addButton = button('Add to my stall', 'lesson-button-primary', () => {
      if (disposed || finished) return;
      finished = true;
      const result = { subjectId: activity.subjectId, activityId: activity.id, reward: activity.reward };
      if (activity.type === 'create') {
        const option = options.find((item) => item.id === selectedIds[0]);
        result.creation = { optionId: option.id, label: option.label, visual: option.visual || '' };
      }
      destroy();
      onComplete?.(result);
    });
    success.append(addButton);
    content.append(success);
    successTitle.focus();
  }

  function showActivity() {
    stage = 'activity';
    stopSpeaking();
    speechStatus.textContent = '';
    stageLabel.textContent = 'Let’s make the festival together';
    content.replaceChildren();
    const reference = element('p', 'activity-reference', activity.story);
    const prompt = element('p', 'activity-prompt', activity.prompt);
    prompt.id = `${dialogId}-prompt`;
    const optionsGroup = element('div', 'activity-options');
    optionsGroup.setAttribute('role', 'group');
    optionsGroup.setAttribute('aria-labelledby', prompt.id);
    optionsGroup.classList.toggle('activity-options-order', activity.type === 'order');
    const answer = element('div', 'activity-answer');
    const selectionLabel = element('p', 'activity-selection-label', 'Your row');
    const sequence = element('ol', 'activity-sequence');
    sequence.setAttribute('aria-label', 'Your chosen order');
    const empty = element('p', 'activity-sequence-empty', 'Tap a piece below to start your row.');
    const editButtons = element('div', 'activity-edit-buttons');
    const undoButton = button('Undo', 'lesson-button-quiet', () => {
      const removedId = selectedIds.pop();
      setFeedback('Last piece removed. Choose another piece when you are ready.');
      updateSelection();
      if (undoButton.disabled) focusOption(removedId);
    });
    const resetButton = button('Start over', 'lesson-button-quiet', () => {
      const removedId = selectedIds[selectedIds.length - 1];
      selectedIds.length = 0;
      setFeedback('Your row is ready for a fresh start.');
      updateSelection();
      if (resetButton.disabled) focusOption(removedId);
    });
    editButtons.append(undoButton, resetButton);
    answer.append(selectionLabel, sequence, empty, editButtons);
    const preview = element('div', 'activity-banner-preview');
    preview.setAttribute('aria-label', 'Your banner preview');
    const banner = element('div', 'activity-banner');
    banner.append(element('span', 'activity-banner-mark', '✦'), element('span', 'activity-banner-name', 'Your festival banner'));
    const previewLabel = element('p', 'activity-banner-caption', 'Choose a design to make it yours.');
    preview.append(banner, previewLabel);
    const actions = element('div', 'activity-actions');
    const checkButton = button(activity.type === 'create' ? 'Make my banner' : 'Check', 'lesson-button-primary', () => {
      if (isActivityAnswerCorrect(activity, selectedIds)) {
        showSuccess();
      } else {
        setFeedback(`Let’s try another way. ${activity.hint || 'Look at the question and each choice again. You can change your answer.'}`, 'hint');
      }
    });
    actions.append(checkButton, element('span', 'activity-reassurance', 'Take your time. You can try again.'));
    const optionButtons = [];
    options.forEach((option, index) => {
      const tile = button('', 'activity-option', () => {
        if (activity.type === 'order') {
          if (!selectedIds.includes(option.id)) selectedIds.push(option.id);
          setFeedback(`Added ${option.label}.`);
        } else {
          selectedIds.splice(0, selectedIds.length, option.id);
          setFeedback(`${option.label} selected. ${activity.type === 'create' ? 'Your banner preview is ready.' : 'Choose Check when you are ready.'}`);
        }
        updateSelection();
        if (activity.type === 'order') {
          if (!checkButton.disabled) checkButton.focus();
          else {
            const next = [...optionButtons.slice(index + 1), ...optionButtons.slice(0, index)]
              .find((optionButton) => !optionButton.disabled);
            next?.focus();
          }
        }
      });
      tile.setAttribute('aria-pressed', 'false');
      const visual = element('span', 'activity-option-visual', option.visual || (activity.type === 'create' ? bannerAppearance(option).mark : ''));
      visual.setAttribute('aria-hidden', 'true');
      const label = element('span', 'activity-option-label', option.label);
      if (visual.textContent) tile.append(visual);
      tile.append(label);
      optionButtons.push(tile);
      optionsGroup.append(tile);
    });

    function focusOption(id) {
      const index = options.findIndex((option) => option.id === id);
      const preferred = optionButtons[index];
      const target = preferred && !preferred.disabled
        ? preferred : optionButtons.find((optionButton) => !optionButton.disabled);
      target?.focus();
    }

    function updateSelection() {
      optionButtons.forEach((tile, index) => {
        const selected = selectedIds.includes(options[index].id);
        tile.setAttribute('aria-pressed', String(selected));
        tile.classList.toggle('activity-option-selected', selected);
        tile.disabled = activity.type === 'order' && selected;
      });
      checkButton.disabled = activity.type === 'order'
        ? selectedIds.length !== (Array.isArray(activity.correct) ? activity.correct.length : options.length)
        : selectedIds.length === 0;
      undoButton.disabled = selectedIds.length === 0;
      resetButton.disabled = selectedIds.length === 0;
      sequence.replaceChildren();
      for (const id of selectedIds) {
        sequence.append(element('li', 'activity-sequence-piece', options.find((option) => option.id === id).label));
      }
      empty.hidden = selectedIds.length > 0;
      if (activity.type === 'create' && selectedIds.length) {
        const selectedIndex = options.findIndex((option) => option.id === selectedIds[0]);
        const option = options[selectedIndex];
        const appearance = bannerAppearance(option);
        banner.dataset.design = appearance.color;
        banner.querySelector('.activity-banner-mark').textContent = appearance.mark;
        banner.querySelector('.activity-banner-name').textContent = option.label;
        previewLabel.textContent = `${option.label} — your choice, your creation.`;
      }
    }

    content.append(reference, prompt);
    if (activity.type === 'order') content.append(answer);
    if (activity.type === 'create') content.append(preview);
    content.append(optionsGroup, actions);
    updateSelection();
    activityTitle.focus();
  }

  const story = element('div', 'activity-story');
  story.append(element('p', 'activity-greeting', character.greeting || `Hello! I’m ${character.name}.`), element('p', 'activity-story-copy', activity.story));
  const startButton = button('Let’s try it', 'lesson-button-primary', showActivity);
  story.append(startButton, element('p', 'activity-story-note', 'Read, listen, or explore at your own pace.'));
  content.append(story);
  listen(dialog, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  listen(dialog, 'close', () => {
    if (!disposed) close();
  });
  host.append(dialog);
  dialog.showModal();
  startButton.focus();
  return { destroy };
}
