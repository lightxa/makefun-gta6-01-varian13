// vehicles.js — Cars and boats: three car types and two boat types, their driving
// physics, and their top-down drawings. Boats are the signature vehicle class:
// they sail the open water between the islands and bob on the storm waves.
import { isWaterAt, tryMove } from './world.js';

export const CAR_TYPES = {
  hatch: { name: 'Dune Hatch', top: 250, accel: 420, turn: 2.6, color: '#e0a458', len: 46, wid: 22 },
  sedan: { name: 'Marlin Sedan', top: 330, accel: 520, turn: 2.9, color: '#5b7fa6', len: 52, wid: 24 },
  interceptor: { name: 'Storm Interceptor', top: 430, accel: 680, turn: 3.3, color: '#b03a3a', len: 54, wid: 24 },
};

export const BOAT_TYPES = {
  skiff: { name: 'Harbour Skiff', top: 230, accel: 300, turn: 1.9, color: '#d8cfba', len: 56, wid: 22 },
  speedboat: { name: 'Tide Runner', top: 380, accel: 520, turn: 2.5, color: '#e8b23a', len: 62, wid: 24 },
};

let nextId = 1;

export function createCar(type, x, y, angle, opts) {
  const t = CAR_TYPES[type];
  return {
    id: nextId++, kind: 'car', type, name: t.name, x, y, angle: angle || 0,
    speed: 0, color: (opts && opts.color) || t.color, top: t.top, accel: t.accel,
    turn: t.turn, len: t.len, wid: t.wid, owned: !!(opts && opts.owned),
    stolen: false, driver: (opts && opts.driver) || 'traffic', hp: 100,
  };
}

export function createBoat(type, x, y, angle, opts) {
  const t = BOAT_TYPES[type];
  return {
    id: nextId++, kind: 'boat', type, name: t.name, x, y, angle: angle || 0,
    speed: 0, color: (opts && opts.color) || t.color, top: t.top, accel: t.accel,
    turn: t.turn, len: t.len, wid: t.wid, owned: !!(opts && opts.owned),
    stolen: false, driver: (opts && opts.driver) || 'parked', hp: 100, bob: 0,
  };
}

// Drive a car with {throttle -1..1, steer -1..1}; returns distance moved.
export function driveCar(v, input, dt, buildings, upgrade) {
  const top = v.top * (upgrade ? 1.25 : 1);
  v.speed += input.throttle * v.accel * dt;
  v.speed -= v.speed * 0.9 * dt;
  if (input.throttle === 0) v.speed -= v.speed * 1.6 * dt;
  v.speed = Math.max(-top * 0.45, Math.min(top, v.speed));
  v.angle += input.steer * v.turn * dt * Math.min(1, Math.abs(v.speed) / 90) * (v.speed < 0 ? -1 : 1);
  const dx = Math.cos(v.angle) * v.speed * dt;
  const dy = Math.sin(v.angle) * v.speed * dt;
  const moved = tryMove(v, dx, dy, v.wid * 0.55, 'land', buildings);
  const dist = Math.hypot(moved.x - v.x, moved.y - v.y);
  if (dist < Math.hypot(dx, dy) * 0.5) v.speed *= 0.4;
  v.x = moved.x;
  v.y = moved.y;
  return dist;
}

// Sail a boat: slower turns, drift, and a push from the wind.
export function driveBoat(v, input, dt, buildings, wind, wave) {
  v.speed += input.throttle * v.accel * dt;
  v.speed -= v.speed * 0.55 * dt;
  if (input.throttle === 0) v.speed -= v.speed * 0.8 * dt;
  v.speed = Math.max(-v.top * 0.4, Math.min(v.top, v.speed));
  v.angle += input.steer * v.turn * dt * Math.min(1, Math.abs(v.speed) / 80) * (v.speed < 0 ? -1 : 1);
  const dx = Math.cos(v.angle) * v.speed * dt + wind * 14 * dt;
  const dy = Math.sin(v.angle) * v.speed * dt + wave * 6 * dt;
  const moved = tryMove(v, dx, dy, v.wid * 0.55, 'sea', buildings);
  const dist = Math.hypot(moved.x - v.x, moved.y - v.y);
  if (dist < Math.hypot(dx, dy) * 0.5) v.speed *= 0.5;
  v.x = moved.x;
  v.y = moved.y;
  v.bob = wave;
  return dist;
}

function drawVehicleShape(ctx, v, isBoat) {
  ctx.save();
  ctx.translate(v.x, v.y + (isBoat ? v.bob * 0.6 : 0));
  ctx.rotate(v.angle);
  const L = v.len, W = v.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = v.color;
  if (isBoat) {
    ctx.beginPath();
    ctx.moveTo(L / 2, 0);
    ctx.lineTo(L / 2 - 12, -W / 2);
    ctx.lineTo(-L / 2, -W / 2);
    ctx.lineTo(-L / 2, W / 2);
    ctx.lineTo(L / 2 - 12, W / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-L / 2 + 8, -W / 2 + 5, L * 0.4, W - 10);
  } else {
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(-L * 0.1, -W / 2 + 4, L * 0.32, W - 8);
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.fillRect(L / 2 - 4, -W / 2 + 3, 3, 5);
    ctx.fillRect(L / 2 - 4, W / 2 - 8, 3, 5);
  }
  ctx.restore();
}

export function drawCar(ctx, v) { drawVehicleShape(ctx, v, false); }
export function drawBoat(ctx, v) { drawVehicleShape(ctx, v, true); }

export function nearestVehicle(list, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const v of list) {
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export { isWaterAt };
