import { CHARACTERS } from './data.js';

const STORAGE_KEY = 'all-aboard-demo-v1';
const SUBJECT_IDS = new Set(CHARACTERS.map(character => character.id));
const own = (object, key) => Object.hasOwn(object, key);
const objectLike = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plainText = (value, limit = 240) => typeof value === 'string' && value.trim().length > 0
  && value.length <= limit && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

export function createState() {
  return {
    version: 1,
    hasStarted: false,
    chapter: 0,
    grade: 1,
    settings: { largeText: false, reducedMotion: true },
    progress: {},
  };
}

export function scopeKey(chapter, grade) {
  if (chapter === 0) return 'chapter-0';
  if (chapter === 1 && Number.isInteger(grade) && grade >= 1 && grade <= 5) {
    return `chapter-1-grade-${grade}`;
  }
  throw new RangeError('Use chapter 0 or chapter 1 with a grade from 1 to 5.');
}

function cleanRecord(record) {
  if (!objectLike(record) || !plainText(record.activityId, 100)
    || !objectLike(record.reward) || !plainText(record.reward.label)
    || !plainText(record.reward.icon, 32) || typeof record.completedAt !== 'string'
    || !Number.isFinite(Date.parse(record.completedAt))) return null;
  return {
    activityId: record.activityId,
    reward: { label: record.reward.label, icon: record.reward.icon },
    creation: plainText(record.creation) ? record.creation : null,
    completedAt: new Date(record.completedAt).toISOString(),
  };
}

// Copy only recognized fields. Unknown scopes and prototype property names never enter state.
function cleanState(input) {
  const state = createState();
  if (!objectLike(input) || input.version !== 1) return state;
  if (typeof input.hasStarted === 'boolean') state.hasStarted = input.hasStarted;
  if (input.chapter === 0 || input.chapter === 1) state.chapter = input.chapter;
  if (Number.isInteger(input.grade) && input.grade >= 1 && input.grade <= 5) state.grade = input.grade;
  if (objectLike(input.settings)) {
    for (const key of ['largeText', 'reducedMotion']) {
      if (typeof input.settings[key] === 'boolean') state.settings[key] = input.settings[key];
    }
  }
  if (!objectLike(input.progress)) return state;
  const scopes = ['chapter-0', ...[1, 2, 3, 4, 5].map(grade => scopeKey(1, grade))];
  for (const scope of scopes) {
    if (!own(input.progress, scope) || !objectLike(input.progress[scope])) continue;
    const records = {};
    for (const subjectId of SUBJECT_IDS) {
      if (!own(input.progress[scope], subjectId)) continue;
      const record = cleanRecord(input.progress[scope][subjectId]);
      if (record) records[subjectId] = record;
    }
    if (Object.keys(records).length) state.progress[scope] = records;
  }
  return state;
}

export function loadState(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return createState();
    const saved = target.getItem(STORAGE_KEY);
    return saved ? cleanState(JSON.parse(saved)) : createState();
  } catch {
    return createState();
  }
}

export function saveState(state, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(cleanState(state)));
    return true;
  } catch {
    return false;
  }
}

export function completeActivity(state, activity, creation = null) {
  const updated = cleanState(state);
  if (!objectLike(activity) || !SUBJECT_IDS.has(activity.subjectId)) return updated;
  let scope;
  try {
    scope = scopeKey(activity.chapter, activity.grade);
  } catch {
    return updated;
  }
  const record = cleanRecord({
    activityId: activity.id,
    reward: activity.reward,
    creation,
    completedAt: new Date().toISOString(),
  });
  if (!record) return updated;
  updated.hasStarted = true;
  updated.progress[scope] = { ...updated.progress[scope], [activity.subjectId]: record };
  return updated;
}

export function getCompleted(state, chapter = state.chapter, grade = state.grade) {
  return getRewards(state, chapter, grade).map(record => record.subjectId);
}

export function getRewards(state, chapter = state.chapter, grade = state.grade) {
  let scope;
  try {
    scope = scopeKey(chapter, grade);
  } catch {
    return [];
  }
  const records = cleanState(state).progress[scope] || {};
  return [...SUBJECT_IDS].filter(subjectId => own(records, subjectId))
    .map(subjectId => ({ subjectId, ...records[subjectId] }));
}
