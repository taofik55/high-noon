import type { Role } from "./types";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;

/** docs/02 §1.1. */
export const ROLE_COUNTS: Readonly<Record<number, Readonly<Record<Role, number>>>> = {
  4: { sheriff: 1, deputy: 0, outlaw: 2, renegade: 1 },
  5: { sheriff: 1, deputy: 1, outlaw: 2, renegade: 1 },
  6: { sheriff: 1, deputy: 1, outlaw: 3, renegade: 1 },
  7: { sheriff: 1, deputy: 2, outlaw: 3, renegade: 1 },
};

export function rolesFor(playerCount: number): Role[] {
  const counts = ROLE_COUNTS[playerCount];
  if (!counts) throw new Error(`Unsupported player count ${playerCount} (${MIN_PLAYERS}–${MAX_PLAYERS})`);
  const roles: Role[] = [];
  for (const role of ["sheriff", "deputy", "outlaw", "renegade"] as const) {
    for (let i = 0; i < counts[role]; i++) roles.push(role);
  }
  return roles;
}
