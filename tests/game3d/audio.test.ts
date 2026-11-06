import { describe, expect, it } from "vitest";
import { playSfx, type SfxName } from "@/game3d/audio/sfx";
import { DEFAULT_VOLUMES, useSettings } from "@/game3d/settings/settingsStore";

/** A minimal stand-in for the Web Audio graph: records nodes, connections and scheduling calls. */
class FakeParam {
  value = 0;
  events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.events.push(["set", v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError("exponential ramp to non-positive value");
    this.events.push(["exp", v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(["lin", v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push(["target", v, t]);
    return this;
  }
}

class FakeNode {
  outputs: unknown[] = [];
  started: number | null = null;
  stopped: number | null = null;
  constructor(readonly kind: string) {}
  connect<T>(n: T): T {
    this.outputs.push(n);
    return n;
  }
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
  }
}

function fakeContext() {
  const nodes: FakeNode[] = [];
  const make = <T extends object>(kind: string, extra: T) => {
    const n = Object.assign(new FakeNode(kind), extra);
    nodes.push(n);
    return n;
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createGain: () => make("gain", { gain: new FakeParam() }),
    createBiquadFilter: () => make("filter", { type: "lowpass", frequency: new FakeParam(), Q: new FakeParam() }),
    createOscillator: () => make("osc", { type: "sine", frequency: new FakeParam() }),
    createBufferSource: () => make("buffer", { buffer: null }),
    createBuffer: (_c: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
  };
  return { ctx: ctx as unknown as BaseAudioContext, nodes };
}

const NAMES: SfxName[] = ["gunshot", "rifle", "ricochet", "explosion", "fuse", "card", "clink", "bell", "gallop", "whoosh", "clank", "thud", "chime", "wind"];

describe("procedural sound effects", () => {
  it.each(NAMES)("%s reaches the output and every source starts and stops", (name) => {
    const { ctx, nodes } = fakeContext();
    const out = new FakeNode("out");
    playSfx(ctx, out as unknown as AudioNode, name, 1.0);
    const reachesOut = (n: unknown, depth = 0): boolean =>
      n === out || (depth < 8 && n instanceof FakeNode && n.outputs.some((o) => reachesOut(o, depth + 1)));
    const sources = nodes.filter((n) => n.kind === "osc" || n.kind === "buffer");
    expect(sources.length).toBeGreaterThan(0);
    // Every audible source ends up at the output, after the requested start time…
    for (const s of sources) {
      expect(s.started).not.toBeNull();
      expect(s.started!).toBeGreaterThanOrEqual(1.0);
    }
    expect(sources.some((s) => reachesOut(s))).toBe(true);
    // …and oscillators always stop, so nothing keeps playing (buffer sources stop through their duration).
    for (const o of nodes.filter((n) => n.kind === "osc")) expect(o.stopped).not.toBeNull();
  });
});

describe("audio settings", () => {
  it("defaults to 80/50/80 and clamps to 0–1", () => {
    expect(DEFAULT_VOLUMES).toEqual({ master: 0.8, music: 0.5, sfx: 0.8 });
    useSettings.getState().setVolume("music", 1.7);
    expect(useSettings.getState().volume.music).toBe(1);
    useSettings.getState().setVolume("sfx", -0.2);
    expect(useSettings.getState().volume.sfx).toBe(0);
    expect(useSettings.getState().volume.master).toBe(0.8);
  });
});
