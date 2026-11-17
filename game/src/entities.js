// Solmar Bay — the living city: the player, traffic cars, pedestrians,
// police units, rival goons, bullets and particles. Each factory makes one
// plain object; each update function advances one population a step.

import {
  CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_MODELS,
  CAR_REVERSE_ACCEL, CAR_TURN_RATE, PED_PANTS, PED_SHIRTS, PLAYER_MAX_HEALTH,
  PLAYER_RADIUS, ROAD_WIDTH, WANTED_HEAT_PER_STAR,
} from './config.js';
import { collideCircleBuildings, isOnRoad, nearestRoad, rectHitsBuilding } from './city.js';
import { floatBetween, intBetween, pick } from './rng.js';

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

let nextCarId = 1;

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    health: PLAYER_MAX_HEALTH,
    punchCooldown: 0, shootCooldown: 0, invuln: 0,
    arrestTimer: 0, moving: false,
  };
}

export function makeCar(x, y, angle, kind, rng) {
  const model = pick(rng, CAR_MODELS);
  return {
    id: nextCarId,
    x, y, angle, speed: 0,
    color: kind === 'police' ? '#1c2733' : model.color,
    model: kind === 'police' ? 'Interceptor' : model.name,
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    hp: 140,
    routeAxis: rng() < 0.5 ? 'x' : 'y',
    routeDir: rng() < 0.5 ? 1 : -1,
    targetSpeed: floatBetween(rng, 90, 150),
    turnCooldown: 0,
    sirenPhase: rng() * Math.PI * 2,
  };
}

// Spawn a traffic car on a road near the player (or anywhere if no player).
export function spawnTrafficCar(state, nearX, nearY) {
  const { rng, city, cars } = state;
  for (let tries = 0; tries < 12; tries += 1) {
    const cx = nearX === undefined ? floatBetween(rng, 300, 3300) : nearX + floatBetween(rng, -700, 700);
    const cy = nearY === undefined ? floatBetween(rng, 300, 3300) : nearY + floatBetween(rng, -700, 700);
    const rx = nearestRoad(cx);
    const ry = nearestRoad(cy);
    const onVertical = Math.abs(cx - rx) < Math.abs(cy - ry);
    const x = onVertical ? rx + (rng() < 0.5 ? -22 : 22) : floatBetween(rng, 300, 3300);
    const y = onVertical ? floatBetween(rng, 300, 3300) : ry + (rng() < 0.5 ? -22 : 22);
    if (x < 150 || x > 3450 || y < 150 || y > 3450) continue;
    if (state.player && dist(x, y, state.player.x, state.player.y) < 220) continue;
    if (cars.some((c) => dist(x, y, c.x, c.y) < 90)) continue;
    const car = makeCar(x, y, 0, 'traffic', rng);
    car.routeAxis = onVertical ? 'y' : 'x';
    car.routeDir = rng() < 0.5 ? 1 : -1;
    car.angle = car.routeAxis === 'x' ? (car.routeDir > 0 ? 0 : Math.PI) : (car.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.speed = car.targetSpeed;
    cars.push(car);
    return car;
  }
  return null;
}

export function spawnParkedCar(state, x, y, angle) {
  const car = makeCar(x, y, angle, 'parked', state.rng);
  state.cars.push(car);
  return car;
}

export function spawnPed(state, nearX, nearY) {
  const { rng, peds } = state;
  const x = nearX === undefined ? floatBetween(rng, 300, 3300) : nearX + floatBetween(rng, -500, 500);
  const y = nearY === undefined ? floatBetween(rng, 300, 3300) : nearY + floatBetween(rng, -500, 500);
  const ped = {
    x: Math.max(120, Math.min(3480, x)),
    y: Math.max(120, Math.min(3480, y)),
    angle: floatBetween(rng, 0, Math.PI * 2),
    speed: floatBetween(rng, 30, 60),
    shirt: pick(rng, PED_SHIRTS),
    pants: pick(rng, PED_PANTS),
    state: 'walk', // 'walk' | 'flee' | 'down'
    hp: 20,
    retarget: 0,
    panic: 0,
  };
  peds.push(ped);
  return ped;
}

// A police unit. In a car when the player drives or the heat is high;
// on foot otherwise. The unit's position follows its car while driving.
export function spawnPolice(state) {
  const { rng, player } = state;
  const inCar = !player.onFoot || state.wantedStars() >= 2;
  const angle = Math.atan2(player.y - 1500, player.x - 1500);
  const sx = player.x + Math.cos(angle + Math.PI) * 0 + floatBetween(rng, -1, 1);
  void sx;
  // Spawn just outside the camera view, on a road.
  const dir = floatBetween(rng, 0, Math.PI * 2);
  const px = player.x + Math.cos(dir) * 750;
  const py = player.y + Math.sin(dir) * 750;
  const unit = {
    x: Math.max(120, Math.min(3480, px)),
    y: Math.max(120, Math.min(3480, py)),
    angle: Math.atan2(player.y - py, player.x - px),
    speed: 0, hp: 60, inCar, car: null,
    attackCooldown: 0, ramCooldown: 0,
  };
  if (inCar) {
    const car = makeCar(unit.x, unit.y, unit.angle, 'police', rng);
    car.speed = 200;
    state.cars.push(car);
    unit.car = car;
  }
  state.police.push(unit);
  return unit;
}

export function spawnGoon(state, x, y) {
  const goon = {
    x, y, angle: 0, hp: 50,
    shootCooldown: floatBetween(state.rng, 0.5, 1.5),
    state: 'guard', // 'guard' | 'chase' | 'down'
    speed: 120,
  };
  state.goons.push(goon);
  return goon;
}

export function addParticle(state, x, y, vx, vy, life, color, size) {
  state.particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

export function burstBlood(state, x, y) {
  for (let i = 0; i < 10; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = floatBetween(state.rng, 40, 160);
    addParticle(state, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5, '#c0392b', 3);
  }
}

export function burstSmoke(state, x, y, n = 6) {
  for (let i = 0; i < n; i += 1) {
    addParticle(state, x, y, floatBetween(state.rng, -20, 20), floatBetween(state.rng, -40, -5), 0.9, '#7f8c8d', 5);
  }
}

export function burstSparks(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = floatBetween(state.rng, 80, 240);
    addParticle(state, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3, '#f1c40f', 2);
  }
}

export function addSkid(state, x1, y1, x2, y2) {
  state.skids.push({ x1, y1, x2, y2, life: 6 });
  if (state.skids.length > 240) state.skids.shift();
}

// ---- wanted helpers (state carries wantedHeat; stars derive from it) ----
export function wantedStarsOf(heat) {
  return Math.max(0, Math.min(5, Math.floor(heat / WANTED_HEAT_PER_STAR)));
}

export function addWanted(state, heat) {
  const before = wantedStarsOf(state.wantedHeat);
  state.wantedHeat = Math.max(0, Math.min(125, state.wantedHeat + heat));
  const after = wantedStarsOf(state.wantedHeat);
  if (heat > 0) state.heatGrace = 5; // fresh crime: the heat holds for 5 s so cops can respond
  if (after > before) state.events.push({ type: 'wanted-up', stars: after });
}

// ---- per-population updates ----

export function updateTraffic(state, dt) {
  const { cars, city } = state;
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    car.turnCooldown -= dt;
    // Follow the current road; at an intersection, sometimes turn.
    const onXRoad = Math.abs(car.y - nearestRoad(car.y)) < ROAD_WIDTH / 2 - 12;
    const onYRoad = Math.abs(car.x - nearestRoad(car.x)) < ROAD_WIDTH / 2 - 12;
    if (car.turnCooldown <= 0 && onXRoad && onYRoad && state.rng() < 0.35) {
      car.routeAxis = car.routeAxis === 'x' ? 'y' : 'x';
      car.routeDir = state.rng() < 0.5 ? 1 : -1;
      car.turnCooldown = 2;
    }
    const targetAngle = car.routeAxis === 'x'
      ? (car.routeDir > 0 ? 0 : Math.PI)
      : (car.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.angle = angleLerp(car.angle, targetAngle, Math.min(1, dt * 3));
    // Slow down if a moving car is right ahead (parked cars sit in the
    // roadside bay, out of the lane, so traffic passes them).
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (forward > 0 && forward < 70 && side < 26) { blocked = true; break; }
    }
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Stay inside the city; turn around at the edge roads.
    if (car.x < 200 || car.x > 3400 || car.y < 200 || car.y > 3400) {
      car.routeDir *= -1;
      car.angle += Math.PI;
      car.x = Math.max(200, Math.min(3400, car.x));
      car.y = Math.max(200, Math.min(3400, car.y));
    }
    void city;
  }
}

export function updatePeds(state, dt) {
  const { peds, player, city } = state;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    ped.retarget -= dt;
    ped.panic = Math.max(0, ped.panic - dt);
    const dPlayer = dist(ped.x, ped.y, player.x, player.y);
    const gunfire = state.gunfireTimer > 0;
    if (ped.state === 'walk' && (dPlayer < 60 || gunfire || ped.panic > 0)) {
      ped.state = 'flee';
      ped.panic = 2;
    }
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.angle = angleLerp(ped.angle, away, Math.min(1, dt * 5));
      ped.speed = 150;
      if (ped.panic <= 0 && dPlayer > 260 && !gunfire) { ped.state = 'walk'; ped.speed = 45; }
    } else if (ped.retarget <= 0) {
      // Wander: prefer staying on roads and sidewalks, turn at intersections.
      ped.angle = Math.floor(state.rng() * 4) * (Math.PI / 2);
      ped.retarget = floatBetween(state.rng, 2, 6);
      ped.speed = floatBetween(state.rng, 30, 60);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    const fixed = collideCircleBuildings(city, nx, ny, 10);
    ped.x = Math.max(100, Math.min(3500, fixed.x));
    ped.y = Math.max(100, Math.min(3500, fixed.y));
  }
}

export function updatePolice(state, dt) {
  const { police, player, city } = state;
  for (const unit of police) {
    unit.attackCooldown -= dt;
    unit.ramCooldown -= dt;
    const target = player.car || null;
    const tx = player.x;
    const ty = player.y;
    const d = dist(unit.x, unit.y, tx, ty);
    if (unit.inCar && unit.car) {
      const car = unit.car;
      // If the player is on foot and the cruiser catches up, the cop gets
      // out and chases on foot so an arrest stays possible.
      if (player.onFoot && d < 70) {
        const idx = state.cars.indexOf(car);
        if (idx >= 0) state.cars.splice(idx, 1);
        unit.inCar = false;
        unit.car = null;
        unit.x = car.x;
        unit.y = car.y;
        unit.speed = 0;
      } else {
        const wantAngle = Math.atan2(ty - car.y, tx - car.x);
      const steer = Math.sin(wantAngle - car.angle);
      car.angle += Math.max(-1, Math.min(1, steer * 2.4)) * CAR_TURN_RATE * 0.7 * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.3);
      // A touch slower than the player's top speed, so a good driver can
      // actually lose them on the straights.
      const targetSpeed = d > 700 ? 440 : Math.min(440, 240 + d * 0.25);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 0.8);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Ram the player's car on contact (a nudge, not a wrecking ball).
      if (target && d < 46 && unit.ramCooldown <= 0) {
        unit.ramCooldown = 1.2;
        target.hp -= 3;
        state.events.push({ type: 'ram' });
        burstSparks(state, (car.x + target.x) / 2, (car.y + target.y) / 2);
        if (target.hp <= 0) {
          burstSmoke(state, target.x, target.y, 14);
          state.events.push({ type: 'car-destroyed', car: target });
        }
      }
      // A police car that clips a building is pushed out along the face
      // instead of wedging in the corner.
      const pushed = collideCircleBuildings(city, car.x, car.y, 22);
      if (dist(pushed.x, pushed.y, car.x, car.y) > 0.5) {
        car.x = pushed.x;
        car.y = pushed.y;
        car.speed = Math.min(car.speed, 120);
      }
      unit.x = car.x;
      unit.y = car.y;
      unit.angle = car.angle;
      unit.speed = car.speed;
      }
    } else {
      // On foot: run at the player, punch when close.
      const wantAngle = Math.atan2(ty - unit.y, tx - unit.x);
      unit.angle = angleLerp(unit.angle, wantAngle, Math.min(1, dt * 6));
      const speed = 185;
      const nx = unit.x + Math.cos(unit.angle) * speed * dt;
      const ny = unit.y + Math.sin(unit.angle) * speed * dt;
      const fixed = collideCircleBuildings(city, nx, ny, 12);
      unit.x = fixed.x;
      unit.y = fixed.y;
      if (d < 30 && unit.attackCooldown <= 0) {
        unit.attackCooldown = 0.9;
        damagePlayer(state, 7, 'police');
        state.events.push({ type: 'punched' });
      }
    }
    void city;
  }
}

export function updateGoons(state, dt) {
  const { goons, player } = state;
  for (const goon of goons) {
    if (goon.state === 'down') continue;
    goon.shootCooldown -= dt;
    const d = dist(goon.x, goon.y, player.x, player.y);
    if (d < 420) {
      goon.state = 'chase';
      goon.angle = Math.atan2(player.y - goon.y, player.x - goon.x);
      if (d > 180) {
        goon.x += Math.cos(goon.angle) * goon.speed * dt;
        goon.y += Math.sin(goon.angle) * goon.speed * dt;
      }
      if (goon.shootCooldown <= 0 && d < 380) {
        goon.shootCooldown = floatBetween(state.rng, 1.1, 2.0);
        const a = goon.angle + floatBetween(state.rng, -0.12, 0.12);
        state.bullets.push({ x: goon.x, y: goon.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, from: 'enemy', life: 1.2 });
        state.events.push({ type: 'enemy-shot' });
      }
    } else {
      goon.state = 'guard';
    }
  }
}

export function updateBullets(state, dt) {
  const { bullets, city, player } = state;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // Hit a building?
    if (!dead && rectHitsBuilding(city, b.x, b.y, 2, 2)) {
      burstSparks(state, b.x, b.y);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const goon of state.goons) {
        if (goon.state !== 'down' && dist(b.x, b.y, goon.x, goon.y) < 16) {
          goon.hp -= 25;
          burstBlood(state, goon.x, goon.y);
          if (goon.hp <= 0) {
            goon.state = 'down';
            state.stats.kills += 1;
            addWanted(state, 12);
            state.events.push({ type: 'goon-down' });
          }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const unit of state.police) {
          if (dist(b.x, b.y, unit.x, unit.y) < 16) {
            unit.hp -= 34;
            burstBlood(state, unit.x, unit.y);
            addWanted(state, 10);
            if (unit.hp <= 0) {
              if (unit.car) {
                const idx = state.cars.indexOf(unit.car);
                if (idx >= 0) state.cars.splice(idx, 1);
              }
              state.police.splice(state.police.indexOf(unit), 1);
              state.stats.kills += 1;
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.hp -= 25;
            burstBlood(state, ped.x, ped.y);
            addWanted(state, 15);
            if (ped.hp <= 0) ped.state = 'down';
            dead = true;
            break;
          }
        }
      }
    } else if (!dead && b.from === 'enemy') {
      if (dist(b.x, b.y, player.x, player.y) < PLAYER_RADIUS + 2) {
        damagePlayer(state, 9, 'bullet');
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }
}

export function damagePlayer(state, amount, source) {
  const player = state.player;
  if (player.invuln > 0 || player.health <= 0) return;
  player.health -= amount;
  player.invuln = 0.25;
  state.events.push({ type: 'hurt', source });
  if (player.health <= 0) {
    player.health = 0;
    state.events.push({ type: 'player-down' });
  }
}

// Steal a car: the player must be on foot and near a parked/traffic car.
export function nearestStealableCar(state) {
  const { player, cars } = state;
  if (!player.onFoot) return null;
  let best = null;
  let bestD = 70;
  for (const car of cars) {
    if (car.kind === 'player') continue;
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car) {
  const { player } = state;
  player.onFoot = false;
  player.car = car;
  car.kind = 'player';
  car.driver = 'player';
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  state.events.push({ type: 'car-enter' });
}

export function exitCar(state) {
  const { player } = state;
  if (!player.car) return;
  const car = player.car;
  car.kind = 'parked';
  car.speed = 0;
  // Step out to the driver's side.
  const side = player.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 26;
  player.y = car.y + Math.sin(side) * 26;
  player.onFoot = true;
  player.car = null;
  player.angle = car.angle;
  state.events.push({ type: 'car-exit' });
}

export { intBetween };
