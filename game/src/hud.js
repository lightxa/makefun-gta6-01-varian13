// hud.js — Everything on top of the world: health, money, wanted stars, the
// mission banner, the minimap, prompts, and the title / pause / game-over menus.
// All of it is drawn on the canvas so it shows up in screenshots.
import { ISLANDS, ROADS, ROAD_W, WORLD, DOCKS } from './world.js';
import { MISSIONS } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill || 'rgba(12,18,28,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, g, vw, vh) {
  const p = g.player;
  // Top-left status panel.
  panel(ctx, 12, 12, 268, 112);
  text(ctx, 'TIDEBREAK ISLES', 24, 38, 15, '#ffd94d', 'left', true);
  text(ctx, `$ ${p.money}`, 24, 64, 20, '#ffffff', 'left', true);
  // Health bar.
  ctx.fillStyle = '#3a2020';
  ctx.fillRect(24, 74, 160, 12);
  ctx.fillStyle = p.hp > 30 ? '#57b25e' : '#e2574c';
  ctx.fillRect(24, 74, 160 * Math.max(0, p.hp / 100), 12);
  text(ctx, `HP ${Math.ceil(p.hp)}`, 192, 86, 13, '#ffffff', 'left');
  const mission = MISSIONS[g.mission.index];
  text(ctx, mission ? `Mission ${g.mission.index + 1}/6: ${mission.title}` : 'All missions done', 24, 100, 13, '#cfe8f5', 'left');

  // Wanted stars, top-right.
  panel(ctx, vw - 212, 12, 200, 52);
  text(ctx, 'WANTED', vw - 200, 34, 13, '#ffb3ad', 'left', true);
  for (let i = 0; i < 5; i++) {
    text(ctx, '★', vw - 200 + i * 34, 58, 22, i < g.police.wanted ? '#ffcf4d' : 'rgba(255,255,255,0.25)', 'left');
  }

  // Mission objective, top-centre.
  if (mission) {
    const lines = [mission.brief];
    if (mission.timed && g.mission.timer > 0) lines.push(`Time left: ${Math.ceil(g.mission.timer)}s`);
    const w = 600;
    panel(ctx, (vw - w) / 2, 12, w, 30 + lines.length * 18);
    text(ctx, `★ ${mission.title}`, vw / 2, 36, 15, '#ffffff', 'center', true);
    lines.forEach((l, i) => text(ctx, l, vw / 2, 54 + i * 18, 13, '#dfe9f2', 'center'));
  }

  // Mission banner.
  if (g.mission.bannerTimer > 0) {
    ctx.globalAlpha = Math.min(1, g.mission.bannerTimer);
    panel(ctx, (vw - 460) / 2, vh / 2 - 130, 460, 64, 'rgba(20,40,24,0.88)');
    text(ctx, g.mission.banner, vw / 2, vh / 2 - 92, 22, '#ffd94d', 'center', true);
    ctx.globalAlpha = 1;
  }

  // Prompt line, bottom-centre.
  if (g.prompt) {
    const w = Math.min(720, 24 + g.prompt.length * 8.4);
    panel(ctx, (vw - w) / 2, vh - 96, w, 34);
    text(ctx, g.prompt, vw / 2, vh - 73, 15, '#ffffff', 'center');
  }

  // Controls reminder, bottom-left.
  text(ctx, 'WASD move/drive  •  E enter vehicle  •  F punch  •  Space/click shoot  •  Q shop  •  P pause', 14, vh - 14, 12, 'rgba(255,255,255,0.75)', 'left');

  drawMinimap(ctx, g, vw, vh);
}

function drawMinimap(ctx, g, vw, vh) {
  const mw = 230, mh = 166, mx = vw - mw - 12, my = vh - mh - 12;
  panel(ctx, mx - 6, my - 6, mw + 12, mh + 12, 'rgba(10,16,26,0.82)');
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  const X = (x) => mx + x * sx;
  const Y = (y) => my + y * sy;
  ctx.fillStyle = '#1d4e6e';
  ctx.fillRect(mx, my, mw, mh);
  for (const isl of ISLANDS) {
    ctx.fillStyle = isl.grass;
    ctx.fillRect(X(isl.x), Y(isl.y), isl.w * sx, isl.h * sy);
  }
  ctx.strokeStyle = '#e8e2d2';
  ctx.lineWidth = 2;
  for (const r of ROADS) {
    ctx.beginPath();
    ctx.moveTo(X(r.x1), Y(r.y1));
    ctx.lineTo(X(r.x2), Y(r.y2));
    ctx.stroke();
  }
  for (const d of DOCKS) {
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(X(d.x) - 3, Y(d.y) - 3, 6, 6);
  }
  const target = MISSIONS[g.mission.index];
  if (target) {
    const pulse = 4 + Math.sin(g.time * 5) * 2;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(X(target.target.x), Y(target.target.y), pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const u of g.police.units) {
    ctx.fillStyle = '#4c8de2';
    ctx.beginPath();
    ctx.arc(X(u.x), Y(u.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(X(g.player.x), Y(g.player.y), 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, 'TIDEBREAK ISLES', mx + 4, my + 14, 11, '#ffffff', 'left', true);
}

export function drawMenu(ctx, g, vw, vh) {
  ctx.fillStyle = 'rgba(8,14,24,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, (vw - 640) / 2, vh / 2 - 190, 640, 380, 'rgba(10,18,30,0.92)');
  text(ctx, 'TIDEBREAK ISLES', vw / 2, vh / 2 - 128, 44, '#ffd94d', 'center', true);
  text(ctx, 'Three islands. One courier. A storm coming in.', vw / 2, vh / 2 - 92, 17, '#dfe9f2', 'center');
  const lines = [
    'You are Rook, courier for the Tidebreak crew.',
    'Run 6 missions across Harbour, Market and Lighthouse islands.',
    'Steal cars, sail boats, dodge the Breakers and the law.',
    'Earn money. Buy a faster boat or a tuned engine at the garage.',
  ];
  lines.forEach((l, i) => text(ctx, l, vw / 2, vh / 2 - 52 + i * 26, 15, '#cfe8f5', 'center'));
  text(ctx, g.hasSave ? 'Press Enter: continue your saved run' : 'Press Enter or click to start', vw / 2, vh / 2 + 74, 18, '#ffffff', 'center', true);
  text(ctx, 'WASD move  •  E enter / steal vehicle  •  F punch  •  Space shoot  •  Q shop  •  P pause', vw / 2, vh / 2 + 112, 13, 'rgba(255,255,255,0.7)', 'center');
  text(ctx, 'A complete open world: 3 islands, traffic, police on land and sea, 6 missions.', vw / 2, vh / 2 + 142, 13, '#ffd94d', 'center');
}

export function drawPause(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,14,24,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, (vw - 420) / 2, vh / 2 - 110, 420, 220, 'rgba(10,18,30,0.94)');
  text(ctx, 'PAUSED', vw / 2, vh / 2 - 56, 34, '#ffffff', 'center', true);
  text(ctx, 'P resume    •    S save game    •    M mute', vw / 2, vh / 2 - 8, 15, '#dfe9f2', 'center');
  text(ctx, 'Your progress saves automatically after each mission.', vw / 2, vh / 2 + 28, 13, '#cfe8f5', 'center');
  text(ctx, 'Saved games live in this browser (localStorage).', vw / 2, vh / 2 + 56, 13, '#cfe8f5', 'center');
}

export function drawGameOver(ctx, vw, vh, reason) {
  ctx.fillStyle = 'rgba(20,8,10,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, (vw - 480) / 2, vh / 2 - 100, 480, 200, 'rgba(24,10,12,0.94)');
  text(ctx, 'BUSTED / DOWN', vw / 2, vh / 2 - 48, 32, '#ff6b5e', 'center', true);
  text(ctx, reason || 'Rook is down. The crew pulls him out and he is back on his feet.', vw / 2, vh / 2 - 6, 14, '#dfe9f2', 'center');
  text(ctx, 'Press Enter to get back in the game', vw / 2, vh / 2 + 40, 16, '#ffffff', 'center', true);
}

export function drawComplete(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,20,12,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, (vw - 560) / 2, vh / 2 - 110, 560, 220, 'rgba(10,26,16,0.94)');
  text(ctx, 'THE TIDE BREAKS FOR YOU', vw / 2, vh / 2 - 56, 30, '#ffd94d', 'center', true);
  text(ctx, 'All six missions done. The Tidebreak crew owns the isles tonight.', vw / 2, vh / 2 - 10, 15, '#dfe9f2', 'center');
  text(ctx, 'Press Enter to keep cruising the islands', vw / 2, vh / 2 + 36, 15, '#ffffff', 'center', true);
}
