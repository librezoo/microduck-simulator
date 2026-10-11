// Runtime-selectable environments. The compact arcade remains the default;
// imported and procedural rooms are both constructed only when selected.

import { ARENA_HALF, SPAWN_X, SPAWN_Y } from "./constants.js";
import { createLoftRoom, createVintageRoom } from "./procedural-rooms.js";

export const DEFAULT_SCENE = "arcade";

export const SCENES = Object.freeze({
  arcade: Object.freeze({
    id: "arcade",
    label: "Arcade",
    arenaHalf: ARENA_HALF,
    spawn: Object.freeze([SPAWN_X, SPAWN_Y]),
    cameraMaxDistance: 3,
  }),
  dining: Object.freeze({
    id: "dining",
    label: "Dining Room",
    // Converted from the supplied Dining_room__Kichen_baked.usdz.
    arenaHalf: 5.2,
    spawn: Object.freeze([0, 0]),
    cameraMaxDistance: 8,
  }),
  apartment: Object.freeze({
    id: "apartment",
    label: "Apartment",
    arenaHalf: 5.8,
    // Lounge aisle: keeps the entry framing clear of the doorway wall.
    spawn: Object.freeze([-0.24, -2.28]),
    heading: Math.PI,
    cameraDistance: 1.5,
    cameraMaxDistance: 9,
  }),
  loft: Object.freeze({
    id: "loft",
    label: "Loft 13",
    arenaHalf: 4.8,
    // The clear end of the gallery; face back toward the conversation island.
    spawn: Object.freeze([4.2, 0.2]),
    heading: Math.PI,
    cameraDistance: 1.25,
    cameraMaxDistance: 8,
  }),
  vintage: Object.freeze({
    id: "vintage",
    label: "Vintage Room",
    // A compact, original postmodern salon built from local primitives.
    arenaHalf: 4.3,
    // The negative-X entry aisle stays clear of the raised lounge platform.
    spawn: Object.freeze([-2.6, 0]),
    heading: -Math.PI / 2,
    cameraDistance: 1.25,
    cameraMaxDistance: 7,
  }),
  backrooms: Object.freeze({
    id: "backrooms",
    label: "Backrooms",
    // The 59 m authored corridor is scaled to a 28 m playable footprint.
    arenaHalf: 14.5,
    spawn: Object.freeze([3.8, 0]),
    cameraMaxDistance: 20,
  }),
});

export const SCENE_IDS = Object.freeze(Object.keys(SCENES));

export const SCENE_ATTRIBUTIONS = Object.freeze({
  dining: Object.freeze({
    title: "Dining room | Kichen baked",
    creator: "ChristyHsu",
    sourceUrl: "https://sketchfab.com/3d-models/dining-room-kichen-baked-4831c2ce6a0044d9bee9eacefcc0f2bd",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    changes: "Converted to GLB, optimized, repositioned, and paired with simplified collision geometry by LibreZoo.",
  }),
  apartment: Object.freeze({
    title: "Appartement",
    creator: "SrMonteiro (crispimrafael)",
    sourceUrl: "https://sketchfab.com/3d-models/appartement-6a7a5fe208344b2e8123a88923dbd5b3",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    changes: "Packaged as GLB, recentered, and floor-aligned at runtime; treated as modified because the historical import pipeline is incomplete.",
  }),
  backrooms: Object.freeze({
    title: "Backrooms VR",
    creator: "carlcapu9",
    sourceUrl: "https://sketchfab.com/3d-models/backrooms-vr-d9b98eca8d064d0eafcd7f5484bb61ed",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    changes: "Packaged as GLB, rescaled, recentered, and floor-aligned at runtime; treated as modified because the historical import pipeline is incomplete.",
  }),
});

// v=2 replaces the legacy dining-room GLB with the supplied USDZ conversion.
export const DINING_ROOM_ASSET = "./assets/rooms/dining-room.glb?v=2";
export const APARTMENT_ASSET = "./assets/rooms/apartment.glb?v=1";
export const BACKROOMS_ASSET = "./assets/rooms/backrooms.glb?v=1";

function finishRoom(root, {
  THREE, scene, name, scale = 1, centerAndFloor = false, floorOffset = 0,
}) {
  if (centerAndFloor) {
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    root.scale.setScalar(scale);
    root.position.set(
      -center.x * scale,
      -bounds.min.y * scale - floorOffset,
      -center.z * scale,
    );
  }
  root.name = name;
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    node.frustumCulled = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.emissiveMap) material.emissiveIntensity = 0.32;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.35;
      material.needsUpdate = true;
    }
  });
  root.visible = false;
  scene.add(root);
  root.updateMatrixWorld(true);
  return root;
}

async function loadRoom({
  GLTFLoader, signed, THREE, scene, asset, name, scale, centerAndFloor, floorOffset,
}) {
  if (!GLTFLoader || !signed || !THREE || !scene) {
    throw new Error(`${name} requires GLTFLoader, signed, THREE, and scene`);
  }
  const gltf = await new GLTFLoader().loadAsync(signed(asset));
  return finishRoom(gltf.scene, {
    THREE, scene, name, scale, centerAndFloor, floorOffset,
  });
}

export async function loadDiningRoom({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: DINING_ROOM_ASSET,
    name: "dining-room-main-scene", scale: 1, centerAndFloor: true, floorOffset: 0,
  });
}

export async function loadApartment({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: APARTMENT_ASSET,
    name: "apartment-main-scene", scale: 1, centerAndFloor: true, floorOffset: 0.01,
  });
}

function loadProceduralRoom({ THREE, scene, name, create }) {
  if (!THREE || !scene) throw new Error(`${name} requires THREE and scene`);
  return finishRoom(create({ THREE }), { THREE, scene, name });
}

export async function loadLoft({ THREE, scene }) {
  return loadProceduralRoom({
    THREE, scene, name: "loft-main-scene", create: createLoftRoom,
  });
}

export async function loadVintageRoom({ THREE, scene }) {
  return loadProceduralRoom({
    THREE, scene, name: "vintage-room-main-scene", create: createVintageRoom,
  });
}

export async function loadBackrooms({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: BACKROOMS_ASSET,
    // Its lowest mesh is not the walking surface; snap the actual floor to
    // the simulation plane after centering the converted asset.
    name: "backrooms-main-scene", scale: 0.48, centerAndFloor: true, floorOffset: 0.4,
  });
}
