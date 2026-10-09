import { meshInstanceKey } from "../game/mesh-selector.js";

const target = (body, mesh, occurrence = 1) => ({ body, mesh, occurrence });

// Print source of truth: the MicroZoo microduck_927 assembly. A part is listed
// here when its CAD solid is a printed part (amber in the CAD export) and it is
// present in the browser model; servos, boards, bearings and the battery are
// purchased and stay out of the print package. The sole pad is a separate TPU
// print. Mirrored parts are separate solids and colour independently; the two
// neck links are one solid used twice, so they are selected by occurrence.
// Regenerate the model and this list together with tools/build_robot_model.py.
export const PART_GROUPS = [
  {
    label: "Head",
    parts: [
      { id: "head", label: "Head dome", targets: [target("jaw_soft", "head_dome.stl")], color: "#F2EFE8" },
      { id: "headBand", label: "Head band", targets: [target("jaw_soft", "head_band.stl")], color: "#FF7A2F" },
      { id: "face", label: "Face plate", targets: [target("jaw_soft", "face_plate.stl")], color: "#9B9892" },
      { id: "eye", label: "Eye ring", targets: [target("jaw_soft", "eye_ring.stl")], color: "#FFB52E" },
      { id: "headBase", label: "Head base plate", targets: [target("jaw_soft", "head_base.stl")], color: "#FF7A2F" },
      { id: "headBrace", label: "Head brace", targets: [target("jaw_soft", "head_brace.stl")], color: "#8B8B90" },
    ],
  },
  {
    label: "Body",
    parts: [
      { id: "bodyLeft", label: "Left body shell", targets: [target("trunk_base", "body_shell_left.stl")], color: "#F2EFE8" },
      { id: "bodyRight", label: "Right body shell", targets: [target("trunk_base", "body_shell_right.stl")], color: "#F2EFE8" },
      { id: "bodyCore", label: "Trunk base", targets: [target("trunk_base", "trunk_base.stl")], color: "#F2EFE8" },
      { id: "trunkPlate", label: "Trunk plate", targets: [target("trunk_base", "trunk_plate.stl")], color: "#8B8B90" },
      { id: "leftHip", label: "Left hip cover", targets: [target("hip_l", "hip_cover_left.stl")], color: "#8B8B90" },
      { id: "rightHip", label: "Right hip cover", targets: [target("hip_l_2", "hip_cover_right.stl")], color: "#8B8B90" },
    ],
  },
  {
    label: "Joints",
    parts: [
      { id: "neckFront", label: "Front neck link", targets: [target("neck", "neck_link.stl", 1)], color: "#8B8B90" },
      { id: "neckRear", label: "Rear neck link", targets: [target("neck", "neck_link.stl", 2)], color: "#8B8B90" },
      { id: "neckPitch", label: "Neck pitch link", targets: [target("neck_pitch", "neck_pitch_link.stl")], color: "#8B8B90" },
      { id: "headJoint", label: "Head yoke", targets: [target("yaw_roll_motion", "head_yoke.stl")], color: "#8B8B90" },
      { id: "leftYawRoll", label: "Left yaw link", targets: [target("yaw2roll", "yaw_link_left.stl")], color: "#1D1D1F" },
      { id: "rightYawRoll", label: "Right yaw link", targets: [target("bearing_roll", "yaw_link_right.stl")], color: "#1D1D1F" },
    ],
  },
  {
    label: "Legs",
    parts: [
      { id: "leftLeg", label: "Left upper leg", targets: [target("upper_leg_left", "upper_leg_left.stl")], color: "#F2EFE8" },
      { id: "rightLeg", label: "Right upper leg", targets: [target("upper_leg_right", "upper_leg_right.stl")], color: "#F2EFE8" },
      { id: "leftRigidity", label: "Left leg plate", targets: [target("upper_leg_left", "leg_plate_left.stl")], color: "#8B8B90" },
      { id: "rightRigidity", label: "Right leg plate", targets: [target("upper_leg_right", "leg_plate_right.stl")], color: "#8B8B90" },
      { id: "leftShin", label: "Left shin shell", targets: [target("leg", "shin_left.stl")], color: "#8B8B90" },
      { id: "rightShin", label: "Right shin shell", targets: [target("leg_2", "shin_right.stl")], color: "#8B8B90" },
    ],
  },
  {
    label: "Feet",
    parts: [
      { id: "leftAnkle", label: "Left ankle bracket A", targets: [target("ankle_left", "ankle_bracket_a_left.stl")], color: "#FF7A2F" },
      { id: "rightAnkle", label: "Right ankle bracket A", targets: [target("ankle_right", "ankle_bracket_a_right.stl")], color: "#FF7A2F" },
      { id: "leftAnkleB", label: "Left ankle bracket B", targets: [target("ankle_left", "ankle_bracket_b_left.stl")], color: "#FF7A2F" },
      { id: "rightAnkleB", label: "Right ankle bracket B", targets: [target("ankle_right", "ankle_bracket_b_right.stl")], color: "#FF7A2F" },
      { id: "leftFoot", label: "Left foot shell", targets: [target("ankle_left", "foot_left.stl")], color: "#FF7A2F" },
      { id: "rightFoot", label: "Right foot shell", targets: [target("ankle_right", "foot_right.stl")], color: "#FF7A2F" },
      { id: "leftSole", label: "Left sole pad", targets: [target("ankle_left", "sole_pad.stl")], color: "#FFD23F" },
      { id: "rightSole", label: "Right sole pad", targets: [target("ankle_right", "sole_pad.stl")], color: "#FFD23F" },
    ],
  },
];

export const PARTS = PART_GROUPS.flatMap((group) => group.parts);
export const PART_BY_ID = Object.fromEntries(PARTS.map((part) => [part.id, part]));
export const PART_BY_TARGET = new Map(PARTS.flatMap((part) => (
  part.targets.map(({ mesh, body, occurrence }) => [meshInstanceKey(mesh, body, occurrence), part])
)));
export const PRINT_MESH_ORDER = PARTS.flatMap((part) => (
  part.targets.map(({ mesh, body, occurrence }) => meshInstanceKey(mesh, body, occurrence))
));
export const DEFAULT_COLORS = Object.fromEntries(PARTS.map((part) => [part.id, part.color]));

export function partForMeshInstance(meshName, bodyName, occurrence) {
  return PART_BY_TARGET.get(meshInstanceKey(meshName, bodyName, occurrence)) ?? null;
}

export function colorOverridesForParts(colors) {
  return Object.fromEntries(PARTS.flatMap((part) => (
    part.targets.map(({ mesh, body, occurrence }) => [
      meshInstanceKey(mesh, body, occurrence),
      colors[part.id],
    ])
  )));
}
