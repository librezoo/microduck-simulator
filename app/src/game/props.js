// Original procedural prop library.
//
// Every visible object is assembled at runtime from Three.js geometry and
// colour-only materials. There are no downloaded models or texture assets in
// this module. Definitions keep placement, collision and entrance timing in
// one place so the MuJoCo and Three.js worlds continue to agree.

import {
  ARCADE_CONTROL_D,
  ARCADE_CONTROL_H,
  ARCADE_CONTROL_TILT,
  ARCADE_CONTROL_Z,
  ARCADE_D,
  ARCADE_FRONT_Z,
  ARCADE_H,
  ARCADE_W,
} from "./constants.js";

export const PROPS_ENABLED = true;

const BOARD_POS = [-1.08, 1.02]; // Three.js [x, z]
const BOARD_YAW = Math.PI / 2 + 0.45;
const ARCADE_YAW = -3 * (Math.PI / 4);

const BOARD_LENGTH = 0.79;
const BOARD_DECK_RADIUS = 0.1;
const BOARD_DECK_STRAIGHT = BOARD_LENGTH - 2 * BOARD_DECK_RADIUS;
const BOARD_DECK_THICKNESS = 0.028;
const BOARD_DECK_Y = 0.103;
const BOARD_WHEEL_RADIUS = 0.021;
const BOARD_WHEEL_Y = 0.023;
const BOARD_WHEEL_Z = 0.112;
const BOARD_WHEEL_WIDTH = 0.024;
const BOARD_MARK_RADIUS = 0.025;
const BOARD_MARK_THICKNESS = 0.007;
const BOARD_MARK_Y = BOARD_DECK_Y
  + BOARD_DECK_THICKNESS / 2
  + BOARD_MARK_THICKNESS / 2;

const BOARD_VISIBLE_MIN_Y = BOARD_WHEEL_Y - BOARD_WHEEL_RADIUS;
const BOARD_VISIBLE_MAX_Y = BOARD_MARK_Y + BOARD_MARK_THICKNESS / 2;
const BOARD_VISIBLE_H = BOARD_VISIBLE_MAX_Y - BOARD_VISIBLE_MIN_Y;
const BOARD_VISIBLE_W = 2 * (BOARD_WHEEL_Z + BOARD_WHEEL_WIDTH / 2);

const ARCADE_BACK_Z = -ARCADE_D / 2;
const ARCADE_COLLIDER_Z = (ARCADE_BACK_Z + ARCADE_FRONT_Z) / 2;
const ARCADE_COLLIDER_D = ARCADE_FRONT_Z - ARCADE_BACK_Z;

function offsetColliderCenter([x, z], yaw, localZ) {
  return [
    x + Math.sin(yaw) * localZ,
    -z - Math.cos(yaw) * localZ,
  ];
}

const PALETTE = Object.freeze({
  graphite: 0x171719,
  charcoal: 0x29292d,
  bone: 0xe8e1d5,
  cobalt: 0x3159c7,
  vermilion: 0xd55237,
  steel: 0x77787b,
  rubber: 0x202124,
});

function standard(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.05,
    roughness: 0.62,
    ...options,
  });
}

function addMesh(THREE, parent, geometry, material, {
  name,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale,
} = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name ?? "procedural-prop-part";
  mesh.userData.meshName = mesh.name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

/** Build a compact, logo-free postmodern arcade cabinet. */
export function createArcadeCabinet(THREE) {
  const root = new THREE.Group();
  root.name = "procedural-arcade-cabinet";
  const graphite = standard(THREE, PALETTE.graphite, { roughness: 0.48 });
  const charcoal = standard(THREE, PALETTE.charcoal);
  const bone = standard(THREE, PALETTE.bone, { roughness: 0.78 });
  const cobalt = standard(THREE, PALETTE.cobalt, { roughness: 0.42 });
  const vermilion = standard(THREE, PALETTE.vermilion, { roughness: 0.48 });
  const screen = standard(THREE, 0x111722, {
    emissive: 0x183c75,
    emissiveIntensity: 0.62,
    metalness: 0,
    roughness: 0.2,
  });

  // A dark monolith with an offset light portal and primary-colour controls.
  addMesh(THREE, root, new THREE.BoxGeometry(ARCADE_W, ARCADE_H * 0.72, ARCADE_D), graphite, {
    name: "cabinet-body",
    position: [0, ARCADE_H * 0.36, 0],
  });
  addMesh(THREE, root, new THREE.BoxGeometry(ARCADE_W * 0.92, ARCADE_H * 0.25, ARCADE_D * 0.9), bone, {
    name: "cabinet-crown",
    position: [0, ARCADE_H * 0.875, -ARCADE_D * 0.025],
  });
  addMesh(THREE, root, new THREE.BoxGeometry(ARCADE_W * 0.72, ARCADE_H * 0.235, 0.018), screen, {
    name: "cabinet-screen",
    position: [ARCADE_W * 0.035, ARCADE_H * 0.555, ARCADE_D * 0.505],
  });
  addMesh(THREE, root, new THREE.BoxGeometry(ARCADE_W * 0.88, ARCADE_CONTROL_H, ARCADE_CONTROL_D), cobalt, {
    name: "cabinet-control-plane",
    position: [0, ARCADE_H * 0.39, ARCADE_CONTROL_Z],
    rotation: [ARCADE_CONTROL_TILT, 0, 0],
  });
  addMesh(THREE, root, new THREE.CylinderGeometry(0.009, 0.011, ARCADE_H * 0.075, 10), charcoal, {
    name: "cabinet-joystick-stem",
    position: [-ARCADE_W * 0.2, ARCADE_H * 0.445, ARCADE_D * 0.625],
    rotation: [ARCADE_CONTROL_TILT, 0, 0],
  });
  addMesh(THREE, root, new THREE.SphereGeometry(0.019, 12, 8), vermilion, {
    name: "cabinet-joystick",
    position: [-ARCADE_W * 0.2, ARCADE_H * 0.487, ARCADE_D * 0.618],
  });
  for (const [index, material] of [bone, vermilion].entries()) {
    addMesh(THREE, root, new THREE.CylinderGeometry(0.014, 0.014, 0.009, 12), material, {
      name: `cabinet-button-${index + 1}`,
      position: [ARCADE_W * (0.08 + index * 0.15), ARCADE_H * 0.445, ARCADE_D * 0.63],
      rotation: [Math.PI / 2 + ARCADE_CONTROL_TILT, 0, 0],
    });
  }
  addMesh(THREE, root, new THREE.BoxGeometry(ARCADE_W * 0.76, ARCADE_H * 0.065, 0.012), charcoal, {
    name: "cabinet-speaker-slot",
    position: [-ARCADE_W * 0.035, ARCADE_H * 0.18, ARCADE_D * 0.506],
  });
  addMesh(THREE, root, new THREE.BoxGeometry(ARCADE_W * 0.42, ARCADE_H * 0.035, ARCADE_D * 0.78), vermilion, {
    name: "cabinet-plinth",
    position: [ARCADE_W * 0.21, ARCADE_H * 0.0175, 0],
  });
  return root;
}

/** Build a rideable-scale skateboard from a deck, trucks and four wheels. */
export function createSkateboard(THREE) {
  const root = new THREE.Group();
  root.name = "procedural-skateboard";
  const deck = standard(THREE, PALETTE.cobalt, { roughness: 0.58 });
  const underside = standard(THREE, PALETTE.bone, { roughness: 0.72 });
  const metal = standard(THREE, PALETTE.steel, { metalness: 0.7, roughness: 0.32 });
  const rubber = standard(THREE, PALETTE.rubber, { roughness: 0.9 });
  const accent = standard(THREE, PALETTE.vermilion, { roughness: 0.5 });

  // CapsuleGeometry gives a clean pill silhouette without a sourced mesh.
  // Its local X radius is compressed before rotating the long axis into X,
  // producing a 0.79 x 0.20 m deck only 2.8 cm thick.
  const deckMesh = addMesh(
    THREE,
    root,
    new THREE.CapsuleGeometry(BOARD_DECK_RADIUS, BOARD_DECK_STRAIGHT, 4, 12),
    deck,
    {
      name: "skateboard-deck",
      position: [0, BOARD_DECK_Y, 0],
      rotation: [0, 0, -Math.PI / 2],
      scale: [BOARD_DECK_THICKNESS / (2 * BOARD_DECK_RADIUS), 1, 1],
    },
  );
  // The substitute is expressed in the source mesh's local coordinates; it
  // inherits the deck's compression and rotation inside the FX overlay.
  deckMesh.userData.fxWireGeometry = new THREE.CapsuleGeometry(
    BOARD_DECK_RADIUS,
    BOARD_DECK_STRAIGHT,
    1,
    4,
  );

  addMesh(THREE, root, new THREE.BoxGeometry(0.53, 0.012, 0.135), underside, {
    name: "skateboard-underside-inlay",
    position: [0, 0.083, 0],
  });
  // CylinderGeometry is Y-up already: leaving it unrotated makes this a thin,
  // horizontal deck decoration instead of the former upright phantom tail.
  addMesh(THREE, root, new THREE.CylinderGeometry(
    BOARD_MARK_RADIUS,
    BOARD_MARK_RADIUS,
    BOARD_MARK_THICKNESS,
    16,
  ), accent, {
    name: "skateboard-tail-mark",
    position: [0.3, BOARD_MARK_Y, 0],
  });

  for (const axleX of [-0.245, 0.245]) {
    addMesh(THREE, root, new THREE.BoxGeometry(0.075, 0.025, 0.09), metal, {
      name: "skateboard-truck",
      position: [axleX, 0.061, 0],
    });
    addMesh(THREE, root, new THREE.CylinderGeometry(0.007, 0.007, 0.245, 8), metal, {
      name: "skateboard-axle",
      position: [axleX, 0.046, 0],
      rotation: [Math.PI / 2, 0, 0],
    });
    for (const wheelZ of [-BOARD_WHEEL_Z, BOARD_WHEEL_Z]) {
      addMesh(THREE, root, new THREE.CylinderGeometry(
        BOARD_WHEEL_RADIUS,
        BOARD_WHEEL_RADIUS,
        BOARD_WHEEL_WIDTH,
        12,
      ), rubber, {
        name: "skateboard-wheel",
        position: [axleX, BOARD_WHEEL_Y, wheelZ],
        rotation: [Math.PI / 2, 0, 0],
      });
    }
  }
  return root;
}

export const PROP_DEFS = Object.freeze([
  Object.freeze({
    id: "arcade",
    enabled: true,
    create: createArcadeCabinet,
    rotation: Object.freeze([0, ARCADE_YAW, 0]),
    position: Object.freeze([1.13, 1.13]),
    fxDelay: 0.85,
    collider: Object.freeze({
      pos: Object.freeze([
        ...offsetColliderCenter([1.13, 1.13], ARCADE_YAW, ARCADE_COLLIDER_Z),
        ARCADE_H / 2,
      ]),
      size: Object.freeze([ARCADE_W / 2, ARCADE_COLLIDER_D / 2, ARCADE_H / 2]),
      euler: Object.freeze([0, 0, ARCADE_YAW]),
    }),
  }),
  Object.freeze({
    id: "skateboard",
    enabled: true,
    create: createSkateboard,
    rotation: Object.freeze([0, BOARD_YAW, 0]),
    position: Object.freeze(BOARD_POS),
    fxDelay: 0.25,
    // One box matches the floor-snapped visual bounds. The procedural board
    // has no raised kicktails, so it must not inherit the old GLB's tail boxes.
    collider: Object.freeze({
      pos: Object.freeze([BOARD_POS[0], -BOARD_POS[1], BOARD_VISIBLE_H / 2]),
      size: Object.freeze([BOARD_LENGTH / 2, BOARD_VISIBLE_W / 2, BOARD_VISIBLE_H / 2]),
      euler: Object.freeze([0, 0, BOARD_YAW]),
    }),
  }),
]);

// Static MJCF collision boxes for every enabled prop, consumed before any
// visual object exists. MuJoCo is Z-up and its Y axis is -Three.js Z.
export function propColliders() {
  if (!PROPS_ENABLED) return [];
  const out = [];
  for (const def of PROP_DEFS) {
    if (!def.enabled || !def.collider) continue;
    const boxes = Array.isArray(def.collider) ? def.collider : [def.collider];
    boxes.forEach((collider, index) => {
      out.push({
        name: boxes.length > 1 ? `prop_${def.id}_${index}` : `prop_${def.id}`,
        pos: collider.pos.join(" "),
        size: collider.size.join(" "),
        euler: collider.euler?.join(" "),
      });
    });
  }
  return out;
}

// Construct every enabled prop and register the same staggered materialize FX
// used by the duck. The async contract is retained for callers even though no
// network, file or model-loader work remains.
export async function loadProps({ THREE, scene, camera, renderer, fx, ceremony }) {
  if (!PROPS_ENABLED) return {};
  const groups = {};
  for (const def of PROP_DEFS) {
    if (!def.enabled) continue;
    try {
      const node = def.create(THREE);
      node.rotation.set(...(def.rotation ?? [0, 0, 0]));
      const group = new THREE.Group();
      group.name = `prop-${def.id}`;
      group.add(node);

      const posed = new THREE.Box3().setFromObject(group);
      group.position.set(def.position[0], -posed.min.y, def.position[1]);
      scene.add(group);

      const propFx = fx.createWireframeFx();
      propFx.init({ THREE, scene, root: group, camera, renderer, hidden: true });
      ceremony.addPropFx(propFx, def.fxDelay ?? 0.3);
      groups[def.id] = [group];
    } catch (error) {
      console.warn(`[props] "${def.id}" disabled:`, error);
    }
  }
  return groups;
}
