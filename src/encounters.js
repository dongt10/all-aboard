import { READING_ITEMS, normalizeReadingFound } from './reading.js';

export const ENCOUNTER_COLORS = ['#e96163', '#f4bf4f', '#6dbea0', '#559fc7', '#9d7fbd', '#fff1cf'];
export const ENCOUNTER_COLOR_NAMES = { '#e96163':'Coral', '#f4bf4f':'Gold', '#6dbea0':'Mint', '#559fc7':'Blue', '#9d7fbd':'Lavender', '#fff1cf':'Cream' };
const SHAPES = ['star', 'flower', 'leaf', 'circle'];
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));
const sum = a => a.reduce((x,y) => x+y,0);
export function normalizeEncounterSnapshot(kind, input = {}, grade = 1, chapter = 0) {
  const s = input && typeof input === 'object' && input.kind === kind ? input : {};
  const base = {kind, grade:clamp(grade,0,5), chapter:clamp(chapter,0,99)};
  if (kind === 'math') return {...base, left:Array.isArray(s.left)?s.left.filter(n=>[1,2,3,5].includes(n)).slice(0,8):[], right:Array.isArray(s.right)?s.right.filter(n=>[1,2,3,5].includes(n)).slice(0,8):[], rolled:s.rolled===true};
  if (kind === 'science') return {...base, canopy:['left','right'].includes(s.canopy)?s.canopy:'none',time:clamp(s.time,0,20)};
  if (kind === 'art') return {...base,background:ENCOUNTER_COLORS.includes(s.background)?s.background:'#fff1cf',stamps:(Array.isArray(s.stamps)?s.stamps:[]).filter(x=>x&&SHAPES.includes(x.shape)&&ENCOUNTER_COLORS.includes(x.color)).slice(0,30).map(x=>({shape:x.shape,color:x.color,x:clamp(x.x,5,95),y:clamp(x.y,5,95),rotation:clamp(x.rotation,0,359)}))};
  if (kind === 'reading') return {...base,found:normalizeReadingFound(s.found)};
  if (kind === 'writing') return {...base,text:typeof s.text==='string'?s.text.slice(0,120):''};
  return {...base,placements:(Array.isArray(s.placements)?s.placements:[]).filter(x=>x&&['bench','sign','quiet'].includes(x.item)).slice(0,12).map(x=>({item:x.item,x:clamp(x.x,10,90),y:clamp(x.y,10,90)})),tried:s.tried===true};
}
export function cartBalance(s) { const left=sum(s.left),right=sum(s.right); return {left,right,balanced:left>0&&left===right}; }
export function iceRemaining(time, shaded) { return Math.max(0,100-time*(shaded?2:5)); }
export function routeReport(s) { return {blocked:s.placements.some(p=>p.item!=='sign'&&Math.abs(p.y-50)<16), quiet:s.placements.some(p=>p.item==='quiet'&&p.x<45&&p.y<35), rest:s.placements.some(p=>p.item==='bench')}; }
export function encounterReady(s) {
  if(s.kind==='math')return s.rolled&&cartBalance(s).balanced;
  if(s.kind==='science')return s.time>=10&&s.canopy!=='none';
  if(s.kind==='art')return s.stamps.length>0;
  if(s.kind==='reading')return normalizeReadingFound(s.found).length===READING_ITEMS.length;
  if(s.kind==='writing')return s.text.trim().length>0;
  const r=routeReport(s); return s.tried&&!r.blocked&&r.quiet&&r.rest;
}
export function shadeScienceTray(state, side) {
 return state.canopy===side ? state : {...state,canopy:side,time:0};
}
export function scienceNextStep(state) {
 if(state.canopy==='none')return state.time>0?'Both trays are in sun. Shade one tray to start a fresh comparison.':'Shade tray A or B to begin the comparison.';
 if(state.time<10)return `Advance ${10-state.time} more model minutes to compare the ice.`;
 return 'Comparison ready. Use this shade, or explore more with More tools.';
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
export function encounterOpeningDialogue(state) {
 if(encounterReady(state)&&state.kind==='math')return 'Your balanced cart is ready to send. You can still change the cargo.';
 if(encounterReady(state)&&state.kind==='science')return 'Your shade test is ready. Use this canopy, or try fresh ice.';
 if(encounterReady(state)&&state.kind==='reading')return 'Your story bag is ready. Share it, or read again.';
 return {math:state.grade===0?'Put the same number of crates on both sides.':'Make both sides of my cart weigh the same.',science:'Start with equal cubes. Shade one tray, then watch 10 model minutes.',art:'Tap the cloth to add a stamp.',reading:'Help me pack three things for the festival.',writing:'Choose words for your welcome sign.',community:'Put a garden by the quiet trees and a bench off the path.'}[state.kind];
}
export function writingControlAvailability(text) {
 return {canPublish:text.trim().length>0,canRemove:text.length>0};
}
