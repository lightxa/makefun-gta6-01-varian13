// audio.js — All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, thunder, splashes and a small bass-line loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;
  const BASS = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* sound is never fatal */ }
  }

  // Deterministic white noise: a tiny LCG seeded per call, never Math.random,
  // so even the sound buffers are reproducible.
  let noiseSeed = 987654321;
  function noiseSample() {
    noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
    return noiseSeed / 4294967296 * 2 - 1;
  }

  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = noiseSample() * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
    } catch { /* sound is never fatal */ }
  }

  return {
    unlock,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.3, 2500); tone(160, 0.1, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.2, 900); },
    hit() { tone(110, 0.15, 'sawtooth', 0.2, 70); },
    pickup() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.14, 'sine', 0.18); },
    cash() { tone(880, 0.09, 'triangle', 0.22); setTimeout(() => tone(1320, 0.16, 'triangle', 0.22), 90); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110)); },
    fail() { tone(220, 0.4, 'sawtooth', 0.18, 110); },
    siren() { tone(720, 0.35, 'sine', 0.07, 950); },
    splash() { noise(0.3, 0.18, 700); },
    thunder() { noise(1.4, 0.4, 180); },
    buy() { tone(392, 0.12, 'triangle', 0.22); setTimeout(() => tone(587, 0.2, 'triangle', 0.22), 120); },
    setEngine(speed01, on) {
      if (!ensure()) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.02 + speed01 * 0.05 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(45 + speed01 * 110, ctx.currentTime, 0.1);
      } catch { /* ignore */ }
    },
    // A slow bass loop for the menu and quiet moments; called every frame.
    updateMusic(dt, playing) {
      if (!ensure() || muted || !playing) return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer = 0.42;
      const f = BASS[musicStep % BASS.length];
      musicStep++;
      if (f) tone(f, 0.4, 'triangle', 0.10);
    },
  };
}
