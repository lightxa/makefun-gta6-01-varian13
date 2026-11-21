// missions.js — The six-mission Tidebreak story. Each mission names its goal,
// its target on the map, how it is completed, and its payout. Completion is
// checked against the live game state, never assumed.
export const MISSIONS = [
  {
    id: 'm1-first-run', title: 'First Run', reward: 150,
    brief: 'Mara needs a parcel at the Night Market. Get it there on foot or by car.',
    target: { x: 1810, y: 1200, label: 'Night Market Square', radius: 90 },
    check: (g) => Math.hypot(g.player.x - 1810, g.player.y - 1200) < 90,
    hint: 'Follow the yellow marker. Cross the west causeway to Market Island.',
  },
  {
    id: 'm2-hot-wheels', title: 'Hot Wheels', reward: 250,
    brief: 'The crew needs a Marlin Sedan. Steal one and park it at Rook\u2019s Garage.',
    target: { x: 595, y: 655, label: "Rook's Garage", radius: 110 },
    check: (g) => g.player.vehicle && g.player.vehicle.kind === 'car'
      && g.player.vehicle.type === 'sedan'
      && Math.hypot(g.player.x - 595, g.player.y - 655) < 110,
    hint: 'Press E beside a blue sedan to steal it. Stealing raises your wanted level.',
  },
  {
    id: 'm3-harbour-lights', title: 'Harbour Lights', reward: 300,
    brief: 'Sail a boat from the Fish Quay to Lantern Quay on Lighthouse Island.',
    target: { x: 3530, y: 900, label: 'Lantern Quay', radius: 110 },
    check: (g) => g.player.vehicle && g.player.vehicle.kind === 'boat'
      && Math.hypot(g.player.x - 3530, g.player.y - 900) < 110,
    hint: 'Board a boat at a dock with E, then sail east around the islands.',
  },
  {
    id: 'm4-breaker-ambush', title: 'Breaker Ambush', reward: 350,
    brief: 'Breaker thugs are shaking down the market. Drive them off: defeat 3 of them.',
    target: { x: 1810, y: 1400, label: 'Market Ambush', radius: 260 },
    check: (g) => g.missionKills >= 3,
    hint: 'Punch with F, shoot with Space or click. Watch your health.',
  },
  {
    id: 'm5-storm-courier', title: 'Storm Courier', reward: 450,
    brief: 'A storm parcel for the lighthouse keeper. Reach Stormlight Lighthouse in 90 seconds.',
    target: { x: 3145, y: 545, label: 'Stormlight Lighthouse', radius: 100 },
    timed: 90,
    check: (g) => Math.hypot(g.player.x - 3145, g.player.y - 545) < 100,
    hint: 'The storm is rising. Drive fast, stay on the roads.',
  },
  {
    id: 'm6-tidebreak-job', title: 'The Tidebreak Job', reward: 800,
    brief: 'Steal the gold Tide Runner speedboat, shake the patrol boats, and bring it home to the Fish Quay.',
    target: { x: 100, y: 1500, label: 'Fish Quay', radius: 120 },
    check: (g) => g.player.vehicle && g.player.vehicle.kind === 'boat'
      && g.player.vehicle.type === 'speedboat'
      && Math.hypot(g.player.x - 100, g.player.y - 1500) < 120,
    hint: 'The gold speedboat waits at Lantern Quay. The law will not like it.',
  },
];

export function createMissionState() {
  return { index: 0, kills: 0, timer: 0, banner: '', bannerTimer: 0, done: false };
}

export function currentMission(state) {
  return MISSIONS[state.index] || null;
}

export function missionTarget(state) {
  const m = currentMission(state);
  return m ? m.target : null;
}
