import { sanitizeBandSnapshot, phraseNotes } from './audio.js';
export { createDefaultBand, sanitizeBandSnapshot } from './audio.js';

export const CAST=[
  {id:'bass',character:'reading',name:'Sora',color:'#91c5f5',sound:'Bum-bum bass',icon:'♩',line:'I play the low notes, like a big drum.'},
  {id:'voice',character:'nori',name:'Nori',color:'#e4a2cf',sound:'Doo-doo singer',icon:'♫',line:'I sing in the middle, warm and round.'},
  {id:'melody',character:'music',name:'Kiko',color:'#f6c85f',sound:'Whistling bird',icon:'♪',line:'I whistle high, like a bird!'},
  {id:'percussion',character:'cricket',name:'Cricket',color:'#79cfc2',sound:'Tap-tap rhythm',icon:'♬',line:'Tap, rest, tap! I keep the beat.'},
];
export function bandPlaybackMessage(snapshot,{quiet=false}={}) {
  const band=sanitizeBandSnapshot(snapshot);
  const musicalTracks=band.tracks.filter(track=>track.enabled&&[...band.form].some(letter=>phraseNotes(track,letter).some(note=>note!==null)));
  if(!musicalTracks.length)return `${quiet?'See beat: everyone':'Everyone'} is resting. Invite a friend or add a note.`;
  if(!musicalTracks.some(track=>track.volume>0))return quiet?'See beat: friend volumes are at zero. Raise one to see their beat.':'Your friends are muted. Raise a friend’s volume to listen.';
  if(quiet)return 'See beat: watch the beat without sound.';
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
