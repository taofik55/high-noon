import { Shape, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { extrude, lathe, mat, roundedRect } from "../core/shapes";
import { sweep } from "../core/sweep";
import { BONE } from "./skeleton";
import { smooth } from "./skin";
import type { CharacterSpec } from "./spec";

// Signature props (docs/07 §2.1): small, recognisable pieces that tell the characters apart at a glance.

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

function suitShape(kind: "spade" | "heart" | "diamond" | "club", s: number): Shape {
  const sh = new Shape();
  if (kind === "diamond") {
    sh.moveTo(0, s);
    sh.lineTo(s * 0.7, 0);
    sh.lineTo(0, -s);
    sh.lineTo(-s * 0.7, 0);
    sh.closePath();
    return sh;
  }
  if (kind === "heart" || kind === "spade") {
    const d = kind === "heart" ? 1 : -1;
    sh.moveTo(0, -s * d);
    sh.bezierCurveTo(s * 1.1, -s * 0.2 * d, s * 0.8, s * d, 0, s * 0.45 * d);
    sh.bezierCurveTo(-s * 0.8, s * d, -s * 1.1, -s * 0.2 * d, 0, -s * d);
    return sh;
  }
  sh.absarc(0, s * 0.45, s * 0.42, 0, Math.PI * 2, false);
  return sh;
}

export function buildSignature(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk;
  const sig = new Set(spec.signature);

  if (sig.has("cards")) {
    // A few playing cards fanned out of the breast pocket.
    const card = extrude(roundedRect(0.034, 0.05, 0.003), 0.0012);
    for (let i = 0; i < 3; i++) {
      parts.add(card, {
        material: "cloth",
        color: i === 1 ? "#f2ead8" : "#e8dcc4",
        bone: BONE.Spine2,
        matrix: mat([0.075 * k + i * 0.006, 1.335 + i * 0.004, 0.118 * k], [-0.25, 0.3, -0.35 + i * 0.3]),
      });
    }
  }
  if (sig.has("suits")) {
    const kinds = ["spade", "heart", "diamond", "club"] as const;
    kinds.forEach((kind, i) => {
      const x = (i < 2 ? 1 : -1) * 0.085 * k;
      const y = 1.13 + (i % 2) * 0.09;
      parts.add(extrude(suitShape(kind, 0.012), 0.002, undefined, 6), {
        material: "cloth",
        color: kind === "heart" || kind === "diamond" ? "#9a2a24" : "#d8cfb8",
        bone: BONE.Spine1,
        matrix: mat([x, y, 0.104 * k + 0.004], [0, Math.sign(x) * 0.5, 0]),
      });
    });
  }
  if (sig.has("telescope")) {
    const scope = lathe([[0, 0], [0.016, 0], [0.016, 0.07], [0.013, 0.075], [0.013, 0.14], [0.011, 0.145], [0.011, 0.2], [0.014, 0.205], [0, 0.205]], 12);
    parts.add(scope, { material: "brass", color: spec.palette.metal, bone: BONE.Hips, matrix: mat([0.155 * k, 0.78, -0.07 * k], [0.15, 0, 0.12]) });
  }
  if (sig.has("horseshoe")) {
    const shoe = new Shape();
    shoe.absarc(0, 0, 0.016, Math.PI * 1.15, Math.PI * -0.15, false);
    shoe.absarc(0, 0, 0.01, Math.PI * -0.15, Math.PI * 1.15, true);
    shoe.closePath();
    parts.add(extrude(shoe, 0.003, { size: 0.0008 }, 8), { material: "brass", color: "#d8b860", bone: BONE.Spine2, matrix: mat([0.085 * k, 1.34, 0.13 * k], [-0.2, 0.35, Math.PI]) });
  }
  if (sig.has("flask")) {
    const flask = extrude(roundedRect(0.07, 0.1, 0.02), 0.022, { size: 0.004 }, 6);
    parts.add(flask, { material: "steel", color: "#9aa0a6", bone: BONE.Hips, matrix: mat([0.13 * k, 0.88, 0.095 * k], [0, 0.6, 0.08]) });
    parts.add(lathe([[0, 0], [0.008, 0], [0.008, 0.018], [0.011, 0.02], [0.011, 0.028], [0, 0.028]], 10), {
      material: "steel",
      color: "#7a7f84",
      bone: BONE.Hips,
      matrix: mat([0.134 * k, 0.93, 0.1 * k], [0, 0, 0.08]),
    });
  }
  if (sig.has("conchos")) {
    // Silver conchos down the outer seam of each trouser leg, vaquero style.
    const concho = lathe([[0, 0], [0.011, 0.0005], [0.012, 0.0025], [0.008, 0.004], [0, 0.0045]], 12);
    for (const side of [1, -1] as const) {
      for (let i = 0; i < 6; i++) {
        const y = 0.9 - i * 0.075;
        const t = smooth(0.92, 0.5, y);
        const x = side * (0.094 + 0.085 - t * 0.026) * k;
        parts.add(concho, {
          material: "steel",
          color: "#c8c8c0",
          bone: i < 4 ? (side === 1 ? BONE.LeftUpLeg : BONE.RightUpLeg) : side === 1 ? BONE.LeftLeg : BONE.RightLeg,
          matrix: mat([x, y, 0.01], [0, 0, side * Math.PI / 2]),
        });
      }
    }
  }
  if (sig.has("scarf")) {
    // A long scarf: one end thrown over the shoulder, the other hanging down the front.
    for (const [end, drop] of [
      [v3(0.07, 1.22, 0.135), 0],
      [v3(-0.03, 1.28, 0.13), 1],
    ] as const) {
      const scarf = sweep({
        path: [v3(0.02 * (drop ? -1 : 1), 1.5, 0.07), v3(end.x * 0.7, 1.4, 0.12), end],
        rings: [
          { w: 0.03, f: 0.004, b: 0.004, p: 4 },
          { w: 0.032, f: 0.004, b: 0.004, p: 4 },
          { w: 0.028, f: 0.004, b: 0.004, p: 4 },
        ],
        front: v3(0, 0, 1),
        radial: 6,
        samples: 6,
      });
      parts.add(scarf.geometry, { material: "cloth", color: spec.palette.accent, bone: BONE.Spine2 });
    }
  }
}
