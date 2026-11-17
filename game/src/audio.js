// Solmar Bay — all sound is synthesized with the Web Audio API: no audio
// files, no network. A tiny scheduler plays a bassline-and-hats groove,
// and one-shot effects cover gunshots, punches, pickups, sirens and the
// engine hum. Audio starts on the first user gesture (browser policy).

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;

  // A laid-back coastal groove: A-minor bassline, 96 bpm, 8 steps a bar.
  const BASSLINE = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 55, 65.41, 82.41, 0, 73.42, 0];
  const STEP_SECONDS = 60 / 96 / 2;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc.connect(engineGain);
      engineOsc.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function scheduleMusicStep() {
    if (!ctx || muted) { step = (step + 1) % 16; return; }
    const freq = BASSLINE[step % 16];
    if (freq) {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + STEP_SECONDS * 0.95);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + STEP_SECONDS);
    }
    // Hat tick on the off-beats.
    if (step % 2 === 1) noise(0.03, 0.12, 8000);
    step = (step + 1) % 16;
  }

  return {
    // Call from any user gesture (click / keypress) to unlock audio.
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx && !musicTimer) {
        musicTimer = window.setInterval(scheduleMusicStep, STEP_SECONDS * 1000);
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    // Engine hum follows the player's car speed (0..1).
    setEngine(ratio) {
      if (!ctx) return;
      const target = muted ? 0 : ratio * 0.06;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + ratio * 140, ctx.currentTime, 0.1);
    },
    // Two-tone police siren while any wanted star is active.
    setSiren(on, time) {
      if (!ctx) return;
      if (!on) { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); return; }
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.2);
      const hi = Math.floor(time * 2) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(hi ? 950 : 650, ctx.currentTime, 0.05);
    },
    gunshot() { noise(0.12, 0.5, 3000); tone(180, 0.08, 'square', 0.25, 0, 60); },
    enemyShot() { noise(0.1, 0.25, 2200); },
    punch() { noise(0.08, 0.4, 500); tone(90, 0.1, 'sine', 0.4, 0, 45); },
    crash() { noise(0.25, 0.5, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.35); tone(990, 0.14, 'sine', 0.35, 0.09); },
    cash() { tone(880, 0.08, 'triangle', 0.3); tone(1174, 0.1, 'triangle', 0.3, 0.08); tone(1568, 0.18, 'triangle', 0.3, 0.16); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.35, i * 0.12));
    },
    busted() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.25, i * 0.18)); },
    carDoor() { noise(0.06, 0.3, 1200); },
    skid() { noise(0.15, 0.12, 1500); },
  };
}
