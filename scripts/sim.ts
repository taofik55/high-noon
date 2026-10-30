// Bot-vs-bot simulation harness (docs/06 §6).
//   pnpm sim -- --games 10000 --players 4-7 --difficulty mixed --seed sim --workers 6 --json sim-report.json
// Every game is reproducible from its seed: rerun a failing one with  --games 1 --seed <seed> --exact
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { roleWon, simulateGame, type AiOptions, type Difficulty, type SimGameResult } from "@/ai";
import { createRng, randomInt, type Role } from "@/engine";

interface Job {
  seed: string;
  difficulties: Difficulty[];
}

interface Args {
  games: number;
  minPlayers: number;
  maxPlayers: number;
  difficulty: Difficulty | "mixed";
  seed: string;
  exact: boolean;
  workers: number;
  json: string | null;
  hard: AiOptions;
}

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const ROLES: Role[] = ["sheriff", "deputy", "outlaw", "renegade"];

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const [lo, hi] = (get("players") ?? "4-7").split("-").map(Number);
  const difficulty = (get("difficulty") ?? "mixed") as Args["difficulty"];
  if (difficulty !== "mixed" && !DIFFICULTIES.includes(difficulty)) throw new Error(`unknown --difficulty ${difficulty}`);
  const num = (name: string): number | undefined => (get(name) === undefined ? undefined : Number(get(name)));
  return {
    games: num("games") ?? 100,
    minPlayers: lo ?? 4,
    maxPlayers: hi ?? lo ?? 7,
    difficulty,
    seed: get("seed") ?? "sim",
    exact: argv.includes("--exact"),
    workers: num("workers") ?? Math.max(1, Math.min(8, availableParallelism() - 1)),
    json: get("json") ?? null,
    hard: {
      ...(num("hard-samples") !== undefined ? { samples: num("hard-samples") } : {}),
      ...(num("hard-candidates") !== undefined ? { candidates: num("hard-candidates") } : {}),
      ...(num("hard-horizon") !== undefined ? { horizon: num("hard-horizon") } : {}),
    },
  };
}

/** Deterministic job list: player counts and per-seat difficulties come from a seeded RNG. */
function makeJobs(args: Args): Job[] {
  const rng = createRng(`jobs:${args.seed}`);
  return Array.from({ length: args.games }, (_, i) => {
    const n = args.minPlayers + randomInt(rng, args.maxPlayers - args.minPlayers + 1);
    const difficulties = Array.from({ length: n }, () =>
      args.difficulty === "mixed" ? (DIFFICULTIES[randomInt(rng, DIFFICULTIES.length)] as Difficulty) : args.difficulty,
    );
    return { seed: args.exact && args.games === 1 ? args.seed : `${args.seed}-${i}`, difficulties };
  });
}

function runJobs(jobs: Job[], hard: AiOptions): SimGameResult[] {
  return jobs.map((job) => simulateGame({ seed: job.seed, difficulties: job.difficulties, hard }));
}

async function runParallel(jobs: Job[], args: Args): Promise<SimGameResult[]> {
  const workers = Math.min(args.workers, jobs.length);
  if (workers <= 1) return runJobs(jobs, args.hard);
  const chunks: Job[][] = Array.from({ length: workers }, () => []);
  jobs.forEach((job, i) => chunks[i % workers]?.push(job));
  const parts = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<SimGameResult[]>((resolve, reject) => {
          const worker = new Worker(__filename, { workerData: { jobs: chunk, hard: args.hard }, execArgv: ["--import", "tsx"] });
          worker.once("message", (results: SimGameResult[]) => resolve(results));
          worker.once("error", reject);
          worker.once("exit", (code) => {
            if (code !== 0) reject(new Error(`worker exited with code ${code}`));
          });
        }),
    ),
  );
  // Restore job order so the report does not depend on scheduling.
  const bySeed = new Map(parts.flat().map((r) => [r.seed, r]));
  return jobs.map((job) => {
    const r = bySeed.get(job.seed);
    if (!r) throw new Error(`missing result for ${job.seed}`);
    return r;
  });
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const signed = (x: number): string => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;

interface Report {
  games: number;
  seconds: number;
  violations: number;
  aiProblems: number;
  unfinished: number;
  avgTurns: number;
  avgSteps: number;
  winners: Record<string, number>;
  roleWinRate: Record<Role, number>;
  /** difficulty → role → [wins, seats] */
  byDifficultyRole: Record<Difficulty, Record<Role, [number, number]>>;
  /** Role-normalized: mean over roles of (difficulty win rate − overall role win rate). */
  difficultyScore: Record<Difficulty, number | null>;
  orderingHolds: boolean | null;
  failingSeeds: string[];
}

function report(results: SimGameResult[], seconds: number, mixed: boolean): Report {
  const roleTotals = Object.fromEntries(ROLES.map((r) => [r, [0, 0]])) as Record<Role, [number, number]>;
  const byDifficultyRole = Object.fromEntries(
    DIFFICULTIES.map((d) => [d, Object.fromEntries(ROLES.map((r) => [r, [0, 0]]))]),
  ) as Record<Difficulty, Record<Role, [number, number]>>;
  const winners: Record<string, number> = {};
  const failingSeeds: string[] = [];

  for (const g of results) {
    winners[g.winner ?? "none"] = (winners[g.winner ?? "none"] ?? 0) + 1;
    if (g.violations.length > 0 || g.aiProblems.length > 0 || !g.winner) failingSeeds.push(g.seed);
    g.roles.forEach((role, seat) => {
      const won = roleWon(role, g.winner) ? 1 : 0;
      const d = g.difficulties[seat] as Difficulty;
      roleTotals[role][0] += won;
      roleTotals[role][1] += 1;
      byDifficultyRole[d][role][0] += won;
      byDifficultyRole[d][role][1] += 1;
    });
  }

  const rate = ([w, n]: [number, number]): number => (n === 0 ? 0 : w / n);
  const roleWinRate = Object.fromEntries(ROLES.map((r) => [r, rate(roleTotals[r])])) as Record<Role, number>;
  const difficultyScore = Object.fromEntries(
    DIFFICULTIES.map((d) => {
      const deltas = ROLES.filter((r) => byDifficultyRole[d][r][1] > 0).map((r) => rate(byDifficultyRole[d][r]) - roleWinRate[r]);
      return [d, deltas.length === 0 ? null : deltas.reduce((a, b) => a + b, 0) / deltas.length];
    }),
  ) as Record<Difficulty, number | null>;
  const { easy, medium, hard } = difficultyScore;
  const orderingHolds = mixed && easy !== null && medium !== null && hard !== null ? hard > medium && medium > easy : null;

  return {
    games: results.length,
    seconds,
    violations: results.reduce((n, g) => n + g.violations.length, 0),
    aiProblems: results.reduce((n, g) => n + g.aiProblems.length, 0),
    unfinished: results.filter((g) => !g.winner).length,
    avgTurns: results.reduce((n, g) => n + g.turns, 0) / Math.max(1, results.length),
    avgSteps: results.reduce((n, g) => n + g.steps, 0) / Math.max(1, results.length),
    winners,
    roleWinRate,
    byDifficultyRole,
    difficultyScore,
    orderingHolds,
    failingSeeds,
  };
}

function print(r: Report, results: SimGameResult[]): void {
  const lines = [
    `Games: ${r.games} in ${r.seconds.toFixed(1)}s   avg turns ${r.avgTurns.toFixed(1)}, avg actions ${r.avgSteps.toFixed(0)}`,
    `Violations: ${r.violations}   AI problems: ${r.aiProblems}   unfinished: ${r.unfinished}`,
    `Winners: ${Object.entries(r.winners)
      .map(([w, n]) => `${w} ${pct(n / r.games)}`)
      .join(", ")}`,
    `Win rate by role: ${ROLES.map((role) => `${role} ${pct(r.roleWinRate[role])}`).join(", ")}`,
    "",
    "Difficulty × role win rate (seats):",
    ...DIFFICULTIES.map(
      (d) =>
        `  ${d.padEnd(7)} ${ROLES.map((role) => {
          const [w, n] = r.byDifficultyRole[d][role];
          return `${role} ${n === 0 ? "  -  " : pct(w / n)} (${n})`;
        }).join("  ")}   score ${r.difficultyScore[d] === null ? "-" : signed(r.difficultyScore[d] ?? 0)}`,
    ),
  ];
  if (r.orderingHolds !== null) lines.push(`Difficulty ordering hard > medium > easy: ${r.orderingHolds ? "HOLDS" : "DOES NOT HOLD"}`);
  if (r.failingSeeds.length > 0) {
    lines.push("", `Failing seeds (${r.failingSeeds.length}): ${r.failingSeeds.slice(0, 20).join(", ")}`);
    const first = results.find((g) => g.seed === r.failingSeeds[0]);
    if (first) lines.push(`  first: ${[...first.violations, ...first.aiProblems].slice(0, 3).join(" | ")}`);
  }
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const jobs = makeJobs(args);
  console.log(
    `Simulating ${jobs.length} games (players ${args.minPlayers}-${args.maxPlayers}, ${args.difficulty}, seed "${args.seed}", ${Math.min(args.workers, jobs.length)} workers)…`,
  );
  const started = performance.now();
  const results = await runParallel(jobs, args);
  const r = report(results, (performance.now() - started) / 1000, args.difficulty === "mixed");
  print(r, results);
  if (args.json) writeFileSync(args.json, JSON.stringify({ args, report: r, failing: results.filter((g) => r.failingSeeds.includes(g.seed)) }, null, 2));
  if (r.violations > 0 || r.aiProblems > 0 || r.unfinished > 0) process.exitCode = 1;
}

if (isMainThread) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
} else {
  const { jobs, hard } = workerData as { jobs: Job[]; hard: AiOptions };
  parentPort?.postMessage(runJobs(jobs, hard));
}
