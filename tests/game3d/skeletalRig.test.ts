import { describe, expect, it } from "vitest";
import { Group, Object3D } from "three";
import { createSkeletalRig } from "@/game3d/characters/skeletalRig";
import { ALL_CLIPS } from "@/game3d/director/clips";
import { buildClips } from "@/game3d/procedural/character/clips";
import { buildCharacter } from "@/game3d/procedural/character/cowboy";
import { ROSTER } from "@/game3d/procedural/character/roster";

describe("skeletal rig (docs/05 §5–6)", () => {
  const clips = buildClips();

  it("has a skeletal clip for every Director clip name", () => {
    const names = new Set(clips.map((c) => c.name));
    for (const name of ALL_CLIPS) expect(names.has(name), name).toBe(true);
  });

  it("draws the revolver from the holster into the hand and puts it back on reset", () => {
    const seat = new Group();
    const ch = buildCharacter(ROSTER.bart_cassidy);
    seat.add(ch.group);
    const rig = createSkeletalRig(seat, ch, clips);
    const gun = new Object3D();
    rig.setGun(gun, false);
    expect(gun.parent).toBe(ch.sockets.holster);
    const tl = rig.play("Draw");
    tl.progress(1);
    expect(gun.parent).toBe(ch.sockets.rightHand);
    rig.reset();
    expect(gun.parent).toBe(ch.sockets.holster);
    rig.dispose();
  });

  it("slings a long gun on the back and brings it to the hands to shoot", () => {
    const seat = new Group();
    const ch = buildCharacter(ROSTER.rose_doolan);
    seat.add(ch.group);
    const rig = createSkeletalRig(seat, ch, clips);
    const rifle = new Object3D();
    rig.setGun(rifle, true);
    expect(rifle.parent?.name).toBe("socket.sling");
    rig.play("ShootRifle").progress(0.01);
    expect(rifle.parent).toBe(ch.sockets.rightHand);
    rig.dispose();
  });

  it("keeps a dead character in its fall pose and steps the mixer without errors", () => {
    const seat = new Group();
    const ch = buildCharacter(ROSTER.slab_the_killer);
    seat.add(ch.group);
    const rig = createSkeletalRig(seat, ch, clips);
    rig.setDead(true);
    rig.reset();
    rig.update(0.5);
    // The hips have dropped toward the ground (Death_A ends lying down).
    expect(ch.skeleton.bones[0]?.position.y).toBeLessThan(0.5);
    rig.dispose();
  });
});
