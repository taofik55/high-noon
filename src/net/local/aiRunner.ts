import { computeAi, type AiRequest, type AiResponse } from "./aiCompute";

export { computeAi, type AiRequest, type AiResponse };

/** Runs one NPC decision; the real work is pure (docs/06 §1), so it can live in a worker or inline. */
export interface AiRunner {
  decide(request: AiRequest): Promise<AiResponse>;
  dispose(): void;
}

/** Same thread. Used by tests and as the fallback when Web Workers are unavailable. */
export class InlineAiRunner implements AiRunner {
  async decide(request: AiRequest): Promise<AiResponse> {
    return computeAi(request);
  }

  dispose(): void {}
}

/** Runs the AI in a Web Worker so hard bots never stutter the UI (docs/03 §7). */
export class WorkerAiRunner implements AiRunner {
  private readonly worker: Worker;
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (r: AiResponse) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<{ id: number; response: AiResponse }>) => {
      this.pending.get(e.data.id)?.resolve(e.data.response);
      this.pending.delete(e.data.id);
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || "AI worker failed"));
      this.pending.clear();
    };
  }

  decide(request: AiRequest): Promise<AiResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, request });
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error("AI worker disposed"));
    this.pending.clear();
  }
}

export function createAiRunner(): AiRunner {
  try {
    if (typeof Worker !== "undefined") return new WorkerAiRunner();
  } catch {
    // Fall through to the inline runner (e.g. a browser that blocks module workers).
  }
  return new InlineAiRunner();
}
