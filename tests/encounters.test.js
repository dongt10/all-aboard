import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEncounterSnapshot,cartBalance,iceRemaining,routeReport,encounterReady } from '../src/encounters.js';
test('cargo groups can differ while total weight balances',()=>{const s=normalizeEncounterSnapshot('math',{kind:'math',left:[2,3],right:[5],rolled:true},4);assert.deepEqual(cartBalance(s),{left:5,right:5,balanced:true});assert.equal(encounterReady(s),true);s.right=[];assert.equal(encounterReady(s),false);});
test('empty cart cannot count as a completed creation',()=>assert.equal(encounterReady({kind:'math',left:[],right:[],rolled:true}),false));
test('ice model has equal starts and a slower shaded melt',()=>{assert.equal(iceRemaining(0,false),iceRemaining(0,true));assert.ok(iceRemaining(10,true)>iceRemaining(10,false));assert.equal(iceRemaining(100,false),0);assert.equal(encounterReady({kind:'science',canopy:'none',time:20}),false);});
test('banner normalization keeps actual art while rejecting foreign colors and bounding positions',()=>{const s=normalizeEncounterSnapshot('art',{kind:'art',stamps:[{shape:'star',color:'#e96163',x:999,y:-9,rotation:90},{shape:'script',color:'#000',x:2,y:3}]},2);assert.deepEqual(s.stamps,[{shape:'star',color:'#e96163',x:95,y:5,rotation:90}]);assert.equal(encounterReady(s),true);});
test('map needs a clear route, rest and a quiet place before opening',()=>{const s={kind:'community',grade:2,tried:true,placements:[{item:'bench',x:50,y:90},{item:'quiet',x:10,y:10}]};assert.equal(encounterReady(s),true);s.placements.push({item:'bench',x:30,y:50});assert.equal(routeReport(s).blocked,true);assert.equal(encounterReady(s),false);});
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
 const picked=readingChoice([],'cup',2);
 assert.equal(picked.accepted,false);
 assert.deepEqual(picked.found,[]);
 assert.match(picked.message,/cup holds a drink/i);
 assert.match(picked.message,/door lock/i);
});
test('reading word mode and elementary passages have direct matching questions',async()=>{
 const {readingStep}=await import('../src/reading.js');
 assert.equal(readingStep([],0).passage,'Key');
 assert.equal(readingStep([],0).word,'Key');
 assert.equal(readingStep([],0).question,'Put the Key in the bag.');
 assert.match(readingStep(['key'],2).passage,/umbrella/);
 assert.match(readingStep(['key'],2).question,/stay dry/);
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
 assert.match(encounterOpeningDialogue({kind:'reading',found:['book','key','umbrella']}),/start over/);
 assert.match(encounterOpeningDialogue({kind:'math',grade:1,left:[],right:[],rolled:false}),/weighs 3/);
 assert.match(encounterOpeningDialogue({kind:'math',left:[],right:[],rolled:false}),/two crates/,'no grade reads as Kindergarten');
});

test('selecting existing shade preserves elapsed time; changing trays starts equal ice again',async()=>{
 const {shadeScienceTray}=await import('../src/encounters.js');
 const state={kind:'science',canopy:'left',time:15};
 assert.equal(shadeScienceTray(state,'left'),state);
 assert.deepEqual(shadeScienceTray(state,'right'),{kind:'science',canopy:'right',time:0});
});
test('science explains remaining comparison steps including an old unshaded 20-minute draft',async()=>{
 const {scienceNextStep}=await import('../src/encounters.js');
 assert.equal(scienceNextStep({canopy:'none',time:20}),'Shade tray A or B to begin.');
 assert.equal(scienceNextStep({canopy:'none',time:0}),'Shade tray A or B to begin.');
 assert.equal(scienceNextStep({canopy:'left',time:5}),'Wait 5 more minutes. Then look at both trays.');
 assert.equal(scienceNextStep({canopy:'left',time:9}),'Wait 1 more minute. Then look at both trays.');
 assert.equal(scienceNextStep({canopy:'left',time:10}),'Ready! Choose Serve ice.');
 assert.equal(scienceNextStep({canopy:'left',time:20}),'Ready! Choose Serve ice.');
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
 assert.equal(encounterOpeningDialogue({kind:'math',grade:0,left:[],right:[],rolled:false}),'Taro put two crates on the left. Put the same on the right!');
 assert.equal(encounterOpeningDialogue({kind:'math',grade:1,left:[],right:[],rolled:false}),'The left side weighs 3. Load the right side to match.');
 assert.equal(encounterOpeningDialogue({kind:'math',grade:2,left:[],right:[],rolled:false}),'The left side weighs 3. Load the right side to match.');
 assert.equal(encounterOpeningDialogue({kind:'math',grade:4,left:[],right:[],rolled:false}),'The left side weighs 8. Find crates that add up to 8.');
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

// --- Grade bands (plan 1C): math pre-loads, the community checklist, kid-word science, inferred reading ---
const SENTENCE_MAX=56;
const sentences=text=>text.split(/(?<=[.!?])\s+/).filter(Boolean);
const shortSentences=(text,where)=>{for(const line of sentences(text))assert.ok(line.length<=SENTENCE_MAX,`${where}: "${line}" is ${line.length} characters`);};

test('grade bands: K is 0, grades 1-2 share a band, grades 3-5 share a band, a missing grade reads as Kindergarten',async()=>{
 const {gradeBand,startingCargo}=await import('../src/encounters.js');
 assert.deepEqual([0,1,2,3,4,5].map(gradeBand),[0,1,1,3,3,3]);
 assert.equal(gradeBand(undefined),0);assert.equal(gradeBand(null),0);assert.equal(gradeBand('x'),0);
 assert.deepEqual(startingCargo(undefined),startingCargo(0));
});
test('Taro pre-loads the left side by band and never the right',async()=>{
 const {startingCargo,cartBalance}=await import('../src/encounters.js');
 assert.deepEqual(startingCargo(0),{left:[1,1],right:[]});
 assert.deepEqual(startingCargo(1),{left:[2,1],right:[]});
 assert.deepEqual(startingCargo(2),{left:[2,1],right:[]});
 assert.deepEqual(startingCargo(3),{left:[5,3],right:[]});
 assert.deepEqual(startingCargo(5),{left:[5,3],right:[]});
 for(const grade of [0,1,3]){const s={kind:'math',grade,...startingCargo(grade),rolled:false};assert.equal(cartBalance(s).balanced,false);assert.equal(encounterReady(s),false);}
 assert.equal(cartBalance({left:[5,3],right:[5,2,1]}).balanced,true);
 assert.equal(cartBalance({left:[5,3],right:[3,3,2]}).balanced,true);
});
test('the math opening names the pre-loaded weight and every sentence fits one page',async()=>{
 const {encounterOpeningDialogue,startingCargo}=await import('../src/encounters.js');
 for(const grade of [0,1,2,3,4,5]){
  const line=encounterOpeningDialogue({kind:'math',grade,...startingCargo(grade),rolled:false});
  shortSentences(line,`math grade ${grade}`);
  if(grade>0)assert.match(line,new RegExp(`weighs ${startingCargo(grade).left.reduce((a,b)=>a+b,0)}`));
  else assert.match(line,new RegExp(['zero','one','two','three'][startingCargo(0).left.length]+' crates'));
 }
 const ready=encounterOpeningDialogue({kind:'math',grade:3,left:[5,3],right:[5,3],rolled:true});
 assert.match(ready,/ready to send/);shortSentences(ready,'math ready');
});

test('the math opening tells the truth about a draft whose left side is not the pre-load',async()=>{
 const {encounterOpeningDialogue,normalizeEncounterSnapshot}=await import('../src/encounters.js');
 const open=(grade,left)=>encounterOpeningDialogue(normalizeEncounterSnapshot('math',{kind:'math',left,right:[]},grade,1));
 assert.equal(open(3,[2]),'The left side weighs 2. Find crates that add up to 2.');
 assert.equal(open(1,[5,5]),'The left side weighs 10. Load the right side to match.');
 assert.equal(open(0,[1,1,1]),'Taro put three crates on the left. Put the same on the right!');
 assert.equal(open(0,[5]),'Taro put one crate on the left. Put the same on the right!');
 assert.equal(open(0,[1,1,1,1,1,1,1,1]),'Taro put eight crates on the left. Put the same on the right!');
 for(const [grade,left] of [[0,[1,1,1]],[1,[5,5]],[3,[2]],[4,[5,5,5,5,5,5,5,5]]])shortSentences(open(grade,left),`math grade ${grade} left ${left}`);
 assert.equal(open(3,[]),'The left side weighs 8. Find crates that add up to 8.','empty left falls back to the band text');
 assert.equal(open(0,[]),'Taro put two crates on the left. Put the same on the right!');
});

test('a sign counts as signed only in a cell touching the stage',async()=>{
 const {routeReport,STAGE_CELLS}=await import('../src/encounters.js');
 assert.deepEqual(STAGE_CELLS,[{x:90,y:10},{x:70,y:10},{x:90,y:30}]);
 for(const cell of STAGE_CELLS)assert.equal(routeReport({placements:[{item:'sign',...cell}]}).signed,true,JSON.stringify(cell));
 assert.equal(routeReport({placements:[{item:'sign',x:10,y:10}]}).signed,false);
 assert.equal(routeReport({placements:[{item:'bench',x:90,y:10}]}).signed,false);
 assert.equal(routeReport({placements:[{item:'sign',x:50,y:50}]}).blocked,false,'a sign on the path never blocks');
 assert.deepEqual(routeReport({placements:[]}),{blocked:false,quiet:false,rest:false,signed:false});
});
test('the square needs more by band: K a bench, 1-2 add the garden, 3-5 add the sign by the stage',async()=>{
 const bench={item:'bench',x:50,y:90},garden={item:'quiet',x:10,y:10},sign={item:'sign',x:90,y:10};
 const at=(grade,placements,tried=true)=>encounterReady({kind:'community',grade,tried,placements});
 assert.equal(at(0,[bench]),true);
 assert.equal(at(0,[bench],false),false);
 assert.equal(at(0,[garden]),false);
 assert.equal(at(1,[bench]),false);assert.equal(at(2,[bench]),false);
 assert.equal(at(1,[bench,garden]),true);assert.equal(at(2,[bench,garden]),true);
 assert.equal(at(3,[bench,garden]),false);assert.equal(at(5,[bench,garden]),false);
 assert.equal(at(3,[bench,garden,sign]),true);assert.equal(at(5,[bench,garden,sign]),true);
 assert.equal(at(3,[bench,garden,{item:'sign',x:10,y:90}]),false,'a sign far from the stage does not count');
 assert.equal(at(3,[bench,garden,sign,{item:'bench',x:30,y:50}]),false,'a bench on the path still blocks');
});
test('squareSteps lists the band’s checklist in order, marking what is done',async()=>{
 const {squareSteps}=await import('../src/encounters.js');
 const bench={item:'bench',x:50,y:90},garden={item:'quiet',x:10,y:10},sign={item:'sign',x:70,y:10};
 const texts=steps=>steps.map(s=>s.text);
 assert.deepEqual(texts(squareSteps({grade:0,placements:[],tried:false})),['Put a bench off the path.','Choose Try it to walk the square.']);
 assert.deepEqual(texts(squareSteps({grade:2,placements:[],tried:false})),['Put a bench off the path.','Put a garden by the quiet trees.','Choose Try it to walk the square.']);
 assert.deepEqual(texts(squareSteps({grade:4,placements:[],tried:false})),['Put a bench off the path.','Put a garden by the quiet trees.','Put a sign next to the stage.','Choose Try it to walk the square.']);
 const g3=squareSteps({grade:3,placements:[bench,garden,sign],tried:true});
 assert.deepEqual(g3.map(s=>[s.id,s.done]),[['rest',true],['quiet',true],['signed',true],['tried',true]]);
 const partial=squareSteps({grade:3,placements:[garden],tried:false});
 assert.deepEqual(partial.map(s=>[s.id,s.done]),[['rest',false],['quiet',true],['signed',false],['tried',false]]);
 assert.equal(squareSteps({grade:3,placements:[{item:'bench',x:30,y:50}],tried:false})[0].done,false,'a bench on the path is not off the path');
 for(const step of g3)shortSentences(step.text,step.id);
});
test('a blocked path shows as an undone step, so the checklist is never all done while the finish is disabled',async()=>{
 const {squareSteps}=await import('../src/encounters.js');
 const s={kind:'community',grade:0,tried:true,placements:[{item:'bench',x:50,y:90},{item:'quiet',x:50,y:50}]};
 assert.equal(encounterReady(s),false);
 const steps=squareSteps(s);
 assert.equal(steps.some(step=>!step.done),true);
 assert.deepEqual(steps.map(step=>[step.id,step.done]),[['rest',false],['tried',true]]);
 assert.equal(steps[0].text,'Move the bench or garden off the path.');
 shortSentences(steps[0].text,'blocked step');
 const clear={...s,placements:[s.placements[0]]};
 assert.equal(encounterReady(clear),true);
 assert.equal(squareSteps(clear).every(step=>step.done),true);
 assert.equal(squareSteps(clear)[0].text,'Put a bench off the path.');
 for(const grade of [0,1,3])for(const placements of [[],[{item:'bench',x:50,y:90}],[{item:'bench',x:50,y:90},{item:'quiet',x:10,y:10}],[{item:'bench',x:50,y:90},{item:'quiet',x:10,y:10},{item:'sign',x:90,y:10}],[{item:'bench',x:30,y:50},{item:'quiet',x:10,y:10},{item:'sign',x:90,y:10}]]){
  const snap={kind:'community',grade,tried:true,placements};
  assert.equal(squareSteps(snap).every(step=>step.done),encounterReady(snap),`grade ${grade} ${JSON.stringify(placements)}`);
 }
});
test('the community opening per band uses the one garden wording and fits one page',async()=>{
 const {encounterOpeningDialogue}=await import('../src/encounters.js');
 const open=grade=>encounterOpeningDialogue({kind:'community',grade,placements:[],tried:false});
 assert.equal(open(0),'Put a bench off the path for a tired neighbor.');
 assert.equal(open(1),'Put a bench off the path. Put a garden by the quiet trees.');
 assert.equal(open(2),open(1));
 assert.equal(open(3),'Add a bench and a garden by the quiet trees. Then put a sign by the stage.');
 assert.equal(open(5),open(3));
 for(const grade of [0,1,3]){shortSentences(open(grade),`community grade ${grade}`);}
 assert.match(open(1),/a garden by the quiet trees/);assert.match(open(3),/a garden by the quiet trees/);
});

test('ice words: lots, less, water',async()=>{
 const {iceWords,iceRemaining}=await import('../src/encounters.js');
 assert.equal(iceWords(100),'Lots of ice');assert.equal(iceWords(70),'Lots of ice');
 assert.equal(iceWords(69),'Less ice');assert.equal(iceWords(1),'Less ice');
 assert.equal(iceWords(0),'Water');
 assert.equal(iceWords(iceRemaining(10,true)),'Lots of ice');
 assert.equal(iceWords(iceRemaining(10,false)),'Less ice');
 assert.equal(iceWords(iceRemaining(20,false)),'Water');
});
test('the prediction line says whether the first shade pick matched the shaded tray',async()=>{
 const {predictionLine}=await import('../src/encounters.js');
 assert.equal(predictionLine('left',{kind:'science',canopy:'left',time:10}),'You guessed right! The shaded tray kept more ice.');
 assert.equal(predictionLine('right',{kind:'science',canopy:'left',time:10}),'Surprise! The shaded tray kept more ice. Shade keeps the sun off.');
 assert.equal(predictionLine(null,{kind:'science',canopy:'left',time:10}),'','no guess this run means no line');
 assert.equal(predictionLine(undefined,{kind:'science',canopy:'left',time:10}),'');
 shortSentences(predictionLine('left',{canopy:'left'}),'guessed right');
 shortSentences(predictionLine('right',{canopy:'left'}),'surprise');
});
test('science openings use kid words at every band and ask for a guess at grades 3-5',async()=>{
 const {encounterOpeningDialogue}=await import('../src/encounters.js');
 for(const grade of [0,1,2,3,4,5]){
  const line=encounterOpeningDialogue({kind:'science',grade,canopy:'none',time:0});
  shortSentences(line,`science grade ${grade}`);
  assert.doesNotMatch(line,/model|%/,'no jargon');
  if(grade>=3)assert.match(line,/Which tray will keep more ice\?/);else assert.match(line,/Shade one tray/);
 }
 const ready=encounterOpeningDialogue({kind:'science',grade:2,canopy:'left',time:10});
 assert.match(ready,/test is ready/);assert.match(ready,/Serve ice/);shortSentences(ready,'science ready');
});

test('grades 3-5 read clues that imply the item without naming it',async()=>{
 const {readingStep,readingChoice,READING_ITEMS}=await import('../src/reading.js');
 const clues={key:'Sora’s front door has a lock. She wants to open it when she comes home.',umbrella:'Gray clouds roll over the bay. Sora does not want to get wet.',book:'At storytime, Sora’s friends sit in a circle. They wait for her to begin.'};
 for(const grade of [3,4,5]){
  let found=[];
  for(const id of READING_ITEMS){
   const step=readingStep(found,grade);
   assert.equal(step.id,id);
   assert.equal(step.passage,clues[id]);
   assert.doesNotMatch(step.passage,new RegExp(id,'i'),`${id} is not named at grade ${grade}`);
   assert.equal(step.question,'What should Sora pack?');
   shortSentences(step.passage,`${id} grade ${grade}`);
   assert.equal(step.retry,readingStep(found,2).retry,'retry hints stay');
   const picked=readingChoice(found,id,grade);
   assert.equal(picked.accepted,true);shortSentences(picked.message,`${id} packed`);
   found=picked.found;
  }
 }
 const wrong=readingChoice([],'cup',4);
 assert.equal(wrong.accepted,false);assert.match(wrong.message,/door lock/);shortSentences(wrong.message,'wrong at grade 4');
 assert.match(readingStep(['key'],2).passage,/umbrella/,'grades 1-2 still name the item');
});
test('kindergarten shows the word as Key, matching the buttons, in passage, question and feedback',async()=>{
 const {readingStep,readingChoice}=await import('../src/reading.js');
 const step=readingStep([],0);
 assert.deepEqual([step.word,step.passage,step.question,step.reason,step.retry],['Key','Key','Put the Key in the bag.','This says Key. Key is in the bag!','Look for Key.']);
 assert.equal(readingChoice([],'cup',0).message,'That says Cup. Look for Key.');
 assert.equal(readingChoice([],'key',0).message,'Key packed! This says Key. Key is in the bag!');
 assert.doesNotMatch(readingChoice([],'key',0).message,/\bkey\b/,'the one-word reader sees Key in one case only');
 assert.equal(readingStep(['key'],0).passage,'Umbrella');
 for(const text of Object.values(step))if(typeof text==='string')assert.doesNotMatch(text,/KEY/);
});
test('every reading line at every grade fits a Bigger-words page, sentence by sentence',async()=>{
 const {readingStep,readingChoice,READING_ITEMS}=await import('../src/reading.js');
 for(const grade of [0,1,2,3,5]){
  let found=[];
  for(const id of READING_ITEMS){
   const step=readingStep(found,grade);
   for(const key of ['passage','question','reason','retry'])shortSentences(step[key],`${key} ${id} grade ${grade}`);
   for(const choice of ['key','umbrella','book','cup'])shortSentences(readingChoice(found,choice,grade).message,`${choice} at ${id} grade ${grade}`);
   found=readingChoice(found,id,grade).found;
  }
  shortSentences(readingChoice(found,'key',grade).message,`bag ready grade ${grade}`);
 }
});
