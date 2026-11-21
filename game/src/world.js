// world.js — The Tidebreak Isles map: three islands, causeways, roads, docks,
// buildings and the collision rules that keep feet and wheels on land and
// boats on water. All layout is generated from a fixed seed, so it is identical
// on every load.
import { Rng } from './rng.js';

export const WORLD = { w: 3600, h: 2600 };

export const ISLANDS = [
  { id: 'harbour', name: 'Harbour Island', x: 120, y: 420, w: 980, h: 1760, sand: '#c9b078', grass: '#7fae62', accent: '#5b7fa6' },
  { id: 'market', name: 'Night Market Island', x: 1420, y: 520, w: 780, h: 1560, sand: '#cbb27e', grass: '#86b364', accent: '#c96a3b' },
  { id: 'lighthouse', name: 'Lighthouse Island', x: 2520, y: 420, w: 980, h: 1760, sand: '#cdb684', grass: '#79a85e', accent: '#e8e2d2' },
];

export const BRIDGES = [
  { x: 1100, y: 1150, w: 320, h: 100 },
  { x: 2200, y: 1150, w: 320, h: 100 },
];

// Road centre-lines, width 46.
export const ROADS = [
  { x1: 200, y1: 700, x2: 1020, y2: 700 }, { x1: 200, y1: 1200, x2: 1100, y2: 1200 },
  { x1: 200, y1: 1700, x2: 1020, y2: 1700 },
  { x1: 350, y1: 500, x2: 350, y2: 2100 }, { x1: 650, y1: 500, x2: 650, y2: 2100 },
  { x1: 950, y1: 500, x2: 950, y2: 2100 },
  { x1: 1100, y1: 1200, x2: 1420, y2: 1200 }, { x1: 2200, y1: 1200, x2: 2520, y2: 1200 },
  { x1: 1500, y1: 800, x2: 2120, y2: 800 }, { x1: 1420, y1: 1200, x2: 2200, y2: 1200 },
  { x1: 1500, y1: 1600, x2: 2120, y2: 1600 },
  { x1: 1650, y1: 600, x2: 1650, y2: 2000 }, { x1: 1900, y1: 600, x2: 1900, y2: 2000 },
  { x1: 2600, y1: 800, x2: 3420, y2: 800 }, { x1: 2520, y1: 1200, x2: 3500, y2: 1200 },
  { x1: 2600, y1: 1700, x2: 3420, y2: 1700 },
  { x1: 2850, y1: 500, x2: 2850, y2: 2100 }, { x1: 3150, y1: 500, x2: 3150, y2: 2100 },
];

export const ROAD_W = 46;

export const DOCKS = [
  { id: 'dock-west-1', x: 95, y: 900, angle: Math.PI, name: 'West Pier', island: 'harbour' },
  { id: 'dock-west-2', x: 95, y: 1500, angle: Math.PI, name: 'Fish Quay', island: 'harbour' },
  { id: 'dock-market', x: 1810, y: 2110, angle: Math.PI / 2, name: 'Market Steps', island: 'market' },
  { id: 'dock-light-1', x: 3530, y: 900, angle: 0, name: 'Lantern Quay', island: 'lighthouse' },
  { id: 'dock-light-2', x: 3530, y: 1600, angle: 0, name: 'East Jetty', island: 'lighthouse' },
];

export const SPECIALS = [
  { kind: 'garage', name: "Rook's Garage", x: 520, y: 600, w: 150, h: 110 },
  { kind: 'lighthouse', name: 'Stormlight Lighthouse', x: 3100, y: 500, w: 90, h: 90 },
  { kind: 'market', name: 'Night Market Square', x: 1730, y: 1120, w: 170, h: 160 },
  { kind: 'warehouse', name: 'Tidebreak Warehouse', x: 800, y: 1750, w: 200, h: 130 },
  { kind: 'clinic', name: 'Quay Clinic', x: 260, y: 1750, w: 130, h: 100 },
];

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function isOnBridge(x, y) {
  return BRIDGES.some((b) => pointInRect(x, y, b));
}

export function islandAt(x, y) {
  return ISLANDS.find((i) => pointInRect(x, y, i)) || null;
}

export function isWaterAt(x, y) {
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return true;
  if (isOnBridge(x, y)) return false;
  return islandAt(x, y) === null;
}

export function distToRoad(x, y) {
  let best = Infinity;
  for (const r of ROADS) {
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - r.x1) * dx + (y - r.y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = r.x1 + t * dx, py = r.y1 + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

export function onRoad(x, y) {
  return distToRoad(x, y) < ROAD_W / 2 + 6;
}

// Build the traffic graph: nodes where roads meet or end, edges along roads.
export function buildRoadGraph() {
  const nodes = [];
  const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  const addNode = (x, y) => {
    const k = key(x, y);
    let n = nodes.find((v) => v.k === k);
    if (!n) { n = { k, x, y, links: [] }; nodes.push(n); }
    return n;
  };
  for (const r of ROADS) {
    addNode(r.x1, r.y1);
    addNode(r.x2, r.y2);
    for (const s of ROADS) {
      if (s === r) continue;
      const horizR = r.y1 === r.y2, horizS = s.y1 === s.y2;
      if (horizR === horizS) continue;
      const h = horizR ? r : s, v = horizR ? s : r;
      if (v.x1 >= Math.min(h.x1, h.x2) && v.x1 <= Math.max(h.x1, h.x2)
        && h.y1 >= Math.min(v.y1, v.y2) && h.y1 <= Math.max(v.y1, v.y2)) {
        addNode(v.x1, h.y1);
      }
    }
  }
  for (const r of ROADS) {
    const along = nodes.filter((n) => {
      if (r.y1 === r.y2) return n.y === r.y1 && n.x >= Math.min(r.x1, r.x2) && n.x <= Math.max(r.x1, r.x2);
      return n.x === r.x1 && n.y >= Math.min(r.y1, r.y2) && n.y <= Math.max(r.y1, r.y2);
    });
    along.sort((a, b) => (r.y1 === r.y2 ? a.x - b.x : a.y - b.y));
    for (let i = 0; i + 1 < along.length; i++) {
      const a = along[i], b = along[i + 1];
      if (!a.links.includes(b)) a.links.push(b);
      if (!b.links.includes(a)) b.links.push(a);
    }
  }
  return nodes;
}

export function bfsPath(nodes, from, to) {
  const prev = new Map();
  const queue = [from];
  prev.set(from.k, null);
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const n of cur.links) {
      if (!prev.has(n.k)) { prev.set(n.k, cur); queue.push(n); }
    }
  }
  if (!prev.has(to.k)) return [to];
  const path = [];
  let cur = to;
  while (cur) { path.unshift(cur); cur = prev.get(cur.k); }
  return path;
}

export function makeWorld(seed) {
  const rng = new Rng(seed);
  const buildings = [];
  const palette = {
    harbour: ['#8a97a8', '#6e7f92', '#9aa5b1', '#5d6b7d'],
    market: ['#c96a3b', '#d98a4a', '#b0522f', '#e0a458', '#a34d6e'],
    lighthouse: ['#e8e2d2', '#d8cfba', '#f2ead8', '#c9bfa8'],
  };
  for (const isl of ISLANDS) {
    let placed = 0, tries = 0;
    while (placed < 16 && tries < 300) {
      tries++;
      const w = rng.range(90, 210), h = rng.range(70, 150);
      const x = rng.range(isl.x + 50, isl.x + isl.w - 50 - w);
      const y = rng.range(isl.y + 50, isl.y + isl.h - 50 - h);
      const cx = x + w / 2, cy = y + h / 2;
      if (distToRoad(cx, cy) < ROAD_W / 2 + Math.max(w, h) / 2 + 14) continue;
      if (SPECIALS.some((s) => x < s.x + s.w + 20 && x + w > s.x - 20 && y < s.y + s.h + 20 && y + h > s.y - 20)) continue;
      if (buildings.some((b) => x < b.x + b.w + 18 && x + w > b.x - 18 && y < b.y + b.h + 18 && y + h > b.y - 18)) continue;
      if (DOCKS.some((d) => Math.hypot(d.x - cx, d.y - cy) < 190)) continue;
      buildings.push({ x, y, w, h, color: rng.pick(palette[isl.id]), island: isl.id });
      placed++;
    }
  }
  const trees = [];
  for (let i = 0; i < 220; i++) {
    const x = rng.range(40, WORLD.w - 40), y = rng.range(40, WORLD.h - 40);
    if (isWaterAt(x, y)) continue;
    if (distToRoad(x, y) < ROAD_W / 2 + 16) continue;
    if (buildings.some((b) => pointInRect(x, y, { x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 }))) continue;
    trees.push({ x, y, r: rng.range(9, 16) });
  }
  return { buildings, trees, nodes: buildRoadGraph() };
}

// Move a circle, axis by axis, respecting land/sea and building walls.
// mode: 'land' stays on land, 'sea' stays on water, 'any' ignores water.
export function tryMove(pos, dx, dy, r, mode, buildings) {
  let { x, y } = pos;
  const ok = (nx, ny) => {
    if (mode === 'land' && isWaterAt(nx, ny)) return false;
    if (mode === 'sea' && !isWaterAt(nx, ny)) return false;
    if (nx < r || ny < r || nx > WORLD.w - r || ny > WORLD.h - r) return false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
      if (Math.hypot(nx - cx, ny - cy) < r) return false;
    }
    return true;
  };
  if (ok(x + dx, y)) x += dx;
  if (ok(x, y + dy)) y += dy;
  return { x, y };
}

export function circleHitsBuilding(x, y, r, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if (Math.hypot(x - cx, y - cy) < r) return b;
  }
  return null;
}
