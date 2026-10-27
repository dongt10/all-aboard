import { cleanPizzaCreation } from './pizza.js';
import { cleanChainCreation } from './chain.js';
import { cleanHelpdayCreation } from './helpday.js';
import { cleanTalesCreation } from './tales.js';
import { cleanRowsCreation } from './rows.js';
import { cleanBeansCreation } from './beans.js';
import { cleanCompassCreation } from './compass.js';
import { cleanRibbonCreation } from './ribbon.js';
import { CHARACTERS } from './data.js';
import { TEMPOS, FORMS, normalizePreset } from './audio.js';
import { normalizeCommunityMap, normalizeSign, ACTIVITY_GRADES } from './encounters.js';

export const STORAGE_KEY = 'all-aboard-demo-v2';
const LEGACY_KEY = 'all-aboard-demo-v1';
const IDS = new Set(CHARACTERS.map(character => character.id));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, min, max, fallback = min) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const shortText = (value, max = 160) => typeof value === 'string' ? value.replace(/[<>\u0000-\u001f]/g, '').slice(0, max) : '';
const artColors = ['#e96163', '#f4bf4f', '#6dbea0', '#559fc7', '#9d7fbd', '#fff1cf'];
const safeColor = value => artColors.includes(value) ? value : '#fff1cf';
const scopes = ['chapter-0', ...[1, 2, 3, 4, 5].map(grade => `chapter-1-grade-${grade}`)];

export function createState() {
  return { version: 2, hasStarted: false, chapter: 0, grade: 1, avatar: 'boy', settings: { largeText: false, reducedMotion: false, autoRead: false, musicAutoplay: true }, progress: {}, drafts: {} };
}

export function scopeKey(chapter, grade) {
  if (chapter === 0) return 'chapter-0';
  if (chapter === 1 && Number.isInteger(grade) && grade >= 1 && grade <= 5) return `chapter-1-grade-${grade}`;
  throw new RangeError('Choose Kindergarten or an elementary grade from 1 to 5.');
}

// Saved creations contain only the small set of fields each scene understands.
export function cleanCreation(subjectId, input) {
  if (!IDS.has(subjectId) || !isObject(input) || input.kind !== subjectId) return null;
  if (Object.hasOwn(input, 'activity') && (input.chapter !== 1 || !(ACTIVITY_GRADES[input.activity] ?? []).includes(input.grade))) return null;
  const base = { kind: subjectId, chapter: input.chapter === 1 ? 1 : 0, grade: input.chapter === 1 ? Math.round(finite(input.grade, 1, 5, 1)) : 0 };
  if (subjectId === 'math' && input.activity === 'pizza') return cleanPizzaCreation({ ...input, ...base });
  if (subjectId === 'science' && input.activity === 'chain') return cleanChainCreation({ ...input, ...base });
  if (subjectId === 'community' && input.activity === 'helpday') return cleanHelpdayCreation({ ...input, ...base });
  if (subjectId === 'reading' && input.activity === 'tales') return cleanTalesCreation({ ...input, ...base });
  if (subjectId === 'math' && input.activity === 'rows') return cleanRowsCreation({ ...input, ...base });
  if (subjectId === 'science' && input.activity === 'beans') return cleanBeansCreation({ ...input, ...base });
  if (subjectId === 'community' && input.activity === 'compass') return cleanCompassCreation({ ...input, ...base });
  if (subjectId === 'reading' && input.activity === 'ribbon') return cleanRibbonCreation({ ...input, ...base });
  if (Object.hasOwn(input, 'activity')) return null;
  if (subjectId === 'math') {
    const cargo = values => Array.isArray(values) ? values.filter(value => [1, 2, 3, 5].includes(value)).slice(0, 8) : [];
    return { ...base, left: cargo(input.left), right: cargo(input.right), rolled: input.rolled === true };
  }
  if (subjectId === 'science') return { ...base, canopy: ['left', 'right', 'none'].includes(input.canopy) ? input.canopy : 'none', time: finite(input.time, 0, 20, 0) };
  if (subjectId === 'art') return { ...base, background: safeColor(input.background), stamps: (Array.isArray(input.stamps) ? input.stamps : []).filter(stamp => isObject(stamp) && ['star', 'flower', 'leaf', 'circle'].includes(stamp.shape) && artColors.includes(stamp.color)).slice(0, 30).map(stamp => ({ shape: shortText(stamp.shape, 24), color: safeColor(stamp.color), x: finite(stamp.x, 5, 95), y: finite(stamp.y, 5, 95), rotation: finite(stamp.rotation, 0, 359), flipped: stamp.flipped === true })) };
  if (subjectId === 'reading') return { ...base, found: ['key', 'umbrella', 'book'].filter(value => Array.isArray(input.found) && input.found.includes(value)) };
  if (subjectId === 'writing') return { ...base, ...normalizeSign(input, base.grade) };
  if (subjectId === 'community') return { ...base, ...normalizeCommunityMap(input) };
  const trackIds = ['bass', 'voice', 'melody', 'percussion'];
  const lesson = { played: base.chapter === 0 && input.lesson?.played === true, echoed: base.chapter === 1 && base.grade === 2 && input.lesson?.echoed === true };
  return { ...base, lesson, preset: normalizePreset(input.preset), tempo: TEMPOS.includes(input.tempo) ? input.tempo : 90, form: FORMS.includes(input.form) ? input.form : 'A', masterVolume: finite(input.masterVolume, 0, 1, 0.45), tracks: trackIds.map(id => {
    const track = Array.isArray(input.tracks) ? input.tracks.find(item => isObject(item) && item.id === id) : null;
    return { id, enabled: track?.enabled === true, pattern: track?.pattern === 1 ? 1 : 0, notes: Array.from({ length: 8 }, (_, index) => { const note = track?.notes?.[index]; return Number.isInteger(note) && note >= 0 && note <= 4 ? note : null; }), volume: finite(track?.volume, 0, 1, 0.65) };
  }) };
}

function cleanScopedCreation(id, input, scope) {
  const creation = cleanCreation(id, input);
  if (!creation || scopeKey(creation.chapter, creation.grade) !== scope) return null;
  // An activity cleaner must not clamp a snapshot from another grade into this scope.
  if (Object.hasOwn(input, 'chapter') && input.chapter !== creation.chapter) return null;
  if (Object.hasOwn(input, 'grade') && input.grade !== creation.grade) return null;
  return creation;
}

function cleanRecord(id, record, scope) {
  if (!isObject(record) || typeof record.completedAt !== 'string' || !Number.isFinite(Date.parse(record.completedAt))) return null;
  const creation = cleanScopedCreation(id, record.creation, scope);
  if (isObject(record.creation) && !creation) return null;
  const character = CHARACTERS.find(item => item.id === id);
  return { activityId: shortText(record.activityId, 100) || `${id}-festival`, reward: { ...character.reward }, creation, completedAt: new Date(record.completedAt).toISOString() };
}

export function normalizeState(input) {
  const state = createState();
  if (!isObject(input) || ![1, 2].includes(input.version)) return state;
  state.hasStarted = input.hasStarted === true;
  state.chapter = input.chapter === 1 ? 1 : 0;
  state.grade = Number.isInteger(input.grade) && input.grade >= 1 && input.grade <= 5 ? input.grade : 1;
  state.avatar = input.avatar === 'girl' ? 'girl' : 'boy';
  for (const key of Object.keys(state.settings)) if (typeof input.settings?.[key] === 'boolean') state.settings[key] = input.settings[key];
  for (const scope of scopes) {
    for (const id of IDS) {
      if (isObject(input.progress?.[scope]) && Object.hasOwn(input.progress[scope], id)) {
        const record = cleanRecord(id, input.progress[scope][id], scope);
        if (record) (state.progress[scope] ??= {})[id] = record;
      }
      if (isObject(input.drafts?.[scope]) && Object.hasOwn(input.drafts[scope], id)) {
        const snapshot = cleanScopedCreation(id, input.drafts[scope][id], scope);
        if (snapshot) (state.drafts[scope] ??= {})[id] = snapshot;
      }
    }
  }
  return state;
}

// Normalization is safe for play, but dropping a saved record must never authorize an overwrite.
function lostRecords(input, state) {
  for (const field of ['progress', 'drafts']) {
    if (input[field] === undefined) continue;
    if (!isObject(input[field])) return true;
    for (const [scope, records] of Object.entries(input[field])) {
      if (!scopes.includes(scope) || !isObject(records)) return true;
      for (const [id, record] of Object.entries(records)) {
        if (!IDS.has(id) || !Object.hasOwn(state[field][scope] ?? {}, id)) return true;
        if (field === 'progress' && isObject(record.creation) && !state[field][scope][id].creation) return true;
      }
    }
  }
  return false;
}

export function loadSave(storage) {
  let raw = null, key = STORAGE_KEY, currentRaw;
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return { state: createState(), status: 'unavailable', currentRaw };
    currentRaw = raw = target.getItem(STORAGE_KEY) ?? null;
    // A present but unreadable current save takes priority over an older save.
    if (raw === null) { key = LEGACY_KEY; raw = target.getItem(key) ?? null; }
    if (raw === null) return { state: createState(), status: 'empty', currentRaw };
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || ![1, 2].includes(parsed.version)) throw new Error('Unsupported save');
    const state = normalizeState(parsed);
    return { state, status: lostRecords(parsed, state) ? 'unreadable' : 'ready', raw, key, currentRaw };
  } catch {
    return { state: createState(), status: raw === null ? 'unavailable' : 'unreadable', raw, key, currentRaw };
  }
}

export const loadState = storage => loadSave(storage).state;

export function saveState(state, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    const saved = loadSave(target);
    if (!['ready', 'empty'].includes(saved.status)) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
    return true;
  } catch { return false; }
}

export function saveDraft(state, subjectId, creation) {
  const next = normalizeState(state);
  const scope = scopeKey(next.chapter, next.grade);
  const snapshot = cleanScopedCreation(subjectId, creation, scope);
  if (!snapshot) return next;
  (next.drafts[scope] ??= {})[subjectId] = snapshot;
  next.hasStarted = true;
  return next;
}

export function publishCreation(state, subjectId, creation) {
  const next = saveDraft(state, subjectId, creation);
  const scope = scopeKey(next.chapter, next.grade), character = CHARACTERS.find(item => item.id === subjectId);
  const snapshot = cleanScopedCreation(subjectId, creation, scope);
  if (!snapshot) return next;
  (next.progress[scope] ??= {})[subjectId] = { activityId: `${subjectId}-${scope}-v2`, reward: { ...character.reward }, creation: snapshot, completedAt: new Date().toISOString() };
  return next;
}

export function getRewards(state, chapter = state.chapter, grade = state.grade) {
  let scope;
  try { scope = scopeKey(chapter, grade); } catch { return []; }
  const records = normalizeState(state).progress[scope] || {};
  return [...IDS].filter(id => Object.hasOwn(records, id)).map(subjectId => ({ subjectId, ...records[subjectId] }));
}
export const getCompleted = (state, chapter = state.chapter, grade = state.grade) => getRewards(state, chapter, grade).map(record => record.subjectId);
export const getCreations = state => Object.fromEntries(getRewards(state).filter(record => record.creation).map(record => [record.subjectId, record.creation]));
export const canStartParade = state => Object.keys(getCreations(state)).length > 0;
export function getDraft(state, subjectId) {
  const safe = normalizeState(state), scope = scopeKey(safe.chapter, safe.grade);
  return safe.drafts[scope]?.[subjectId] || safe.progress[scope]?.[subjectId]?.creation || null;
}
