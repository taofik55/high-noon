/**
 * Production smoke test (docs/DEPLOY.md, Phase 14). Read-only checks of a live deployment, plus an optional online
 * round trip (anonymous sign-in → create a room → leave it) when Supabase settings are given.
 *
 *   pnpm smoke -- --url https://high-noon-xxxx.vercel.app [--password <SITE_PASSWORD>]
 *
 * For the online round trip also set, in the shell (never committed):
 *   SMOKE_SUPABASE_URL=https://<ref>.supabase.co  SMOKE_SUPABASE_KEY=<publishable key>
 * It leaves one anonymous user in Auth (anonymous users cannot delete themselves); the room is removed again.
 */
import { createServerClient } from "@supabase/ssr";

interface Args {
  url: string;
  password: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? (argv[i + 1] ?? null) : null;
  };
  const url = get("url");
  if (!url) throw new Error("usage: pnpm smoke -- --url https://… [--password …]");
  return { url: url.replace(/\/+$/, ""), password: get("password") };
}

const results: { name: string; ok: boolean; detail: string }[] = [];

async function check(name: string, run: () => Promise<string>): Promise<void> {
  try {
    results.push({ name, ok: true, detail: await run() });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

/** A tiny cookie jar: the gate cookie and the Supabase session cookies go out on every request. */
const jar = new Map<string, string>();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
function remember(res: Response): void {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = (pair ?? "").indexOf("=");
    if (eq > 0) jar.set(pair!.slice(0, eq).trim(), pair!.slice(eq + 1).trim());
  }
}

async function get(base: string, path: string): Promise<Response> {
  const res = await fetch(base + path, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  remember(res);
  return res;
}

async function post(base: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { cookie: cookieHeader(), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  remember(res);
  return res;
}

async function main(): Promise<void> {
  const { url, password } = parseArgs(process.argv.slice(2));
  console.log(`Smoke test: ${url}\n`);

  await check("site password gate", async () => {
    const res = await get(url, "/");
    if (res.status === 200) return "no gate (SITE_PASSWORD empty)";
    assert(res.status === 307 || res.status === 302, `GET / → ${res.status}`);
    assert(res.headers.get("location")?.includes("/gate"), "redirects somewhere other than /gate");
    assert(password, "the site has a password gate: pass --password");
    const ok = await post(url, "/api/gate", { password });
    assert(ok.status === 200, `POST /api/gate → ${ok.status} (wrong password?)`);
    return "gate passed";
  });

  await check("home page", async () => {
    const res = await get(url, "/");
    assert(res.status === 200, `GET / → ${res.status}`);
    const html = await res.text();
    assert(/<h1[^>]*>/.test(html), "no <h1> on the home page");
    assert(/noindex/.test(html), "home page is indexable (robots meta missing)");
    const nosniff = res.headers.get("x-content-type-options");
    assert(nosniff === "nosniff", "security headers missing");
    return "200, noindex, security headers";
  });

  await check("robots.txt", async () => {
    const res = await get(url, "/robots.txt");
    assert(res.status === 200, `GET /robots.txt → ${res.status}`);
    assert(/Disallow: \/\s*$/m.test(await res.text()), "robots.txt does not disallow everything");
    return "disallows all";
  });

  await check("solo page", async () => {
    const res = await get(url, "/play/solo");
    assert(res.status === 200, `GET /play/solo → ${res.status}`);
    return "200";
  });

  await check("developer tools hidden", async () => {
    for (const path of ["/dev/assets", "/dev/cards"]) {
      const res = await get(url, path);
      assert(res.status === 404, `GET ${path} → ${res.status} (should be 404 in production)`);
    }
    return "/dev/assets and /dev/cards are 404";
  });

  await check("API refuses anonymous callers", async () => {
    const res = await post(url, "/api/rooms");
    assert(res.status === 401, `POST /api/rooms without a session → ${res.status}`);
    return "401";
  });

  const supabaseUrl = process.env.SMOKE_SUPABASE_URL;
  const supabaseKey = process.env.SMOKE_SUPABASE_KEY;
  if (supabaseUrl && supabaseKey) {
    await check("online round trip (sign in, create room, leave)", async () => {
      // The same cookie format the app uses, so the API sees an ordinary browser session.
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value: decodeURIComponent(value) })),
          setAll: (toSet) => {
            for (const { name, value } of toSet) jar.set(name, encodeURIComponent(value));
          },
        },
      });
      const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: "Smoke test" } } });
      assert(!error && data.user, `anonymous sign-in failed: ${error?.message ?? "no user"} (Anonymous sign-ins enabled?)`);
      const created = await post(url, "/api/rooms");
      const body = (await created.json().catch(() => ({}))) as { roomId?: string; code?: string; error?: string };
      assert(created.status === 200 && body.roomId, `POST /api/rooms → ${created.status} ${body.error ?? ""} (migrations pushed? secret key set?)`);
      const left = await post(url, `/api/rooms/${body.roomId}/seat`, { op: "leave" });
      assert(left.status === 200, `leaving the room → ${left.status}`);
      await supabase.auth.signOut();
      return `room ${body.code} created and left`;
    });
  } else {
    results.push({ name: "online round trip", ok: true, detail: "skipped (set SMOKE_SUPABASE_URL and SMOKE_SUPABASE_KEY)" });
  }

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
  process.exitCode = failed ? 1 : 0;
}

void main();
