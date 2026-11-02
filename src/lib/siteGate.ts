// Optional shared password for the private site (docs/03 §6, SITE_PASSWORD). Runs in the proxy and route handlers,
// so it only uses Web Crypto (available in every Next.js runtime).

export const GATE_COOKIE = "hn_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Paths reachable without the password: the gate itself, health checks, auth callbacks, crawlers' robots.txt. */
const EXEMPT_PREFIXES = ["/gate", "/api/gate", "/api/health", "/auth/callback", "/robots.txt", "/favicon.ico"];

export function isGateExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Cookie value proving the visitor knew the password: a SHA-256 of it (never the password itself). Changing
 * SITE_PASSWORD invalidates every existing cookie.
 */
export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`high-noon-gate:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex tokens. */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Only relative paths on this site are allowed as the post-gate destination (no open redirect). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
