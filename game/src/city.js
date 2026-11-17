// Solmar Bay — the city itself. A seeded generator lays a 9x9 street grid
// over the world, fills each block with buildings (palettes per district),
// parks and trees, and places the six story landmarks. It also answers the
// two questions the physics needs: "is this point on a road?" and "does
// this circle hit a building?".

import {
  DISTRICTS, LANDMARKS, ROAD_COUNT, ROAD_FIRST, ROAD_GAP, ROAD_WIDTH, WORLD_SIZE,
} from './config.js';
import { floatBetween, intBetween, pick } from './rng.js';

export function roadCenters() {
  const centers = [];
  for (let i = 0; i < ROAD_COUNT; i += 1) centers.push(ROAD_FIRST + i * ROAD_GAP);
  return centers;
}

export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (let i = 0; i < ROAD_COUNT; i += 1) {
    const c = ROAD_FIRST + i * ROAD_GAP;
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

// Nearest road centre line to a coordinate (used to snap traffic to lanes).
export function nearestRoad(value) {
  let best = ROAD_FIRST;
  let bestDist = Infinity;
  for (let i = 0; i < ROAD_COUNT; i += 1) {
    const c = ROAD_FIRST + i * ROAD_GAP;
    const d = Math.abs(value - c);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[0];
}

export function createCity(rng) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const centers = roadCenters();
  const halfRoad = ROAD_WIDTH / 2;

  // Blocks sit between neighbouring roads. Each block gets 1-4 buildings,
  // a park, or a plaza, with a margin so sidewalks stay walkable.
  for (let bx = 0; bx < ROAD_COUNT - 1; bx += 1) {
    for (let by = 0; by < ROAD_COUNT - 1; by += 1) {
      const x0 = centers[bx] + halfRoad + 14;
      const y0 = centers[by] + halfRoad + 14;
      const x1 = centers[bx + 1] - halfRoad - 14;
      const y1 = centers[by + 1] - halfRoad - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roll = rng();

      if (roll < 0.12) {
        // Park: grass, trees, a pond.
        parks.push({ x0, y0, x1, y1 });
        const n = intBetween(rng, 4, 7);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: floatBetween(rng, x0 + 20, x1 - 20), y: floatBetween(rng, y0 + 20, y1 - 20), r: floatBetween(rng, 10, 16) });
        }
        continue;
      }

      const count = roll < 0.45 ? 1 : roll < 0.8 ? 2 : 4;
      if (count === 1) {
        const w = floatBetween(rng, 150, 220);
        const h = floatBetween(rng, 150, 220);
        buildings.push(makeBuilding(cx - w / 2, cy - h / 2, w, h, district, rng));
      } else if (count === 2) {
        const vertical = rng() < 0.5;
        for (let k = 0; k < 2; k += 1) {
          if (vertical) {
            const w = (x1 - x0) * 0.42;
            const h = floatBetween(rng, 150, 220);
            buildings.push(makeBuilding(x0 + k * ((x1 - x0) * 0.58), cy - h / 2, w, h, district, rng));
          } else {
            const w = floatBetween(rng, 150, 220);
            const h = (y1 - y0) * 0.42;
            buildings.push(makeBuilding(cx - w / 2, y0 + k * ((y1 - y0) * 0.58), w, h, district, rng));
          }
        }
      } else {
        const w = (x1 - x0) * 0.44;
        const h = (y1 - y0) * 0.44;
        for (let gx = 0; gx < 2; gx += 1) {
          for (let gy = 0; gy < 2; gy += 1) {
            buildings.push(makeBuilding(x0 + gx * (w + 12), y0 + gy * (h + 12), w, h, district, rng));
          }
        }
      }

      // A tree or two on the block corners, clear of the buildings.
      if (rng() < 0.6) {
        trees.push({ x: x0 + 12, y: y0 + 12, r: 11 });
        trees.push({ x: x1 - 12, y: y1 - 12, r: 11 });
      }
    }
  }

  // Street lamps along every road, every other block.
  for (const c of centers) {
    for (let i = 0; i < ROAD_COUNT - 1; i += 1) {
      const along = centers[i] + ROAD_GAP / 2;
      lamps.push({ x: c + halfRoad + 6, y: along });
      lamps.push({ x: along, y: c - halfRoad - 6 });
    }
  }

  // The beach: a sand strip and water along the south edge, with the pier.
  const beach = { x0: 0, y0: WORLD_SIZE - 130, x1: WORLD_SIZE, y1: WORLD_SIZE };

  return { buildings, trees, lamps, parks, beach, centers };
}

function makeBuilding(x, y, w, h, district, rng) {
  const color = pick(rng, district.palette);
  return {
    x, y, w, h,
    color,
    roof: shade(color, -18),
    height: intBetween(rng, 1, district.name === 'Downtown' ? 5 : 3), // storeys, for shadows
    windows: intBetween(rng, 2, 5),
    district: district.name,
  };
}

// Darken a #rrggbb colour by an amount (negative = darker).
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

// Circle (x, y, radius) vs building rectangles: push the circle out and
// return the corrected position. Used for the player and pedestrians.
export function collideCircleBuildings(city, x, y, radius) {
  for (const b of city.buildings) {
    const closestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      if (distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        x = closestX + (dx / dist) * radius;
        y = closestY + (dy / dist) * radius;
      } else {
        // Centre inside the building: push out along the smallest overlap.
        const pushLeft = x - b.x + radius;
        const pushRight = b.x + b.w - x + radius;
        const pushUp = y - b.y + radius;
        const pushDown = b.y + b.h - y + radius;
        const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (m === pushLeft) x = b.x - radius;
        else if (m === pushRight) x = b.x + b.w + radius;
        else if (m === pushUp) y = b.y - radius;
        else y = b.y + b.h + radius;
      }
    }
  }
  return { x, y };
}

// Axis-aligned rectangle (a car) vs buildings: returns true on overlap.
export function rectHitsBuilding(city, x, y, hw, hh) {
  for (const b of city.buildings) {
    if (x - hw < b.x + b.w && x + hw > b.x && y - hh < b.y + b.h && y + hh > b.y) return b;
  }
  return null;
}

export { LANDMARKS };
