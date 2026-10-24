import { characterSVG } from './characters.js';
import { createBandEngine, createDefaultBand, sanitizeBandSnapshot, PATTERNS, applyBeatChanges, notesForBeat, renderBandPreview, encodeWav } from './audio.js';
export { createDefaultBand, sanitizeBandSnapshot } from './audio.js';

const CAST=[
  {id:'bass',character:'reading',name:'Sora',color:'#91c5f5',sound:'Bum-bum bass',icon:'♩',line:'My low notes give our song a cozy floor.'},
  {id:'voice',character:'nori',name:'Nori',color:'#e4a2cf',sound:'Doo-doo singer',icon:'♫',line:'I sing a warm little doo. Shall we try another tune?'},
  {id:'melody',character:'music',name:'Kiko',color:'#f6c85f',sound:'Whistling bird',icon:'♪',line:'My whistle floats up high! Every tune belongs here.'},
  {id:'percussion',character:'cricket',name:'Cricket',color:'#79cfc2',sound:'Tap-tap rhythm',icon:'♬',line:'Tap, rest, tap! A little space makes a lovely rhythm.'},
];
const PITCHES=['Do','Re','Mi','Sol','La'];
export function bandPlaybackMessage(snapshot,{quiet=false}={}) {
  const band=sanitizeBandSnapshot(snapshot);
  const musicalTracks=band.tracks.filter(track=>track.enabled&&track.notes.some(note=>note!==null));
  if(!musicalTracks.length)return `${quiet?'Quiet play: everyone':'Everyone'} is resting. Invite a friend or add a note.`;
  if(!musicalTracks.some(track=>track.volume>0))return quiet?'Quiet play: friend volumes are at zero. Raise one to see their beat.':'Your friends are muted. Raise a friend’s volume to listen.';
  if(quiet)return 'Quiet play: watch the beat without sound.';
  if(band.masterVolume===0)return 'Band is playing with sound off. Raise band volume to listen.';
  return 'Your band is playing. Try a new sound!';
}
// Own the asynchronous Play/Stop interaction, including a pending browser resume.
export function createPlaybackController(engine,{onState=()=>{}}={}) {
  let state='stopped',generation=0;
  const publish=(next,reason=next)=>{state=next;onState(next,reason);};
  function stop(){generation++;publish('stopped');engine.stop();}
  return {
    get active(){return state!=='stopped';},
    get starting(){return state==='starting';},
    async toggle(snapshot){
      if(state!=='stopped'){stop();return false;}
      const token=++generation;publish('starting');
      let result=false;
      try{result=await engine.start(snapshot);}catch{ /* A failed start stays stopped. */ }
      if(token!==generation)return false;
      publish(result?'playing':'stopped',result?'playing':'unavailable');return result;
    },
    stop,
    engineStopped(){if(state==='playing'){generation++;publish('stopped');}},
  };
}
export function mountMusic(host,{grade=1,snapshot=null,settings={},onSave=()=>{},onComplete=()=>{},onClose=()=>{}}={}) {
  let band=sanitizeBandSnapshot(snapshot),selected='voice',quiet=false,destroyed=false,visualTimer=null,visualBeat=0;
  const kindergarten=grade===0||String(grade).toLowerCase()==='k';
  const advanced=Number(grade)>=3;
  if(!snapshot)band.masterVolume=typeof settings.volume==='number'?Math.max(0,Math.min(1,settings.volume)):typeof settings.masterVolume==='number'?Math.max(0,Math.min(1,settings.masterVolume)):band.masterVolume;
  let recordingToken=0, recording=false;
  const downloadURLs=new Map();
  const root=document.createElement('section');root.className=`music-room${settings.reducedMotion?' jam-reduced-motion':''}${settings.largeText?' jam-large-text':''}`;
  root.setAttribute('aria-label','Meadow Band music studio');host.append(root);
  root.innerHTML=`
    <header class="jam-top"><button class="jam-back" type="button" aria-label="Return to village and keep music draft">← Village</button><div><span class="jam-eyebrow">KIKO’S SOUND GARDEN</span><h1>Make your band</h1></div><span class="jam-location">♫ EVERY MIX BELONGS</span></header>
    <div class="jam-transport"><button type="button" class="jam-play">▶ Play band</button><button type="button" class="jam-quiet" aria-pressed="false">☀ Quiet play</button><button type="button" class="jam-save">✓ Save band</button></div>
    <p class="jam-main-hint">Tap a friend to join or rest.</p>
    <div class="jam-landscape"><div class="jam-sun"></div><div class="jam-cloud jam-cloud-one"></div><div class="jam-cloud jam-cloud-two"></div><div class="jam-hill jam-hill-back"></div><div class="jam-hill jam-hill-front"></div><div class="jam-tree jam-tree-left"></div><div class="jam-tree jam-tree-right"></div><div class="jam-bunting" aria-hidden="true">▼ ▾ ▼ ▾ ▼ ▾ ▼ ▾ ▼ ▾ ▼</div><div class="jam-stage-title">THE MEADOW BAND</div><div class="jam-stage"><div class="jam-flowers" aria-hidden="true">✿ &nbsp; ✿ &nbsp; ✿</div><div class="jam-musicians">${CAST.map(c=>`<button type="button" class="jam-musician" data-musician="${c.id}" style="--jam-track:${c.color}" aria-label="${c.name}, ${c.sound}, in the band. Tap to rest." aria-pressed="true"><span class="jam-note" aria-hidden="true">${c.icon}</span><span class="jam-creature">${characterSVG(c.character,{size:128,pose:'perform'})}</span><span class="jam-name">${c.name}</span><span class="jam-part">${c.icon} ${c.sound}</span><span class="jam-invited">✓ In the band</span></button>`).join('')}</div><div class="jam-stage-edge"></div></div><div class="jam-beat-strip" aria-label="Eight beats in the repeating phrase">${Array.from({length:8},(_,i)=>`<span data-beat="${i}" aria-label="Beat ${i+1}">${i+1}</span>`).join('')}</div></div>
    <div class="jam-console"><div class="jam-status" role="status" aria-live="polite">Ready when you are.</div>
      <div class="jam-options"><details class="jam-tune-details"><summary>Edit tunes & notes <span>Optional</span></summary><div class="jam-dialogue"><div class="jam-portrait"></div><div class="jam-conversation"><label class="jam-friend-label">Choose a musician <select class="jam-friend">${CAST.map(c=>`<option value="${c.id}"${selected===c.id?' selected':''}>${c.icon} ${c.name} · ${c.sound}</option>`).join('')}</select></label><div class="jam-speaker"></div><p class="jam-line"></p><div class="jam-controls"></div><div class="jam-editor"></div></div></div></details>
      <details class="jam-sound-details"><summary>Sound & recording <span>Optional</span></summary><div class="jam-sound-content"><label class="jam-master">Band volume <input aria-label="Band volume" type="range" min="0" max="1" step=".05" value="${band.masterVolume}"></label><div class="jam-mix">${CAST.map(c=>`<label class="jam-volume" style="--jam-track:${c.color}"><span>${c.icon} ${c.name}<small>${c.sound}</small></span><input type="range" data-volume="${c.id}" min="0" max="1" step=".05" value="${band.tracks.find(t=>t.id===c.id).volume}" aria-label="${c.name} volume"></label>`).join('')}</div><button type="button" class="jam-record">↓ Save recording</button><span class="jam-record-help">Download two phrases as a WAV audio file.</span></div></details></div></div>`;
  const $=s=>root.querySelector(s);
  function clearBeats(){root.querySelectorAll('[data-beat]').forEach(el=>el.classList.remove('jam-current'));root.querySelectorAll('.jam-musician').forEach(el=>el.classList.remove('jam-performing'));updateStage();}
  function beat({beat,notes}) {
    clearBeats();$(`[data-beat="${beat}"]`)?.classList.add('jam-current');
    for(const note of notes){const card=$(`[data-musician="${note.id}"]`);card?.classList.add('jam-performing');if(card)card.querySelector('.jam-invited').textContent=quiet?'♫ On this beat':'♫ Playing';}
  }
  let playback;
  const engine=createBandEngine({onBeat:beat,onStatus:status=>{
    if(destroyed)return;
    if(status==='stopped'){playback?.engineStopped();if(!quiet)clearBeats();}
    if(status==='interrupted')$('.jam-status').textContent='Sound was interrupted. Press Play band to start again.';
  }});
  playback=createPlaybackController(engine,{onState:(state,reason)=>{
    if(destroyed)return;
    $('.jam-play').textContent=state==='stopped'?'▶ Play band':'■ Stop band';
    $('.jam-status').textContent=reason==='unavailable'?'Sound is unavailable. Try Quiet play to see your band.':state==='starting'?'Waking up the band…':state==='playing'?bandPlaybackMessage(band):'Band stopped. Your song is safe.';
  }});
  function cancelRecording(){recordingToken++;recording=false;$('.jam-record').textContent='↓ Save recording';}
  function stopAll(){cancelRecording();quiet=false;clearInterval(visualTimer);visualTimer=null;playback.stop();$('.jam-quiet').setAttribute('aria-pressed','false');$('.jam-quiet').textContent='☀ Quiet play';clearBeats();}
  function save(message='Saved your changes.') {engine.update(band);onSave(getSnapshot());$('.jam-status').textContent=message;updateStage();}
  function getSnapshot(){return sanitizeBandSnapshot(band);}
  function updateStage(){for(const t of band.tracks){const c=CAST.find(c=>c.id===t.id),button=$(`[data-musician="${t.id}"]`);button.classList.toggle('jam-resting',!t.enabled);button.setAttribute('aria-pressed',String(t.enabled));button.setAttribute('aria-label',`${c.name}, ${c.sound}, ${t.enabled?'in the band. Tap to rest.':'resting. Tap to invite.'}`);button.querySelector('.jam-invited').textContent=t.enabled?'✓ In the band':'☾ Resting';}}
  function editor(){
    const c=CAST.find(c=>c.id===selected),t=band.tracks.find(t=>t.id===selected);
    $('.jam-portrait').innerHTML=characterSVG(c.character,{size:80,pose:'talk'});
    $('.jam-speaker').textContent=`${c.icon} ${c.name} · ${c.sound}`;$('.jam-line').textContent=c.line;$('.jam-dialogue').style.setProperty('--jam-track',c.color);$('.jam-friend').value=selected;
    $('.jam-controls').innerHTML=`<button type="button" class="jam-pattern jam-sprout" data-pattern="0" aria-pressed="${t.pattern===0}">🌱 Little sprout <span>${t.pattern===0?'✓':''}</span></button><button type="button" class="jam-pattern jam-flower" data-pattern="1" aria-pressed="${t.pattern===1}">🌸 Wildflower <span>${t.pattern===1?'✓':''}</span></button>`;
    $('.jam-editor').innerHTML=kindergarten?'<p class="jam-edit-help">Try the sprout and flower tunes. They sound lovely together!</p>':`<div class="jam-edit-help">${advanced&&selected!=='percussion'?'Choose a note or a rest for each beat.':'Tap a beat to add a sound or a rest.'} <span>Changes join at the next phrase.</span></div><div class="jam-note-grid">${t.notes.map((n,i)=>advanced&&selected!=='percussion'?`<label><span>${i+1}</span><select data-note="${i}" aria-label="Beat ${i+1} note"><option value="rest"${n===null?' selected':''}>Rest</option>${PITCHES.map((name,p)=>`<option value="${p}"${n===p?' selected':''}>${name}</option>`).join('')}</select></label>`:`<button type="button" data-note="${i}" class="jam-step${n!==null?' jam-on':''}" aria-label="Beat ${i+1}: ${n!==null?'sound':'rest'}" aria-pressed="${n!==null}"><span>${i+1}</span>${n!==null?'♪':'—'}</button>`).join('')}</div>`;
    root.querySelectorAll('[data-pattern]').forEach(button=>button.onclick=()=>{t.pattern=Number(button.dataset.pattern);t.notes=[...PATTERNS[t.id][t.pattern]];save('New tune ready for the next phrase.');editor();$(`[data-pattern="${t.pattern}"]`).focus();});
    root.querySelectorAll('[data-note]').forEach(control=>{
      if(control.tagName==='SELECT')control.onchange=()=>{t.notes[Number(control.dataset.note)]=control.value==='rest'?null:Number(control.value);save('Your notes join at the next phrase.');};
      else control.onclick=()=>{const i=Number(control.dataset.note);t.notes[i]=t.notes[i]===null?(PATTERNS[t.id][t.pattern][i]??0):null;save('Your rhythm joins at the next phrase.');editor();$(`[data-note="${i}"]`).focus();};
    });updateStage();
  }
  root.querySelectorAll('[data-musician]').forEach(button=>button.onclick=()=>{selected=button.dataset.musician;const track=band.tracks.find(t=>t.id===selected),c=CAST.find(c=>c.id===selected);track.enabled=!track.enabled;save(`${c.name} ${track.enabled?'joins':'rests'} on the next beat.`);editor();});
  $('.jam-friend').onchange=e=>{selected=e.target.value;editor();};
  root.querySelectorAll('[data-volume]').forEach(input=>input.oninput=()=>{band.tracks.find(t=>t.id===input.dataset.volume).volume=Number(input.value);save();});
  $('.jam-play').onclick=()=>{if(playback.active){stopAll();return;}stopAll();void playback.toggle(band);};
  $('.jam-quiet').onclick=()=>{
    if(quiet){stopAll();return;}
    stopAll();quiet=true;visualBeat=0;$('.jam-quiet').setAttribute('aria-pressed','true');$('.jam-quiet').textContent='■ Stop quiet';$('.jam-status').textContent=bandPlaybackMessage(band,{quiet:true});
    let quietBand=getSnapshot();
    const tick=()=>{quietBand=applyBeatChanges(quietBand,band,visualBeat);beat({beat:visualBeat,notes:notesForBeat(quietBand,visualBeat)});visualBeat=(visualBeat+1)%8;};tick();visualTimer=setInterval(tick,60000/90);
  };
  $('.jam-master input').oninput=e=>{band.masterVolume=Number(e.target.value);save();};
  $('.jam-record').onclick=async()=>{
    if(recording){cancelRecording();$('.jam-status').textContent='Recording canceled.';return;}
    recording=true;const token=++recordingToken,score=getSnapshot();
    $('.jam-record').textContent='Cancel recording';$('.jam-status').textContent='Making a two-phrase recording…';
    try{
      const buffer=await renderBandPreview(score,{phrases:2});
      if(destroyed||token!==recordingToken)return;
      const url=URL.createObjectURL(new Blob([encodeWav(buffer)],{type:'audio/wav'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='my-meadow-band.wav';anchor.hidden=true;root.append(anchor);anchor.click();anchor.remove();
      downloadURLs.set(url,setTimeout(()=>{URL.revokeObjectURL(url);downloadURLs.delete(url);},30000));
      $('.jam-status').textContent='Recording prepared. Check your downloads.';
    }catch{if(!destroyed&&token===recordingToken)$('.jam-status').textContent='Could not make a recording in this browser. Your band remains here.';}
    finally{if(!destroyed&&token===recordingToken){recording=false;$('.jam-record').textContent='↓ Save recording';}}
  };
  $('.jam-save').onclick=()=>{stopAll();onComplete(getSnapshot());};
  $('.jam-back').onclick=()=>{stopAll();onSave(getSnapshot());onClose(getSnapshot());};
  const hide=()=>{if(document.hidden)stopAll();};document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',stopAll);
  const tray=$('.jam-transport');
  const measureTray=()=>root.style.setProperty('--jam-tray-height',`${Math.ceil(tray.getBoundingClientRect().height)}px`);
  const trayObserver=typeof ResizeObserver==='function'?new ResizeObserver(measureTray):null;
  trayObserver?.observe(tray);measureTray();
  const revealFocus=event=>{
    if(tray.contains(event.target)||!event.target.getBoundingClientRect)return;
    const bounds=event.target.getBoundingClientRect(),trayBounds=tray.getBoundingClientRect();
    if(bounds.top<trayBounds.bottom+8&&bounds.bottom>root.getBoundingClientRect().top)root.scrollTop-=trayBounds.bottom+8-bounds.top;
  };
  root.addEventListener('focusin',revealFocus);
  editor();
  return {getSnapshot,pause:stopAll,destroy(){destroyed=true;stopAll();trayObserver?.disconnect();root.removeEventListener('focusin',revealFocus);for(const [url,timer] of downloadURLs){clearTimeout(timer);URL.revokeObjectURL(url);}downloadURLs.clear();engine.destroy();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',stopAll);root.remove();}};
}
