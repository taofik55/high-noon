// Web Worker entry: NPC decisions off the main thread (docs/03 §7).
import { computeAi, type AiRequest, type AiResponse } from "./aiCompute";

// The project compiles with the DOM lib, so type the worker scope explicitly instead of pulling in "webworker".
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; request: AiRequest }>) => void) | null;
  postMessage(message: { id: number; response: AiResponse }): void;
};

scope.onmessage = (e) => {
  scope.postMessage({ id: e.data.id, response: computeAi(e.data.request) });
};
