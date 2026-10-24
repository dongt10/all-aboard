// Original little festival neighbors, drawn on a 40 × 48 pixel grid.
export const palette = { ink:'#49344b', cream:'#fff0bd', coral:'#e47b65', jade:'#558b78', gold:'#efbd63' };
const box=(x,y,w,h,c)=>`<path d="M${x} ${y}h${w}v${h}h-${w}z" fill="${c}"/>`;
export function characterSVG(id,{size=96,pose='idle',facing='front'}={}) {
 const colors={math:['#a57459','#e6bd8b','#ce7054'],science:['#fff0ce','#f7cdba','#72a690'],art:['#edc293','#fff0ca','#a18ab2'],reading:['#9d705e','#e6c49b','#7199b4'],writing:['#d88e59','#fff0c5','#568f89'],community:['#ba9169','#efce9c','#829b6a'],music:['#a67b58','#f6dba8','#dfaa51'],player:['#d89c7f','#edbd94','#7897aa'],pip:['#f5dfab','#fff1c2','#779cb1'],nori:['#84a77c','#c4d2a0','#b38d62'],cricket:['#759070','#b8c78b','#bf8c66']};
 const [fur,face,shirt]=colors[id]||colors.player, ink=palette.ink;
 let ears=box(8,10,7,9,fur)+box(25,10,7,9,fur);
 if(id==='science') ears=box(10,1,6,18,fur)+box(25,3,6,16,fur)+box(12,4,2,11,'#db9e9e')+box(27,6,2,10,'#db9e9e');
 if(['art','writing'].includes(id)) ears=`<path d="M7 20V7h4l9 13M22 20l9-13h3v16" fill="${fur}"/>`+box(10,12,3,5,'#c5787c')+box(28,12,3,5,'#c5787c');
 if(id==='community') ears+=`<path d="M12 12V4H7M12 7h5M28 12V3h5M28 7h-4" stroke="#745745" stroke-width="3"/>`;
 if(['player','pip','nori','music','cricket'].includes(id)) ears='';
 let tail=id==='writing'?`<path d="M29 38h7v-5h4v-9h-6v6h-7z" fill="${fur}"/>`+box(35,24,5,6,face):id==='math'?`<path d="M30 32h7v12H26v-6h4" fill="${fur}"/>`+box(31,35,6,4,ink):id==='reading'?`<path d="M28 35h8v9H23v-5h5z" fill="${fur}"/>`:'';
 const up=pose==='joy'||pose==='perform';
 let body=box(12,40,6,5,ink)+box(23,40,6,5,ink)+box(10,29,21,13,shirt)+box(7,up?24:31,5,9,fur)+box(30,up?23:31,5,9,fur)+box(12,37,17,3,'#fff0bd');
 if(id==='nori')body=box(7,28,28,15,'#647e61')+body+box(13,30,15,10,'#a08c5b')+box(18,31,5,8,'#c6b176');
 let head=ears+box(9,15,23,14,fur)+box(6,19,28,8,fur)+box(11,24,19,7,face);
 if(id==='math')head+=box(9,20,9,5,ink)+box(24,20,9,5,ink);
 if(id==='art')head+=box(8,15,8,6,'#b78058')+box(26,16,7,7,'#785f58');
 if(id==='music')head+=box(9,16,23,4,ink)+box(14,26,12,4,'#e4aa55')+box(28,12,4,6,fur);
 if(id==='pip')head+=box(10,11,20,5,shirt)+box(24,15,12,3,shirt)+box(14,26,14,4,'#e4aa55');
 if(id==='player')head+=box(8,12,24,8,ink)+box(7,18,5,8,ink)+box(29,18,5,8,ink)+box(10,10,20,4,ink)+box(12,15,18,3,'#c06e60');
 if(id==='cricket')head+=`<path d="M14 17 10 7M27 17l5-10" stroke="${ink}" stroke-width="2"/>`;
 const eyes=(pose==='joy'||pose==='perform')?`<path d="m12 23 3-2 3 2m7 0 3-2 3 2" stroke="${ink}" stroke-width="2"/>`:box(13,21,3,4,id==='math'?'#fff0bd':ink)+box(25,21,3,4,id==='math'?'#fff0bd':ink);
 head+=eyes+box(18,27,5,(pose==='talk'||pose==='perform')?3:2,ink)+box(9,25,4,2,'#df9a8b')+box(29,25,4,2,'#df9a8b');
 let prop=id==='reading'?box(11,33,18,6,'#fff0bd')+box(20,33,1,6,'#a88d77'):id==='art'?box(27,28,2,12,ink)+box(27,27,3,4,'#ca6f78'):id==='writing'?box(13,32,13,8,'#fff0bd')+box(15,34,8,1,'#967e6b'):id==='music'?box(10,33,21,7,'#c47555')+box(10,32,21,2,'#fff0bd'):id==='math'?box(13,32,15,5,'#e7b86a'):'';
 if(facing==='back'){head=ears+box(9,15,23,15,id==='player'?ink:fur);prop=id==='player'?box(13,29,15,13,'#c26e5c')+box(16,32,9,6,'#e39573'):'';}
 const safeSize=Math.max(16,Math.min(1024,Number(size)||96));
 return `<svg class="char-sprite char-${id}" xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize*1.2}" viewBox="0 0 40 48" fill="none" shape-rendering="crispEdges" aria-hidden="true"><ellipse cx="20" cy="45" rx="15" ry="2" fill="#342f43" opacity=".22"/>${tail}${body}${head}${prop}</svg>`;
}
