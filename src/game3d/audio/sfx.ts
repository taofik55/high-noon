/**
 * Synthesised sound effects (docs/05 §10) on the Web Audio API: no audio files. Each voice schedules its own nodes
 * into `out` starting at `t` and lets them stop and be garbage collected. Pure functions of their inputs.
 */

export type SfxName =
  | "gunshot"
  | "rifle"
  | "ricochet"
  | "explosion"
  | "fuse"
  | "card"
  | "clink"
  | "bell"
  | "gallop"
  | "whoosh"
  | "clank"
  | "thud"
  | "chime"
  | "wind";

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, shared by every noisy voice. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

function noiseSource(ctx: BaseAudioContext, t: number, dur: number, offset = 0): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.start(t, offset % 1.5, dur);
  return s;
}

/** Gain node with an attack/decay envelope. */
function env(ctx: BaseAudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function tone(ctx: BaseAudioContext, out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = env(ctx, t, peak, 0.004, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Schedule one effect. `pitch` scales its frequencies (variation between weapons and repeats). */
export function playSfx(ctx: BaseAudioContext, out: AudioNode, name: SfxName, t: number, pitch = 1): void {
  switch (name) {
    case "gunshot":
    case "rifle": {
      const long = name === "rifle";
      // Crack: bright noise burst; body: low thump; tail: filtered echo off the buildings.
      const crack = noiseSource(ctx, t, 0.25);
      const hp = filter(ctx, "highpass", 900 * pitch);
      crack.connect(hp).connect(env(ctx, t, 0.9, 0.002, 0.09)).connect(out);
      tone(ctx, out, t, "sine", 150 * pitch, 45, long ? 0.35 : 0.22, 0.9);
      const tail = noiseSource(ctx, t + 0.02, long ? 1.4 : 0.9, 0.3);
      tail.connect(filter(ctx, "lowpass", 1200 * pitch)).connect(env(ctx, t + 0.02, 0.25, 0.01, long ? 1.2 : 0.75)).connect(out);
      break;
    }
    case "ricochet": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(2600 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(900 * pitch, t + 0.45);
      const vib = ctx.createOscillator();
      vib.frequency.value = 38;
      const depth = ctx.createGain();
      depth.gain.value = 120;
      vib.connect(depth).connect(o.frequency);
      o.connect(env(ctx, t, 0.18, 0.01, 0.45)).connect(out);
      o.start(t);
      vib.start(t);
      o.stop(t + 0.5);
      vib.stop(t + 0.5);
      break;
    }
    case "explosion": {
      const blast = noiseSource(ctx, t, 2.2);
      const lp = filter(ctx, "lowpass", 1800);
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(140, t + 1.8);
      blast.connect(lp).connect(env(ctx, t, 1.0, 0.005, 1.9)).connect(out);
      tone(ctx, out, t, "sine", 70, 28, 1.4, 1.0);
      break;
    }
    case "fuse": {
      const hiss = noiseSource(ctx, t, 1.2, 0.7);
      hiss.connect(filter(ctx, "bandpass", 5200, 2)).connect(env(ctx, t, 0.12, 0.05, 1.1)).connect(out);
      break;
    }
    case "card": {
      const swish = noiseSource(ctx, t, 0.2, 0.5);
      const bp = filter(ctx, "bandpass", 2500 * pitch, 1.2);
      bp.frequency.setValueAtTime(1500 * pitch, t);
      bp.frequency.exponentialRampToValueAtTime(4200 * pitch, t + 0.14);
      swish.connect(bp).connect(env(ctx, t, 0.22, 0.02, 0.14)).connect(out);
      break;
    }
    case "clink": {
      for (const [f, d] of [[2100, 0.5], [3300, 0.35], [5150, 0.25]] as const) tone(ctx, out, t, "sine", f * pitch, f * pitch * 0.995, d, 0.12);
      break;
    }
    case "bell": {
      // Church-bell partials (inharmonic), long decay.
      for (const [r, a, d] of [[0.5, 0.25, 3.5], [1, 0.3, 2.6], [1.19, 0.18, 2.2], [1.56, 0.12, 1.6], [2.0, 0.1, 1.2]] as const) tone(ctx, out, t, "sine", 330 * r * pitch, 330 * r * pitch, d, a);
      break;
    }
    case "chime": {
      [0, 0.09, 0.18].forEach((dt, i) => tone(ctx, out, t + dt, "triangle", [880, 1108, 1318][i]! * pitch, [880, 1108, 1318][i]! * pitch, 0.6, 0.1));
      break;
    }
    case "gallop": {
      // Hooves: a three-beat canter repeated, each a dull knock.
      for (let i = 0; i < 8; i++) {
        for (const [dt, a] of [[0, 0.5], [0.09, 0.35], [0.17, 0.45]] as const) {
          const k = t + i * 0.42 + dt;
          const n = noiseSource(ctx, k, 0.08, i * 0.1);
          n.connect(filter(ctx, "lowpass", 600)).connect(env(ctx, k, a, 0.003, 0.07)).connect(out);
          tone(ctx, out, k, "sine", 110, 60, 0.07, a * 0.6);
        }
      }
      break;
    }
    case "whoosh": {
      const w = noiseSource(ctx, t, 0.35, 0.2);
      const bp = filter(ctx, "bandpass", 800, 1.5);
      bp.frequency.setValueAtTime(600, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
      w.connect(bp).connect(env(ctx, t, 0.16, 0.08, 0.25)).connect(out);
      break;
    }
    case "clank": {
      const n = noiseSource(ctx, t, 0.6, 0.9);
      n.connect(filter(ctx, "bandpass", 420, 8)).connect(env(ctx, t, 0.8, 0.002, 0.5)).connect(out);
      for (const f of [310, 470, 790]) tone(ctx, out, t, "square", f * pitch, f * pitch * 0.98, 0.35, 0.05);
      break;
    }
    case "thud": {
      tone(ctx, out, t, "sine", 120 * pitch, 40, 0.25, 0.6);
      noiseSource(ctx, t, 0.15).connect(filter(ctx, "lowpass", 400)).connect(env(ctx, t, 0.3, 0.003, 0.12)).connect(out);
      break;
    }
    case "wind": {
      const w = noiseSource(ctx, t, 2.0, 1.1);
      const bp = filter(ctx, "bandpass", 500, 0.8);
      bp.frequency.setValueAtTime(350, t);
      bp.frequency.linearRampToValueAtTime(900, t + 1.0);
      bp.frequency.linearRampToValueAtTime(400, t + 2.0);
      w.connect(bp).connect(env(ctx, t, 0.18, 0.6, 1.3)).connect(out);
      break;
    }
  }
}
