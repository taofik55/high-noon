"use client";

import type { Vec3 } from "../world/layout";
import { MusicPlayer } from "./music";
import { playSfx, type SfxName } from "./sfx";

/**
 * The game's audio (docs/05 §10): one AudioContext with master, music and effects buses. World sounds go through a
 * panner placed at their position (the listener follows the camera); UI sounds play flat. Nothing starts until the
 * first user gesture, as browsers require.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
  private wantMusic = false;

  /** Creates (or resumes) the context; call from a user gesture. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.music = new MusicPlayer(this.ctx, this.musicBus);
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.wantMusic) this.music?.startTown();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.volumes = v;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    // Perceived loudness is roughly logarithmic: square the slider values.
    this.master.gain.setTargetAtTime(this.volumes.master ** 2, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music ** 2 * 0.6, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx ** 2, t, 0.05);
  }

  /** Where the camera is and where it looks (called every frame by AudioLayer). */
  setListener(pos: Vec3, forward: Vec3): void {
    const l = this.ctx?.listener;
    if (!l || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos[0], t, 0.05);
      l.positionY.setTargetAtTime(pos[1], t, 0.05);
      l.positionZ.setTargetAtTime(pos[2], t, 0.05);
      l.forwardX.setTargetAtTime(forward[0], t, 0.05);
      l.forwardY.setTargetAtTime(forward[1], t, 0.05);
      l.forwardZ.setTargetAtTime(forward[2], t, 0.05);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  }

  /** Plays an effect, positioned in the world when `at` is given. Silent until unlocked. */
  sfx(name: SfxName, at?: Vec3, opts: { pitch?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfxBus || this.ctx.state !== "running") return;
    let out: AudioNode = this.sfxBus;
    if (at) {
      const p = this.ctx.createPanner();
      p.panningModel = "equalpower";
      p.distanceModel = "inverse";
      p.refDistance = 6;
      p.rolloffFactor = 0.8;
      p.positionX.value = at[0];
      p.positionY.value = at[1];
      p.positionZ.value = at[2];
      p.connect(this.sfxBus);
      out = p;
    }
    // Small random detune so repeats never sound identical.
    const pitch = (opts.pitch ?? 1) * (0.94 + Math.random() * 0.12);
    playSfx(this.ctx, out, name, this.ctx.currentTime + (opts.delay ?? 0), pitch);
  }

  startMusic(): void {
    this.wantMusic = true;
    if (this.ready) this.music?.startTown();
  }

  stopMusic(): void {
    this.wantMusic = false;
    this.music?.stop();
  }

  stinger(kind: "duel" | "victory"): void {
    if (!this.ready || !this.music) return;
    if (kind === "duel") this.music.duel();
    else this.music.victory();
  }
}

export const audio = new AudioEngine();
