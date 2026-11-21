// weather.js — The gathering storm: a day that starts sunny and slides into rain,
// lightning and rough seas. Rain, wind and waves are all drawn from this module.
import { WORLD } from './world.js';

export function createWeather(rng) {
  const state = {
    time: 0,            // seconds since boot
    storm: 0,           // 0 = clear sun, 1 = full storm
    rain: 0,            // 0..1 rain intensity
    wind: 0.2,          // wind strength, pushes boats and rain sideways
    flash: 0,           // lightning flash brightness 0..1
    flashTimer: 6,      // seconds to the next bolt
    drops: [],
  };
  for (let i = 0; i < 260; i++) {
    state.drops.push({ x: rng.range(0, 1600), y: rng.range(0, 900), len: rng.range(10, 22), speed: rng.range(700, 1100) });
  }

  function update(dt, onThunder) {
    state.time += dt;
    // The storm gathers over the first four minutes of play.
    const target = Math.min(1, state.time / 240);
    state.storm += (target - state.storm) * dt * 0.2;
    state.rain = state.storm * state.storm;
    state.wind = 0.2 + state.storm * 0.9;
    state.flashTimer -= dt;
    if (state.flashTimer <= 0) {
      state.flashTimer = 5 + rng.range(0, 9) * (1 - state.storm * 0.6);
      state.flash = 1;
      if (onThunder) onThunder();
    }
    state.flash = Math.max(0, state.flash - dt * 2.2);
    for (const d of state.drops) {
      d.y += d.speed * dt;
      d.x += state.wind * 260 * dt;
      if (d.y > 920) { d.y = -20; d.x = rng.range(-40, 1640); }
      if (d.x > 1640) d.x = -20;
    }
  }

  function setStorm(value) {
    state.storm = value;
    state.time = value * 240;
    state.rain = value * value;
    state.wind = 0.2 + value * 0.9;
  }

  // Sun-to-storm sky tint, drawn as a full-screen wash by the renderer.
  function skyTint() {
    const s = state.storm;
    return { r: Math.round(255 - s * 110), g: Math.round(240 - s * 95), b: Math.round(200 - s * 40), a: 0.10 + s * 0.16 };
  }

  function drawRain(ctx, cam, vw, vh) {
    if (state.rain < 0.03) return;
    ctx.save();
    ctx.strokeStyle = `rgba(180,200,230,${0.25 + state.rain * 0.35})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const n = Math.floor(state.drops.length * state.rain);
    for (let i = 0; i < n; i++) {
      const d = state.drops[i];
      const x = ((d.x - cam.x * 0.4) % vw + vw) % vw;
      const y = ((d.y - cam.y * 0.4) % vh + vh) % vh;
      ctx.moveTo(x, y);
      ctx.lineTo(x - state.wind * 6, y + d.len);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLightning(ctx, vw, vh) {
    if (state.flash <= 0.01) return;
    ctx.save();
    ctx.fillStyle = `rgba(220,230,255,${state.flash * 0.22})`;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  // Wave height at a water point, for boat bobbing and spray.
  function waveAt(x, y) {
    return Math.sin(x * 0.02 + state.time * 2.1) * Math.cos(y * 0.017 + state.time * 1.6) * (0.5 + state.storm * 2.2);
  }

  return { state, update, setStorm, skyTint, drawRain, drawLightning, waveAt };
}

export { WORLD };
