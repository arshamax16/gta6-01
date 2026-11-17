// Solmar Bay — shared constants, tuning and the city layout table.
// Every value here was chosen for this game: a 3.6 km square coastal city
// on a regular street grid, with four named districts and six landmarks
// that the missions use as their destinations.

export const WORLD_SIZE = 3600;          // world is WORLD_SIZE x WORLD_SIZE px
export const ROAD_WIDTH = 96;
export const ROAD_GAP = 400;             // distance between road centre lines
export const ROAD_FIRST = 200;           // centre line of the first road
export const ROAD_COUNT = 9;             // roads at 200, 600, ... 3400

export const STEP = 1 / 60;              // fixed simulation step (seconds)
export const SAVE_KEY = 'solmarbay.save.v1';

// Player tuning
export const PLAYER_WALK_SPEED = 175;
export const PLAYER_RUN_SPEED = 265;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RADIUS = 13;

// Car tuning (arcade, top-down)
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 700;
export const CAR_REVERSE_ACCEL = 260;
export const CAR_MAX_SPEED = 560;
export const CAR_MAX_REVERSE = 180;
export const CAR_TURN_RATE = 2.6;        // rad/s at full lock, scaled by speed
export const CAR_DRAG = 0.55;

// Wanted system
export const WANTED_HEAT_PER_STAR = 25;  // heat 0..125 maps to 0..5 stars
export const WANTED_MAX = 5;

// Clock: the game day starts at 08:00; one game hour lasts 150 real seconds.
export const CLOCK_START_MINUTES = 8 * 60;
export const SECONDS_PER_GAME_HOUR = 150;

// Districts, used for building palettes and the minimap labels.
export const DISTRICTS = [
  { name: 'Old Harbor', x0: 0, y0: 0, x1: 1800, y1: 1800, palette: ['#b98a5e', '#a5714f', '#c49a6b', '#8f6a52'] },
  { name: 'Downtown', x0: 1800, y0: 0, x1: 3600, y1: 1800, palette: ['#7d8aa0', '#6b7a90', '#8b98ac', '#5d6b7f'] },
  { name: 'Marina', x0: 0, y0: 1800, x1: 1800, y1: 3600, palette: ['#e8d9a8', '#dcc98f', '#f0e2b6', '#c9b47e'] },
  { name: 'Sunset Hills', x0: 1800, y0: 1800, x1: 3600, y1: 3600, palette: ['#c98f7a', '#b57a68', '#d9a08c', '#a56a5c'] },
];

// Landmarks the story uses. x/y are world coordinates (px).
export const LANDMARKS = {
  diner:   { name: "Rosa's Diner", x: 600,  y: 600,  label: 'DINER' },
  hideout: { name: 'The Hideout',  x: 3000, y: 3000, label: 'HIDEOUT' },
  docks:   { name: 'Old Harbor Docks', x: 200, y: 300, label: 'DOCKS' },
  bank:    { name: 'Bank of Solmar', x: 2600, y: 600, label: 'BANK' },
  pier:    { name: 'Marina Pier',  x: 600,  y: 3300, label: 'PIER' },
  plaza:   { name: 'Solmar Plaza', x: 1800, y: 1800, label: 'PLAZA' },
};

// Traffic car paint jobs and names (all invented for this game).
export const CAR_MODELS = [
  { name: 'Pinto',   color: '#c0392b' },
  { name: 'Comet',   color: '#2980b9' },
  { name: 'Vela',    color: '#f1c40f' },
  { name: 'Bruto',   color: '#7f8c8d' },
  { name: 'Lumen',   color: '#ecf0f1' },
  { name: 'Falco',   color: '#16a085' },
  { name: 'Dune',    color: '#e67e22' },
  { name: 'Onyx',    color: '#2c3e50' },
  { name: 'Coral',   color: '#e74c3c' },
  { name: 'Mistral', color: '#9b59b6' },
];

export const PED_SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8'];
export const PED_PANTS = ['#2c3e50', '#34495e', '#7f8c8d', '#5d4037', '#37474f'];
