import { READING_ITEMS, READING_LABELS, normalizeReadingFound, readingStep, readingChoice, readingObjectSVG } from './reading.js';
import { characterSVG } from './characters.js';

export const ENCOUNTER_COLORS = ['#e96163', '#f4bf4f', '#6dbea0', '#559fc7', '#9d7fbd', '#fff1cf'];
export const ENCOUNTER_COLOR_NAMES = { '#e96163':'Coral', '#f4bf4f':'Gold', '#6dbea0':'Mint', '#559fc7':'Blue', '#9d7fbd':'Lavender', '#fff1cf':'Cream' };
const SHAPES = ['star', 'flower', 'leaf', 'circle'];
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
// Preserve the local keyboard workflow even when an action consumes its control.
export function encounterFocusTarget(previous, candidates, complete = false) {
 const enabled = candidates.filter(node => !node.disabled);
 const exact = enabled.find(node => JSON.stringify({...node.dataset}) === JSON.stringify(previous));
 if (exact) return exact;
 if (previous.action === 'find' && enabled.some(node => node.dataset.action === 'reading-next')) return enabled.find(node => node.dataset.action === 'reading-next');
 if (previous.action === 'find' && complete) return enabled.find(node => node.dataset.action === 'publish');
 const nearby = enabled.filter(node => node.dataset.action === previous.action);
 if (nearby.length) return nearby[Math.min(Number(previous.index) || 0, nearby.length - 1)];
 if (previous.action?.startsWith('remove-')) return enabled.find(node => node.dataset.action === `load-${previous.action.slice(7)}`);
 if (complete && ['roll','time','routes'].includes(previous.action)) return enabled.find(node => node.dataset.action === 'publish');
 const following = {time:'more', undo:'stamp',backword:'word',shape:'pick-shape',color:'pick-color',weight:'pick-weight','reading-next':'reading-passage','reading-again':'reading-passage'}[previous.action];
 if (following) return enabled.find(node => node.dataset.action === following);
 return null;
}
// Keep focused controls visible without moving an already-visible scene.
export function encounterScrollTop(scrollTop, viewport, target, margin = 8) {
 if (target.top < viewport.top + margin) return Math.max(0, scrollTop + target.top - viewport.top - margin);
 if (target.bottom > viewport.bottom - margin) return Math.max(0, scrollTop + target.bottom - viewport.bottom + margin);
 return scrollTop;
}
const names={math:'Taro',science:'Momo',art:'Yuki',reading:'Sora',writing:'Fumi',community:'Hana'};
const titles={math:'A cart for the festival',science:'A little shade experiment',art:'Your colors, flying high',reading:'Pack for the festival',writing:'A sign from you',community:'Room for every neighbor'};
const hints={math:'Put cargo on each side. Different groups can weigh the same. Tap a loaded crate to take it off.',science:'Both trays start with equal ice cubes. Shade one tray. Advance time twice to watch 10 model minutes. Compare the ice, then use the shade. Changing trays starts a fresh test.',art:'Choose a stamp and color, then tap any square on the cloth. Tab and Enter work too. There is no wrong design.',reading:'Read the word or story above the objects. Choose the named picture that fits. Read why it belongs in Sora’s bag. Press Next when you are ready.',writing:'Choose words for a welcoming sign. Tap words to add them, or write your own short message.',community:'Put a quiet garden by the upper-left quiet trees. Put a bench beside the path. Signs may sit on the path. Keep benches and gardens off the path. Invite neighbors to try your layout.'};
function stamp(shape,color,rotation=0) { const forms={star:'<path d="m20 2 5 12 13 1-10 9 3 13-11-7-11 7 3-13L2 15l13-1Z"/>',flower:'<path d="M20 12C7-5-4 18 12 20-5 33 18 44 20 28c13 17 24-6 8-8C45 7 22-4 20 12Z"/><circle cx="20" cy="20" r="5" fill="#fff1cf"/>',leaf:'<path d="M5 35C-1 10 17 0 35 5c5 19-6 36-30 30Z"/><path d="m8 32 20-20" stroke="#284b45" fill="none" stroke-width="2"/>',circle:'<circle cx="20" cy="20" r="16"/><circle cx="15" cy="14" r="4" fill="#fff" opacity=".4"/>'};return `<svg viewBox="0 0 40 40" aria-hidden="true" style="transform:rotate(${rotation}deg);fill:${color}">${forms[shape]||forms.circle}</svg>`; }
const button=(action,label,extra='')=>`<button type="button" data-action="${action}" ${extra}>${label}</button>`;


export function mountEncounter(host,{character,chapter=0,grade=1,snapshot=null,settings={},onSave=()=>{},onComplete=()=>{},onClose=()=>{}}) {
 const kind=character.id; let state=normalizeEncounterSnapshot(kind,snapshot,grade,chapter), destroyed=false;
 let selectedWeight=grade>2?2:1, shape='star', color=ENCOUNTER_COLORS[0], rotation=0, item='bench', panel=null, helpOpen=false, readingReview=null, readingFeedback='';
 let dialogue=encounterOpeningDialogue(state);
 const clone=()=>JSON.parse(JSON.stringify(state));
 const save=()=>onSave(clone());
 const say=t=>{dialogue=t;};
 const commit=()=>{save();render();};
 const speak=()=>{if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance){say('Read aloud is unavailable in this browser. All the words are here to read.');render();return;}speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(`${names[kind]}. ${dialogue}. ${kind==='reading'?clue():''} ${helpOpen?hints[kind]:''}`));};
 const clue=()=>{const step=readingStep(state.found,grade,readingReview);return step?`${step.passage}. ${step.question}. ${readingFeedback}`:'A key for the door. An umbrella for rain. A book for storytime.';};
 function mathScene(){const b=cartBalance(state),tilt=Math.max(-9,Math.min(9,(b.right-b.left)*2));return `<div class="enc-cart-area"><div class="enc-load-label">${grade===0?'Count the crates':'Build equal loads'} · ${b.left+b.right} ${grade===0?'crates':'weight units'} aboard</div><div class="enc-cart ${state.rolled&&b.balanced?'enc-rolling':''}" style="--tilt:${tilt}deg"><div class="enc-cargo-bays">${['left','right'].map(side=>`<div class="enc-bay"><div class="enc-crates">${state[side].map((n,i)=>button(`remove-${side}`,`${n}`,`data-index="${i}" aria-label="Remove ${n} unit crate from ${side}" class="enc-crate enc-weight-${n}"`)).join('')}</div>${button(`load-${side}`,`＋ Load ${side}`,state[side].length>=8?'disabled':'')}<b>${side==='left'?b.left:b.right}</b></div>`).join('')}</div><div class="enc-cart-board"></div><i class="enc-wheel enc-wheel-a"></i><i class="enc-wheel enc-wheel-b"></i></div><div class="enc-road"></div><p>${state.rolled&&b.left+b.right>0?(b.balanced?'Steady wheels! Your cart can carry the festival supplies.':`${b.left>b.right?'Left':'Right'} side dips. Move a crate or change the groups.`):'Load the cart, then try a gentle roll.'}</p></div>`;}
 function scienceScene(){return `<div class="enc-lab"><span class="enc-sun">☀</span><p class="enc-model">SIMPLIFIED MODEL · equal starting cubes</p><div class="enc-trays">${['left','right'].map(side=>{const shade=state.canopy===side,remaining=iceRemaining(state.time,shade);return `<div class="enc-tray-wrap">${shade?'<div class="enc-canopy">SHADE</div>':'<div class="enc-sun-label">SUN</div>'}<div class="enc-tray"><div class="enc-water" style="height:${(100-remaining)*.55+8}%"></div><div class="enc-ice" style="width:${25+remaining*.5}%;height:${remaining*.75}%"></div></div><strong>${side==='left'?'Tray A':'Tray B'}</strong><span>${grade<2?(remaining>60?'Lots of ice':remaining>0?'Less ice':'Water'):`${remaining}% ice left`}</span>${button(`shade-${side}`,shade?'✓ Shaded':`Shade tray ${side==='left'?'A':'B'}`,`aria-pressed="${shade}"`)}</div>`;}).join('')}</div><div class="enc-clock">◷ ${state.time} model minutes</div><p class="enc-science-next">${scienceNextStep(state)}</p></div>`;}
 function artScene(){return `<div class="enc-banner-poles"><div class="enc-banner" style="background:${state.background}" aria-label="Your banner"><div class="enc-design-stamps">${state.stamps.map(s=>`<span style="left:${s.x}%;top:${s.y}%">${stamp(s.shape,s.color,s.rotation)}</span>`).join('')}</div><div class="enc-paint-grid">${Array.from({length:30},(_,i)=>button('stamp','',`data-x="${8.33+(i%6)*16.66}" data-y="${10+Math.floor(i/6)*20}" aria-label="Stamp row ${Math.floor(i/6)+1}, column ${i%6+1}"`)).join('')}</div></div><p class="enc-project-caption">${state.stamps.length?`${state.stamps.length} stamps`:'Your banner'}</p></div>`;}
 function readingScene(){
  const step=readingStep(state.found,grade,readingReview);
  const bag=`<div class="enc-reading-bag" aria-label="Sora’s bag, ${state.found.length} of 3 packed"><strong>Bag · ${state.found.length}/3</strong>${READING_ITEMS.map(id=>`<span class="${state.found.includes(id)?'enc-packed':'enc-pack-space'}">${state.found.includes(id)?`${readingObjectSVG(id)}<small>✓ ${READING_LABELS[id]}</small>`:'<span aria-hidden="true">·</span>'}</span>`).join('')}</div>`;
  if(!step)return `<div class="enc-reading-work">${bag}<div class="enc-reading-passage enc-reading-complete" tabindex="-1" data-action="reading-passage"><strong>Ready for the festival!</strong><p>A key for the door. An umbrella for rain. A book for storytime.</p><p>Share Sora’s packed story in the village, or read it again.</p></div></div>`;
  return `<div class="enc-reading-work"><section class="enc-reading-passage" tabindex="-1" data-action="reading-passage" aria-label="Story part ${step.index+1}"><span class="enc-reading-part">${grade===0?'READ THE WORD':'READ THE STORY'} · ${step.index+1} / 3</span><p class="${grade===0?'enc-reading-word':''}">${esc(step.passage)}</p><strong class="enc-reading-question">${esc(step.question)}</strong></section><div class="enc-reading-table" role="group" aria-label="Things to pack">${['key','umbrella','book','cup'].map(id=>{const packed=state.found.includes(id);return button('find',`${readingObjectSVG(id)}<span>${READING_LABELS[id]}</span>${packed?'<small>✓ Packed</small>':''}`,`data-object="${id}" class="enc-reading-object ${packed?'enc-is-packed':''}" aria-label="${READING_LABELS[id]}${packed?', packed':''}" ${packed||readingReview?'disabled':''}`);}).join('')}</div>${readingFeedback?`<p class="enc-reading-feedback ${readingReview?'enc-reading-success':''}" role="status">${readingReview?'✓ ':''}${esc(readingFeedback)}</p>`:''}${bag}</div>`;
 }
 function writingScene(){return `<div class="enc-sign-scene"><div class="enc-paper-sign"><span class="enc-sign-flower">✿</span><div class="enc-sign-words">${esc(state.text)||'<span class="enc-placeholder">Your words go here</span>'}</div><span class="enc-sign-flower">✿</span></div><div class="enc-sign-post"></div></div>`;}
 function communityScene(){const r=routeReport(state);return `<div class="enc-map"><div class="enc-map-quiet">♧ Quiet trees<br><strong>Garden here</strong></div><div class="enc-map-stage">♫<br>stage</div><div class="enc-map-path"></div><span class="enc-map-entry">entrance →</span><div class="enc-map-grid">${Array.from({length:25},(_,i)=>{const x=10+i%5*20,y=10+Math.floor(i/5)*20,p=state.placements.find(p=>p.x===x&&p.y===y);return button('place',p?({bench:'▰',sign:'➜',quiet:'♧'})[p.item]:'',`data-x="${x}" data-y="${y}" class="${p?'enc-placed':''}" aria-label="${communityCellLabel(item,p,Math.floor(i/5)+1,i%5+1)}"`);}).join('')}</div>${state.tried?`<div class="enc-neighbor-route ${r.blocked?'enc-route-blocked':''}"><span>●</span><span>●</span><span>●</span></div>`:''}</div>`;}
 function disclosure(action,label,which){return button(action,`${label} <span aria-hidden="true">${panel===which?'−':'＋'}</span>`,`aria-expanded="${panel===which}" aria-controls="enc-options-${kind}"`);}
 function tools(){
 if(kind==='math')return `${grade>0?`<label class="enc-cargo-select">Cargo <select data-action="pick-weight" aria-label="Cargo weight">${(grade<3?[1,2]:[1,2,3,5]).map(n=>`<option value="${n}" ${n===selectedWeight?'selected':''}>▣ ${n} ${n===1?'unit':'units'}</option>`).join('')}</select></label>`:'<span class="enc-current-tool">▣ 1 crate at a time</span>'}${disclosure('more','More tools','more')}`;
 if(kind==='science')return disclosure('more','More tools','more');
 if(kind==='art')return `${disclosure('pick-shape',`<span class="enc-tool-preview">${stamp(shape,color)}</span> Shape: ${shape[0].toUpperCase()+shape.slice(1)}`,'shape')}${disclosure('pick-color',`<i class="enc-swatch" style="background:${color}"></i> Color: ${ENCOUNTER_COLOR_NAMES[color]}`,'color')}${button('undo','↶ Undo',!state.stamps.length?'disabled':'')}${disclosure('more','More tools','more')}`;
 if(kind==='reading')return encounterReady(state)?button('reading-again','Read again'):'';
 if(kind==='writing'){const words=writingWords();const count=grade===0?2:grade<3?4:2;return `${grade>0?`<label class="enc-edit-label">Your sign <input class="enc-text-input" maxlength="120" value="${esc(state.text)}" aria-label="Write your festival sign"></label>`:''}<div class="enc-word-tiles">${words.slice(0,count).map(w=>button('word',esc(w),`data-word="${esc(w)}"`)).join('')}</div>${button('backword','Remove word',`aria-label="Remove last word" ${!state.text?'disabled':''}`)}${disclosure('more','More words','more')}`;}
 return `<div class="enc-tool-group enc-map-tools">${['bench','sign','quiet'].map(p=>button('item',`${item===p?'✓ ':''}${({bench:'▰ Bench',sign:'➜ Sign',quiet:'♧ Quiet garden'})[p]}`,`data-item="${p}" class="enc-choice-${p}" aria-pressed="${item===p}"`)).join('')}</div>${button('item',`${item==='remove'?'✓ ':''}Remove`,`data-item="remove" aria-pressed="${item==='remove'}"`)}`;
 }
 function writingWords(){return grade===0?['Hello','friend!','Welcome','♡']:grade<3?['Welcome','to','our','festival!','Come','play','with','us.']:['Welcome, neighbors!','Come explore','our summer festival.','Everyone belongs here.','Please keep the path clear.'];}
 function extras(){
 if(!panel)return '';
 let content='',label='More tools';
 if(panel==='shape'){label='Choose a shape';content=SHAPES.map(s=>button('shape',`${stamp(s,color)}<span>${s[0].toUpperCase()+s.slice(1)}</span>${s===shape?'<b aria-hidden="true">✓</b>':''}`,`data-shape="${s}" class="enc-shape-option" aria-pressed="${s===shape}"`)).join('');}
 if(panel==='color'){label='Choose a color';content=ENCOUNTER_COLORS.map(c=>button('color',`<i class="enc-swatch" style="background:${c}"></i><span>${ENCOUNTER_COLOR_NAMES[c]}</span>${c===color?'<b aria-hidden="true">✓</b>':''}`,`data-color="${c}" class="enc-color-option" aria-pressed="${c===color}"`)).join('');}
 if(panel==='more'){
  if(kind==='art')content=button('rotate',`↻ Rotate ${rotation}°`)+button('background',`Color cloth ${ENCOUNTER_COLOR_NAMES[color]}`);
  if(kind==='math')content=button('clear','Unload cart');
  if(kind==='science')content=button('restart','Fresh ice')+(encounterReady(state)?button('time','Advance 5 minutes',state.time>=20?'disabled':''):'');
  if(kind==='writing'){label='More words';const count=grade===0?2:grade<3?4:2;content=writingWords().slice(count).map(w=>button('word',esc(w),`data-word="${esc(w)}"`)).join('')+button('clear','Clear sign','class="enc-secondary"');}
 }
 return `<div id="enc-options-${kind}" class="enc-options" role="group" aria-label="${label}"><strong>${label}</strong><div>${content}</div></div>`;
 }
 function primary(){
 const ready=encounterReady(state);
 if(kind==='reading'&&readingReview&&!ready)return button('reading-next','Next part →','class="enc-primary"');
 if(kind==='reading'&&!ready)return '<span class="enc-reading-instruction">Choose a picture to pack ↑</span>';
 if(!ready&&kind==='math')return button('roll','Try cart →','class="enc-primary"');
 if(!ready&&kind==='science')return state.canopy==='none'?'<span class="enc-reading-instruction">Shade one tray above ↑</span>':button('time','Advance 5 minutes →','class="enc-primary"');
 if(!ready&&kind==='community')return button('routes','Try the square →','class="enc-primary"');
 return button('publish',({math:'Send cart ✓',science:'Use this shade ✓',art:'Hang banner ✓',reading:'Share the story ✓',writing:'Put up sign ✓',community:'Open the square ✓'})[kind],`class="enc-primary enc-publish" ${!ready?'disabled':''}`);
 }
 function render(revealOptions=false,revealReadingFeedback=false){
 if(destroyed)return;
 const previousScroll=host.querySelector('.enc-screen')?.scrollTop||0;
 const focus=host.contains(document.activeElement)?document.activeElement:null;
 const oldData=focus?{...focus.dataset}:null;
 const scene=({math:mathScene,science:scienceScene,art:artScene,reading:readingScene,writing:writingScene,community:communityScene})[kind]();
 host.innerHTML=`<section class="enc-screen enc-${kind} ${settings.largeText?'enc-large':''} ${settings.reducedMotion?'enc-reduced':''}"><header class="enc-header">${button('close','← Village')}<div><span>${esc(character.subject||kind)} · ${grade===0?'Kindergarten':`Grade ${grade}`}</span><h1>${titles[kind]}</h1></div></header><div class="enc-stage"><div class="enc-scenery enc-scenery-a"></div><div class="enc-scenery enc-scenery-b"></div><div class="enc-neighbor"><div class="enc-nameplate">${names[kind]}</div>${characterSVG(kind,{size:112,pose:'idle',facing:'front'})}</div><div class="enc-project" tabindex="-1" aria-label="${titles[kind]}">${scene}</div><div class="enc-player">${characterSVG('player',{size:132,pose:'idle',facing:'back'})}</div><span class="enc-player-name">YOU</span></div><div class="enc-console"><div class="enc-dialogue"><strong>${names[kind]}</strong><p aria-live="polite">${esc(dialogue)}</p><div class="enc-support">${button('hint','? Help',`aria-expanded="${helpOpen}" aria-controls="enc-help-${kind}"`)}${button('read','♪ Hear')}</div></div><div class="enc-commands"><div class="enc-main-tools">${tools()}</div><div class="enc-primary-slot">${primary()}</div></div>${extras()}${helpOpen?`<div class="enc-help" id="enc-help-${kind}"><strong>Try this</strong><ol>${hints[kind].split(/(?<=[.!?])\s+/).map(line=>`<li>${esc(line)}</li>`).join('')}</ol></div>`:''}</div></section>`;
 const screen=host.querySelector('.enc-screen');
 screen.scrollTop=previousScroll;
 if(oldData){
  const candidates=[...host.querySelectorAll('[data-action]')];
  const selectedOption=revealOptions?(host.querySelector('.enc-options button[aria-pressed="true"]')||host.querySelector('.enc-options button:not(:disabled)')):null;
  const target=selectedOption||encounterFocusTarget(oldData,candidates,encounterReady(state))||host.querySelector('.enc-project');
  target.focus({preventScroll:true});
  screen.scrollTop=encounterScrollTop(screen.scrollTop,screen.getBoundingClientRect(),target.getBoundingClientRect());
 }
 if(revealReadingFeedback){
  const feedback=host.querySelector('.enc-reading-feedback');
  if(feedback)screen.scrollTop=encounterScrollTop(screen.scrollTop,screen.getBoundingClientRect(),feedback.getBoundingClientRect());
 }
 }
 function click(event){const b=event.target.closest('[data-action]');if(!b||b.disabled||b.tagName==='SELECT'||b.dataset.action==='reading-passage')return;const a=b.dataset.action;
 if(a==='close'){save();onClose();return;}if(a==='publish'){if(encounterReady(state)){save();onComplete(clone());}return;}if(a==='hint'){helpOpen=!helpOpen;render();return;}if(a==='read'){speak();return;}
 if(['pick-shape','pick-color','more'].includes(a)){const next=({'pick-shape':'shape','pick-color':'color',more:'more'})[a];panel=panel===next?null:next;render(panel!==null);return;}
 if(a==='weight'){selectedWeight=Number(b.dataset.weight);render();return;}
 if(a.startsWith('load-')){const side=a.slice(5);if(state[side].length<8)state[side].push(selectedWeight);state.rolled=false;say('Make the two loads equal, then try the cart.');}
 if(a.startsWith('remove-')){state[a.slice(7)].splice(Number(b.dataset.index),1);state.rolled=false;say('The load changed. Try the cart again.');}
 if(a==='roll'){state.rolled=true;say(!state.left.length&&!state.right.length?'Let’s load some supplies first, then try the wheels.':cartBalance(state).balanced?'A smooth roll! Your cart is ready.':`Oop, a wobble! The ${cartBalance(state).left>cartBalance(state).right?'left':'right'} load is heavier. Let’s adjust it.`);}
 if(a.startsWith('shade-')){const next=shadeScienceTray(state,a.slice(6));if(next===state){say(scienceNextStep(state));render();return;}state=next;say('Fresh equal cubes. Watch 10 model minutes with one tray shaded.');}
 if(a==='time'){state.time=Math.min(20,state.time+5);say(state.canopy==='none'?'Both trays are sunny. Their ice melts at the same rate.':'The shaded ice melts more slowly in this model.');}
 if(a==='restart'){state.time=0;say('Equal cubes again. Try moving the canopy to the other tray.');}
 if(a==='shape'){shape=b.dataset.shape;panel=null;render();return;}if(a==='color'){color=b.dataset.color;panel=null;render();return;}if(a==='rotate'){rotation=(rotation+45)%360;render();return;}
 if(a==='background')state.background=color;
 if(a==='stamp'){if(state.stamps.length<30){state.stamps.push({shape,color,rotation,x:Number(b.dataset.x),y:Number(b.dataset.y)});say('Keep stamping, or hang your banner.');}else say('The cloth has 30 stamps. Undo a mark to make room, or hang your banner.');}
 if(a==='undo')state.stamps.pop();
 if(a==='reading-next'){readingReview=null;readingFeedback='';say('Read the next part, then choose what to pack.');render();return;}
 if(a==='reading-again'){state.found=[];readingReview=null;readingFeedback='';say('Let’s read from the start and pack again.');commit();return;}
 if(a==='find'){
  if(readingReview)return;
  const result=readingChoice(state.found,b.dataset.object,grade);
  state.found=result.found;readingReview=result.reviewId;readingFeedback=result.message;
  say(result.accepted?(encounterReady(state)?'All three are packed. Your story is ready to share.':'Packed! Read why, then choose Next part.'):'Read the story again. You can try another picture.');
  if(!result.accepted){save();render(false,true);return;}
 }
 if(a==='word'){state.text=(state.text?state.text+' ':'')+b.dataset.word;state.text=state.text.slice(0,120);say('Your sign is ready. Add words or put it up.');}
 if(a==='backword')state.text=state.text.trim().split(/\s+/).slice(0,-1).join(' ');
 if(a==='clear'){if(kind==='writing')state.text='';if(kind==='math'){state.left=[];state.right=[];state.rolled=false;say('An empty cart, ready for a new idea. Add some cargo to both sides.');}}
 if(a==='item'){item=b.dataset.item;if(item==='sign')say('Signs may sit on the path. Benches and gardens go beside it.');if(item==='quiet')say('Place the quiet garden inside the marked quiet-tree corner.');render();return;}
 if(a==='place'){
  const result=placeCommunityItem(state,item,Number(b.dataset.x),Number(b.dataset.y));
  if(result.status==='full'){say('All 12 places are used. Remove an item or replace one already on the map.');render();return;}
  if(result.status==='unchanged'){say(item==='remove'?'There is nothing here to remove.':'That item is already here. Choose another place.');render();return;}
  state=result.state;say('The square changed. Invite neighbors to try it.');
 }
 if(a==='routes'){state.tried=true;const r=routeReport(state);say(r.blocked?'A neighbor is blocked. Move that object off the path.':!r.quiet?'Add a quiet garden by the upper-left trees.':!r.rest?'A tired neighbor needs a bench off the path.':'A clear path, a bench, and a quiet spot. Ready!' );}
 commit();
 }
 function change(e){if(e.target.matches('[data-action="pick-weight"]')){selectedWeight=Number(e.target.value);}}
 function input(e){if(!e.target.matches('.enc-text-input'))return;state.text=e.target.value.slice(0,120);const words=host.querySelector('.enc-sign-words');words.textContent=state.text||'Your words go here';const controls=writingControlAvailability(state.text);host.querySelector('[data-action="publish"]').disabled=!controls.canPublish;host.querySelector('[data-action="backword"]').disabled=!controls.canRemove;save();}
 host.addEventListener('click',click);host.addEventListener('input',input);host.addEventListener('change',change);render();
 return {getSnapshot:clone,destroy(){destroyed=true;host.removeEventListener('click',click);host.removeEventListener('input',input);host.removeEventListener('change',change);globalThis.speechSynthesis?.cancel();host.replaceChildren();}};
}
