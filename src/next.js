import { loadState } from './progress.js';
import { mountStage, applySettings } from './ui/stage.js';

const state = loadState();
const { stage } = mountStage(document.querySelector('#app'));
applySettings(stage, state.settings);
stage.innerHTML = '<div class="stage-placeholder"><p class="px-frame">The festival is getting ready…</p></div>';
