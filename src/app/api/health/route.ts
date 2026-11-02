import { NextResponse } from "next/server";

/** Liveness check; exempt from the site password (docs/03 §6). */
export function GET() {
  return NextResponse.json({ ok: true });
}
