import { notFound } from "next/navigation";

/**
 * Developer tools (/dev/assets, /dev/cards) are heavy and not meant for players: 404 in production builds. The 2D
 * /dev/table stays, it is the light fallback table linked from the home page.
 */
export function devOnly(): void {
  if (process.env.NODE_ENV === "production") notFound();
}
