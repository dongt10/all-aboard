// Festival palette. tests/ui-kit.test.js holds every text-on-fill pair to 4.5:1 or better.
export const INK = '#1f2147';
export const INK_SOFT = '#4a4e7a';
export const PAPER = '#fff8e6';
export const PAPER_SHADE = '#f3e3bf';
export const FINISH = '#1f7a55';
export const SKY = '#9fdcff';
export const SEA = '#3fa7d6';
export const GRASS = '#79c96a';
export const GRASS_DARK = '#4f9a50';
export const PATH = '#f4d9a0';
export const WOOD = '#b8754a';
export const VERMILION = '#d9412e';
export const LANTERN = '#ffc94a';
export const LETTERBOX = '#2b2d5c';

// Every subject choice pairs its color with an icon and a word, never color alone.
export const SUBJECT_THEME = {
  math: { color: '#ff9a3c', icon: 'math', label: 'Math' },
  science: { color: '#3fcfbf', icon: 'science', label: 'Science' },
  art: { color: '#ff8fc0', icon: 'art', label: 'Art' },
  reading: { color: '#6db8ff', icon: 'reading', label: 'Reading' },
  writing: { color: '#b59cff', icon: 'writing', label: 'Writing' },
  community: { color: '#7fd46a', icon: 'community', label: 'Community' },
  music: { color: '#ffd447', icon: 'music', label: 'Music' },
};

const channel = value => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

// WCAG 2.x contrast ratio between two #rrggbb colors.
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
