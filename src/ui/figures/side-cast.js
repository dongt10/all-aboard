// Pip and Nori wander the village like the neighbors; Cricket only stands on the music stage.
const sheet = id => `assets/figures/${id}.png`;

export const SIDE_CAST = [
  { id: 'pip', name: 'Pip', species: 'duck', sheet: sheet('pip'), views: ['front', 'left', 'right'], walks: true, joy: true },
  { id: 'nori', name: 'Nori', species: 'turtle', sheet: sheet('nori'), views: ['front', 'left', 'right'], walks: true, joy: true },
  { id: 'cricket', name: 'Cricket', species: 'cricket', sheet: sheet('cricket'), views: ['front'], walks: false, joy: true },
];
