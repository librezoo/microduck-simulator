import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { createRoomVisualCache, disposeRoomRoot } from "../src/game/room-cache.js";

function room(name, counters) {
  const root = new THREE.Group();
  root.name = name;
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const originalTextureDispose = texture.dispose.bind(texture);
  const originalMaterialDispose = material.dispose.bind(material);
  const originalGeometryDispose = geometry.dispose.bind(geometry);
  texture.dispose = () => { counters.textures++; originalTextureDispose(); };
  material.dispose = () => { counters.materials++; originalMaterialDispose(); };
  geometry.dispose = () => { counters.geometries++; originalGeometryDispose(); };
  root.add(new THREE.Mesh(geometry, material));
  new THREE.Scene().add(root);
  return root;
}

test("room cache keeps the active visual plus one recent inactive room", async () => {
  const counters = { textures: 0, materials: 0, geometries: 0 };
  const cache = createRoomVisualCache({
    loadRoom: async (sceneId) => room(sceneId, counters),
    maxInactive: 1,
  });

  await cache.ensure("dining");
  cache.activate("dining");
  await cache.ensure("apartment");
  cache.activate("apartment");
  assert.deepEqual(cache.residentIds(), ["dining", "apartment"]);

  await cache.ensure("backrooms");
  cache.activate("backrooms");
  assert.deepEqual(cache.residentIds(), ["apartment", "backrooms"]);
  assert.deepEqual(counters, { textures: 1, materials: 1, geometries: 1 });

  cache.activate("arcade");
  assert.deepEqual(cache.residentIds(), ["backrooms"]);
  assert.deepEqual(counters, { textures: 2, materials: 2, geometries: 2 });
  cache.destroy();
  assert.deepEqual(counters, { textures: 3, materials: 3, geometries: 3 });
});

test("disposeRoomRoot disposes shared GPU resources exactly once", () => {
  const counters = { textures: 0, materials: 0, geometries: 0 };
  const root = room("shared", counters);
  const first = root.children[0];
  root.add(new THREE.Mesh(first.geometry, first.material));

  disposeRoomRoot(root);
  disposeRoomRoot(root);
  assert.equal(root.parent, null);
  assert.equal(root.children.length, 0);
  assert.equal(root.userData.roomDisposed, true);
  assert.deepEqual(counters, { textures: 1, materials: 1, geometries: 1 });
});

test("a room resolving after cache destruction is disposed and never published", async () => {
  const counters = { textures: 0, materials: 0, geometries: 0 };
  let resolveRoom;
  const cache = createRoomVisualCache({
    loadRoom: () => new Promise((resolve) => { resolveRoom = resolve; }),
  });

  const loading = cache.ensure("dining");
  await Promise.resolve();
  assert.equal(cache.pendingCount(), 1);
  cache.destroy();
  resolveRoom(room("late", counters));

  assert.equal(await loading, null);
  assert.deepEqual(cache.residentIds(), []);
  assert.deepEqual(counters, { textures: 1, materials: 1, geometries: 1 });
});
