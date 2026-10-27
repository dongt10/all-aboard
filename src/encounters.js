import { GRADES_PIZZA, normalizePizza, pizzaReady, pizzaOpening } from './pizza.js';
import { GRADES_CHAIN, normalizeChain, chainReady, chainOpening } from './chain.js';
import { GRADES_HELPDAY, normalizeHelpday, helpdayReady, helpdayOpening } from './helpday.js';
import { GRADES_TALES, normalizeTales, talesReady, talesOpening } from './tales.js';
import { GRADES_ROWS, normalizeRows, rowsReady, rowsOpening } from './rows.js';
import { GRADES_BEANS, normalizeBeans, beansReady, beansOpening } from './beans.js';
import { GRADES_COMPASS, normalizeCompass, compassReady, compassOpening } from './compass.js';
import { GRADES_RIBBON, normalizeRibbon, ribbonReady, ribbonOpening } from './ribbon.js';
import { readingItems, normalizeReadingFound } from './reading.js';

export const ACTIVITY_GRADES = {
  __proto__: null,
  pizza: GRADES_PIZZA, chain: GRADES_CHAIN, helpday: GRADES_HELPDAY, tales: GRADES_TALES,
  rows: GRADES_ROWS, beans: GRADES_BEANS, compass: GRADES_COMPASS, ribbon: GRADES_RIBBON,
};

export const ENCOUNTER_COLORS = ['#e96163', '#f4bf4f', '#6dbea0', '#559fc7', '#9d7fbd', '#fff1cf'];
export const ENCOUNTER_COLOR_NAMES = { '#e96163':'Coral', '#f4bf4f':'Gold', '#6dbea0':'Mint', '#559fc7':'Blue', '#9d7fbd':'Lavender', '#fff1cf':'Cream' };
const SHAPES = ['star', 'flower', 'leaf', 'circle'];
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));
const sum = a => a.reduce((x,y) => x+y,0);
// Request 1 is the original activity, including every snapshot saved before requests existed.
export const normalizeRequest = (value, count = 2) => Number.isInteger(value) ? Math.max(1, Math.min(count, value)) : 1;
export function encounterRequest(kind, request) {
  return normalizeRequest(request, kind === 'math' ? 3 : 2);
}
// Grades come in three bands tonight: 0 is Kindergarten, 1 covers grades 1–2, 3 covers grades 3–5.
// A snapshot without a grade (old tests, old saves) is treated as Kindergarten, like cleanCreation's chapter-0
// grade 0 and guide.js learnedText.
export function gradeBand(grade) {
  if (grade === null || grade === undefined) return 0;
  const g = Number(grade);
  if (!Number.isFinite(g)) return 0;
  return g <= 0 ? 0 : g <= 2 ? 1 : 3;
}
// Saved maps use the same five centers as the field. Keep the first item in each cell.
export function normalizeCommunityMap(input) {
  const original = Array.isArray(input.placements) ? input.placements : [];
  const snap = n => 10 + 20 * Math.round(((Number.isFinite(n) ? clamp(n, 10, 90) : 10) - 10) / 20);
  const occupied = new Set();
  const placements = original.filter(p => p && !Array.isArray(p) && ['bench', 'sign', 'quiet'].includes(p.item))
    .map(p => ({ item: p.item, x: snap(p.x), y: snap(p.y) }))
    .filter(p => {
      const cell = `${p.x},${p.y}`;
      if (occupied.has(cell)) return false;
      occupied.add(cell);
      return true;
    }).slice(0, 12);
  const changed = placements.length !== original.length || placements.some((p, i) =>
    p.item !== original[i]?.item || p.x !== original[i]?.x || p.y !== original[i]?.y);
  return { placements, tried: input.tried === true && !changed };
}
export function normalizeEncounterSnapshot(kind, input = {}, grade = 1, chapter = 0) {
  let s = input && typeof input === 'object' && input.kind === kind ? input : {};
  const base = {kind, grade:clamp(grade,0,5), chapter:clamp(chapter,0,99)};
  if (Object.hasOwn(s, 'activity') && (chapter !== 1 || !(ACTIVITY_GRADES[s.activity] ?? []).includes(grade))) s = {};
  if (kind === 'math' && s.activity === 'pizza') return normalizePizza(s, base.grade, base.chapter);
  if (kind === 'science' && s.activity === 'chain') return normalizeChain(s, base.grade, base.chapter);
  if (kind === 'community' && s.activity === 'helpday') return normalizeHelpday(s, base.grade, base.chapter);
  if (kind === 'reading' && s.activity === 'tales') return normalizeTales(s, base.grade, base.chapter);
  if (kind === 'math' && s.activity === 'rows') return normalizeRows(s, base.grade, base.chapter);
  if (kind === 'science' && s.activity === 'beans') return normalizeBeans(s, base.grade, base.chapter);
  if (kind === 'community' && s.activity === 'compass') return normalizeCompass(s, base.grade, base.chapter);
  if (kind === 'reading' && s.activity === 'ribbon') return normalizeRibbon(s, base.grade, base.chapter);

  base.request = encounterRequest(kind, s.request);

  if (kind === 'math') return {...base, left:Array.isArray(s.left)?s.left.filter(n=>[1,2,3,5].includes(n)).slice(0,8):[], right:Array.isArray(s.right)?s.right.filter(n=>[1,2,3,5].includes(n)).slice(0,8):[], rolled:s.rolled===true};
  if (kind === 'science') return {...base, canopy:['left','right'].includes(s.canopy)?s.canopy:'none',time:clamp(s.time,0,20)};
  if (kind === 'art') return {...base,background:ENCOUNTER_COLORS.includes(s.background)?s.background:'#fff1cf',stamps:(Array.isArray(s.stamps)?s.stamps:[]).filter(x=>x&&SHAPES.includes(x.shape)&&ENCOUNTER_COLORS.includes(x.color)).slice(0,30).map(x=>({shape:x.shape,color:x.color,x:clamp(x.x,5,95),y:clamp(x.y,5,95),rotation:clamp(x.rotation,0,359),flipped:x.flipped===true}))};
  if (kind === 'reading') return {...base,found:normalizeReadingFound(s.found, base.request)};
  if (kind === 'writing') return {...base,...normalizeSign(s, base.grade)};
  return {...base,...normalizeCommunityMap(s)};
}

import { bannerReady, bannerOpening } from './banner-rules.js';
import { normalizeSign, signReady, signOpening } from './sign-rules.js';
export { signWords, reconcileTiles, normalizeSign } from './sign-rules.js';
// Taro's cart starts with crates on the left so the child has something to match. The right side is always empty.
export function startingCargo(grade, request = 1) {
  const band = gradeBand(grade);
  const loads = band === 0 ? [[1, 1], [1, 1, 1], [1, 1, 1, 1]]
    : band === 1 ? [[2, 1], [2, 2], [2, 2, 1]] : [[5, 3], [5, 5], [5, 3, 3]];
  return { left: [...loads[normalizeRequest(request, 3) - 1]], right: [] };
}
export function cartBalance(s) { const left=sum(s.left),right=sum(s.right); return {left,right,balanced:left>0&&left===right}; }
export function iceRemaining(time, shaded) { return Math.max(0,100-time*(shaded?2:5)); }
// Ice in kid words, at every grade. Grades 2–5 may add the number beside these.
export function iceWords(remaining) { return remaining >= 70 ? 'Lots of ice' : remaining > 0 ? 'Less ice' : 'Water'; }
// After 10 minutes, Momo says whether the child's first Shade pick (the prediction) was the tray that kept more ice.
// The shaded tray always keeps more ice in this model, so the guess is right when it matches the shaded tray.
// With no guess this run (the guess is never saved, so a reloaded draft has none) it returns '' and the caller skips it.
export function predictionLine(predictedSide, s) {
  if (predictedSide !== 'left' && predictedSide !== 'right') return '';
  if (predictedSide === s?.canopy) return 'You guessed right! The shaded tray kept more ice.';
  return 'Surprise! The shaded tray kept more ice. Shade keeps the sun off.';
}
// Hana's map: the stage is drawn in the top-right corner, over the cell at x 90, y 10.
// A sign counts as "next to the stage" in that cell or in either cell touching it.
export const STAGE_CELLS = [{ x: 90, y: 10 }, { x: 70, y: 10 }, { x: 90, y: 30 }];
const onPath = p => Math.abs(p.y - 50) < 16;
const atStage = p => STAGE_CELLS.some(c => c.x === p.x && c.y === p.y);
export function routeReport(s) {
  const placements = Array.isArray(s?.placements) ? s.placements : [];
  return {
    blocked: placements.some(p => p.item !== 'sign' && onPath(p)),
    quiet: placements.some(p => p.item === 'quiet' && p.x < 45 && p.y < 35),
    rest: placements.some(p => p.item === 'bench'),
    signed: placements.some(p => p.item === 'sign' && atStage(p)),
  };
}
export function communityBlockedLine(s) {
  const blocker = (s?.placements ?? []).find(p => p.item !== 'sign' && onPath(p));
  if (!blocker) return null;
  return blocker.item === 'quiet'
    ? 'Choose Remove, then tap the garden. Put a garden by the quiet trees.'
    : 'Choose Remove, then tap the bench. Put a bench off the path.';
}
// The square's checklist for this snapshot's grade, in order. K: bench. Grades 1–2 add the garden. Grades 3–5 add the sign.
// A bench or garden on the path blocks the walk, so the first step stays undone and says to move it until the path is clear.
export function squareSteps(s) {
  const r = routeReport(s), band = gradeBand(s?.grade);
  const steps = [r.blocked
    ? { id: 'rest', done: false, text: communityBlockedLine(s) }
    : { id: 'rest', done: r.rest, text: 'Put a bench off the path.' }];
  if (band >= 1) steps.push({ id: 'quiet', done: r.quiet, text: 'Put a garden by the quiet trees.' });
  if (band >= 3) steps.push({ id: 'signed', done: r.signed, text: 'Put a sign next to the stage.' });
  if (normalizeRequest(s?.request) === 2) {
    // K makes a new useful place: a sign by the stage. Older children plan the garden first.
    if (band === 0) steps.splice(0, steps.length, { id: 'signed', done: r.signed && !r.blocked, text: r.blocked ? communityBlockedLine(s) : 'Put a sign next to the stage.' });
    else steps.unshift(...steps.splice(1, 1));
  }
  steps.push({ id: 'tried', done: s?.tried === true, text: 'Choose Try it to walk the square.' });
  return steps;
}
export function encounterReady(s) {
  if (s.kind === 'math' && s.activity === 'pizza') return pizzaReady(s);
  if (s.kind === 'science' && s.activity === 'chain') return chainReady(s);
  if (s.kind === 'community' && s.activity === 'helpday') return helpdayReady(s);
  if (s.kind === 'reading' && s.activity === 'tales') return talesReady(s);
  if (s.kind === 'math' && s.activity === 'rows') return rowsReady(s);
  if (s.kind === 'science' && s.activity === 'beans') return beansReady(s);
  if (s.kind === 'community' && s.activity === 'compass') return compassReady(s);
  if (s.kind === 'reading' && s.activity === 'ribbon') return ribbonReady(s);

  if(s.kind==='math')return s.rolled&&cartBalance(s).balanced;
  if(s.kind==='science')return s.time>=10&&s.canopy!=='none';
  if (s.kind === 'art') return bannerReady(s);
  if(s.kind==='reading')return normalizeReadingFound(s.found, s.request).length===readingItems(s.request).length;
  if (s.kind === 'writing') return signReady(s);
  return squareSteps(s).every(step => step.done);
}
export function shadeScienceTray(state, side) {
 return state.canopy===side ? state : {...state,canopy:side,time:0};
}
export function scienceNextStep(state) {
 if(state.canopy==='none')return 'Shade tray A or B to begin.';
 if(state.time<10){const n=10-state.time;return `Wait ${n} more ${n===1?'minute':'minutes'}. Then look at both trays.`;}
 return 'Ready! Choose Serve ice.';
}
export function communityCellLabel(tool, placed, row, column) {
 const label=item=>item==='quiet'?'quiet garden':item;
 const action=tool==='remove'
  ? (placed?`Remove ${label(placed.item)}`:'Empty space, no item to remove')
  : (placed?`Replace ${label(placed.item)} with ${label(tool)}`:`Place ${label(tool)}`);
 return `${action}, row ${row}, column ${column}`;
}
export function placeCommunityItem(state, item, x, y) {
 const previous=state.placements.find(p=>p.x===x&&p.y===y);
 if((item==='remove'&&!previous)||previous?.item===item)return {state,status:'unchanged'};
 if(item!=='remove'&&!previous&&state.placements.length>=12)return {state,status:'full'};
 const placements=state.placements.filter(p=>p.x!==x||p.y!==y);
 if(item!=='remove')placements.push({item,x,y});
 return {state:{...state,placements,tried:false},status:item==='remove'?'removed':'placed'};
}
// Every sentence here is 56 characters or fewer so a page never breaks mid-sentence with Bigger words on.
// The math opening reads the draft's real left side (a saved draft or a Load left press may differ from the pre-load).
// The fixed band text is only the fallback for an empty left side.
const MATH_OPENING = {
 0:'Taro put two crates on the left. Put the same on the right!',
 1:'The left side weighs 3. Load the right side to match.',
 3:'The left side weighs 8. Find crates that add up to 8.',
};
const COUNT_WORDS = ['zero','one','two','three','four','five','six','seven','eight'];
function mathOpening(state, band) {
 const left = Array.isArray(state.left) ? state.left : [];
 if (left.length === 0) return MATH_OPENING[band];
 if (band === 0) return `Taro put ${COUNT_WORDS[left.length] ?? left.length} ${left.length === 1 ? 'crate' : 'crates'} on the left. Put the same on the right!`;
 const w = cartBalance({ left, right: [] }).left;
 return band === 1 ? `The left side weighs ${w}. Load the right side to match.` : `The left side weighs ${w}. Find crates that add up to ${w}.`;
}
const SCIENCE_OPENING = {
 0:'Shade one tray. Then wait and look!',
 1:'Shade one tray. Then wait and look!',
 3:'Which tray will keep more ice? Shade your guess.',
};
const COMMUNITY_OPENING = {
 0:'Put a bench off the path for a tired neighbor.',
 1:'Put a bench off the path. Put a garden by the quiet trees.',
 3:'Add a bench and a garden by the quiet trees. Then put a sign by the stage.',
};
export function encounterOpeningDialogue(state) {
  if (state.kind === 'math' && state.activity === 'pizza') return pizzaOpening(state);
  if (state.kind === 'science' && state.activity === 'chain') return chainOpening(state);
  if (state.kind === 'community' && state.activity === 'helpday') return helpdayOpening(state);
  if (state.kind === 'reading' && state.activity === 'tales') return talesOpening(state);
  if (state.kind === 'math' && state.activity === 'rows') return rowsOpening(state);
  if (state.kind === 'science' && state.activity === 'beans') return beansOpening(state);
  if (state.kind === 'community' && state.activity === 'compass') return compassOpening(state);
  if (state.kind === 'reading' && state.activity === 'ribbon') return ribbonOpening(state);

 const band=gradeBand(state.grade);
 if(encounterReady(state)&&state.kind==='math')return 'Your balanced cart is ready. Send cart, or Try another.';
 if(encounterReady(state)&&state.kind==='science')return 'Your ice test is ready. Serve ice, or Try another.';
 if(encounterReady(state)&&state.kind==='reading')return 'Your story bag is packed. Share it, or Try another.';
 if(encounterReady(state)&&state.kind==='community')return 'Your square plan is ready. Open square, or Try another.';
 if(state.kind==='community'&&normalizeRequest(state.request)===2)return band===0
   ? 'Help neighbors find the stage. Put a sign next to it.'
   : band >= 3 ? 'Start with a garden by the trees. Add a bench, then a sign by the stage.'
   : 'Plan a quiet spot first. Add a garden by the trees, then a bench off the path.';
 if(state.kind==='science'&&normalizeRequest(state.request)===2)return state.canopy==='right'&&state.time===0
   ? 'Tray B has shade now. Wait and see which tray keeps more ice.' : scienceNextStep(state);
 return {math:mathOpening(state,band),science:SCIENCE_OPENING[band],art:bannerOpening(state),reading:'Help me pack three things for the festival.',writing:signOpening(state),community:COMMUNITY_OPENING[band]}[state.kind];
}
