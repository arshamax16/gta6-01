// Solmar Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between title, play, paused and game over.
//
// ?seed=N fixes the city and traffic. ?shot=start|foot|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import {
  CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_MAX_REVERSE, CAR_MAX_SPEED,
  CAR_REVERSE_ACCEL, CAR_TURN_RATE, CLOCK_START_MINUTES, LANDMARKS,
  PLAYER_MAX_HEALTH, PLAYER_RADIUS, PLAYER_RUN_SPEED, PLAYER_WALK_SPEED,
  ROAD_WIDTH, SECONDS_PER_GAME_HOUR, STEP, WORLD_SIZE,
} from './config.js';
import { createRandom } from './rng.js';
import { createCity, collideCircleBuildings, nearestRoad } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  addSkid, addWanted, burstBlood, burstSmoke, burstSparks, createPlayer,
  damagePlayer, dist, enterCar, exitCar, nearestStealableCar, spawnGoon,
  spawnParkedCar, spawnPed, spawnPolice, spawnTrafficCar, updateBullets,
  updateGoons, updateParticles, updatePeds, updatePolice, updateTraffic,
  wantedStarsOf, angleLerp,
} from './entities.js';
import { MISSIONS, makeCourierJob, objectiveText } from './missions.js';
import { clearSave, hasSave, loadSave, saveGame } from './save.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer, daylightFactor } from './render.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// ---- game state ----
function createGameState(seedValue) {
  const rng = createRandom(seedValue);
  const city = createCity(rng);
  const state = {
    seed: seedValue,
    rng,
    city,
    time: 0,
    clockMinutes: CLOCK_START_MINUTES,
    money: 50,
    ammo: 60,
    wantedHeat: 0,
    player: createPlayer(LANDMARKS.diner.x, LANDMARKS.diner.y + 120),
    cars: [],
    peds: [],
    police: [],
    goons: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    camera: { x: LANDMARKS.diner.x, y: LANDMARKS.diner.y + 120, zoom: 0.95 },
    marker: null,
    missionIndex: 0,
    stepIndex: 0,
    stepState: {},
    dialogue: null,
    toast: '',
    toastTimer: 0,
    gunfireTimer: 0,
    carrying: false,
    stats: { kills: 0, missionsDone: 0, carsStolen: 0 },
    events: [],
    screen: SCREEN_TITLE,
    menuIndex: 0,
    helpOpen: false,
    overReason: '',
    saveMessage: '',
    muted: false,
    policeSpawnTimer: 0,
    pickupSpawnTimer: 20,
    autoSaveTimer: 45,
    courierCount: 0,
    currentMission: null,
    wantedStars() { return wantedStarsOf(this.wantedHeat); },
  };
  // Parked cars in roadside bays (on the road strip, offset from the lane so
  // traffic can pass) so mission 1 is always doable on foot.
  spawnParkedCar(state, 636, 760, Math.PI / 2);   // by Rosa's Diner
  spawnParkedCar(state, 1700, 1836, 0);           // by Solmar Plaza
  spawnParkedCar(state, 1900, 1764, Math.PI);     // by Solmar Plaza
  spawnParkedCar(state, 3036, 3120, Math.PI / 2); // by the Hideout
  spawnParkedCar(state, 2500, 636, 0);            // by the Bank of Solmar
  for (let i = 0; i < 14; i += 1) spawnTrafficCar(state);
  for (let i = 0; i < 26; i += 1) spawnPed(state);
  spawnPickups(state);
  return state;
}

function spawnPickups(state) {
  const spots = [
    { kind: 'health', x: 1000, y: 1000 }, { kind: 'ammo', x: 2200, y: 1000 },
    { kind: 'health', x: 1000, y: 2600 }, { kind: 'ammo', x: 2600, y: 2600 },
    { kind: 'cash', x: 1800, y: 1400 }, { kind: 'health', x: 3000, y: 1800 },
  ];
  for (const s of spots) state.pickups.push({ ...s, amount: s.kind === 'cash' ? 50 : 0 });
}

// ---- missions ----
function currentMission(state) {
  if (state.currentMission) return state.currentMission;
  if (state.missionIndex < MISSIONS.length) return MISSIONS[state.missionIndex];
  return null;
}

function startMission(state, mission) {
  state.currentMission = mission;
  state.stepIndex = 0;
  state.stepState = {};
  state.dialogue = [...mission.briefing];
  startStep(state);
}

function startStep(state) {
  const mission = currentMission(state);
  if (!mission) { state.marker = null; return; }
  const step = mission.steps[state.stepIndex];
  if (!step) { state.marker = null; return; }
  state.stepState = { kills: 0, checkpointsHit: 0, timeLeft: step.seconds || 0, holdLeft: step.seconds || 0, holding: false };
  if (step.type === 'kill') {
    for (let i = 0; i < step.count; i += 1) {
      spawnGoon(state, step.spawn.x + (state.rng() - 0.5) * 160, step.spawn.y + (state.rng() - 0.5) * 160);
    }
  }
  if (step.type === 'timed') addWanted(state, step.heat || 0);
  if (step.type === 'hold') addWanted(state, 0);
  updateMarker(state);
}

function updateMarker(state) {
  const mission = currentMission(state);
  if (!mission) { state.marker = null; return; }
  const step = mission.steps[state.stepIndex];
  if (!step) { state.marker = null; return; }
  if (step.type === 'timed') {
    const next = step.checkpoints[state.stepState.checkpointsHit];
    state.marker = next ? { x: next.x, y: next.y } : null;
  } else if (step.type === 'steal') {
    state.marker = null;
  } else if (step.type === 'kill') {
    state.marker = { x: step.spawn.x, y: step.spawn.y };
  } else {
    state.marker = { x: step.x, y: step.y };
  }
}

function advanceStep(state, audio) {
  const mission = currentMission(state);
  state.stepIndex += 1;
  if (state.stepIndex >= mission.steps.length) {
    completeMission(state, mission, audio);
  } else {
    startStep(state);
  }
}

function completeMission(state, mission, audio) {
  state.money += mission.reward;
  state.stats.missionsDone += 1;
  state.carrying = false;
  state.toast = `MISSION COMPLETE — ${mission.title}  +$${mission.reward}`;
  state.toastTimer = 4;
  state.dialogue = [...mission.complete];
  audio.missionDone();
  audio.cash();
  saveGame(state);
  // The next mission follows the one just completed, whatever order the
  // story reached it in.
  const completedIdx = MISSIONS.indexOf(mission);
  state.missionIndex = completedIdx >= 0 ? completedIdx + 1 : state.missionIndex + 1;
  if (state.missionIndex >= MISSIONS.length) {
    // Story done: hand out a repeatable courier job.
    state.courierCount += 1;
    state.currentMission = makeCourierJob(state.rng, state.courierCount);
    state.stepIndex = 0;
    state.stepState = {};
    startStep(state);
  } else {
    state.currentMission = null;
    // The next mission starts when the player reaches the Hideout, or
    // immediately after dismissing the completion dialogue.
    state.pendingMission = true;
    state.marker = { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y };
  }
}

function checkMissionStep(state, dt, audio) {
  const mission = currentMission(state);
  if (!mission || state.dialogue) return;
  const step = mission.steps[state.stepIndex];
  if (!step) return;
  const p = state.player;
  const ss = state.stepState;

  if (step.type === 'goto' || step.type === 'deliver') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) advanceStep(state, audio);
  } else if (step.type === 'talk') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      state.dialogue = [...step.lines];
      state.talkStepDone = true;
    }
  } else if (step.type === 'steal') {
    if (!p.onFoot) advanceStep(state, audio);
  } else if (step.type === 'pickup') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      state.prompt = 'Press E to pick it up';
      if (state.interactPressed) {
        state.interactPressed = false;
        state.carrying = true;
        if (step.heat) addWanted(state, step.heat);
        audio.pickup();
        advanceStep(state, audio);
      }
    }
  } else if (step.type === 'kill') {
    ss.kills = state.goons.filter((g) => g.state === 'down').length;
    updateMarker(state);
    if (ss.kills >= step.count) {
      state.goons = [];
      // The turf war is over: Vince's fixer makes the heat go away, so
      // the drive back to the Hideout is not a police gauntlet.
      state.wantedHeat = 0;
      for (const unit of state.police) {
        if (unit.car) {
          const idx = state.cars.indexOf(unit.car);
          if (idx >= 0) state.cars.splice(idx, 1);
        }
      }
      state.police = [];
      state.toast = "HEAT'S OFF — Vince's fixer handled the cops";
      state.toastTimer = 3;
      advanceStep(state, audio);
    }
  } else if (step.type === 'timed') {
    ss.timeLeft -= dt;
    const next = step.checkpoints[ss.checkpointsHit];
    if (next && dist(p.x, p.y, next.x, next.y) < 90) {
      ss.checkpointsHit += 1;
      audio.pickup();
      state.toast = `CHECKPOINT ${ss.checkpointsHit}/${step.checkpoints.length}`;
      state.toastTimer = 1.5;
      updateMarker(state);
    }
    if (ss.checkpointsHit >= step.checkpoints.length) advanceStep(state, audio);
    else if (ss.timeLeft <= 0) {
      state.toast = 'TOO SLOW — the crew got caught. Try again from the Hideout.';
      state.toastTimer = 4;
      // Restart the mission from its first step.
      state.stepIndex = 0;
      startStep(state);
    }
  } else if (step.type === 'hold') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      state.prompt = 'Hold E to crack the vault';
      if (state.holdingE) {
        ss.holding = true;
        ss.holdLeft -= dt;
        if (Math.random() < 0.4) burstSparks(state, p.x, p.y);
        if (ss.holdLeft <= 0) {
          if (step.heat) addWanted(state, step.heat);
          state.carrying = true;
          audio.cash();
          advanceStep(state, audio);
        }
      } else {
        ss.holding = false;
      }
    } else {
      ss.holding = false;
    }
  }
}

// ---- boot ----
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
let state = createGameState(seed);

function announce(message) {
  status.textContent = message;
}

// ---- player movement & driving ----
function updatePlayer(state, dt, input) {
  const p = state.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.arrestTimer = Math.max(0, p.arrestTimer - dt * 0.5);

  if (p.onFoot) {
    const mv = input.moveVector();
    const sprint = input.isHeld('sprint');
    const speed = sprint ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.angle = Math.atan2(mv.y, mv.x);
      const nx = p.x + mv.x * speed * dt;
      const ny = p.y + mv.y * speed * dt;
      const fixed = collideCircleBuildings(state.city, nx, ny, PLAYER_RADIUS);
      p.x = Math.max(60, Math.min(WORLD_SIZE - 60, fixed.x));
      p.y = Math.max(60, Math.min(WORLD_SIZE - 60, fixed.y));
    }
    return;
  }

  // Driving.
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const up = input.isHeld('up');
  const down = input.isHeld('down');
  const left = input.isHeld('left');
  const right = input.isHeld('right');
  if (up) car.speed += CAR_ACCEL * dt;
  else if (down) {
    if (car.speed > 30) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_REVERSE_ACCEL * dt;
  } else {
    car.speed -= car.speed * CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  // Some steering authority even at low speed, so a stopped car can turn
  // out of a dead end instead of sitting helpless.
  const speedFactor = Math.min(1, Math.abs(car.speed) / 120 + 0.15);
  const reverse = car.speed < 0 ? -1 : 1;
  car.angle += steer * CAR_TURN_RATE * speedFactor * reverse * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(120, Math.min(WORLD_SIZE - 120, car.x));
  car.y = Math.max(120, Math.min(WORLD_SIZE - 120, car.y));
  // Building collision as a circle push-out (not a reverted move): a car
  // that clips a building corner slides along the face and can always back
  // out, instead of wedging in the corner with every move reverted.
  const pushed = collideCircleBuildings(state.city, car.x, car.y, 22);
  const pushedDist = dist(pushed.x, pushed.y, car.x, car.y);
  if (pushedDist > 0.5) {
    if (Math.abs(car.speed) > 180) {
      car.hp -= 8;
      burstSparks(state, car.x, car.y);
      state.events.push({ type: 'crash' });
      audio.crash();
    }
    car.x = pushed.x;
    car.y = pushed.y;
    car.speed *= -0.25;
  }
  // Skid marks + smoke when drifting hard.
  if (Math.abs(steer) === 1 && Math.abs(car.speed) > 300) {
    const bx = car.x - Math.cos(car.angle) * 20;
    const by = car.y - Math.sin(car.angle) * 20;
    addSkid(state, bx, by, bx - Math.cos(car.angle) * 8, by - Math.sin(car.angle) * 8);
  }
  if (car.hp < 40 && Math.random() < 0.2) burstSmoke(state, car.x, car.y, 1);
  // Running over pedestrians (a crime).
  for (const ped of state.peds) {
    if (ped.state !== 'down' && dist(car.x, car.y, ped.x, ped.y) < 26) {
      ped.state = 'down';
      burstBlood(state, ped.x, ped.y);
      addWanted(state, 15);
      state.events.push({ type: 'crash' });
    }
  }
  // Car-to-car bumps.
  for (const other of state.cars) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 48 && d > 0.01) {
      const push = (48 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      if (Math.abs(car.speed) > 120) {
        other.hp -= 6;
        car.hp -= 3;
        burstSparks(state, (car.x + other.x) / 2, (car.y + other.y) / 2);
      }
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  audio.setEngine(Math.abs(car.speed) / CAR_MAX_SPEED);
}

// ---- combat ----
function tryShoot(state, input, audio) {
  const p = state.player;
  if (!p.onFoot || p.shootCooldown > 0) return;
  if (state.ammo <= 0) {
    state.toast = 'OUT OF AMMO — find an ammo box (orange)';
    state.toastTimer = 2;
    return;
  }
  p.shootCooldown = 0.18;
  state.ammo -= 1;
  state.stats.shotsFired = (state.stats.shotsFired || 0) + 1;
  const angle = Math.atan2(input.mouse.worldY - p.y, input.mouse.worldX - p.x);
  p.angle = angle;
  state.bullets.push({
    x: p.x + Math.cos(angle) * 18, y: p.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720, from: 'player', life: 0.9,
  });
  state.gunfireTimer = 1.5;
  addWanted(state, 2);
  audio.gunshot();
  burstSparks(state, p.x + Math.cos(angle) * 22, p.y + Math.sin(angle) * 22);
}

function tryPunch(state, audio) {
  const p = state.player;
  if (!p.onFoot || p.punchCooldown > 0) return;
  p.punchCooldown = 0.5;
  audio.punch();
  const reach = 46;
  const hit = (t) => {
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > reach) return false;
    const a = Math.atan2(t.y - p.y, t.x - p.x);
    return Math.abs(((a - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1;
  };
  for (const goon of state.goons) {
    if (goon.state !== 'down' && hit(goon)) {
      goon.hp -= 25;
      burstBlood(state, goon.x, goon.y);
      if (goon.hp <= 0) {
        goon.state = 'down';
        state.stats.kills += 1;
        addWanted(state, 12);
      }
      return;
    }
  }
  for (const unit of state.police) {
    if (hit(unit)) {
      unit.hp -= 30;
      burstBlood(state, unit.x, unit.y);
      addWanted(state, 10);
      if (unit.hp <= 0) {
        if (unit.car) {
          const idx = state.cars.indexOf(unit.car);
          if (idx >= 0) state.cars.splice(idx, 1);
        }
        state.police.splice(state.police.indexOf(unit), 1);
      }
      return;
    }
  }
  for (const ped of state.peds) {
    if (ped.state !== 'down' && hit(ped)) {
      ped.hp -= 25;
      burstBlood(state, ped.x, ped.y);
      addWanted(state, 15);
      if (ped.hp <= 0) ped.state = 'down';
      return;
    }
  }
}

// ---- wanted & police ----
function updateWanted(state, dt) {
  const stars = state.wantedStars();
  // Heat fades when no police is near and no crime just happened (the
  // grace period after a crime holds it so the cops can actually respond).
  state.heatGrace = Math.max(0, (state.heatGrace || 0) - dt);
  const nearestCop = state.police.reduce((m, u) => Math.min(m, dist(u.x, u.y, state.player.x, state.player.y)), Infinity);
  if (state.heatGrace <= 0 && nearestCop > 500 && state.wantedHeat > 0) {
    state.wantedHeat = Math.max(0, state.wantedHeat - dt * 1.5);
  }
  // Spawn police up to the star count; despawn extras when heat fades.
  state.policeSpawnTimer -= dt;
  if (state.police.length < stars && state.policeSpawnTimer <= 0) {
    spawnPolice(state);
    state.policeSpawnTimer = 1.2;
  }
  if (state.police.length > stars) {
    // A far unit gives up and leaves.
    let farthest = null;
    let farD = 0;
    for (const u of state.police) {
      const d = dist(u.x, u.y, state.player.x, state.player.y);
      if (d > farD) { farD = d; farthest = u; }
    }
    if (farthest && farD > 600) {
      if (farthest.car) {
        const idx = state.cars.indexOf(farthest.car);
        if (idx >= 0) state.cars.splice(idx, 1);
      }
      state.police.splice(state.police.indexOf(farthest), 1);
    }
  }
  audio.setSiren(stars > 0, state.time);
  // Arrest: on foot, a cop stays on top of the player for 2 seconds.
  if (stars > 0 && state.player.onFoot) {
    const close = state.police.some((u) => dist(u.x, u.y, state.player.x, state.player.y) < 34);
    if (close) {
      state.player.arrestTimer += dt;
      if (state.player.arrestTimer > 2) {
        state.screen = SCREEN_OVER;
        state.overReason = 'busted';
        audio.busted();
      }
    }
  }
}

// ---- pickups & ambient population ----
function updatePickups(state, dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      if (pk.kind === 'health') {
        p.health = Math.min(PLAYER_MAX_HEALTH, p.health + 40);
        state.toast = 'HEALTH +40';
      } else if (pk.kind === 'ammo') {
        state.ammo += 48;
        state.toast = 'AMMO +48';
      } else {
        state.money += pk.amount;
        state.toast = `+$${pk.amount} CASH`;
        audio.cash();
      }
      state.toastTimer = 2;
      audio.pickup();
      state.pickups.splice(i, 1);
    }
  }
  // Replenish pickups over time.
  state.pickupSpawnTimer -= dt;
  if (state.pickupSpawnTimer <= 0) {
    state.pickupSpawnTimer = 45;
    const kinds = ['health', 'ammo', 'cash'];
    const kind = kinds[Math.floor(state.rng() * kinds.length)];
    const rx = nearestRoad(300 + state.rng() * 3000);
    const ry = nearestRoad(300 + state.rng() * 3000);
    state.pickups.push({ kind, x: rx + 60, y: ry + 60, amount: 50 });
  }
  // Keep the streets alive: top up traffic and pedestrians near the player.
  if (state.cars.filter((c) => c.kind === 'traffic').length < 12 && Math.random() < 0.02) {
    spawnTrafficCar(state, p.x, p.y);
  }
  if (state.peds.filter((x) => x.state !== 'down').length < 20 && Math.random() < 0.02) {
    spawnPed(state, p.x, p.y);
  }
  // The dead get up and walk away eventually (respawn as fresh pedestrians).
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    if (state.peds[i].state === 'down' && dist(state.peds[i].x, state.peds[i].y, p.x, p.y) > 500) {
      state.peds.splice(i, 1);
    }
  }
}

function processEvents(state, audio) {
  for (const ev of state.events) {
    if (ev.type === 'wanted-up') {
      state.toast = `WANTED LEVEL ${ev.stars} — the Solmar police are coming`;
      state.toastTimer = 3;
    } else if (ev.type === 'player-down') {
      state.screen = SCREEN_OVER;
      state.overReason = 'wasted';
      audio.busted();
    } else if (ev.type === 'car-destroyed') {
      if (state.player.car === ev.car) {
        exitCar(state);
        state.cars.splice(state.cars.indexOf(ev.car), 1);
        state.toast = 'YOUR CAR IS WRECKED';
        state.toastTimer = 3;
      } else {
        state.cars.splice(state.cars.indexOf(ev.car), 1);
      }
    } else if (ev.type === 'car-enter') {
      audio.carDoor();
      state.stats.carsStolen += 1;
    } else if (ev.type === 'car-exit') {
      audio.carDoor();
    } else if (ev.type === 'enemy-shot') {
      audio.enemyShot();
    } else if (ev.type === 'goon-down') {
      state.toast = 'Saltwater crew member down';
      state.toastTimer = 1.5;
    }
  }
  state.events.length = 0;
}

// ---- the per-step world update (play screen only) ----
function stepWorld(state, dt, input, audio) {
  state.time += dt;
  state.clockMinutes += (dt / SECONDS_PER_GAME_HOUR) * 60;
  state.gunfireTimer = Math.max(0, state.gunfireTimer - dt);
  state.toastTimer = Math.max(0, state.toastTimer - dt);
  state.autoSaveTimer -= dt;
  if (state.autoSaveTimer <= 0) {
    state.autoSaveTimer = 60;
    saveGame(state);
  }

  // Dialogue first: E or click dismisses it, nothing else acts.
  if (state.dialogue) {
    if (input.takePressed('interact') || input.takePressed('confirm') || input.takeClick()) {
      state.dialogue = null;
      if (state.talkStepDone) {
        state.talkStepDone = false;
        advanceStep(state, audio);
      } else if (state.pendingMission) {
        state.pendingMission = false;
        startMission(state, MISSIONS[state.missionIndex]);
      }
    }
    input.endFrame();
    return;
  }

  state.interactPressed = input.takePressed('interact');
  state.holdingE = input.isHeld('interact');
  state.prompt = null; // recomputed every step; checkMissionStep may set one

  // Pause / mute / help.
  if (input.takePressed('pause')) {
    state.screen = SCREEN_PAUSED;
    state.menuIndex = 0;
    announce('Paused.');
    input.endFrame();
    return;
  }
  if (input.takePressed('mute')) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
  }
  if (input.takePressed('help')) state.helpOpen = !state.helpOpen;

  // Enter / exit a car — but a mission interaction (pickup / vault) at the
  // player's feet wins over the car: otherwise the E meant for the crate
  // just puts you back in the car you stepped out of.
  const missionNow = currentMission(state);
  const stepNow = missionNow && missionNow.steps[state.stepIndex];
  const nearMissionInteract = stepNow
    && (stepNow.type === 'pickup' || stepNow.type === 'hold')
    && dist(state.player.x, state.player.y, stepNow.x, stepNow.y) < stepNow.radius;
  if (state.interactPressed) {
    const p = state.player;
    if (!p.onFoot) {
      exitCar(state);
      state.interactPressed = false;
    } else if (!nearMissionInteract) {
      const car = nearestStealableCar(state);
      if (car) {
        const wasParked = car.kind === 'parked';
        enterCar(state, car);
        if (!wasParked) {
          addWanted(state, 12); // stealing a driven car is a crime
          state.toast = 'CAR STOLEN — the owner called the cops';
          state.toastTimer = 2.5;
        }
        state.interactPressed = false;
      }
    }
  }

  // Combat.
  if (input.takeClick() && !state.helpOpen) tryShoot(state, input, audio);
  if (input.takePressed('attack')) tryPunch(state, audio);

  updatePlayer(state, dt, input);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateGoons(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateWanted(state, dt);
  updatePickups(state, dt);
  checkMissionStep(state, dt, audio);
  processEvents(state, audio);

  // Camera follows the player, smoothly.
  const cam = state.camera;
  const targetZoom = state.player.onFoot ? 1.0 : 0.85;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2);
  cam.x += (state.player.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (state.player.y - cam.y) * Math.min(1, dt * 5);

  // Mouse world coordinates for aiming.
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  void scaleX;
  input.mouse.worldX = cam.x + (input.mouse.x - window.innerWidth / 2) / cam.zoom;
  input.mouse.worldY = cam.y + (input.mouse.y - window.innerHeight / 2) / cam.zoom;

  // Interaction prompt. (A pickup / hold prompt set by checkMissionStep
  // above is kept; everything else is recomputed here.)
  const mission = currentMission(state);
  if (!state.prompt && state.player.onFoot) {
    const car = nearestStealableCar(state);
    if (car) state.prompt = `Press E to steal the ${car.model}`;
    else if (mission && mission.steps[state.stepIndex] && mission.steps[state.stepIndex].type === 'talk'
      && dist(state.player.x, state.player.y, mission.steps[state.stepIndex].x, mission.steps[state.stepIndex].y) < 100) {
      state.prompt = 'Press E to talk';
    }
  } else if (!state.prompt && !state.player.onFoot) {
    state.prompt = 'Press E to get out';
  }
  if (state.player.onFoot && state.player.health < 30) state.prompt = state.prompt || 'Low health — find a white first-aid box';

  input.endFrame();
}

// Ambient city life behind the title screen.
function stepAmbient(state, dt) {
  state.time += dt;
  state.clockMinutes += (dt / SECONDS_PER_GAME_HOUR) * 60;
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateParticles(state, dt);
  state.camera.x += (LANDMARKS.plaza.x - state.camera.x) * Math.min(1, dt * 0.5);
  state.camera.y += (LANDMARKS.plaza.y - state.camera.y) * Math.min(1, dt * 0.5);
}

// ---- menus ----
function extrasFor(state, input) {
  const mission = currentMission(state);
  return {
    objective: mission ? `${mission.title}: ${objectiveText(mission, state.stepIndex, state.stepState)}` : 'Free roam — visit the Hideout for work',
    dialogue: state.dialogue,
    toast: state.toast,
    toastTimer: state.toastTimer,
    prompt: state.prompt,
    mouseX: input ? input.mouse.x : 0,
    mouseY: input ? input.mouse.y : 0,
    menuIndex: state.menuIndex,
    hasSave: hasSave(),
    helpOpen: state.helpOpen,
    saveMessage: state.saveMessage,
    overReason: state.overReason,
    muted: state.muted,
  };
}

function applySave(state, data) {
  state.money = data.money;
  state.player.health = data.health;
  state.ammo = data.ammo;
  state.wantedHeat = data.wantedHeat;
  state.player.x = data.x;
  state.player.y = data.y;
  state.clockMinutes = data.clockMinutes;
  state.missionIndex = data.missionIndex;
  state.stats.missionsDone = data.missionsDone;
  state.stats.kills = data.kills;
  state.stats.carsStolen = data.carsStolen;
  state.camera.x = data.x;
  state.camera.y = data.y;
  state.currentMission = null;
  state.pendingMission = false;
}

function startNewGame(state, audio) {
  const fresh = createGameState(Math.floor(Math.random() * 4294967296));
  // Keep the same object identity for the renderer/debug hooks.
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fresh);
  state.screen = SCREEN_PLAY;
  startMission(state, MISSIONS[0]);
  audio.unlock();
  announce('Playing. Follow the yellow marker.');
}

function respawn(state, audio) {
  state.player.health = PLAYER_MAX_HEALTH;
  state.wantedHeat = 0;
  state.police = [];
  state.player.x = LANDMARKS.diner.x;
  state.player.y = LANDMARKS.diner.y + 120;
  if (!state.player.onFoot) {
    const car = state.player.car;
    state.player.car = null;
    state.player.onFoot = true;
    if (car) car.kind = 'parked';
  }
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.screen = SCREEN_PLAY;
  state.overReason = '';
  announce('Back on the streets of Solmar Bay.');
}

// ---- main loop ----
function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let titleItems = hasSave() ? 3 : 2;

  function menuUpDown() {
    const max = state.screen === SCREEN_TITLE ? titleItems : 4;
    if (input.isHeld('up') && input.takePressed('up')) state.menuIndex = (state.menuIndex + max - 1) % max;
    if (input.isHeld('down') && input.takePressed('down')) state.menuIndex = (state.menuIndex + 1) % max;
  }

  function handleTitleInput() {
    titleItems = hasSave() ? 3 : 2;
    if (input.takePressed('up')) state.menuIndex = (state.menuIndex + titleItems - 1) % titleItems;
    if (input.takePressed('down')) state.menuIndex = (state.menuIndex + 1) % titleItems;
    if (input.takePressed('help')) state.helpOpen = !state.helpOpen;
    if (state.helpOpen && (input.takePressed('pause') || input.takePressed('confirm'))) state.helpOpen = false;
    const confirm = input.takePressed('confirm') || input.takeClick();
    if (!confirm) return;
    audio.unlock();
    const idx = state.menuIndex;
    if (hasSave() && idx === 0) {
      const data = loadSave();
      if (data) {
        applySave(state, data);
        state.screen = SCREEN_PLAY;
        startMission(state, MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)]);
        announce('Continuing your story.');
      }
    } else if ((!hasSave() && idx === 0) || (hasSave() && idx === 1)) {
      startNewGame(state, audio);
    } else {
      state.helpOpen = true;
    }
    input.endFrame();
  }

  function handlePauseInput() {
    if (input.takePressed('up')) state.menuIndex = (state.menuIndex + 3) % 4;
    if (input.takePressed('down')) state.menuIndex = (state.menuIndex + 1) % 4;
    if (input.takePressed('help')) state.helpOpen = !state.helpOpen;
    if (input.takePressed('pause') && !state.helpOpen) {
      state.screen = SCREEN_PLAY;
      input.endFrame();
      return;
    }
    const confirm = input.takePressed('confirm') || input.takeClick();
    if (!confirm) return;
    audio.unlock();
    if (state.menuIndex === 0) state.screen = SCREEN_PLAY;
    else if (state.menuIndex === 1) {
      state.saveMessage = saveGame(state) ? 'Game saved.' : 'Save failed (storage off).';
    } else if (state.menuIndex === 2) state.helpOpen = true;
    else if (state.menuIndex === 3) {
      state.screen = SCREEN_TITLE;
      state.menuIndex = 0;
      state.helpOpen = false;
      clearSaveKeepProgress(state);
    }
    input.endFrame();
  }

  // Quitting to title keeps the world but returns to the menu.
  function clearSaveKeepProgress() {}

  function handleOverInput() {
    if (input.takePressed('confirm') || input.takeClick()) {
      audio.unlock();
      respawn(state, audio);
      input.endFrame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (state.screen === SCREEN_TITLE) {
      handleTitleInput();
      while (accumulator >= STEP) { stepAmbient(state, STEP); accumulator -= STEP; }
    } else if (state.screen === SCREEN_PLAY) {
      while (accumulator >= STEP && state.screen === SCREEN_PLAY) {
        stepWorld(state, STEP, input, audio);
        accumulator -= STEP;
      }
      if (state.screen !== SCREEN_PLAY) accumulator = 0;
    } else if (state.screen === SCREEN_PAUSED) {
      handlePauseInput();
      accumulator = 0;
    } else if (state.screen === SCREEN_OVER) {
      handleOverInput();
      accumulator = 0;
    }
    renderer.draw(state, state.screen, extrasFor(state, input));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// ---- screenshot staging (?shot=...) ----
function runShot(name) {
  const input = createInput(canvas);
  // Deterministic golden-hour-ish clock per scene.
  const clocks = { start: 17 * 60 + 20, foot: 10 * 60, drive: 12 * 60, chase: 18 * 60 + 30, mission: 10 * 60 + 30 };
  state.clockMinutes = clocks[name] ?? 10 * 60;
  state.screen = SCREEN_PLAY;

  if (name === 'start') {
    state.screen = SCREEN_TITLE;
    state.camera.x = LANDMARKS.plaza.x;
    state.camera.y = LANDMARKS.plaza.y;
    state.camera.zoom = 0.9;
  } else if (name === 'foot') {
    state.player.x = LANDMARKS.plaza.x;
    state.player.y = LANDMARKS.plaza.y;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    startMission(state, MISSIONS[0]);
    state.dialogue = null;
    state.stepIndex = 0;
    startStep(state);
    for (let i = 0; i < 90; i += 1) { stepAmbient(state, STEP); }
  } else if (name === 'drive') {
    const car = state.cars.find((c) => c.kind === 'parked');
    state.player.x = 1800;
    state.player.y = 1400;
    enterCar(state, car);
    car.x = 1800; car.y = 1400; car.angle = 0; car.speed = 320;
    state.player.x = car.x; state.player.y = car.y;
    state.camera.x = car.x; state.camera.y = car.y; state.camera.zoom = 0.85;
    startMission(state, MISSIONS[0]);
    state.dialogue = null;
    state.stepIndex = 3; // 'Drive the car back to the diner' — already driving
    startStep(state);
    for (let i = 0; i < 40; i += 1) stepAmbient(state, STEP);
  } else if (name === 'chase') {
    state.player.x = 2200;
    state.player.y = 1400;
    const car = state.cars.find((c) => c.kind === 'parked');
    enterCar(state, car);
    car.x = 2200; car.y = 1400; car.angle = 0; car.speed = 380;
    state.player.x = car.x; state.player.y = car.y;
    state.camera.x = car.x; state.camera.y = car.y; state.camera.zoom = 0.85;
    state.wantedHeat = 26; // 1 star now; the timed step adds 50 → 3 stars
    startMission(state, MISSIONS[2]);
    state.dialogue = null;
    // startMission already started step 0 (the timed checkpoints, +50 heat).
    for (let i = 0; i < 3; i += 1) spawnPolice(state);
    for (let i = 0; i < 120; i += 1) {
      updatePolice(state, STEP);
      updateTraffic(state, STEP);
      state.time += STEP;
    }
  } else if (name === 'mission') {
    state.player.x = LANDMARKS.pier.x - 60;
    state.player.y = LANDMARKS.pier.y - 40;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    state.camera.zoom = 1.0;
    startMission(state, MISSIONS[3]);
    state.dialogue = null;
    state.stepIndex = 1;
    startStep(state);
    for (let i = 0; i < 60; i += 1) {
      updateGoons(state, STEP);
      state.time += STEP;
    }
  }

  let painted = 0;
  function paint() {
    renderer.draw(state, state.screen, extrasFor(state, input));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// Debug / playtest hooks (read-only state + a few actions the test driver uses).
window.__solmar = {
  state: () => state,
  screen: () => state.screen,
  startNewGame: () => startNewGame(state, audio),
  mission: () => currentMission(state),
  step: () => (currentMission(state) ? currentMission(state).steps[state.stepIndex] : null),
  startMission: (i) => startMission(state, MISSIONS[i]),
  addWanted: (heat) => addWanted(state, heat),
  teleport: (x, y) => { state.player.x = x; state.player.y = y; state.camera.x = x; state.camera.y = y; },
};

if (shot) runShot(shot);
else runGame();
