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
  return choice.chapter === 0 ? { ...state, chapter: 0, hasStarted: true } : { ...state, chapter: 1, grade: choice.grade, hasStarted: true };
}

export const isChosenGrade = (state, choice) => state.chapter === choice.chapter && (choice.chapter === 0 || state.grade === choice.grade);
