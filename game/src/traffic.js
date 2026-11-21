// traffic.js — The living city: traffic cars that follow the road graph and
// pedestrians who wander the sidewalks. Both are seeded, so the streets look
// the same on every run with the same seed.
import { bfsPath, tryMove } from './world.js';
import { createCar, CAR_TYPES } from './vehicles.js';

const PED_COLORS = ['#e2574c', '#4c8de2', '#57b25e', '#e2c14c', '#9b59b6', '#e07b39', '#3fa7a0'];

export function createTraffic(world, rng) {
  const nodes = world.nodes;
  const cars = [];
  const carTypes = Object.keys(CAR_TYPES);
  for (let i = 0; i < 14; i++) {
    const node = rng.pick(nodes);
    const type = rng.pick(carTypes);
    const car = createCar(type, node.x + rng.range(-14, 14), node.y + rng.range(-14, 14), rng.angle(), { driver: 'traffic' });
    car.path = [];
    car.targetNode = null;
    car.speed = 0;
    cars.push(car);
  }
  const peds = [];
  for (let i = 0; i < 36; i++) {
    const isl = rng.pick([{ x: 200, y: 500, w: 820, h: 1600 }, { x: 1500, y: 600, w: 620, h: 1400 }, { x: 2600, y: 500, w: 820, h: 1600 }]);
    const x = rng.range(isl.x, isl.x + isl.w), y = rng.range(isl.y, isl.y + isl.h);
    peds.push({ x, y, tx: x, ty: y, angle: rng.angle(), speed: rng.range(28, 55), color: rng.pick(PED_COLORS), wait: rng.range(0, 3) });
  }
  return { cars, peds, nodes };
}

function nearestNode(nodes, x, y) {
  let best = nodes[0], bestD = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export function updateTraffic(traffic, dt, world, rng, playerPos) {
  for (const car of traffic.cars) {
    if (car.driver !== 'traffic') continue;
    if (!car.path.length) {
      const from = nearestNode(traffic.nodes, car.x, car.y);
      const to = rng.pick(traffic.nodes);
      car.path = bfsPath(traffic.nodes, from, to).slice(1);
    }
    const target = car.path[0];
    if (!target) continue;
    const dx = target.x - car.x, dy = target.y - car.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Slow for the player crossing ahead.
    const pd = playerPos ? Math.hypot(playerPos.x - car.x, playerPos.y - car.y) : 9999;
    const cruise = pd < 90 ? 40 : 150;
    car.speed += (cruise - car.speed) * dt * 1.2;
    const moved = tryMove(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 12, 'land', world.buildings);
    car.x = moved.x;
    car.y = moved.y;
    if (dist < 26) car.path.shift();
  }
  for (const p of traffic.peds) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      const isl = { x: 120, y: 420, w: 3380, h: 1760 };
      let nx = p.x + rng.range(-320, 320), ny = p.y + rng.range(-320, 320);
      nx = Math.max(isl.x + 40, Math.min(isl.x + isl.w - 40, nx));
      ny = Math.max(isl.y + 40, Math.min(isl.y + isl.h - 40, ny));
      p.tx = nx; p.ty = ny;
      p.wait = rng.range(0, 2.5);
      continue;
    }
    p.angle = Math.atan2(dy, dx);
    const moved = tryMove(p, Math.cos(p.angle) * p.speed * dt, Math.sin(p.angle) * p.speed * dt, 10, 'land', world.buildings);
    p.x = moved.x;
    p.y = moved.y;
  }
}

export function drawTraffic(ctx, traffic, cam, vw, vh) {
  for (const p of traffic.peds) {
    if (p.x < cam.x - 40 || p.x > cam.x + vw + 40 || p.y < cam.y - 40 || p.y > cam.y + vh + 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(p.x, p.y - 4, 5, 0, Math.PI * 2); ctx.fill();
  }
}
