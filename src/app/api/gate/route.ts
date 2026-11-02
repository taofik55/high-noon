import { NextResponse } from "next/server";
import { z } from "zod";
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, safeNext, sameToken } from "@/lib/siteGate";

const Body = z.object({ password: z.string().max(200), next: z.string().max(500).optional() });

/** Checks the shared site password and sets the gate cookie (docs/03 §6). */
export async function POST(request: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.json({ ok: true, next: "/" });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  // Compare hashes in constant time rather than the raw strings.
  const expected = await gateToken(password);
  if (!sameToken(await gateToken(parsed.data.password), expected)) return NextResponse.json({ ok: false }, { status: 401 });

  const response = NextResponse.json({ ok: true, next: safeNext(parsed.data.next) });
  response.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return response;
}
