import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as gatePost } from "@/app/api/gate/route";
import { GATE_COOKIE, gateToken, isGateExempt, safeNext, sameToken } from "@/lib/siteGate";
import { proxy } from "@/proxy";

describe("site gate helpers (docs/03 §6)", () => {
  it("derives a stable hex token per password, never the password itself", async () => {
    const a = await gateToken("tumbleweed");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await gateToken("tumbleweed")).toBe(a);
    expect(await gateToken("other")).not.toBe(a);
    expect(a).not.toContain("tumbleweed");
  });

  it("compares tokens exactly", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("abc", "ab")).toBe(false);
  });

  it("exempts only the gate, health check, auth callback and static basics", () => {
    for (const p of ["/gate", "/api/gate", "/api/health", "/auth/callback", "/robots.txt"]) expect(isGateExempt(p), p).toBe(true);
    for (const p of ["/", "/play/solo", "/api/rooms", "/gateway", "/dev/table"]) expect(isGateExempt(p), p).toBe(false);
  });

  it("only follows relative redirects after the gate (no open redirect)", () => {
    expect(safeNext("/play/solo?x=1")).toBe("/play/solo?x=1");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("proxy with SITE_PASSWORD", () => {
  const saved = process.env.SITE_PASSWORD;
  beforeEach(() => {
    process.env.SITE_PASSWORD = "high-noon";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = saved;
  });

  it("redirects pages to /gate with the original destination", async () => {
    const res = await proxy(new NextRequest("http://localhost/play/solo?x=1"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/gate");
    expect(location.searchParams.get("next")).toBe("/play/solo?x=1");
  });

  it("answers API calls with 401 instead of a redirect", async () => {
    const res = await proxy(new NextRequest("http://localhost/api/rooms"));
    expect(res.status).toBe(401);
  });

  it("lets through visitors with the right cookie, and exempt paths without one", async () => {
    const token = await gateToken("high-noon");
    const ok = await proxy(new NextRequest("http://localhost/", { headers: { cookie: `${GATE_COOKIE}=${token}` } }));
    expect(ok.headers.get("location")).toBeNull();
    expect(ok.status).toBe(200);
    const gate = await proxy(new NextRequest("http://localhost/gate"));
    expect(gate.status).toBe(200);
    const wrong = await proxy(new NextRequest("http://localhost/", { headers: { cookie: `${GATE_COOKIE}=${await gateToken("nope")}` } }));
    expect(wrong.status).toBe(307);
  });

  it("does nothing when no password is configured", async () => {
    delete process.env.SITE_PASSWORD;
    const res = await proxy(new NextRequest("http://localhost/play/solo"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/gate", () => {
  const saved = process.env.SITE_PASSWORD;
  beforeEach(() => {
    process.env.SITE_PASSWORD = "high-noon";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = saved;
  });

  const post = (body: unknown) =>
    gatePost(new Request("http://localhost/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

  it("rejects a wrong password without setting a cookie", async () => {
    const res = await post({ password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sets an httpOnly gate cookie holding the token and returns a safe destination", async () => {
    const res = await post({ password: "high-noon", next: "//evil.example" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, next: "/" });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${GATE_COOKIE}=${await gateToken("high-noon")}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie).not.toContain("high-noon;");
  });

  it("rejects malformed bodies", async () => {
    expect((await post({ nope: 1 })).status).toBe(400);
  });
});
