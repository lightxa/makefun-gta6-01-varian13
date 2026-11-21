// effects.js — Particles: spray off boats, skid smoke, muzzle flashes, splashes,
// smoke and the little gold sparkle of a pickup. All spawned through the seeded
// game RNG so replays stay deterministic.
export function createEffects(rng) {
  const parts = [];
  const skids = [];

  function spawn(kind, x, y, vx, vy, life, size, color) {
    if (parts.length > 420) parts.shift();
    parts.push({ kind, x, y, vx, vy, life, maxLife: life, size, color });
  }

  function spray(x, y, angle, n) {
    for (let i = 0; i < n; i++) {
      const a = angle + Math.PI + rng.range(-0.7, 0.7);
      const sp = rng.range(40, 160);
      spawn('spray', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rng.range(0.3, 0.7), rng.range(2, 5), '#cfe8f5');
    }
  }

  function skid(x, y, angle) {
    skids.push({ x, y, angle, life: 4 });
    if (skids.length > 240) skids.shift();
    spawn('smoke', x, y, rng.range(-20, 20), rng.range(-20, 20), 0.5, rng.range(4, 8), '#9aa0a8');
  }

  function muzzle(x, y, angle) {
    spawn('flash', x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 0, 0, 0.09, 14, '#ffd76a');
    for (let i = 0; i < 4; i++) {
      spawn('spark', x, y, Math.cos(angle + rng.range(-0.4, 0.4)) * rng.range(200, 380),
        Math.sin(angle + rng.range(-0.4, 0.4)) * rng.range(200, 380), 0.18, 2, '#ffcf4d');
    }
  }

  function splash(x, y, n) {
    for (let i = 0; i < (n || 8); i++) {
      spawn('spray', x + rng.range(-8, 8), y + rng.range(-8, 8), rng.range(-90, 90), rng.range(-120, -20),
        rng.range(0.3, 0.6), rng.range(2, 4), '#bfe0f2');
    }
  }

  function smoke(x, y) {
    spawn('smoke', x, y, rng.range(-12, 12), rng.range(-40, -10), rng.range(0.6, 1.1), rng.range(6, 12), '#6b6f75');
  }

  function sparkle(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = rng.angle();
      spawn('spark', x, y, Math.cos(a) * rng.range(30, 120), Math.sin(a) * rng.range(30, 120),
        rng.range(0.3, 0.6), rng.range(2, 4), '#ffd94d');
    }
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.kind === 'spray') p.vy += 160 * dt;
    }
    for (let i = skids.length - 1; i >= 0; i--) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const s of skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(0.5, s.life * 0.2);
      ctx.fillStyle = '#3a3f45';
      ctx.fillRect(-14, -3, 28, 6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'flash') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  return { spawn, spray, skid, muzzle, splash, smoke, sparkle, update, draw, parts, skids };
}
