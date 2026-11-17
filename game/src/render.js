// Solmar Bay — drawing only: the world, the day/night lighting, the HUD
// (health, cash, wanted stars, objective, clock), the live minimap, the
// dialogue box and the title / pause / game-over screens. No game logic
// lives here; main.js owns the state and passes it in each frame.

import { DISTRICTS, LANDMARKS, ROAD_COUNT, ROAD_FIRST, ROAD_GAP, ROAD_WIDTH, WORLD_SIZE } from './config.js';
import { districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Daylight factor from the game clock: 1 at noon, 0 at midnight.
export function daylightFactor(clockMinutes) {
  const h = (clockMinutes / 60) % 24;
  if (h >= 6 && h <= 18) {
    const t = (h - 6) / 12; // 0..1 across the day
    return 0.35 + 0.65 * Math.sin(Math.PI * t);
  }
  if (h > 18 && h < 20) return 0.3 - (h - 18) * 0.15;
  if (h >= 4 && h < 6) return 0.1 + (h - 4) * 0.125;
  return 0.08;
}

export function clockText(clockMinutes) {
  const total = Math.floor(clockMinutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
  }

  window.addEventListener('resize', resize);
  resize();

  function text(str, x, y, size, color, align = 'left', bold = false) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- world drawing (in world coordinates, camera transform applied) ----
  function drawWorld(state) {
    const cam = state.camera;
    const zoom = cam.zoom;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (viewW / 2 - cam.x * zoom), dpr * (viewH / 2 - cam.y * zoom));
    const vw = viewW / zoom;
    const vh = viewH / zoom;
    const vx0 = cam.x - vw / 2 - 80;
    const vy0 = cam.y - vh / 2 - 80;
    const vx1 = cam.x + vw / 2 + 80;
    const vy1 = cam.y + vh / 2 + 80;
    const inView = (x, y, m = 100) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    // Ground: sun-baked grass base.
    ctx.fillStyle = '#8fae6b';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

    const city = state.city;
    // Parks.
    for (const p of city.parks) {
      if (!inView((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 200)) continue;
      ctx.fillStyle = '#5d9b4a';
      ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      ctx.fillStyle = '#7ec8e3';
      ctx.beginPath();
      ctx.ellipse((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 34, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beach + sea along the south edge.
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(0, city.beach.y0, WORLD_SIZE, city.beach.y1 - city.beach.y0);
    ctx.fillStyle = '#2e86c1';
    ctx.fillRect(0, WORLD_SIZE - 60, WORLD_SIZE, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let wx = 0; wx < WORLD_SIZE; wx += 160) {
      ctx.fillRect(wx + ((state.time * 20) % 160), WORLD_SIZE - 44, 60, 3);
    }

    // City blocks (sidewalk slabs).
    ctx.fillStyle = '#b9b3a4';
    for (let bx = 0; bx < ROAD_COUNT - 1; bx += 1) {
      for (let by = 0; by < ROAD_COUNT - 1; by += 1) {
        const x0 = ROAD_FIRST + bx * ROAD_GAP + ROAD_WIDTH / 2;
        const y0 = ROAD_FIRST + by * ROAD_GAP + ROAD_WIDTH / 2;
        if (!inView(x0 + 150, y0 + 150, 250)) continue;
        ctx.fillRect(x0, y0, ROAD_GAP - ROAD_WIDTH, ROAD_GAP - ROAD_WIDTH);
      }
    }

    // Roads: asphalt with a centre line and edge dashes.
    ctx.fillStyle = '#3a3f47';
    for (let i = 0; i < ROAD_COUNT; i += 1) {
      const c = ROAD_FIRST + i * ROAD_GAP;
      ctx.fillRect(0, c - ROAD_WIDTH / 2, WORLD_SIZE, ROAD_WIDTH);
      ctx.fillRect(c - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_SIZE);
    }
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (let i = 0; i < ROAD_COUNT; i += 1) {
      const c = ROAD_FIRST + i * ROAD_GAP;
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD_SIZE, c); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD_SIZE); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.55)';
    ctx.lineWidth = 5;
    for (const s of state.skids) {
      ctx.globalAlpha = Math.min(1, s.life / 3);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Buildings with shadows, roofs, windows and landmark signs.
    const daylight = daylightFactor(state.clockMinutes);
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Windows: lit warm at night.
      ctx.fillStyle = daylight < 0.4 ? '#ffd97a' : '#2c3e50';
      const cols = Math.max(2, Math.floor(b.w / 46));
      const rows = Math.max(2, Math.floor(b.h / 46));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 14 + cx * ((b.w - 28) / cols), b.y + 14 + cy * ((b.h - 28) / rows), 14, 10);
        }
      }
    }
    // Landmark labels.
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    for (const key of Object.keys(LANDMARKS)) {
      const lm = LANDMARKS[key];
      if (!inView(lm.x, lm.y, 120)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(lm.label).width + 16;
      roundRect(lm.x - w / 2, lm.y - 62, w, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(lm.label, lm.x, lm.y - 47);
    }

    // Trees.
    for (const t of city.trees) {
      if (!inView(t.x, t.y, 40)) continue;
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#43a047';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    // Pickups: health cross, ammo box, cash.
    for (const pk of state.pickups) {
      if (!inView(pk.x, pk.y, 40)) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = '#7e5109';
        ctx.fillRect(-7, -4, 4, 8);
        ctx.fillRect(0, -4, 4, 8);
        ctx.fillRect(7, -4, 4, 8);
      } else {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 5);
      }
      ctx.restore();
    }

    // Mission marker: a pulsing beacon + a ground ring.
    const marker = state.marker;
    if (marker) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(241,196,15,0.9)';
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2); ctx.fill();
      // A light pillar so the marker is visible from far away.
      const grad = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
      grad.addColorStop(0, 'rgba(241,196,15,0)');
      grad.addColorStop(1, 'rgba(241,196,15,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(marker.x - 8, marker.y - 260, 16, 260);
    }

    drawCars(state, inView);
    drawPeds(state, inView);
    drawGoons(state, inView);
    drawPolice(state, inView);
    drawPlayer(state);
    drawBullets(state);
    drawParticles(state);

    // Night lighting: darkness + warm lamp glows.
    if (daylight < 0.55) {
      const dark = (0.55 - daylight) * 1.1;
      ctx.fillStyle = `rgba(8,12,40,${Math.min(0.62, dark)})`;
      ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
      ctx.globalCompositeOperation = 'lighter';
      for (const lamp of city.lamps) {
        if (!inView(lamp.x, lamp.y, 60)) continue;
        const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 90);
        g.addColorStop(0, 'rgba(255,214,120,0.5)');
        g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 90, 0, Math.PI * 2); ctx.fill();
      }
      const p = state.player;
      const pg = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 220);
      pg.addColorStop(0, 'rgba(255,230,160,0.28)');
      pg.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(p.x, p.y, 220, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // Golden-hour tint at dusk/dawn.
    const h = (state.clockMinutes / 60) % 24;
    if ((h >= 17 && h < 19) || (h >= 6 && h < 7.5)) {
      ctx.fillStyle = 'rgba(255,140,60,0.10)';
      ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = 46;
    const W = 22;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(-8, -W / 2 + 4, 16, W - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(8, -W / 2 + 5, 5, W - 10);
    // Wheels.
    ctx.fillStyle = '#111';
    ctx.fillRect(-L / 2 + 4, -W / 2 - 3, 10, 5);
    ctx.fillRect(-L / 2 + 4, W / 2 - 2, 10, 5);
    ctx.fillRect(L / 2 - 14, -W / 2 - 3, 10, 5);
    ctx.fillRect(L / 2 - 14, W / 2 - 2, 10, 5);
    if (car.kind === 'police') {
      // Light bar, flashing red/blue.
      const phase = Math.floor(car.sirenPhase * 2) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d7dff';
      ctx.fillRect(-4, -W / 2 + 2, 8, 6);
      ctx.fillStyle = phase ? '#2d7dff' : '#ff2d2d';
      ctx.fillRect(-4, W / 2 - 8, 8, 6);
      ctx.fillStyle = '#fff';
      ctx.font = '700 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, -W / 2 - 5);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCars(state, inView) {
    for (const car of state.cars) {
      if (!inView(car.x, car.y, 80)) continue;
      drawCarShape(car, car === state.player.car);
      // Damage smoke.
      if (car.hp < 45 && Math.random() < 0.3) {
        ctx.fillStyle = 'rgba(127,140,141,0.5)';
        ctx.beginPath(); ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPerson(x, y, angle, shirt, pants, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Legs.
    ctx.fillStyle = pants;
    ctx.fillRect(-4, -8, 8, 6);
    ctx.fillRect(-4, 2, 8, 6);
    // Body.
    ctx.fillStyle = shirt;
    roundRect(-8, -10, 16, 20, 6);
    ctx.fill();
    // Head.
    ctx.fillStyle = opts.skin || '#e8b98a';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    // Facing direction: nose + gun arm.
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(8, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    if (opts.gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(18, 2); ctx.stroke();
    }
    if (opts.star) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, -16);
    }
    ctx.restore();
  }

  function drawPeds(state, inView) {
    for (const ped of state.peds) {
      if (!inView(ped.x, ped.y, 40)) continue;
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.fillStyle = ped.shirt;
        roundRect(-8, -10, 16, 20, 6);
        ctx.fill();
        ctx.restore();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.pants);
    }
  }

  function drawGoons(state, inView) {
    for (const goon of state.goons) {
      if (goon.state === 'down' || !inView(goon.x, goon.y, 60)) continue;
      drawPerson(goon.x, goon.y, goon.angle, '#5b2c6f', '#1a1a2e', { gun: true, skin: '#d9a066' });
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(goon.x - 14, goon.y - 26, 28, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(goon.x - 14, goon.y - 26, 28 * Math.max(0, goon.hp / 50), 5);
    }
  }

  function drawPolice(state, inView) {
    for (const unit of state.police) {
      if (!unit.inCar && inView(unit.x, unit.y, 60)) {
        drawPerson(unit.x, unit.y, unit.angle, '#1a5276', '#17202a', { star: true, skin: '#e8b98a' });
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.health <= 0) return;
    if (p.onFoot) {
      // Blink briefly after taking a hit.
      if (p.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) return;
      drawPerson(p.x, p.y, p.angle, '#f39c12', '#2c3e50', { gun: state.ammo > 0, skin: '#c98d5f' });
      // Name tag.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('DANTE', p.x, p.y - 22);
    }
  }

  function drawBullets(state) {
    ctx.fillStyle = '#f7dc6f';
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD (screen space) ----
  function drawHud(state, extras) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = state.player;
    // Health bar + cash, top left.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(14, 12, 250, 62, 10);
    ctx.fill();
    text('HEALTH', 26, 34, 12, '#bbb', 'left', true);
    ctx.fillStyle = '#222';
    ctx.fillRect(26, 42, 150, 12);
    ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(26, 42, 150 * Math.max(0, p.health / 100), 12);
    text(`$${state.money.toLocaleString('en-US')}`, 186, 54, 18, '#2ecc71', 'left', true);
    text(p.onFoot ? (state.ammo > 0 ? `PISTOL ${state.ammo}` : 'FISTS') : `${state.player.car ? state.player.car.model.toUpperCase() : ''}`, 26, 66, 12, '#f1c40f', 'left', true);

    // Wanted stars, top right.
    const stars = state.wantedStars();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(viewW - 214, 12, 200, 52, 10);
    ctx.fill();
    text('WANTED', viewW - 202, 30, 11, '#bbb', 'left', true);
    for (let i = 0; i < 5; i += 1) {
      text('★', viewW - 202 + i * 34, 52, 24, i < stars ? '#f1c40f' : 'rgba(255,255,255,0.25)', 'left', true);
    }

    // Clock + district, top centre.
    const district = districtAt(p.x, p.y);
    text(`${clockText(state.clockMinutes)}  •  ${district.name.toUpperCase()}`, viewW / 2, 30, 15, '#fff', 'center', true);
    text(state.muted ? 'MUTED (M)' : '', viewW / 2, 50, 12, '#bbb', 'center');

    // Mission objective bar.
    const obj = extras.objective || '';
    if (obj) {
      ctx.font = `700 16px ${FONT}`;
      const w = Math.min(viewW - 40, ctx.measureText(obj).width + 60);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect((viewW - w) / 2, 62, w, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc((viewW - w) / 2 + 20, 79, 5, 0, Math.PI * 2); ctx.fill();
      text(obj, (viewW - w) / 2 + 34, 84, 15, '#fff', 'left', true);
    }

    // Toast (mission complete / event banners).
    if (extras.toast && extras.toastTimer > 0) {
      ctx.globalAlpha = Math.min(1, extras.toastTimer);
      ctx.font = `700 22px ${FONT}`;
      const w = ctx.measureText(extras.toast).width + 48;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      roundRect((viewW - w) / 2, 110, w, 44, 10);
      ctx.fill();
      text(extras.toast, viewW / 2, 140, 20, '#f1c40f', 'center', true);
      ctx.globalAlpha = 1;
    }

    drawMinimap(state);
    drawDialogue(state, extras);

    // Controls hint, bottom left.
    text('WASD move/drive • E enter car / interact • Click shoot • F punch • Shift run • P pause • H help', 16, viewH - 14, 12, 'rgba(255,255,255,0.65)');
    // Crosshair when on foot with a gun.
    if (p.onFoot && state.ammo > 0) {
      const mx = extras.mouseX;
      const my = extras.mouseY;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
      ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
      ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
      ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
      ctx.stroke();
    }
    // Interaction prompt.
    if (extras.prompt) {
      ctx.font = `700 16px ${FONT}`;
      const w = ctx.measureText(extras.prompt).width + 36;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      roundRect((viewW - w) / 2, viewH - 96, w, 36, 8);
      ctx.fill();
      text(extras.prompt, viewW / 2, viewH - 72, 15, '#fff', 'center', true);
    }
  }

  function drawMinimap(state) {
    const size = 190;
    const x0 = viewW - size - 16;
    const y0 = viewH - size - 16;
    const s = size / WORLD_SIZE;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#1e2a22';
    ctx.fillRect(x0, y0, size, size);
    // Roads.
    ctx.strokeStyle = '#5a6470';
    ctx.lineWidth = 3;
    for (let i = 0; i < ROAD_COUNT; i += 1) {
      const c = ROAD_FIRST + i * ROAD_GAP;
      ctx.beginPath(); ctx.moveTo(x0, y0 + c * s); ctx.lineTo(x0 + size, y0 + c * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + c * s, y0); ctx.lineTo(x0 + c * s, y0 + size); ctx.stroke();
    }
    // Landmarks.
    ctx.fillStyle = '#f1c40f';
    for (const key of Object.keys(LANDMARKS)) {
      ctx.fillRect(x0 + LANDMARKS[key].x * s - 2, y0 + LANDMARKS[key].y * s - 2, 4, 4);
    }
    // Mission marker.
    if (state.marker) {
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(x0 + state.marker.x * s, y0 + state.marker.y * s, pulse + 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police (red), cars (white dots).
    ctx.fillStyle = '#ff4d4d';
    for (const unit of state.police) {
      ctx.beginPath(); ctx.arc(x0 + unit.x * s, y0 + unit.y * s, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      ctx.fillRect(x0 + car.x * s - 1, y0 + car.y * s - 1, 2, 2);
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(x0 + p.x * s, y0 + p.y * s);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // North + district label.
    text('N', x0 + size - 10, y0 + 16, 12, '#fff', 'center', true);
  }

  function drawDialogue(state, extras) {
    const lines = extras.dialogue;
    if (!lines || lines.length === 0) return;
    const boxH = 34 + lines.length * 24 + 18;
    const y0 = viewH - 190 - boxH;
    ctx.fillStyle = 'rgba(10,12,20,0.82)';
    roundRect(40, y0, viewW - 80, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    roundRect(40, y0, viewW - 80, boxH, 12);
    ctx.stroke();
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], 60, y0 + 36 + i * 24, 15, i === 0 ? '#f1c40f' : '#eee', 'left', i === 0);
    }
    text('E / click to continue', viewW - 60, y0 + boxH - 12, 12, '#bbb', 'right');
  }

  // ---- screens ----
  function drawTitle(state, extras) {
    drawWorld(state);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(5,8,20,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    // Sun-soaked gradient banner.
    const grad = ctx.createLinearGradient(0, 0, viewW, 0);
    grad.addColorStop(0, '#ff9a3c');
    grad.addColorStop(0.5, '#ff5e78');
    grad.addColorStop(1, '#7b5cff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, viewH * 0.16, viewW, 4);
    text('SOLMAR BAY', viewW / 2, viewH * 0.30, 84, '#fff', 'center', true);
    ctx.fillStyle = grad;
    ctx.fillRect(viewW / 2 - 220, viewH * 0.30 + 18, 440, 4);
    text('AN OPEN-WORLD CRIME STORY', viewW / 2, viewH * 0.30 + 62, 22, '#ffd97a', 'center', true);
    text('Steal cars. Outrun the law. Take the Bay.', viewW / 2, viewH * 0.30 + 96, 17, '#ddd', 'center');
    const items = extras.hasSave
      ? ['▶  CONTINUE  (saved game)', '▶  NEW GAME', 'HOW TO PLAY  (H)']
      : ['▶  NEW GAME', 'HOW TO PLAY  (H)'];
    items.forEach((item, i) => {
      const y = viewH * 0.52 + i * 44;
      const selected = extras.menuIndex === i;
      if (selected) {
        ctx.fillStyle = 'rgba(241,196,15,0.9)';
        roundRect(viewW / 2 - 230, y - 28, 460, 38, 8);
        ctx.fill();
        text(item, viewW / 2, y, 19, '#111', 'center', true);
      } else {
        text(item, viewW / 2, y, 19, '#eee', 'center');
      }
    });
    text('WASD move & drive  •  E steal car / talk  •  Click shoot  •  F punch  •  P pause', viewW / 2, viewH * 0.78, 15, '#ccc', 'center');
    text('5 missions  •  wanted stars & police chases  •  traffic, pedestrians, minimap, day & night', viewW / 2, viewH * 0.82, 14, '#aaa', 'center');
    text('A make.fun entry — an original game. Nothing here is from any Rockstar game.', viewW / 2, viewH - 24, 12, '#888', 'center');
    if (extras.helpOpen) drawHelp();
  }

  function drawHelp() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    roundRect(viewW / 2 - 320, viewH / 2 - 190, 640, 380, 14);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    roundRect(viewW / 2 - 320, viewH / 2 - 190, 640, 380, 14);
    ctx.stroke();
    text('HOW TO PLAY', viewW / 2, viewH / 2 - 150, 24, '#f1c40f', 'center', true);
    const lines = [
      'WASD / arrows — walk, run (Shift), drive when in a car',
      'E — steal a car, talk, pick up, crack the vault',
      'Mouse — aim. Click — shoot (pistol). F — punch.',
      'Follow the yellow marker: it is your next objective.',
      'Crimes raise your wanted stars. Cops chase, ram and arrest.',
      'Lose the heat by hiding: stars fade when no cop can see you.',
      'Health and ammo pickups spawn around the city. P — pause, M — mute.',
      'Your progress saves automatically and from the pause menu.',
    ];
    lines.forEach((line, i) => text(line, viewW / 2, viewH / 2 - 108 + i * 30, 15, '#eee', 'center'));
    text('Press H or Esc to close', viewW / 2, viewH / 2 + 158, 14, '#bbb', 'center');
  }

  function drawPaused(state, extras) {
    drawWorld(state);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(5,8,20,0.6)';
    ctx.fillRect(0, 0, viewW, viewH);
    text('PAUSED', viewW / 2, viewH * 0.32, 56, '#fff', 'center', true);
    const items = ['▶  RESUME  (P)', 'SAVE GAME', 'HOW TO PLAY  (H)', 'QUIT TO TITLE'];
    items.forEach((item, i) => {
      const y = viewH * 0.46 + i * 44;
      if (extras.menuIndex === i) {
        ctx.fillStyle = 'rgba(241,196,15,0.9)';
        roundRect(viewW / 2 - 200, y - 28, 400, 38, 8);
        ctx.fill();
        text(item, viewW / 2, y, 19, '#111', 'center', true);
      } else {
        text(item, viewW / 2, y, 19, '#eee', 'center');
      }
    });
    text(extras.saveMessage || '', viewW / 2, viewH * 0.46 + 4 * 44 + 10, 15, '#2ecc71', 'center');
    if (extras.helpOpen) drawHelp();
  }

  function drawGameOver(state, extras) {
    drawWorld(state);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(20,0,0,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    const title = extras.overReason === 'busted' ? 'BUSTED!' : 'WASTED';
    text(title, viewW / 2, viewH * 0.34, 72, '#e74c3c', 'center', true);
    text(extras.overReason === 'busted'
      ? 'The Solmar police caught up with you. The Bay forgets fast — try again.'
      : 'Dante went down in the streets of Solmar Bay. The story is not over yet.', viewW / 2, viewH * 0.34 + 44, 16, '#eee', 'center');
    text(`Cash $${state.money.toLocaleString('en-US')}  •  Missions done ${state.stats.missionsDone}  •  Cars stolen ${state.stats.carsStolen}`, viewW / 2, viewH * 0.50, 17, '#ffd97a', 'center', true);
    text('Press Enter or click to try again', viewW / 2, viewH * 0.58, 19, '#fff', 'center', true);
    text('Your cash is kept — the Bay is generous that way.', viewW / 2, viewH * 0.58 + 30, 13, '#aaa', 'center');
  }

  function draw(state, screen, extras) {
    if (screen === SCREEN_TITLE) { drawTitle(state, extras); return; }
    if (screen === SCREEN_OVER) { drawGameOver(state, extras); return; }
    drawWorld(state);
    drawHud(state, extras);
    if (screen === SCREEN_PAUSED) drawPaused(state, extras);
    else if (extras.helpOpen) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHelp();
    }
  }

  return { draw, resize };
}

export { DISTRICTS };
