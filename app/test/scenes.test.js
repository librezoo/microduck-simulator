import test from "node:test";
import assert from "node:assert/strict";

import {
  APARTMENT_ASSET,
  BACKROOMS_ASSET,
  DEFAULT_SCENE,
  DINING_ROOM_ASSET,
  loadLoft,
  loadVintageRoom,
  SCENES,
  SCENE_IDS,
} from "../src/game/scenes.js";
import * as THREE from "three";

test("publishes every runtime-selectable scene contract", () => {
  assert.equal(DEFAULT_SCENE, "arcade");
  assert.deepEqual(SCENE_IDS, ["arcade", "dining", "apartment", "loft", "vintage", "backrooms"]);
  assert.ok(Math.abs(SCENES.arcade.spawn[0] - (-0.6)) < 1e-12);
  assert.equal(SCENES.arcade.spawn[1], 0);
  assert.equal(SCENES.arcade.arenaHalf, 1.5);
  assert.deepEqual(SCENES.dining.spawn, [0, 0]);
  assert.equal(SCENES.dining.arenaHalf, 5.2);
  assert.deepEqual(SCENES.apartment.spawn, [-0.24, -2.28]);
  assert.equal(SCENES.apartment.heading, Math.PI);
  assert.equal(SCENES.apartment.cameraDistance, 1.5);
  assert.equal(SCENES.apartment.arenaHalf, 5.8);
  assert.deepEqual(SCENES.loft.spawn, [4.2, 0.2]);
  assert.equal(SCENES.loft.heading, Math.PI);
  assert.equal(SCENES.loft.cameraDistance, 1.25);
  assert.equal(SCENES.loft.arenaHalf, 4.8);
  assert.deepEqual(SCENES.vintage.spawn, [-2.6, 0]);
  assert.equal(SCENES.vintage.heading, -Math.PI / 2);
  assert.equal(SCENES.vintage.cameraDistance, 1.25);
  assert.equal(SCENES.vintage.arenaHalf, 4.3);
  assert.deepEqual(SCENES.backrooms.spawn, [3.8, 0]);
  assert.equal(SCENES.backrooms.arenaHalf, 14.5);
});

test("every externally imported room has a cache-busted GLB asset", () => {
  for (const asset of [
    DINING_ROOM_ASSET,
    APARTMENT_ASSET,
    BACKROOMS_ASSET,
  ]) {
    assert.match(asset, /^\.\/assets\/rooms\/.+\.glb\?v=\d+$/);
  }
});

function assertOriginalProceduralRoom(root, scene, roomId, expectedName) {
  assert.equal(root.name, expectedName);
  assert.equal(root.parent, scene);
  assert.equal(root.visible, false);
  assert.equal(root.userData.roomId, roomId);
  assert.equal(root.userData.procedural, true);
  assert.deepEqual(root.userData.externalAssets, []);

  let meshCount = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    meshCount++;
    assert.ok(node.geometry, `${node.name} has geometry`);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      assert.ok(material?.isMeshStandardMaterial, `${node.name} uses a standard material`);
      assert.equal(material.map, null, `${node.name} has no image texture`);
      assert.equal(material.normalMap, null, `${node.name} has no normal texture`);
      assert.equal(material.roughnessMap, null, `${node.name} has no roughness texture`);
      assert.equal(material.metalnessMap, null, `${node.name} has no metalness texture`);
      assert.equal(material.emissiveMap, null, `${node.name} has no emissive texture`);
    }
  });
  assert.ok(meshCount >= 20, `${roomId} has enough architectural detail`);
  assert.ok(meshCount <= 32, `${roomId} remains lightweight for mobile rendering`);

  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.y <= 0, `${roomId} floor reaches the simulation plane`);
  assert.ok(bounds.max.y >= 3, `${roomId} has room-scale architecture`);
}

test("loft is an original texture-free procedural room", async () => {
  const scene = new THREE.Scene();
  const root = await loadLoft({ THREE, scene });
  assertOriginalProceduralRoom(root, scene, "loft", "loft-main-scene");
});

test("vintage is an original texture-free procedural room", async () => {
  const scene = new THREE.Scene();
  const root = await loadVintageRoom({ THREE, scene });
  assertOriginalProceduralRoom(root, scene, "vintage", "vintage-room-main-scene");
});
