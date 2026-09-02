import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import { ARCADE_D } from "../src/game/constants.js";
import {
  PROPS_ENABLED,
  PROP_DEFS,
  createArcadeCabinet,
  createSkateboard,
  loadProps,
  propColliders,
} from "../src/game/props.js";

const EPSILON = 2e-5;

function assertVectorNear(actual, expected, label) {
  for (const axis of ["x", "y", "z"]) {
    assert.ok(
      Math.abs(actual[axis] - expected[axis]) <= EPSILON,
      `${label}.${axis}: expected ${expected[axis]}, received ${actual[axis]}`,
    );
  }
}

function floorSnappedVisualBounds(def) {
  const bounds = new THREE.Box3().setFromObject(def.create(THREE));
  bounds.max.y -= bounds.min.y;
  bounds.min.y = 0;
  return bounds;
}

// Convert one world-space MuJoCo box back into the prop's local Three.js
// coordinates. MuJoCo is Z-up and its local Y axis is -Three.js local Z.
function localColliderBounds(def, collider) {
  const yaw = def.rotation?.[1] ?? 0;
  const dx = collider.pos[0] - def.position[0];
  const dy = collider.pos[1] + def.position[1];
  const localMjX = Math.cos(yaw) * dx + Math.sin(yaw) * dy;
  const localMjY = -Math.sin(yaw) * dx + Math.cos(yaw) * dy;
  const center = new THREE.Vector3(localMjX, collider.pos[2], -localMjY);
  const half = new THREE.Vector3(collider.size[0], collider.size[2], collider.size[1]);
  return new THREE.Box3(center.clone().sub(half), center.clone().add(half));
}

test("procedural arcade and skateboard preserve real-world scale", () => {
  const arcadeBox = new THREE.Box3().setFromObject(createArcadeCabinet(THREE));
  const boardBox = new THREE.Box3().setFromObject(createSkateboard(THREE));
  const arcadeSize = arcadeBox.getSize(new THREE.Vector3());
  const boardSize = boardBox.getSize(new THREE.Vector3());

  assert.ok(Math.abs(arcadeSize.y - 0.7) < 1e-5);
  assert.ok(Math.abs(arcadeSize.x - 0.3668) < 1e-5);
  assert.ok(Math.abs(arcadeSize.z - 0.4882051743) < 1e-5);
  assert.ok(Math.abs(arcadeBox.max.z - ARCADE_D / 2 - 0.0768851743) < 1e-5);
  assert.ok(Math.abs(boardSize.x - 0.79) < 1e-5);
  assert.ok(Math.abs(boardSize.y - 0.122) < 1e-5);
  assert.ok(Math.abs(boardSize.z - 0.248) < 1e-5);
});

test("enabled procedural props have colliders matching their visible bounds", () => {
  assert.equal(PROPS_ENABLED, true);
  assert.deepEqual(PROP_DEFS.map(({ id, enabled }) => [id, enabled]), [
    ["arcade", true],
    ["skateboard", true],
  ]);
  assert.deepEqual(propColliders().map(({ name }) => name), [
    "prop_arcade",
    "prop_skateboard",
  ]);

  for (const def of PROP_DEFS) {
    assert.ok(!Array.isArray(def.collider), `${def.id} uses one visible-bounds box`);
    const visual = floorSnappedVisualBounds(def);
    const collider = localColliderBounds(def, def.collider);
    assertVectorNear(collider.min, visual.min, `${def.id} collider min`);
    assertVectorNear(collider.max, visual.max, `${def.id} collider max`);
  }
});

test("skateboard tail mark lies flat on the deck surface", () => {
  const board = createSkateboard(THREE);
  const deckBounds = new THREE.Box3().setFromObject(board.getObjectByName("skateboard-deck"));
  const mark = board.getObjectByName("skateboard-tail-mark");
  const markBounds = new THREE.Box3().setFromObject(mark);
  const markSize = markBounds.getSize(new THREE.Vector3());

  assert.equal(mark.rotation.x, 0);
  assert.ok(Math.abs(markBounds.min.y - deckBounds.max.y) < 1e-5);
  assert.ok(Math.abs(markSize.x - 0.05) < 1e-5);
  assert.ok(Math.abs(markSize.y - 0.007) < 1e-5);
  assert.ok(Math.abs(markSize.z - 0.05) < 1e-5);
});

test("prop loading constructs primitives and registers entrance FX", async () => {
  const scene = new THREE.Scene();
  const registrations = [];
  let fxCount = 0;
  const groups = await loadProps({
    THREE,
    scene,
    camera: new THREE.PerspectiveCamera(),
    renderer: {},
    fx: {
      createWireframeFx() {
        fxCount++;
        return { init(args) { assert.equal(args.hidden, true); } };
      },
    },
    ceremony: {
      addPropFx(_effect, delay) { registrations.push(delay); },
    },
  });

  assert.deepEqual(Object.keys(groups), ["arcade", "skateboard"]);
  assert.equal(scene.children.length, 2);
  assert.equal(fxCount, 2);
  assert.deepEqual(registrations, [0.85, 0.25]);
});

test("prop implementation has no model-loader or asset dependency", async () => {
  const source = await readFile(new URL("../src/game/props.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /assets\/props\//);
  assert.doesNotMatch(source, /GLTFLoader/);
  assert.doesNotMatch(source, /\.glb/);
});
