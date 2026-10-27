import { openWindow } from './window.js';
import { stopSpeaking } from './voice.js';

// Keep the exact unreadable text available to a caregiver without changing storage.
export function openSaveRecovery(ctx, saved) {
  stopSpeaking();
  const lines = [
    'We could not read all of your old save.',
    'Your old save is still kept on this device.',
    'New play in this tab will not be saved.',
    'Keep a copy and ask a grown-up for help.',
  ];
  const body = document.createElement('div');
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    body.append(p);
  }
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'px-button';
  copy.textContent = 'Keep copy';
  copy.addEventListener('click', () => {
    let url, link;
    try {
      url = URL.createObjectURL(new Blob([saved.raw], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = `${saved.key}-recovery.txt`;
      body.append(link);
      link.click();
      ctx.announce('Copy requested. Your old save is still kept.');
    } catch {
      status.textContent = 'Copy did not work. Your old save is still kept.';
      ctx.announce(status.textContent);
    } finally {
      link?.remove();
      // Give the browser time to start the download before releasing its URL.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  const hear = document.createElement('button');
  hear.type = 'button';
  hear.className = 'px-button';
  hear.textContent = 'Hear';
  hear.addEventListener('click', () => ctx.speak([...lines, status.textContent].join(' ')));
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  body.append(copy, hear, status);
  return openWindow(ctx.stage, { title: 'Old save', body, onClose: stopSpeaking });
}

// Pure state helpers for the new UI. Each returns a new state and never mutates its input.
const SETTINGS = ['largeText', 'reducedMotion', 'autoRead'];
const AVATARS = ['boy', 'girl'];

// A snapshot saved from a scene belongs to the grade it was made in (Kindergarten is grade 0).
export const withScope = (snapshot, state) => ({ ...snapshot, chapter: state.chapter, grade: state.chapter === 0 ? 0 : state.grade });

export function toggleSetting(state, key) {
  if (!SETTINGS.includes(key)) throw new RangeError(`Unknown comfort setting: ${key}`);
  return { ...state, settings: { ...state.settings, [key]: !state.settings?.[key] } };
}

export function chooseAvatar(state, avatar) {
  if (!AVATARS.includes(avatar)) throw new RangeError('Choose boy or girl.');
  return { ...state, avatar };
}

export const GRADE_CHOICES = Object.freeze([
  { chapter: 0, grade: 0, label: 'K', name: 'Kindergarten' },
  ...[1, 2, 3, 4, 5].map(grade => ({ chapter: 1, grade, label: String(grade), name: `Grade ${grade}` })),
]);
export const gradeChoices = () => GRADE_CHOICES.map(choice => ({ ...choice }));

// Kindergarten keeps the last elementary grade, so switching back lands where the child left off.
export function chooseGrade(state, choice) {
  return choice.chapter === 0 ? { ...state, chapter: 0 } : { ...state, chapter: 1, grade: choice.grade };
}

export const isChosenGrade = (state, choice) => state.chapter === choice.chapter && (choice.chapter === 0 || state.grade === choice.grade);
