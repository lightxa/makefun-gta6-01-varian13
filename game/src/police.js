// police.js — The wanted system: stars 0 to 5, police cars on land and patrol
// boats at sea. Heat rises with crimes and cools when the player lays low and
// out of sight. Police ram the player; they never teleport onto them.
import { tryMove, isWaterAt } from './world.js';
import { createCar, createBoat } from './vehicles.js';

export function createPolice(world) {
  return {
    wanted: 0,
    heat: 0,          // seconds since the last crime
    coolTimer: 0,
    units: [],        // {kind:'car'|'boat', x,y,angle,speed,...}
    sirenTimer: 0,
    spawnTimer: 0,
  };
}

export function addWanted(police, n, reason) {
  police.wanted = Math.max(0, Math.min(5, police.wanted + n));
  police.heat = 0;
  police.coolTimer = 0;
  return police.wanted;
}

function spawnUnit(police, player, world, rng) {
  const atSea = isWaterAt(player.x, player.y);
  let x = player.x, y = player.y, angle = rng.angle();
  for (let tries = 0; tries < 14; tries++) {
    angle = rng.angle();
    const dist = 620;
    const tx = player.x + Math.cos(angle) * dist;
    const ty = player.y + Math.sin(angle) * dist;
    if (tx < 60 || ty < 60 || tx > 3540 || ty > 2540) continue;
    if (atSea ? isWaterAt(tx, ty) : !isWaterAt(tx, ty)) { x = tx; y = ty; break; }
  }
  if (atSea) {
    const boat = createBoat('skiff', x, y, angle, { driver: 'police' });
    boat.top = 300;
    boat.color = '#2f5fd0';
    boat.isPolice = true;
    police.units.push(boat);
  } else {
    const car = createCar('sedan', x, y, angle, { driver: 'police' });
    car.top = 360;
    car.color = '#2f5fd0';
    car.isPolice = true;
    police.units.push(car);
  }
}

export function updatePolice(police, dt, player, world, rng, onRam) {
  police.heat += dt;
  police.sirenTimer -= dt;
  // Cool down: no crime for 18 s and no unit close by sheds a star.
  const nearest = police.units.reduce((m, u) => Math.min(m, Math.hypot(u.x - player.x, u.y - player.y)), Infinity);
  if (police.wanted > 0 && police.heat > 18 && nearest > 420) {
    police.coolTimer += dt;
    if (police.coolTimer > 9) {
      police.wanted -= 1;
      police.coolTimer = 0;
      police.heat = 0;
    }
  } else {
    police.coolTimer = 0;
  }
  // Keep the chase sized to the wanted level.
  const want = police.wanted > 0 ? Math.min(police.wanted, 4) : 0;
  police.spawnTimer -= dt;
  if (police.units.length < want && police.spawnTimer <= 0) {
    spawnUnit(police, player, world, rng);
    police.spawnTimer = 1.2;
  }
  // Cull units that fell far behind.
  police.units = police.units.filter((u) => Math.hypot(u.x - player.x, u.y - player.y) < 1600);
  for (const u of police.units) {
    const dx = player.x - u.x, dy = player.y - u.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - u.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = u.kind === 'boat' ? 2.2 : 3.0;
    u.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const targetSpeed = dist > 120 ? u.top : u.top * 0.55;
    u.speed += (targetSpeed - u.speed) * dt * 1.4;
    const mode = u.kind === 'boat' ? 'sea' : 'land';
    const moved = tryMove(u, Math.cos(u.angle) * u.speed * dt, Math.sin(u.angle) * u.speed * dt, 12, mode, world.buildings);
    u.x = moved.x;
    u.y = moved.y;
    if (dist < 46 && onRam) onRam(u, dist);
  }
  if (police.wanted > 0 && police.sirenTimer <= 0) {
    police.sirenTimer = 0.9;
    return true; // time to play the siren
  }
  return false;
}

export function drawPolice(ctx, police, time) {
  for (const u of police.units) {
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(u.angle);
    ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-8, -u.wid / 2 - 4, 16, 6);
    ctx.restore();
  }
}
