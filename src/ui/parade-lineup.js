// Pure parade helpers: who marches, in what order, which band controls make sense, and what the band status says.
import { bandPlaybackMessage } from '../music.js';

export const PARADE_ORDER = ['math', 'science', 'art', 'reading', 'writing', 'community', 'music'];

// creations: getCreations(state), subject id → snapshot. Legacy completions without a creation are
// already left out by getCreations; empty or unknown entries are skipped here too.
export function paradeLineup(creations = {}) {
  const made = creations ?? {};
  return PARADE_ORDER.filter(id => made[id]).map(id => ({ id, creation: made[id] }));
}

// playing: the band is starting or playing (the playback controller is active).
export function paradeCommands({ hasBand = false, playing = false } = {}) {
  return [
    { id: 'play', label: 'Play band', icon: 'music', disabled: !hasBand || playing },
    { id: 'stop', label: 'Stop', icon: 'stop', disabled: !playing },
    { id: 'march', label: 'March again', icon: 'undo' },
    { id: 'village', label: 'Village', icon: 'home' },
  ];
}

// The music stage's status lines, reworded for the parade, which has no volume or friend controls
// (the same replacements the original parade screen used).
export function paradeStatus(phase, reason, band) {
  if (reason === 'unavailable') return 'Sound could not start. The parade is still yours.';
  if (phase === 'starting') return 'Starting your band…';
  if (phase !== 'playing') return 'Music stopped';
  return bandPlaybackMessage(band)
    .replace('Invite a friend or add a note.', 'Visit Kiko to invite a friend or add a note.')
    .replace('Raise a friend’s volume to listen.', 'Visit Kiko to raise a friend’s volume.')
    .replace('Raise band volume to listen.', 'Visit Kiko to raise the band volume.')
    .replace(' Try a new sound!', '');
}
