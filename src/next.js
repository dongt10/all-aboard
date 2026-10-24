import { createApp } from './ui/app.js';
import { createTitleScene } from './ui/screens/title.js';
import { createVillageScene } from './ui/screens/village.js';
import { createEncounterScene } from './ui/screens/encounter.js';
import { createMusicScene } from './ui/screens/music.js';
import { createParadeScene } from './ui/screens/parade.js';

const app = createApp(document.querySelector('#app'), {
  scenes: { title: createTitleScene, village: createVillageScene, encounter: createEncounterScene, music: createMusicScene, parade: createParadeScene },
});
app.go('title');
