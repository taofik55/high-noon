"use client";

import { useEffect, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import type { CardId } from "@/engine";
import type { HandCardState, TableInteraction } from "@/ui/table/useTableInteraction";
import { CARD_GEOMETRY, CardMesh, CARD_W } from "../cards/CardMesh";
import { HAND_CARD_PX, fanLayout, type FanSlot } from "./fanLayout";
import { seatAtPointer } from "../seatPicker";
import { registerTestProvider } from "../testHook";
import { useUi3D } from "../uiStore";

const SCALE = HAND_CARD_PX / CARD_W;
const DRAG_THRESHOLD = 10;

interface HandCardProps {
  cardId: CardId;
  slot: FanSlot;
  index: number;
  state: HandCardState;
  hidden: boolean;
  onPress: (cardId: CardId, e: ThreeEvent<PointerEvent>) => void;
  onDouble: (cardId: CardId) => void;
}

function HandCard({ cardId, slot, index, state, hidden, onPress, onDouble }: HandCardProps) {
  const hovered = useUi3D((s) => s.hoveredCard === cardId);
  const setHoveredCard = useUi3D((s) => s.setHoveredCard);
  const lift = (hovered ? 34 : 0) + (state === "selected" ? 26 : 0);
  const scale = SCALE * (hovered ? 1.22 : state === "selected" ? 1.1 : 1);
  return (
    <group>
      {/* Hit area at the card's resting size and place: the lifted, enlarged hover card must not swallow clicks
          meant for its neighbours in a big hand. Invisible but still raycast (colorWrite off). */}
      <mesh
        geometry={CARD_GEOMETRY}
        position={[slot.x, slot.y, index]}
        rotation={[0, 0, slot.rotation]}
        scale={[SCALE, SCALE, SCALE]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredCard(cardId);
        }}
        onPointerOut={() => {
          if (useUi3D.getState().hoveredCard === cardId) setHoveredCard(null);
        }}
        onPointerDown={(e) => onPress(cardId, e)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDouble(cardId);
        }}
      >
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <CardMesh
        cardId={cardId}
        unlit
        dimmed={state === "dimmed"}
        visible={!hidden}
        position={[slot.x, slot.y + lift, hovered ? 60 : index + 20]}
        rotation={[0, 0, hovered ? 0 : slot.rotation]}
        scale={[scale, scale, scale]}
        raycast={() => null}
      />
    </group>
  );
}

/**
 * The player's hand as a fan of 3D cards in an overlay scene (docs/05 §4): hover lifts and enlarges, illegal cards
 * are dimmed, click selects (then click a glowing player), or drag onto a player / up onto the table.
 */
export function HandFan({ ti, renderPriority = 1 }: { ti: TableInteraction; renderPriority?: number }) {
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const drag = useUi3D((s) => s.drag);
  const setDrag = useUi3D((s) => s.setDrag);
  const hand = ti.view?.myHand ?? [];
  const slots = fanLayout(hand.length, size.width, size.height);

  // The latest interaction, for window listeners registered once per drag.
  const tiRef = useRef(ti);
  useEffect(() => {
    tiRef.current = ti;
  });

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  });
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);

  // Drag tracking on the window, so the pointer can leave the card (and the HUD) freely. The listeners go on in the
  // press handler itself: a quick tap on a touch screen lifts the finger before React would run an effect.
  const onPress = (cardId: CardId, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!tiRef.current.actNow) return;
    const start = toCanvas(e.nativeEvent.clientX, e.nativeEvent.clientY);
    setDrag({ cardId, x: start.x, y: start.y, active: false });
    release.current?.();
    const move = (ev: PointerEvent) => {
      const cur = useUi3D.getState().drag;
      if (!cur) return;
      const p = toCanvas(ev.clientX, ev.clientY);
      const active = cur.active || Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD;
      setDrag({ ...cur, x: p.x, y: p.y, active });
    };
    const up = () => {
      stop();
      const cur = useUi3D.getState().drag;
      setDrag(null);
      if (!cur) return;
      if (!cur.active) {
        tiRef.current.onHandCard(cur.cardId);
        return;
      }
      const seat = useUi3D.getState().hoveredSeat ?? seatAtPointer(cur.x, cur.y);
      // Dropped on a player, or anywhere above the hand for cards that need no target.
      if (seat !== null) tiRef.current.dropCard(cur.cardId, seat);
      else if (cur.y < sizeRef.current.height * 0.62) tiRef.current.dropCard(cur.cardId, null);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      release.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    release.current = stop;
  };

  useEffect(
    () =>
      registerTestProvider("handCards", () => {
        const rect = gl.domElement.getBoundingClientRect();
        const cur = tiRef.current.view?.myHand ?? [];
        return fanLayout(cur.length, rect.width, rect.height).map((s, i) => ({
          cardId: cur[i] as CardId,
          // The visible strip of the card, where a player would click or tap it.
          x: rect.left + rect.width / 2 + s.pickX,
          y: rect.top + rect.height / 2 - s.y,
          state: tiRef.current.handState(cur[i] as CardId),
        }));
      }),
    [gl],
  );

  return (
    <Hud renderPriority={renderPriority}>
      <OrthographicCamera makeDefault position={[0, 0, 200]} near={0.1} far={1000} />
      {hand.map((id, i) => (
        <HandCard
          key={id}
          cardId={id}
          slot={slots[i] ?? { x: 0, y: 0, rotation: 0, pickX: 0 }}
          index={i}
          state={ti.handState(id)}
          hidden={drag?.active === true && drag.cardId === id}
          onPress={onPress}
          onDouble={(cardId) => tiRef.current.dropCard(cardId, null)}
        />
      ))}
      {drag?.active && (
        <CardMesh
          cardId={drag.cardId}
          unlit
          position={[drag.x - size.width / 2, size.height / 2 - drag.y, 100]}
          scale={[SCALE * 1.1, SCALE * 1.1, SCALE * 1.1]}
          raycast={() => null}
        />
      )}
    </Hud>
  );
}
