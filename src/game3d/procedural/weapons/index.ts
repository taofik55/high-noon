import { Group, Mesh, type BufferGeometry } from "three";
import { triangleCount } from "../core/parts";
import { isMaterialKey, material } from "../materials";
import { COLT_OPTIONS, revolverGeometry } from "./colt45";
import { carabineGeometry, leverActionGeometry } from "./longarms";

/** One model per weapon card (docs/05 §5: the gun in hand follows the equipped weapon; Colt .45 by default). */
export const WEAPON_IDS = ["colt45", "volcanic", "schofield", "remington", "rev_carabine", "winchester"] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

/** Long guns are held in both hands and fired with ShootRifle. */
export const LONG_GUNS: ReadonlySet<WeaponId> = new Set(["rev_carabine", "winchester"]);

const cache = new Map<WeaponId, Map<string, BufferGeometry>>();

function geometry(id: WeaponId): Map<string, BufferGeometry> {
  const hit = cache.get(id);
  if (hit) return hit;
  let g: Map<string, BufferGeometry>;
  switch (id) {
    case "colt45":
      g = revolverGeometry("colt45", COLT_OPTIONS);
      break;
    case "schofield":
      g = revolverGeometry("schofield", { barrel: 0.178, steel: "#2a2e36", frame: "#2a2e36", grip: "#4a2a1a", guard: "#2a2e36", guardKey: "steel", topBreak: true });
      break;
    case "remington":
      // Nickel finish and ivory grips: the showy one.
      g = revolverGeometry("remington", { barrel: 0.19, steel: "#b8bcc0", frame: "#b8bcc0", grip: "#e6dcc4", guard: "#b8bcc0", guardKey: "steel", web: true });
      break;
    case "volcanic":
      g = leverActionGeometry("volcanic");
      break;
    case "winchester":
      g = leverActionGeometry("winchester");
      break;
    case "rev_carabine":
      g = carabineGeometry();
      break;
  }
  cache.set(id, g);
  return g;
}

export function buildWeapon(id: WeaponId): { group: Group; triangles: number } {
  const group = new Group();
  group.name = `weapon.${id}`;
  let triangles = 0;
  for (const [key, g] of geometry(id)) {
    if (!isMaterialKey(key)) continue;
    const mesh = new Mesh(g, material(key));
    mesh.castShadow = true;
    mesh.name = `${id}.${key}`;
    group.add(mesh);
    triangles += triangleCount(g);
  }
  return { group, triangles };
}
