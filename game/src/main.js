// main.js — Tidebreak Isles: boot, the game loop, the player (on foot, by car,
// by boat), combat, the shop, saving, and the screenshot scenes. The world,
// traffic, police, missions, weather, sound and HUD each live in their own file.
import { Rng } from './rng.js';
import {
  WORLD, ISLANDS, BRIDGES, ROADS, ROAD_W, DOCKS, SPECIALS,
  islandAt, isWaterAt, isOnBridge, distToRoad, onRoad, makeWorld, tryMove, pointInRect,
} from './world.js';
import { CAR_TYPES, BOAT_TYPES, createCar, createBoat, driveCar, driveBoat, drawCar, drawBoat, nearestVehicle } from './vehicles.js';
import { createTraffic, updateTraffic, drawTraffic } from './traffic.js';
import { createPolice, addWanted, updatePolice, drawPolice } from './police.js';
import { MISSIONS, createMissionState, currentMission } from './missions.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { createEffects } from './effects.js';
import { createInput, ACT_ENTER, ACT_PUNCH, ACT_PAUSE, ACT_CONFIRM, ACT_SHOP, ACT_SAVE } from './input.js';
import { drawHud, drawMenu, drawPause, drawGameOver, drawComplete } from './hud.js';

const SAVE_KEY = 'tidebreak-isles-save-v1';
const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const rng = new Rng(seed);
const worldData = makeWorld(seed);
const audio = createAudio();
const weather = createWeather(rng);
const effects = createEffects(rng);
const input = createInput(canvas);

function announce(msg) { if (statusEl) statusEl.textContent = msg; }

const g = {
  time: 0, seed, rng, world: worldData, weather, effects, audio,
  screen: 'menu', // menu | playing | paused | over | complete
  player: {
    x: 600, y: 780, angle: -Math.PI / 2, hp: 100, money: 50,
    vehicle: null, carUpgrade: false, boatOwned: false,
    shootCd: 0, punchCd: 0, hurtCd: 0, speed: 0,
  },
  mission: createMissionState(),
  missionKills: 0,
  police: createPolice(worldData),
  traffic: createTraffic(worldData, rng),
  cars: [], boats: [], enemies: [], bullets: [], pickups: [],
  camera: { x: 0, y: 0 },
  prompt: '', hasSave: false, overReason: '', demo: false,
  vw: 1280, vh: 800,
};

function placeParkedVehicles() {
  g.cars = [
    createCar('hatch', 420, 700, 0, { driver: 'parked' }),
    createCar('sedan', 700, 1150, Math.PI / 2, { driver: 'parked' }),
    createCar('sedan', 1700, 850, 0, { driver: 'parked' }),
    createCar('hatch', 1950, 1650, Math.PI, { driver: 'parked' }),
    createCar('interceptor', 2900, 1250, 0, { driver: 'parked' }),
    createCar('sedan', 3200, 1750, -Math.PI / 2, { driver: 'parked' }),
    createCar('hatch', 950, 1750, Math.PI / 2, { driver: 'parked' }),
  ];
  g.boats = [
    createBoat('skiff', 100, 900, Math.PI, { driver: 'parked' }),
    createBoat('skiff', 100, 1500, Math.PI, { driver: 'parked' }),
    createBoat('skiff', 1810, 2105, Math.PI / 2, { driver: 'parked' }),
    createBoat('speedboat', 3525, 900, 0, { driver: 'parked' }),
    createBoat('skiff', 3525, 1600, 0, { driver: 'parked' }),
  ];
}

function placePickups() {
  const spots = [
    [420, 1150], [900, 700], [1000, 1650], [1650, 780], [2100, 1200], [1900, 1700],
    [2700, 800], [3400, 1200], [2900, 1650], [3300, 700], [600, 2000], [1500, 1900],
  ];
  g.pickups = spots.map(([x, y]) => ({ x, y, taken: false, value: 25 }));
}

function saveGame() {
  try {
    const p = g.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: p.money, mission: g.mission.index, carUpgrade: p.carUpgrade,
      boatOwned: p.boatOwned, x: p.x, y: p.y, hp: p.hp,
    }));
    g.hasSave = true;
  } catch { /* storage off: the run lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const p = g.player;
    p.money = s.money ?? 50;
    p.carUpgrade = !!s.carUpgrade;
    p.boatOwned = !!s.boatOwned;
    p.x = s.x ?? 600; p.y = s.y ?? 780; p.hp = s.hp ?? 100;
    g.mission.index = s.mission ?? 0;
    if (p.boatOwned) spawnOwnedBoat();
    return true;
  } catch { return false; }
}

function spawnOwnedBoat() {
  if (g.boats.some((b) => b.owned)) return;
  const b = createBoat('speedboat', 100, 1560, Math.PI, { driver: 'parked', owned: true });
  b.color = '#e8b23a';
  g.boats.push(b);
}

function startMission(i) {
  const m = MISSIONS[i];
  if (!m) return;
  g.mission.timer = m.timed || 0;
  g.missionKills = 0;
  if (m.id === 'm4-breaker-ambush') spawnBreakers();
  if (m.id === 'm6-tidebreak-job') addWanted(g.police, 2, 'job');
  announce(`Mission ${i + 1}: ${m.title}. ${m.brief}`);
}

function spawnBreakers() {
  g.enemies = [];
  const spots = [[1750, 1330], [1880, 1470], [1810, 1250]];
  for (const [x, y] of spots) {
    g.enemies.push({ x, y, angle: 0, hp: 30, speed: 95, atkCd: 0, kind: 'breaker', wander: 0, tx: x, ty: y });
  }
}

function completeMission() {
  const m = MISSIONS[g.mission.index];
  if (!m) return;
  g.player.money += m.reward;
  g.mission.banner = `Mission complete: ${m.title}  +$${m.reward}`;
  g.mission.bannerTimer = 3.5;
  audio.mission();
  audio.cash();
  g.mission.index += 1;
  saveGame();
  if (g.mission.index >= MISSIONS.length) {
    g.mission.done = true;
    g.screen = 'complete';
  } else {
    startMission(g.mission.index);
  }
}

function damagePlayer(amount, reason) {
  const p = g.player;
  if (p.hurtCd > 0) return;
  p.hp -= amount;
  p.hurtCd = 0.5;
  audio.hit();
  effects.smoke(p.x, p.y);
  if (p.hp <= 0) {
    p.hp = 0;
    g.overReason = reason || 'Rook is down. The crew pulls him out.';
    p.money = Math.floor(p.money / 2);
    g.screen = 'over';
    audio.fail();
  }
}

function fireBullet(targetX, targetY) {
  const p = g.player;
  if (p.shootCd > 0) return;
  p.shootCd = 0.28;
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  p.angle = angle;
  g.bullets.push({ x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.5 });
  effects.muzzle(p.x, p.y, angle);
  audio.shoot();
}

function punch() {
  const p = g.player;
  if (p.punchCd > 0) return;
  p.punchCd = 0.45;
  audio.punch();
  for (const e of g.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < 60) {
      e.hp -= 20;
      e.x += Math.cos(p.angle) * 26;
      e.y += Math.sin(p.angle) * 26;
      effects.sparkle(e.x, e.y);
      if (e.hp <= 0) killEnemy(e);
    }
  }
}

function killEnemy(e) {
  e.dead = true;
  g.missionKills += 1;
  addWanted(g.police, 1, 'fight');
  effects.sparkle(e.x, e.y);
  audio.hit();
}

function enterVehicle() {
  const p = g.player;
  if (p.vehicle) {
    // Step out: beside the car, or onto the nearest land from a boat.
    const v = p.vehicle;
    v.driver = 'parked';
    v.speed = 0;
    p.vehicle = null;
    if (v.kind === 'boat') {
      let best = null, bestD = Infinity;
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        for (let d = 30; d <= 160; d += 20) {
          const x = v.x + Math.cos(ang) * d, y = v.y + Math.sin(ang) * d;
          if (!isWaterAt(x, y)) { const dd = Math.hypot(x - v.x, y - v.y); if (dd < bestD) { bestD = dd; best = { x, y }; } }
        }
      }
      if (!best) { p.vehicle = v; v.driver = 'player'; g.prompt = 'Too far from shore to get out. Sail to a dock.'; return; }
      p.x = best.x; p.y = best.y;
    } else {
      p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 40;
      p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 40;
    }
    return;
  }
  const car = nearestVehicle([...g.cars, ...g.traffic.cars.filter((c) => c.driver === 'traffic')], p.x, p.y, 78);
  const boat = nearestVehicle(g.boats, p.x, p.y, 95);
  const pick = boat && (!car || Math.hypot(boat.x - p.x, boat.y - p.y) < Math.hypot(car.x - p.x, car.y - p.y)) ? boat : car;
  if (!pick) { g.prompt = 'No vehicle close by. Walk to a parked car or a docked boat.'; return; }
  if (pick.kind === 'boat' && isWaterAt(p.x, p.y)) { g.prompt = 'You are in the water already. Swim to a dock.'; return; }
  p.vehicle = pick;
  pick.driver = 'player';
  p.x = pick.x; p.y = pick.y;
  if (!pick.owned && !pick.stolen) {
    pick.stolen = true;
    addWanted(g.police, 1, 'theft');
    g.prompt = `${pick.name} stolen! The law is coming.`;
    audio.siren();
  } else {
    g.prompt = `Driving the ${pick.name}.`;
  }
  audio.unlock();
}

function tryShop() {
  const p = g.player;
  const nearGarage = Math.hypot(p.x - 595, p.y - 655) < 150;
  const nearDock = Math.hypot(p.x - 3530, p.y - 900) < 170;
  if (nearGarage && !p.carUpgrade) {
    if (p.money >= 500) {
      p.money -= 500;
      p.carUpgrade = true;
      audio.buy();
      g.prompt = 'Engine tuned! All your cars are 25% faster.';
      saveGame();
    } else {
      g.prompt = `Engine tune costs $500. You have $${p.money}. Earn more on missions.`;
    }
    return;
  }
  if (nearDock && !p.boatOwned) {
    if (p.money >= 800) {
      p.money -= 800;
      p.boatOwned = true;
      spawnOwnedBoat();
      audio.buy();
      g.prompt = 'You bought a Tide Runner speedboat! It waits at the Fish Quay.';
      saveGame();
    } else {
      g.prompt = `A Tide Runner speedboat costs $800. You have $${p.money}.`;
    }
    return;
  }
  if (nearGarage && p.carUpgrade) g.prompt = 'Your engine is already tuned. The garage has nothing else to sell.';
  else if (nearDock && p.boatOwned) g.prompt = 'Your speedboat waits at the Fish Quay.';
  else g.prompt = 'Shop: visit Rook\u2019s Garage (car tune $500) or Lantern Quay (speedboat $800).';
}

function update(dt) {
  g.time += dt;
  const p = g.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  if (p.hp < 100 && g.police.wanted === 0) p.hp = Math.min(100, p.hp + 1.2 * dt);
  if (g.mission.bannerTimer > 0) g.mission.bannerTimer -= dt;
  const m = currentMission(g.mission);
  if (m && m.timed && g.screen === 'playing') {
    g.mission.timer -= dt;
    if (g.mission.timer <= 0) {
      g.mission.timer = 0;
      g.mission.banner = 'Too slow! The parcel is late. Try the run again.';
      g.mission.bannerTimer = 3;
      audio.fail();
      startMission(g.mission.index);
    }
  }

  weather.update(dt, () => audio.thunder());
  effects.update(dt);
  audio.updateMusic(dt, g.screen === 'menu');

  const actions = input.takeActions();
  if (actions & ACT_PAUSE) {
    if (g.screen === 'playing') { g.screen = 'paused'; announce('Paused.'); }
    else if (g.screen === 'paused') { g.screen = 'playing'; announce('Playing.'); }
  }
  if (g.screen === 'menu' && (actions & ACT_CONFIRM || input.takeClick())) {
    audio.unlock();
    if (g.hasSave && loadSave()) announce('Save loaded. Welcome back, Rook.');
    g.screen = 'playing';
    startMission(g.mission.index);
    return;
  }
  if ((g.screen === 'over' || g.screen === 'complete') && (actions & ACT_CONFIRM || input.takeClick())) {
    if (g.screen === 'over') {
      p.hp = 100;
      p.x = 600; p.y = 780;
      if (p.vehicle) { p.vehicle.driver = 'parked'; p.vehicle = null; }
      g.police.wanted = 0;
      g.police.units = [];
    }
    g.screen = 'playing';
    return;
  }
  if (g.screen !== 'playing') {
    updateTraffic(g.traffic, dt, g.world, rng, null);
    return;
  }
  if (actions & ACT_SAVE) { saveGame(); g.prompt = 'Game saved.'; }
  if (actions & ACT_SHOP) tryShop();
  if (actions & ACT_ENTER) enterVehicle();
  if (actions & ACT_PUNCH) punch();
  if (input.down('KeyM') && !g._mPressed) { g._mPressed = true; audio.toggleMute(); }
  if (!input.down('KeyM')) g._mPressed = false;

  // --- Player movement ---
  const ax = input.axis();
  if (p.vehicle) {
    const v = p.vehicle;
    const throttle = ax.y !== 0 ? -ax.y : (g.demo ? 1 : 0);
    const steer = ax.x + (g.demoSteer || 0);
    if (v.kind === 'car') {
      const dist = driveCar(v, { throttle, steer }, dt, g.world.buildings, p.carUpgrade);
      if (Math.abs(v.speed) > 300 && throttle !== 0 && rng.chance(0.3)) effects.skid(v.x - Math.cos(v.angle) * 20, v.y - Math.sin(v.angle) * 20, v.angle);
      p.x = v.x; p.y = v.y; p.angle = v.angle; p.speed = v.speed;
      audio.setEngine(Math.abs(v.speed) / v.top, true);
    } else {
      const wave = weather.waveAt(v.x, v.y);
      const dist = driveBoat(v, { throttle, steer }, dt, g.world.buildings, weather.state.wind, wave);
      if (Math.abs(v.speed) > 120) effects.spray(v.x - Math.cos(v.angle) * v.len / 2, v.y - Math.sin(v.angle) * v.len / 2, v.angle, 1);
      p.x = v.x; p.y = v.y; p.angle = v.angle; p.speed = v.speed;
      audio.setEngine(Math.abs(v.speed) / v.top, true);
    }
  } else {
    audio.setEngine(0, false);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight') ? 1.5 : 1;
    const sp = 230 * sprint;
    let dx = ax.x, dy = ax.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      p.angle = Math.atan2(dy, dx);
      const moved = tryMove(p, dx * sp * dt, dy * sp * dt, 12, 'land', g.world.buildings);
      p.x = moved.x; p.y = moved.y; p.speed = sp;
    } else p.speed = 0;
    // Aim with the mouse, shoot with Space or click. Mouse coords are CSS
    // pixels, matching the camera's coordinate space.
    const wx = g.camera.x + input.mouse.x, wy = g.camera.y + input.mouse.y;
    if (input.down('Space') || input.mouse.down) fireBullet(wx, wy);
    if (g.demo && g.demoTarget) {
      const d = Math.hypot(g.demoTarget.x - p.x, g.demoTarget.y - p.y);
      if (d > 30) {
        const a = Math.atan2(g.demoTarget.y - p.y, g.demoTarget.x - p.x);
        const moved = tryMove(p, Math.cos(a) * 230 * dt, Math.sin(a) * 230 * dt, 12, 'land', g.world.buildings);
        p.x = moved.x; p.y = moved.y; p.angle = a;
      }
    }
  }

  // --- Bullets ---
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    for (const e of g.enemies) {
      if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < 20) {
        e.hp -= 12;
        effects.sparkle(e.x, e.y);
        if (e.hp <= 0) killEnemy(e);
        dead = true;
        break;
      }
    }
    if (dead) g.bullets.splice(i, 1);
  }
  g.enemies = g.enemies.filter((e) => !e.dead);

  // --- Enemies ---
  for (const e of g.enemies) {
    e.atkCd = Math.max(0, e.atkCd - dt);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < 520) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = a;
      if (d > 42) {
        const moved = tryMove(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt, 12, 'land', g.world.buildings);
        e.x = moved.x; e.y = moved.y;
      } else if (e.atkCd <= 0) {
        e.atkCd = 0.8;
        damagePlayer(8, 'A Breaker thug put Rook down.');
      }
    } else {
      e.wander -= dt;
      if (e.wander <= 0) {
        e.wander = rng.range(1.5, 3.5);
        e.tx = e.x + rng.range(-160, 160);
        e.ty = e.y + rng.range(-160, 160);
      }
      const a = Math.atan2(e.ty - e.y, e.tx - e.x);
      if (Math.hypot(e.tx - e.x, e.ty - e.y) > 14) {
        const moved = tryMove(e, Math.cos(a) * e.speed * 0.5 * dt, Math.sin(a) * e.speed * 0.5 * dt, 12, 'land', g.world.buildings);
        e.x = moved.x; e.y = moved.y;
      }
    }
  }

  // --- Pickups ---
  for (const pk of g.pickups) {
    if (!pk.taken && Math.hypot(p.x - pk.x, p.y - pk.y) < 34) {
      pk.taken = true;
      p.money += pk.value;
      effects.sparkle(pk.x, pk.y);
      audio.pickup();
      g.prompt = `Found $${pk.value} stashed cash.`;
    }
  }

  // --- Traffic, police, missions ---
  updateTraffic(g.traffic, dt, g.world, rng, p);
  const siren = updatePolice(g.police, dt, p, g.world, rng, (unit) => {
    damagePlayer(6, 'The police ran Rook down.');
    if (unit) { unit.speed *= 0.3; }
  });
  if (siren) audio.siren();

  if (m && m.check(g)) completeMission();

  // --- Prompt ---
  if (g.screen === 'playing') {
    if (p.vehicle) {
      g.prompt = p.vehicle.kind === 'boat'
        ? `Sailing the ${p.vehicle.name} — E to dock and step out, Q for the boat shop at Lantern Quay`
        : `Driving the ${p.vehicle.name} — E to step out`;
    } else {
      const car = nearestVehicle([...g.cars, ...g.traffic.cars], p.x, p.y, 78);
      const boat = nearestVehicle(g.boats, p.x, p.y, 95);
      if (car) g.prompt = `Press E to steal the ${car.name}`;
      else if (boat) g.prompt = `Press E to board the ${boat.name}`;
      else if (Math.hypot(p.x - 595, p.y - 655) < 150) g.prompt = 'Press Q at the garage: engine tune $500';
      else if (Math.hypot(p.x - 3530, p.y - 900) < 170) g.prompt = 'Press Q at Lantern Quay: Tide Runner speedboat $800';
      else g.prompt = '';
    }
  }

  // --- Camera ---
  const vw = g.vw, vh = g.vh;
  g.camera.x = Math.max(0, Math.min(WORLD.w - vw, p.x - vw / 2));
  g.camera.y = Math.max(0, Math.min(WORLD.h - vh, p.y - vh / 2));
}

function drawWorld() {
  const cam = g.camera, vw = g.vw, vh = g.vh;
  const t = g.time;
  // Water with animated wave bands.
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#2a6d8f');
  grad.addColorStop(1, '#1d4e6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const wy = ((i * 173 + t * 26) % (vh + 80)) - 40;
    ctx.beginPath();
    for (let x = 0; x <= vw; x += 40) ctx.lineTo(x, wy + Math.sin(x * 0.02 + t * 1.4 + i) * 5);
    ctx.stroke();
  }
  // Islands.
  for (const isl of ISLANDS) {
    const x = isl.x - cam.x, y = isl.y - cam.y;
    ctx.fillStyle = isl.sand;
    ctx.fillRect(x - 14, y - 14, isl.w + 28, isl.h + 28);
    ctx.fillStyle = isl.grass;
    ctx.fillRect(x, y, isl.w, isl.h);
  }
  // Bridges.
  for (const b of BRIDGES) {
    ctx.fillStyle = '#8d8578';
    ctx.fillRect(b.x - cam.x - 4, b.y - cam.y - 4, b.w + 8, b.h + 8);
    ctx.fillStyle = '#b5aa94';
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.strokeStyle = '#6e675c';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
  }
  // Roads.
  ctx.strokeStyle = '#3d3a36';
  ctx.lineCap = 'round';
  for (const r of ROADS) {
    ctx.lineWidth = ROAD_W;
    ctx.beginPath();
    ctx.moveTo(r.x1 - cam.x, r.y1 - cam.y);
    ctx.lineTo(r.x2 - cam.x, r.y2 - cam.y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(240,220,120,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 16]);
  for (const r of ROADS) {
    ctx.beginPath();
    ctx.moveTo(r.x1 - cam.x, r.y1 - cam.y);
    ctx.lineTo(r.x2 - cam.x, r.y2 - cam.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Docks.
  for (const d of DOCKS) {
    ctx.save();
    ctx.translate(d.x - cam.x, d.y - cam.y);
    ctx.rotate(d.angle);
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(-8, -46, 60, 16);
    ctx.fillStyle = '#a67c4e';
    ctx.fillRect(-8, -46, 60, 5);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name, d.x - cam.x, d.y - cam.y + 62);
  }
  // Special buildings.
  for (const s of SPECIALS) {
    const x = s.x - cam.x, y = s.y - cam.y;
    ctx.fillStyle = s.kind === 'lighthouse' ? '#f2ead8' : s.kind === 'garage' ? '#5b7fa6' : '#8a6f4d';
    ctx.fillRect(x, y, s.w, s.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, s.w, s.h);
    if (s.kind === 'lighthouse') {
      ctx.fillStyle = '#b03a3a';
      ctx.fillRect(x, y, s.w, 14);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(x + s.w / 2, y + s.h / 2, 10 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
      ctx.fill();
      const beam = ctx.createLinearGradient(x + s.w / 2, y, x + s.w / 2 + 260, y - 60);
      beam.addColorStop(0, 'rgba(255,220,120,0.35)');
      beam.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x + s.w / 2, y + 10);
      ctx.lineTo(x + s.w / 2 + 260, y - 70);
      ctx.lineTo(x + s.w / 2 + 260, y + 60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.name, x + s.w / 2, y + s.h + 16);
  }
  // Buildings.
  for (const b of g.world.buildings) {
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x + b.w < -20 || x > vw + 20 || y + b.h < -20 || y > vh + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 4, y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 6, y + 6, b.w - 12, 10);
    ctx.fillStyle = 'rgba(20,30,45,0.7)';
    const nw = Math.max(1, Math.floor(b.w / 34));
    for (let i = 0; i < nw; i++) ctx.fillRect(x + 12 + i * 34, y + b.h / 2 - 8, 16, 16);
  }
  // Trees.
  for (const tr of g.world.trees) {
    const x = tr.x - cam.x, y = tr.y - cam.y;
    if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) continue;
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath(); ctx.arc(x, y, tr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4c8a3f';
    ctx.beginPath(); ctx.arc(x - 3, y - 3, tr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  // Mission marker.
  const m = currentMission(g.mission);
  if (m) {
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    const mx = m.target.x - cam.x, my = m.target.y - cam.y;
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(12, -28); ctx.lineTo(-12, -28); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.target.label, mx, my - 62);
  }
  // Pickups.
  for (const pk of g.pickups) {
    if (pk.taken) continue;
    const x = pk.x - cam.x, y = pk.y - cam.y;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(x, y + Math.sin(t * 3 + pk.x) * 3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6d1f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', x, y + 4);
  }
  // Vehicles, traffic, pedestrians, enemies, player.
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const c of g.cars) drawCar(ctx, c);
  for (const c of g.traffic.cars) drawCar(ctx, c);
  for (const b of g.boats) drawBoat(ctx, b);
  drawPolice(ctx, g.police, t);
  drawTraffic(ctx, g.traffic, cam, vw, vh);
  for (const e of g.enemies) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a2e2e';
    ctx.beginPath(); ctx.arc(e.x, e.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(e.x, e.y - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2020';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#e2574c';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 30), 5);
  }
  for (const b of g.bullets) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  const p = g.player;
  if (!p.vehicle) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hurtCd > 0 && Math.floor(t * 12) % 2 === 0 ? '#ff8a7a' : '#2f6db3';
    ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 - 3, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
  }
  effects.draw(ctx);
  ctx.restore();
  // Storm wash + lightning.
  const tint = weather.skyTint();
  ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a * 0.35})`;
  ctx.fillRect(0, 0, vw, vh);
  weather.drawLightning(ctx, vw, vh);
  weather.drawRain(ctx, cam, vw, vh);
}

function render() {
  ctx.setTransform(g.ratio || 1, 0, 0, g.ratio || 1, 0, 0);
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawWorld();
  if (g.screen === 'playing' || g.screen === 'paused' || g.screen === 'over' || g.screen === 'complete') drawHud(ctx, g, g.vw, g.vh);
  if (g.screen === 'menu') drawMenu(ctx, g, g.vw, g.vh);
  else if (g.screen === 'paused') drawPause(ctx, g.vw, g.vh);
  else if (g.screen === 'over') drawGameOver(ctx, g.vw, g.vh, g.overReason);
  else if (g.screen === 'complete') drawComplete(ctx, g.vw, g.vh);
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  g.ratio = ratio;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  g.vw = canvas.width / ratio;
  g.vh = canvas.height / ratio;
}

function stageShot(name) {
  g.demo = true;
  placeParkedVehicles();
  placePickups();
  const p = g.player;
  if (name === 'chase') {
    weather.setStorm(0.85);
    const car = createCar('interceptor', 1250, 1200, 0, { driver: 'player', owned: true });
    g.cars.push(car);
    p.vehicle = car;
    p.x = car.x; p.y = car.y; p.angle = 0;
    p.money = 1250;
    addWanted(g.police, 4, 'chase');
    // Two patrol cars already on the causeway behind, so the chase is in frame.
    for (const [px, py] of [[980, 1200], [880, 1250]]) {
      const pc = createCar('sedan', px, py, 0, { driver: 'police' });
      pc.top = 360; pc.color = '#2f5fd0'; pc.isPolice = true;
      g.police.units.push(pc);
    }
    g.mission.index = 4;
    startMission(4);
    g.mission.timer = 62;
    g.screen = 'playing';
    g.demoSteer = 0;
    g.shotFrames = 28;
  } else if (name === 'boat') {
    weather.setStorm(0.6);
    const boat = createBoat('speedboat', 2300, 1000, 0.25, { driver: 'player', owned: true });
    g.boats.push(boat);
    p.vehicle = boat;
    p.x = boat.x; p.y = boat.y; p.angle = 0.25;
    p.money = 980;
    addWanted(g.police, 2, 'sea');
    const pb = createBoat('skiff', 2080, 1180, 0.3, { driver: 'police' });
    pb.top = 300; pb.color = '#2f5fd0'; pb.isPolice = true;
    g.police.units.push(pb);
    g.mission.index = 2;
    startMission(2);
    g.screen = 'playing';
    g.shotFrames = 55;
  } else if (name === 'market') {
    weather.setStorm(0.15);
    p.x = 1810; p.y = 1380; p.angle = -Math.PI / 2;
    p.money = 320;
    g.mission.index = 0;
    startMission(0);
    g.demoTarget = { x: 1810, y: 1200 };
    g.screen = 'playing';
  } else {
    // 'start' and anything else: the title screen over the living city.
    weather.setStorm(0.1);
    p.x = 1810; p.y = 1200;
    g.screen = 'menu';
  }
  g.camera.x = Math.max(0, Math.min(WORLD.w - g.vw, p.x - g.vw / 2));
  g.camera.y = Math.max(0, Math.min(WORLD.h - g.vh, p.y - g.vh / 2));
}

function boot() {
  resize();
  window.addEventListener('resize', resize);
  placeParkedVehicles();
  placePickups();
  g.hasSave = (() => {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
  })();
  if (shot) {
    stageShot(shot);
    let frames = 0;
    const total = g.shotFrames || 90;
    const stepShot = () => {
      // Let the staged scene live a little so police close in and rain falls.
      for (let i = 0; i < 3; i++) update(STEP);
      render();
      frames++;
      if (frames < total) requestAnimationFrame(stepShot);
      else window.__shotReady = true;
    };
    requestAnimationFrame(stepShot);
  } else {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      acc += Math.min((now - last) / 1000, 0.25);
      last = now;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
      render();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && g.screen === 'playing') g.screen = 'paused';
    });
    announce('Tidebreak Isles. Press Enter or click to start.');
    requestAnimationFrame(frame);
  }
  window.__ready = true;
  // Debug and automated-playtest API (read-only state plus test hooks).
  window.TIDE = {
    game: g,
    state() {
      return {
        screen: g.screen, x: Math.round(g.player.x), y: Math.round(g.player.y),
        hp: Math.round(g.player.hp), money: g.player.money,
        mission: g.mission.index, missionKills: g.missionKills,
        wanted: g.police.wanted, police: g.police.units.length,
        vehicle: g.player.vehicle ? `${g.player.vehicle.kind}:${g.player.vehicle.type}` : null,
        enemies: g.enemies.length, storm: +g.weather.state.storm.toFixed(2),
      };
    },
    teleport(x, y) { g.player.x = x; g.player.y = y; if (g.player.vehicle) { g.player.vehicle.x = x; g.player.vehicle.y = y; } },
    setMission(i) { g.mission.index = i; startMission(i); },
    setMoney(n) { g.player.money = n; },
    addWanted(n) { addWanted(g.police, n, 'test'); },
    save: saveGame,
  };
}

boot();
