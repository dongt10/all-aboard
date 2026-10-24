import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEncounterSnapshot,cartBalance,iceRemaining,routeReport,encounterReady } from '../src/encounters.js';
test('cargo groups can differ while total weight balances',()=>{const s=normalizeEncounterSnapshot('math',{kind:'math',left:[2,3],right:[5],rolled:true},4);assert.deepEqual(cartBalance(s),{left:5,right:5,balanced:true});assert.equal(encounterReady(s),true);s.right=[];assert.equal(encounterReady(s),false);});
test('empty cart cannot count as a completed creation',()=>assert.equal(encounterReady({kind:'math',left:[],right:[],rolled:true}),false));
test('ice model has equal starts and a slower shaded melt',()=>{assert.equal(iceRemaining(0,false),iceRemaining(0,true));assert.ok(iceRemaining(10,true)>iceRemaining(10,false));assert.equal(iceRemaining(100,false),0);assert.equal(encounterReady({kind:'science',canopy:'none',time:20}),false);});
test('banner normalization keeps actual art while rejecting foreign colors and bounding positions',()=>{const s=normalizeEncounterSnapshot('art',{kind:'art',stamps:[{shape:'star',color:'#e96163',x:999,y:-9,rotation:90},{shape:'script',color:'#000',x:2,y:3}]},2);assert.deepEqual(s.stamps,[{shape:'star',color:'#e96163',x:95,y:5,rotation:90}]);assert.equal(encounterReady(s),true);});
test('map needs a clear route, rest and a quiet place before opening',()=>{const s={kind:'community',tried:true,placements:[{item:'bench',x:50,y:90},{item:'quiet',x:10,y:10}]};assert.equal(encounterReady(s),true);s.placements.push({item:'bench',x:30,y:50});assert.equal(routeReport(s).blocked,true);assert.equal(encounterReady(s),false);});
test('reading discoveries are unique and do not accept unknown objects',()=>assert.deepEqual(normalizeEncounterSnapshot('reading',{kind:'reading',found:['book','book','ball']}).found,['book']));
test('writing persists personal text and requires a visible message',()=>{const s=normalizeEncounterSnapshot('writing',{kind:'writing',text:'Welcome, friends!'});assert.equal(s.text,'Welcome, friends!');assert.equal(encounterReady(s),true);assert.equal(encounterReady({...s,text:'  '}),false);});
test('a snapshot for another character cannot leak into a new encounter',()=>assert.deepEqual(normalizeEncounterSnapshot('math',{kind:'art',left:[5]}).left,[]));

test('every saved art color has a distinct readable name',async()=>{
 const {ENCOUNTER_COLORS,ENCOUNTER_COLOR_NAMES}=await import('../src/encounters.js');
 const names=ENCOUNTER_COLORS.map(color=>ENCOUNTER_COLOR_NAMES[color]);
 assert.equal(names.every(name=>typeof name==='string'&&name.length>0),true);
 assert.equal(new Set(names).size,ENCOUNTER_COLORS.length);
});

test('old out-of-order reading saves keep discoveries and always select a missing item',async()=>{
 const {normalizeReadingFound,readingStep,readingChoice}=await import('../src/reading.js');
 assert.deepEqual(normalizeReadingFound(['book','book','unknown','key']),['key','book']);
 assert.equal(readingStep(['book'],5).id,'key');
 const first=readingChoice(['book'],'key',5);
 assert.deepEqual(first.found,['key','book']);
 assert.equal(readingStep(first.found,5).id,'umbrella');
 assert.equal(readingStep(readingChoice(first.found,'umbrella',5).found,5),null);
});
test('reading review retains the answered passage until explicitly advanced',async()=>{
 const {readingChoice,readingStep}=await import('../src/reading.js');
 const picked=readingChoice([],'key',2);
 assert.equal(picked.accepted,true);
 assert.equal(readingStep(picked.found,2,picked.reviewId).id,'key');
 assert.match(readingStep(picked.found,2,picked.reviewId).passage,/door/);
 assert.equal(readingStep(picked.found,2,null).id,'umbrella');
});
test('wrong reading picks explain the mismatch without changing progress',async()=>{
 const {readingChoice}=await import('../src/reading.js');
 const picked=readingChoice([],'cup',3);
 assert.equal(picked.accepted,false);
 assert.deepEqual(picked.found,[]);
 assert.match(picked.message,/cup holds a drink/i);
 assert.match(picked.message,/door lock/i);
});
test('reading word mode and elementary passages have direct matching questions',async()=>{
 const {readingStep}=await import('../src/reading.js');
 assert.equal(readingStep([],0).passage,'KEY');
 assert.match(readingStep([],0).question,/KEY/);
 assert.match(readingStep(['key'],5).passage,/umbrella/);
 assert.match(readingStep(['key'],5).question,/stay dry/);
});

test('typing from an empty writing draft enables removal as well as publishing',async()=>{
 const {writingControlAvailability}=await import('../src/encounters.js');
 assert.deepEqual(writingControlAvailability(''),{canPublish:false,canRemove:false});
 assert.deepEqual(writingControlAvailability('Hello friends'),{canPublish:true,canRemove:true});
 assert.deepEqual(writingControlAvailability('  '),{canPublish:false,canRemove:true});
});
test('ready encounter reentry describes the saved state rather than restarting its task',async()=>{
 const {encounterOpeningDialogue}=await import('../src/encounters.js');
 assert.match(encounterOpeningDialogue({kind:'math',left:[2],right:[2],rolled:true}),/ready to send/);
 assert.match(encounterOpeningDialogue({kind:'science',canopy:'left',time:10}),/test is ready/);
 assert.match(encounterOpeningDialogue({kind:'reading',found:['book','key','umbrella']}),/read again/);
 assert.match(encounterOpeningDialogue({kind:'math',left:[],right:[],rolled:false}),/weigh the same/);
});

test('selecting existing shade preserves elapsed time; changing trays starts equal ice again',async()=>{
 const {shadeScienceTray}=await import('../src/encounters.js');
 const state={kind:'science',canopy:'left',time:15};
 assert.equal(shadeScienceTray(state,'left'),state);
 assert.deepEqual(shadeScienceTray(state,'right'),{kind:'science',canopy:'right',time:0});
});
test('science explains remaining comparison steps including an old unshaded 20-minute draft',async()=>{
 const {scienceNextStep}=await import('../src/encounters.js');
 assert.match(scienceNextStep({canopy:'none',time:20}),/Shade one tray/);
 assert.match(scienceNextStep({canopy:'left',time:5}),/5 more model minutes/);
 assert.match(scienceNextStep({canopy:'left',time:10}),/Comparison ready/);
});
test('full community map rejects a new placement without invalidating an existing trial',async()=>{
 const {placeCommunityItem}=await import('../src/encounters.js');
 const state={kind:'community',tried:true,placements:Array.from({length:12},(_,i)=>({item:'sign',x:10+(i%5)*20,y:10+Math.floor(i/5)*20}))};
 const refused=placeCommunityItem(state,'bench',90,90);
 assert.equal(refused.status,'full');
 assert.equal(refused.state,state);
 assert.equal(refused.state.tried,true);
 const replaced=placeCommunityItem(state,'bench',10,10);
 assert.equal(replaced.status,'placed');
 assert.equal(replaced.state.placements.length,12);
 assert.equal(replaced.state.tried,false);
 assert.equal(replaced.state.placements.find(p=>p.x===10&&p.y===10).item,'bench');
});
test('math opening explains equal counts for kindergarten and equal weight for older children',async()=>{
 const {encounterOpeningDialogue}=await import('../src/encounters.js');
 assert.match(encounterOpeningDialogue({kind:'math',grade:0,left:[],right:[],rolled:false}),/same number of crates/);
 assert.match(encounterOpeningDialogue({kind:'math',grade:4,left:[],right:[],rolled:false}),/weigh the same/);
});

test('community removal labels describe removal or an empty no-op',async()=>{
 const {communityCellLabel,placeCommunityItem}=await import('../src/encounters.js');
 assert.equal(communityCellLabel('remove',{item:'bench'},2,3),'Remove bench, row 2, column 3');
 assert.equal(communityCellLabel('remove',null,2,3),'Empty space, no item to remove, row 2, column 3');
 assert.equal(communityCellLabel('sign',{item:'quiet'},1,1),'Replace quiet garden with sign, row 1, column 1');
 const state={placements:[],tried:true};
 const result=placeCommunityItem(state,'remove',10,10);
 assert.equal(result.status,'unchanged');
 assert.equal(result.state,state);
 assert.equal(result.state.tried,true);
});
