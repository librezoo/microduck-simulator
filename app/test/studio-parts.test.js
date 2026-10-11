import assert from "node:assert/strict";
import test from "node:test";
import { materialHookForMap, materialMapForHexOverrides } from "../src/game/variants.js";
import { meshInstanceKey, meshNameFromSelector } from "../src/game/mesh-selector.js";
import { duckKinematics, duckStudio } from "./helpers/duck-studio.js";

// The print list now comes from the generated studio manifest
// (public/robot/librezoo/studio.json) instead of a hand-written module.
const {
  colorOverridesForParts,
  defaultColors: DEFAULT_COLORS,
  parts: PARTS,
  partForMeshInstance,
  printMeshOrder: PRINT_MESH_ORDER,
} = duckStudio();

test("every LibreZoo Studio print target exists once in the walking model", () => {
  const kinematics = duckKinematics();
  const available = new Map();
  const seenGeoms = new Set();
  const occurrences = new Map();
  for (const body of kinematics.bodies) {
    for (const geom of body.geoms ?? []) {
      if (!geom.mesh) continue;
      const duplicateKey = `${body.name}|${geom.mesh}|${geom.pos}|${geom.quat}`;
      if (seenGeoms.has(duplicateKey)) continue;
      seenGeoms.add(duplicateKey);
      const occurrenceKey = `${body.name}|${geom.mesh}`;
      const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
      occurrences.set(occurrenceKey, occurrence);
      const selector = meshInstanceKey(geom.mesh, body.name, occurrence);
      available.set(selector, (available.get(selector) ?? 0) + 1);
    }
  }

  assert.equal(new Set(PRINT_MESH_ORDER).size, PRINT_MESH_ORDER.length);
  assert.equal(PARTS.length, 32);
  for (const selector of PRINT_MESH_ORDER) {
    assert.equal(available.get(selector), 1, `${selector} must resolve to exactly one model mesh`);
  }

  const expectedPrintMeshes = [
    "head_dome.stl", "head_band.stl", "face_plate.stl", "eye_ring.stl", "head_base.stl", "head_brace.stl",
    "body_shell_left.stl", "body_shell_right.stl", "trunk_base.stl", "trunk_plate.stl",
    "hip_cover_left.stl", "hip_cover_right.stl",
    "neck_link.stl", "neck_pitch_link.stl", "head_yoke.stl", "yaw_link_left.stl", "yaw_link_right.stl",
    "upper_leg_left.stl", "upper_leg_right.stl", "leg_plate_left.stl", "leg_plate_right.stl",
    "shin_left.stl", "shin_right.stl",
    "ankle_bracket_a_left.stl", "ankle_bracket_a_right.stl", "ankle_bracket_b_left.stl", "ankle_bracket_b_right.stl",
    "foot_left.stl", "foot_right.stl", "sole_pad.stl",
  ];
  const printableMeshes = new Set(PRINT_MESH_ORDER.map(meshNameFromSelector));
  assert.deepEqual([...printableMeshes].sort(), expectedPrintMeshes.sort());
  const expectedPrintSelectors = [...available.keys()]
    .filter((selector) => printableMeshes.has(meshNameFromSelector(selector)))
    .sort();
  assert.deepEqual([...PRINT_MESH_ORDER].sort(), expectedPrintSelectors);

  // Purchased hardware, boards, proxies and the 3D-printed-in-place spacers stay out.
  const purchased = [
    "servo_case.stl", "servo_horn.stl", "spacer.stl", "battery.stl", "sbc.stl", "lens.stl",
    "pcb_main.stl", "idler_bearing.stl",
  ];
  for (const mesh of purchased) assert.equal(printableMeshes.has(mesh), false, `${mesh} must stay out of the print list`);
});

test("mirrored print parts select and colour independently", () => {
  assert.equal(partForMeshInstance("hip_cover_left.stl", "hip_l", 1).id, "leftHip");
  assert.equal(partForMeshInstance("hip_cover_right.stl", "hip_l_2", 1).id, "rightHip");
  assert.equal(partForMeshInstance("leg_plate_left.stl", "upper_leg_left", 1).id, "leftRigidity");
  assert.equal(partForMeshInstance("leg_plate_right.stl", "upper_leg_right", 1).id, "rightRigidity");
  assert.equal(partForMeshInstance("shin_left.stl", "leg", 1).id, "leftShin");
  assert.equal(partForMeshInstance("shin_right.stl", "leg_2", 1).id, "rightShin");
  assert.equal(partForMeshInstance("neck_link.stl", "neck", 1).id, "neckFront");
  assert.equal(partForMeshInstance("neck_link.stl", "neck", 2).id, "neckRear");
  assert.equal(partForMeshInstance("sole_pad.stl", "ankle_left", 1).id, "leftSole");
  assert.equal(partForMeshInstance("sole_pad.stl", "ankle_right", 1).id, "rightSole");

  const overrides = colorOverridesForParts({
    ...DEFAULT_COLORS,
    leftRigidity: "#FF0000",
    rightRigidity: "#0000FF",
  });
  const map = materialMapForHexOverrides(overrides);
  const materialForMesh = materialHookForMap(map);
  assert.deepEqual(materialForMesh("leg_plate_left.stl", "upper_leg_left", null, 1).color, [1, 0, 0]);
  assert.deepEqual(materialForMesh("leg_plate_right.stl", "upper_leg_right", null, 1).color, [0, 0, 1]);
});
