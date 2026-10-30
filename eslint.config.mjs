import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Golden rule 2 (CLAUDE.md): src/engine and src/ai must stay pure and deterministic so the same
// code runs in the browser, in a Web Worker, on the server and in the bot simulator, and so that
// same seed + same actions always gives the same game (T-51).
const PURE_FILES = ["src/engine/**/*.{ts,tsx}", "src/ai/**/*.{ts,tsx}"];

const impureImportPatterns = [
  {
    group: ["react", "react/**", "react-dom", "react-dom/**"],
    message: "Engine/AI must not depend on React (Golden rule 2).",
  },
  {
    group: ["three", "three/**", "@react-three/**", "postprocessing", "gsap", "gsap/**"],
    message: "Engine/AI must not depend on 3D/animation libraries (Golden rule 2).",
  },
  {
    group: ["next", "next/**", "server-only"],
    message: "Engine/AI must not depend on Next.js (Golden rule 2).",
  },
  {
    group: ["@supabase/**"],
    message: "Engine/AI must not depend on Supabase (Golden rule 2).",
  },
  {
    group: ["zustand", "zustand/**", "howler"],
    message: "Engine/AI must not depend on client state or audio (Golden rule 2).",
  },
  {
    group: ["node:*", "fs", "fs/**", "path", "os", "crypto", "child_process", "worker_threads"],
    message: "Engine/AI must not use Node APIs (Golden rule 2).",
  },
  {
    group: [
      "@/app", "@/app/**", "@/game3d", "@/game3d/**", "@/ui", "@/ui/**",
      "@/net", "@/net/**", "@/server", "@/server/**", "@/lib", "@/lib/**",
      "**/app", "**/app/**", "**/game3d", "**/game3d/**", "**/ui", "**/ui/**",
      "**/net", "**/net/**", "**/server", "**/server/**", "**/lib", "**/lib/**",
    ],
    message: "Engine/AI must not import presentation, network or server code (Golden rule 2).",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: PURE_FILES,
    rules: {
      "no-restricted-imports": ["error", { patterns: impureImportPatterns }],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Non-deterministic. Pass time in via actions/config (Golden rule 2)." },
        { name: "window", message: "No DOM in engine/AI (Golden rule 2)." },
        { name: "document", message: "No DOM in engine/AI (Golden rule 2)." },
        { name: "navigator", message: "No DOM in engine/AI (Golden rule 2)." },
        { name: "localStorage", message: "No browser storage in engine/AI (Golden rule 2)." },
        { name: "sessionStorage", message: "No browser storage in engine/AI (Golden rule 2)." },
        { name: "self", message: "No worker/DOM globals in engine/AI (Golden rule 2)." },
        { name: "globalThis", message: "Would allow bypassing purity rules (Golden rule 2)." },
        { name: "crypto", message: "Non-deterministic. Use the seeded RNG in state (Golden rule 1)." },
        { name: "performance", message: "Non-deterministic. Hard-AI time budget is injected (docs/06)." },
        { name: "process", message: "No Node APIs in engine/AI (Golden rule 2)." },
        { name: "require", message: "No Node APIs in engine/AI (Golden rule 2)." },
        { name: "fetch", message: "No I/O in engine/AI (Golden rule 2)." },
        { name: "setTimeout", message: "No timers in engine/AI (Golden rule 2)." },
        { name: "setInterval", message: "No timers in engine/AI (Golden rule 2)." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG from src/engine/rng.ts (Golden rule 1)." },
      ],
    },
  },
  {
    // CLAUDE.md code style: no `any`.
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test/tool output:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
