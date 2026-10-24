
const svg = (body, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 36" fill="none" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
const rect = (x,y,w,h,c) => `<path d="M${x} ${y}h${w}v${h}H${x}z" fill="${c}"/>`;

export function avatarMarkup(id, {size = 48} = {}) {
  size = Number.isFinite(Number(size)) ? Math.max(16, Math.min(512, Number(size))) : 48;
  const styles = {
    math:['#9c673f','#deb58a','#ce7045'], science:['#f9ebcd','#ffcfb6','#8fbfb1'],
    art:['#f4dfbb','#ffebd0','#a48bc7'], reading:['#946245','#e6c79e','#658cbd'],
    writing:['#dd8a43','#fff0ce','#4e9b91'], community:['#b88758','#ead3a6','#7f9a60'],
    music:['#9d7953','#f6e2b0','#e8b64c'], player:['#b77a55','#e6b68e','#f6ebcd'],
    pip:['#f9f0d8','#fff7df','#689fc0'], nori:['#83a66a','#bdd19b','#e6ad80'],
  };
  const [fur,face,shirt] = styles[id] || styles.player;
  let ears = rect(7,6,5,7,fur) + rect(20,6,5,7,fur);
  if(id === 'science') ears = rect(8,0,5,14,fur)+rect(19,0,5,14,fur)+rect(9,2,2,9,'#eeb69f')+rect(20,2,2,9,'#eeb69f');
  if(id === 'writing' || id === 'art') ears = `<path d="M6 13V3l9 9M18 12l8-9v12" fill="${fur}"/>`;
  if(id === 'community') ears += rect(9,1,2,8,'#715537')+rect(6,2,5,2,'#715537')+rect(21,1,2,8,'#715537')+rect(21,2,5,2,'#715537');
  if(['player','pip','nori','music'].includes(id)) ears = '';
  let extra = '';
  if(id==='math') extra=rect(7,14,7,5,'#5e4234')+rect(18,14,7,5,'#5e4234');
  if(id==='art') extra=rect(6,9,7,6,'#d18a49')+rect(21,11,5,6,'#705746');
  if(id==='player') extra=rect(7,7,19,5,'#614936')+rect(6,11,4,6,'#614936')+rect(23,11,3,6,'#614936');
  if(id==='pip') extra=rect(8,6,16,4,'#6598ba')+rect(18,9,10,3,'#477b9b')+rect(12,19,9,3,'#e6a444');
  if(id==='music') extra=rect(13,18,6,4,'#df9a3c');
  let body = rect(9,31,5,4,'#694e3b')+rect(19,31,5,4,'#694e3b')+rect(8,23,17,10,shirt)+rect(5,25,4,6,fur)+rect(25,25,3,6,fur);
  if(id==='player') body=rect(5,23,6,9,'#c46950')+body+rect(9,30,15,3,'#498c83');
  if(id==='reading') body+=rect(10,25,13,6,'#f4e8c9')+rect(16,25,1,6,'#bfa885');
  if(id==='math') body+=rect(11,27,10,3,'#f1ce7d');
  if(id==='nori') body=rect(6,22,21,11,'#8c7150')+body+rect(11,25,11,6,'#a17f55');
  return svg(`<ellipse cx="16" cy="34" rx="12" ry="2" fill="#3d655b" opacity=".17"/>${body}${ears}${rect(6,11,21,11,fur)}${rect(9,19,15,5,face)}${extra}${rect(10,15,2,3,'#493d35')}${rect(21,15,2,3,'#493d35')}${rect(15,20,3,2,'#855745')}`,size);
}

function building(id) {
  const large = ['math','art','science'].includes(id);
  const roof = {math:'#bc755b', art:'#a18aaf', science:'#759e8a', reading:'#7f96a0',writing:'#c3896d', community:'#93a674', music:'#c5a45e'}[id] || '#93a674';
  let body = large
    ? `<path d="M21 60h118v57H21z" fill="#f7e8bf"/><path d="M13 62 35 20h89l25 42z" fill="${roof}"/><path d="M21 49h119v5H21M30 35h103v4H30" fill="#fff" opacity=".16"/><path d="M17 61h127v7H17" fill="#694e42"/><path d="M26 71h7v46h-7m98-46h7v46h-7" fill="#a07856"/><path d="M63 78h34v39H63" fill="#8a6750"/><path d="M69 84h22v33H69" fill="#503e35"/><path d="M38 76h18v21H38m67-21h18v21h-18" fill="#9fc2bb"/><path d="M46 76h3v21h-3m67-21h3v21h-3" fill="#efe0b7"/><path d="M17 117h127v7H17" fill="#ae9874"/>`
    : `<path d="M30 53h7v65h-7m93-65h7v65h-7" fill="#997855"/><path d="M20 52 38 26h84l18 26v14H20z" fill="${roof}"/><path d="M38 26h17L44 66H25zm34 0h16v40H60zm34 0h16l13 40h-25" fill="#f8edcf" opacity=".85"/><path d="M29 92h102v27H29" fill="#c39d6e"/><path d="M27 91h106v7H27" fill="#886b4c"/><path d="M37 104h86v4H37" fill="#e4c599"/>`;
  const props={math:'<path d="M10 104h25v18H10" fill="#caa16c"/><path d="M14 100h5v17h-5m8-20h5v20h-5" fill="#f3d490"/>', science:'<path d="M113 102h30v13h-30" fill="#9eb79b"/><path d="M117 97h8v7h-8m12-3h8v9h-8" fill="#efae75"/>',art:'<path d="M8 87h20v31H8" fill="#f0d7bc"/><path d="m10 94 12 14-12 4" fill="#ac97c6"/><path d="M132 98h17v21h-17" fill="#7b9c9a"/>',reading:'<path d="M44 79h19v12H44m29-18h18v18H73m27-13h15v13h-15" fill="#ede2ba"/><path d="M48 78h4v13h-4m30-20h5v20h-5" fill="#b86b56"/>',writing:'<path d="M48 74h28v17H48" fill="#fff2d0"/><path d="m49 75 13 10 13-10" stroke="#b78863" stroke-width="2"/><path d="m98 88 9-25 4 2-9 25" fill="#f1ca64"/>',community:'<path d="M53 67h54v29H53" fill="#f1dfad"/><path d="m57 87 13-13 10 12 10-14 13 15" stroke="#8ea37b" stroke-width="4"/>',music:'<path d="M56 74h43v20H56" fill="#d8986b"/><path d="M54 73h47v6H54m0 12h47v5H54" fill="#f9e6b7"/><path d="m112 83 2-18 10-3v18" stroke="#745b42" stroke-width="3"/>'}[id] || '';
  return `<svg class="village-building" viewBox="0 0 160 132" aria-hidden="true"> <ellipse cx="80" cy="121" rx="73" ry="8" fill="#57794b" opacity=".2"/>${body}${props}</svg>`;
}

const tree = (x,y,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="0" cy="27" rx="22" ry="7" fill="#557c56" opacity=".17"/><path d="M-4 2h8v26H-4" fill="#a58258"/><path d="M-24-2v-18h7v-13h12v-7h15v7h12v13h6v20H15v9H-14V-2z" fill="#678e64"/><path d="M-21-20h8v-10H0v-6h10v7h10v10h-9v7H-11v-8z" fill="#87aa73"/></g>`;
function scenery(){
 return `<svg class="village-terrain" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="village-grass" width="41" height="37" patternUnits="userSpaceOnUse"><path d="m8 17 2-4 2 4m19 12 2-4 2 4" stroke="#82a771" stroke-width="1.7" fill="none" opacity=".42"/></pattern><pattern id="village-water" width="60" height="25" patternUnits="userSpaceOnUse"><path d="M5 14h18m12-8h15" stroke="#c3e0d2" stroke-width="2" opacity=".55"/></pattern></defs><path fill="#a9c58a" d="M0 0h1000v650H0z"/><path fill="url(#village-grass)" d="M0 0h1000v650H0z"/><path d="M0 592Q120 561 245 586T500 589T750 582T1000 585V650H0" fill="#e4d9ac"/><path d="M0 612Q110 581 245 606T500 609T750 602T1000 605V650H0" fill="#88b7ae"/><path d="M0 612Q110 581 245 606T500 609T750 602T1000 605V650H0" fill="url(#village-water)"/><g fill="none" stroke="#ecdfb4" stroke-linecap="round" stroke-linejoin="round"><path d="M500 600V338Q500 305 466 305H174M500 305H822M200 156Q318 207 500 185T800 156M500 185V305M174 305Q159 434 229 478M822 305Q839 428 772 479M229 478Q355 456 500 507T772 479" stroke-width="39"/><path d="M230 478Q310 500 500 507" stroke-width="32"/></g><ellipse cx="500" cy="315" rx="112" ry="83" fill="#e6d5a5"/><ellipse cx="500" cy="315" rx="95" ry="69" fill="#eddfb9"/><path d="M467 565h66v85h-66" fill="#af8961"/><path d="M472 578h56m-56 14h56m-56 14h56m-56 14h56m-56 14h56" stroke="#d7b68b" stroke-width="3"/><path d="M464 570v71m72-71v71" stroke="#805f49" stroke-width="5"/>
${[[38,61,1.1],[89,42,.8],[330,64,.9],[642,44,.8],[931,58,1.15],[980,160,.95],[35,220,.9],[350,240,.7],[656,231,.7],[959,343,1.2],[45,421,1.1],[339,399,.72],[655,409,.72],[59,550,.85],[944,554,1.1],[374,556,.6]].map(p=>tree(...p)).join('')}
<g stroke="#6e7353" stroke-width="2" fill="none"><path d="M301 159Q500 231 702 156"/><path d="M285 366Q500 425 716 366"/></g>${[[333,172],[390,190],[449,202],[510,204],[571,198],[633,182],[306,372],[371,389],[438,400],[505,404],[573,398],[644,386],[697,373]].map(([x,y],i)=>`<g transform="translate(${x} ${y})"><rect x="-7" y="0" width="14" height="19" rx="5" fill="${i%2?'#eec882':'#d99279'}"/><path d="M-5 5H5m-5 9H5" stroke="#f7e2ad" stroke-width="2"/></g>`).join('')}
<g fill="#eab8a5">${[[85,177],[102,181],[90,192],[885,234],[902,242],[905,225],[336,531],[348,539],[358,526],[874,530],[892,537]].map(([x,y])=>`<path d="M${x-3} ${y-5}h6v3h3v5h-3v3h-6v-3h-3v-5h3z"/>`).join('')}</g><g fill="#f4e6ae"><circle cx="90" cy="179" r="2"/><circle cx="900" cy="239" r="2"/><circle cx="349" cy="537" r="2"/></g><g fill="#ab885f"><path d="M360 129h47v8h-47m3 4h41v7h-41m3 0h4v9h-4m30-9h4v9h-4"/><path d="M586 521h47v8h-47m3 4h41v7h-41m3 0h4v9h-4m30-9h4v9h-4"/></g><path d="M390 310h220" stroke="#cdb988" stroke-width="2" stroke-dasharray="4 6"/></svg>`;
}
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountVillage(host, {characters, completedSubjects = [], onVisit, settings = {}}) {
 let completed = completedSubjects, preferences = settings, player = {x:50,y:87}, dead=false;
 const list = Array.isArray(characters) ? characters : Object.values(characters || {});
 host.innerHTML = `<div class="village-wrap"><div class="village-pan"><div class="village-world" tabindex="0" role="region" aria-label="Festival village. Arrow keys or W A S D to walk. E or Space to talk to a nearby neighbor." aria-describedby="village-walk-help">${scenery()}<div class="village-world-caption"><span class="village-season">SUMMER • FESTIVAL DAY</span><span class="village-place">Willow Bay Village</span></div>${list.map(c=>`<button type="button" class="village-location village-location-${escape(c.id)}" data-visit="${escape(c.id)}" style="left:${Number(c.position.x)}%;top:${Number(c.position.y)}%" aria-label="Visit ${escape(c.name)} at ${escape(c.location)} for ${escape(c.subject)}">${building(c.id)}<span class="village-neighbor">${avatarMarkup(c.id,{size:52})}</span><span class="village-location-label"><strong>${escape(c.name)}<span class="village-complete" aria-hidden="true">✓</span></strong><span>${escape(c.subject)}</span></span></button>`).join('')}<div class="village-festival"><div class="village-festival-roof"></div><div class="village-festival-counter"><span class="village-creations"></span></div><span class="village-festival-label">Your festival stall</span></div><div class="village-side village-pip">${avatarMarkup('pip',{size:38})}<span>Pip</span></div><div class="village-side village-nori">${avatarMarkup('nori',{size:42})}<span>Nori</span></div><div class="village-player" style="left:50%;top:87%">${avatarMarkup('player',{size:54})}<span>You</span></div><span class="village-pier-label">ARRIVAL PIER</span></div></div><div class="village-controls"><p id="village-walk-help"><span class="village-control-icon" aria-hidden="true">↔</span> Select any neighbor to visit. <span class="village-key-help">Or focus the village, walk with <kbd>↑ ↓ ← →</kbd> / <kbd>W A S D</kbd>, and talk with <kbd>E</kbd>.</span></p><button type="button" class="village-talk" hidden></button></div><span class="village-status" role="status" aria-live="polite"></span></div>`;
 const world = host.querySelector('.village-world'), playerNode=host.querySelector('.village-player'), talk=host.querySelector('.village-talk'), status=host.querySelector('.village-status');
 let nearest=null;
 const findNearest=()=>{
   nearest=list.map(c=>({c,d:Math.hypot(c.position.x-player.x,(c.position.y+8-player.y)*.67)})).sort((a,b)=>a.d-b.d)[0];
   if(nearest?.d < 19){talk.hidden=false; talk.textContent=`Talk to ${nearest.c.name} →`;}
   else{talk.hidden=true;nearest=null;}
 };
 const visit = event=>{const target=event.target.closest('[data-visit]');if(target)onVisit?.(target.dataset.visit);};
 const keydown=event=>{
   if(event.target!==world || event.altKey || event.ctrlKey || event.metaKey)return;
   const key=event.key.toLowerCase();
   const delta={arrowup:[0,-2],w:[0,-2],arrowdown:[0,2],s:[0,2],arrowleft:[-1.5,0],a:[-1.5,0],arrowright:[1.5,0],d:[1.5,0]}[key];
   if(delta){event.preventDefault();player.x=Math.max(5,Math.min(95,player.x+delta[0]));player.y=Math.max(10,Math.min(89,player.y+delta[1]));playerNode.style.left=`${player.x}%`;playerNode.style.top=`${player.y}%`;findNearest();}
   if((key==='e'||key===' ')&&nearest){event.preventDefault();onVisit?.(nearest.c.id);}
 };
 const talkClick=()=>{if(nearest)onVisit?.(nearest.c.id);};
 world.addEventListener('click',visit);world.addEventListener('keydown',keydown);talk.addEventListener('click',talkClick);
 function render(){
   if(dead)return;
   world.classList.toggle('village-reduced-motion',Boolean(preferences.reducedMotion));
   const done=new Set(completed);
   for(const button of world.querySelectorAll('[data-visit]')){const c=list.find(c=>c.id===button.dataset.visit); const isDone=done.has(c.id)||done.has(c.subject);button.classList.toggle('village-is-complete',isDone);button.setAttribute('aria-label',`Visit ${c.name} at ${c.location} for ${c.subject}${isDone?', completed':''}`);}
   const finished=list.filter(c=>done.has(c.id)||done.has(c.subject));
   host.querySelector('.village-creations').innerHTML=finished.length?finished.map(c=>`<span title="${escape(c.reward?.label || c.subject)}">${escape(c.reward?.icon || '★')}</span>`).join(''):'<span class="village-stall-empty">Made by you, soon!</span>';
   status.textContent=finished.length ? `${finished.length} of 7 festival creations ready.`:'';
 }
 render();findNearest();
 return {update(next={}){if('completedSubjects'in next)completed=next.completedSubjects || [];if('settings'in next)preferences=next.settings||{};render();},destroy(){dead=true;world.removeEventListener('click',visit);world.removeEventListener('keydown',keydown);talk.removeEventListener('click',talkClick);host.innerHTML='';}};
}
