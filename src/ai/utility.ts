import { WEAPON_RANGE, cardType, type GameState, type Role, type Seat } from "@/engine";

type Team = "law" | "outlaws" | "renegade";

function teamOf(role: Role): Team {
  return role === "sheriff" || role === "deputy" ? "law" : role === "outlaw" ? "outlaws" : "renegade";
}

function inPlayScore(state: GameState, seat: Seat): number {
  let score = 0;
  for (const id of state.players[seat]?.inPlay ?? []) {
    const type = cardType(id);
    if (type === "barrel" || type === "mustang") score += 3;
    else if (type === "scope") score += 2;
    else if (type === "jail") score -= 4;
    else if (type === "dynamite") score -= 2;
    else if (WEAPON_RANGE[type] !== undefined) score += 1 + (WEAPON_RANGE[type] ?? 1) * 0.5;
  }
  return score;
}

/**
 * Role-aware score of a (determinized) state from `seat`'s point of view (docs/06 §4 Hard): a decided game dominates;
 * otherwise friendly life/cards count for, enemy life/cards against. The Renegade ignores the Sheriff while others
 * are still alive, since he needs him alive until the final duel.
 */
export function utility(state: GameState, seat: Seat): number {
  const self = state.players[seat];
  if (!self) return 0;
  const myTeam = teamOf(self.role);
  if (state.winner) {
    const won =
      (state.winner === "sheriff_team" && myTeam === "law") ||
      (state.winner === "outlaws" && myTeam === "outlaws") ||
      (state.winner === "renegade" && myTeam === "renegade");
    return won ? 1000 : -1000;
  }
  const alive = state.players.filter((p) => p.alive).length;
  let u = 0;
  for (const p of state.players) {
    if (!p.alive) continue;
    let weight: number;
    if (p.seat === seat) weight = 1.2;
    else if (myTeam === "renegade") weight = p.role === "sheriff" && alive > 2 ? 0 : -1;
    else weight = teamOf(p.role) === myTeam ? 1 : -1;
    u += weight * (10 + 4 * p.life + 1.2 * p.hand.length + inPlayScore(state, p.seat));
  }
  return u;
}
