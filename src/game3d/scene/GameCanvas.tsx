"use client";

import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Vector3 } from "three";
import type { TableInteraction } from "@/ui/table/useTableInteraction";
import { CameraRig } from "../camera/CameraRig";
import { CenterPile } from "../cards/CenterPile";
import { HandFan } from "../hand/HandFan";
import { BadgeTracker } from "../hud/BadgeTracker";
import { QUALITY_CONFIG, resolveQuality } from "../settings/quality";
import { useSettings } from "../settings/settingsStore";
import { registerSeatPicker } from "../seatPicker";
import { registerTestProvider } from "../testHook";
import { useUi3D } from "../uiStore";
import { useTargetSeats } from "../useTargetSeats";
import { VfxLayer } from "../vfx/VfxLayer";
import { SEAT_TINTS, seatPosition, type Vec3 } from "../world/layout";
import { Seat } from "../world/Seat";
import { Town } from "../world/Town";
import { StudioEnvironment } from "../procedural/StudioEnvironment";

const METALS = ["steel", "brass", "glass"] as const;

/** Projects each character's chest to the screen: drop detection for drags, and seat positions for the e2e tests. */
function SeatProjector({ positions, targets }: { positions: { seat: number; pos: Vec3 }[]; targets: ReadonlySet<number> }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const latest = useRef({ positions, targets });
  useEffect(() => {
    latest.current = { positions, targets };
  });
  const size = useThree((s) => s.size);
  // Nearest projected character within ~1.5 character widths of the pointer (canvas pixels).
  useEffect(
    () =>
      registerSeatPicker((x, y) => {
        let best: { seat: number; d: number } | null = null;
        for (const { seat, pos } of latest.current.positions) {
          const v = new Vector3(pos[0], 1.1, pos[2]).project(camera);
          const d = Math.hypot(((v.x + 1) / 2) * size.width - x, ((1 - v.y) / 2) * size.height - y);
          if (d < 110 && (!best || d < best.d)) best = { seat, d };
        }
        return best?.seat ?? null;
      }),
    [camera, size],
  );
  useEffect(
    () =>
      registerTestProvider("seats", () => {
        const rect = gl.domElement.getBoundingClientRect();
        return latest.current.positions.map(({ seat, pos }) => {
          const v = new Vector3(pos[0], 1.1, pos[2]).project(camera);
          return {
            seat,
            x: rect.left + ((v.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - v.y) / 2) * rect.height,
            targetable: latest.current.targets.has(seat),
          };
        });
      }),
    [camera, gl],
  );
  return null;
}

/**
 * The 3D table (docs/05): presentation only — it reads the presented view and sends intents through the shared
 * interaction state machine; it never touches game state (Golden rule 5).
 */
export function GameCanvas({ ti }: { ti: TableInteraction }) {
  const setting = useSettings((s) => s.quality);
  const autoLevel = useSettings((s) => s.autoLevel);
  const degradeAuto = useSettings((s) => s.degradeAuto);
  const quality = QUALITY_CONFIG[resolveQuality(setting, autoLevel)];
  const hoveredSeat = useUi3D((s) => s.hoveredSeat);
  const freeCamera = useUi3D((s) => s.freeCamera);
  const cinematic = useUi3D((s) => s.cinematic);
  const targets = useTargetSeats(ti);

  const view = ti.view;
  if (!view) return null;
  const me = view.viewer === "spectator" ? 0 : view.viewer;
  const n = view.players.length;
  const positions = view.players.map((p) => ({ seat: p.seat, pos: seatPosition(p.seat, me, n) }));
  const focusSeat = hoveredSeat !== null && targets.has(hoveredSeat) ? (positions[hoveredSeat]?.pos ?? null) : null;

  return (
    <Canvas
      // three r18x removed PCFSoftShadowMap; "percentage" = PCFShadowMap.
      shadows={quality.shadows ? "percentage" : false}
      dpr={quality.dpr}
      gl={{ antialias: quality.antialias }}
      camera={{ position: [0, 8.5, 13.5], fov: 50, near: 0.1, far: 500 }}
      onPointerMissed={() => ti.mode.kind === "card" && ti.setMode({ kind: "idle" })}
      data-testid="game-canvas"
    >
      <PerformanceMonitor onDecline={degradeAuto} flipflops={3} />
      <Town shadows={quality.shadows} shadowMapSize={quality.shadowMapSize} />
      {/* Something for metal to reflect (revolvers, hoops, badges); generated, no HDR download. */}
      <StudioEnvironment intensity={0.5} only={METALS} />
      <CenterPile deckCount={view.deckCount} discardTop={view.discard.at(-1) ?? null} />
      {view.players.map((p) => (
        <Seat
          key={p.seat}
          player={p}
          position={positions[p.seat]?.pos ?? [0, 0, 0]}
          tint={SEAT_TINTS[p.seat % SEAT_TINTS.length] ?? "#d9a441"}
          isTurn={view.turn.seat === p.seat}
          isActing={view.currentActor === p.seat}
          targetable={targets.has(p.seat)}
          version={ti.version}
          onSelect={ti.onSeat}
        />
      ))}
      <CameraRig focus={focusSeat} free={freeCamera} cinematic={cinematic} />
      <VfxLayer />
      <HandFan ti={ti} />
      <BadgeTracker positions={positions} />
      <SeatProjector positions={positions} targets={targets} />
    </Canvas>
  );
}
