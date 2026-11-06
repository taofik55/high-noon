/**
 * Procedural music (docs/05 §10): a lonesome plucked-guitar loop for the town, a brass stinger for showdowns and a
 * fanfare for the winners. Notes are scheduled a little ahead of time (a lookahead scheduler), so timing stays steady
 * even when the main thread is busy with 3D.
 */

const A4 = 440;
const hz = (semitonesFromA4: number) => A4 * 2 ** (semitonesFromA4 / 12);

/** A plucked string: a bright triangle partial over a softer sine, fast attack, ringing decay, low-passed. */
function pluck(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, vel: number, dur = 1.6): void {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(6000, f * 8), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [type, mult, level] of [["triangle", 1, 1], ["sine", 2, 0.35], ["sine", 3.01, 0.12]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mult;
    const lv = ctx.createGain();
    lv.gain.value = level;
    o.connect(lv).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lp.connect(g).connect(out);
}

/** A brassy note: sawtooth with vibrato through a low-pass, for stingers and fanfares. */
function horn(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, dur: number, vel: number): void {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = f;
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.value = f * 0.012;
  vib.connect(depth).connect(o.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = f * 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.06);
  g.gain.setValueAtTime(vel, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  vib.start(t);
  o.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
}

// Town loop: A minor – G – F – E (the spaghetti-western cadence), fingerpicked, 84 bpm, two bars per chord.
const CHORDS: readonly (readonly number[])[] = [
  [-24, -12, -5, 0, 3], // Am
  [-26, -14, -7, -2, 2], // G
  [-28, -16, -9, -4, 0], // F
  [-29, -17, -10, -5, -1], // E
];
const PATTERN = [0, 2, 3, 4, 2, 3, 1, 3];
const BEAT = 60 / 84 / 2; // eighth notes

export class MusicPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  startTown(): void {
    if (this.timer) return;
    this.next = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    while (this.next < this.ctx.currentTime + 0.4) {
      const bar = Math.floor(this.step / 8);
      const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length] as readonly number[];
      const note = chord[PATTERN[this.step % 8] as number] as number;
      // Bass on the downbeats, then the arpeggio; a touch of swing and velocity variation keeps it human.
      if (this.step % 8 === 0) pluck(this.ctx, this.out, this.next, hz(chord[0] as number), 0.3, 2.4);
      const swing = this.step % 2 === 1 ? BEAT * 0.12 : 0;
      pluck(this.ctx, this.out, this.next + swing, hz(note), 0.11 + ((this.step * 7) % 5) * 0.012);
      this.next += BEAT;
      this.step++;
    }
  }

  /** Showdown stinger: a rising minor horn call over a held low note. */
  duel(): void {
    const t = this.ctx.currentTime + 0.05;
    horn(this.ctx, this.out, t, hz(-24), 2.2, 0.08);
    [0, 3, 7, 12].forEach((s, i) => horn(this.ctx, this.out, t + i * 0.28, hz(s - 12), i === 3 ? 1.4 : 0.32, 0.12));
  }

  /** Winners' fanfare: a major arpeggio and a held chord. */
  victory(): void {
    const t = this.ctx.currentTime + 0.05;
    [0, 4, 7, 12].forEach((s, i) => horn(this.ctx, this.out, t + i * 0.18, hz(s - 9), 0.3, 0.12));
    for (const s of [-9, -5, -2, 3]) horn(this.ctx, this.out, t + 0.8, hz(s), 1.8, 0.07);
  }
}
