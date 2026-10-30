import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the Golden rule 2 lint rules in eslint.config.mjs actually fire, so a config change that
// silently disables them fails CI instead of letting impure code into src/engine or src/ai.
const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIdsFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? "fatal");
}

describe("engine/AI purity lint rules", () => {
  it.each([
    ["Math.random", "export const x = Math.random();", "no-restricted-properties"],
    ["Date.now", "export const x = Date.now();", "no-restricted-globals"],
    ["new Date", "export const x = new Date();", "no-restricted-globals"],
    ["window", "export const x = window.innerWidth;", "no-restricted-globals"],
    ["document", "export const x = document.title;", "no-restricted-globals"],
    ["crypto", "export const x = crypto.randomUUID();", "no-restricted-globals"],
    ["react", 'import { useState } from "react";\nexport const x = useState;', "no-restricted-imports"],
    ["three", 'import * as THREE from "three";\nexport const x = THREE;', "no-restricted-imports"],
    ["drei", 'import { Html } from "@react-three/drei";\nexport const x = Html;', "no-restricted-imports"],
    ["next", 'import { cookies } from "next/headers";\nexport const x = cookies;', "no-restricted-imports"],
    ["supabase", 'import { createClient } from "@supabase/supabase-js";\nexport const x = createClient;', "no-restricted-imports"],
    ["node api", 'import { readFileSync } from "node:fs";\nexport const x = readFileSync;', "no-restricted-imports"],
    ["@/game3d", 'import { x as y } from "@/game3d/scene";\nexport const x = y;', "no-restricted-imports"],
    ["@/ui", 'import { x as y } from "@/ui/hud";\nexport const x = y;', "no-restricted-imports"],
    ["@/server", 'import { x as y } from "@/server/gameService";\nexport const x = y;', "no-restricted-imports"],
    ["relative ui", 'import { x as y } from "../../ui/hud";\nexport const x = y;', "no-restricted-imports"],
    ["relative server", 'import { x as y } from "../server/admin";\nexport const x = y;', "no-restricted-imports"],
  ])("rejects %s in src/engine and src/ai", async (_name, code, rule) => {
    expect(await ruleIdsFor(code, "src/engine/rules/probe.ts")).toContain(rule);
    expect(await ruleIdsFor(code, "src/ai/probe.ts")).toContain(rule);
  });

  it("allows pure code and engine imports", async () => {
    const code = 'import { x as y } from "@/engine/rng";\nexport const x = Math.max(1, y);';
    expect(await ruleIdsFor(code, "src/engine/rules/probe.ts")).toEqual([]);
    expect(await ruleIdsFor(code, "src/ai/probe.ts")).toEqual([]);
  });

  it("does not restrict code outside engine/AI", async () => {
    expect(await ruleIdsFor("export const x = Math.random() + Date.now();", "src/game3d/probe.ts")).toEqual([]);
  });
});
