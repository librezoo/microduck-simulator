// Bounded ownership for lazily loaded room visuals. Imported GLBs can retain
// tens of megabytes of vertex buffers and textures, so keeping every visited
// room alive is especially costly in a WKWebView. The cache keeps the active
// room plus a small number of recently used inactive rooms and disposes the
// GPU resources owned by older roots.

function materialTextures(material) {
  const textures = new Set();
  for (const value of Object.values(material ?? {})) {
    if (value?.isTexture) textures.add(value);
  }
  for (const uniform of Object.values(material?.uniforms ?? {})) {
    const value = uniform?.value;
    if (value?.isTexture) textures.add(value);
    if (Array.isArray(value)) {
      for (const item of value) if (item?.isTexture) textures.add(item);
    }
  }
  return textures;
}

export function disposeRoomRoot(root) {
  if (!root || root.userData?.roomDisposed) return;

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse?.((node) => {
    if (node.geometry?.dispose) geometries.add(node.geometry);
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of nodeMaterials) {
      if (!material?.dispose) continue;
      materials.add(material);
      for (const texture of materialTextures(material)) textures.add(texture);
    }
  });

  root.removeFromParent?.();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  root.clear?.();
  root.userData = { ...root.userData, roomDisposed: true };
}

export function createRoomVisualCache({ loadRoom, maxInactive = 1, dispose = disposeRoomRoot }) {
  if (typeof loadRoom !== "function") throw new TypeError("loadRoom must be a function");
  if (!Number.isInteger(maxInactive) || maxInactive < 0) {
    throw new RangeError("maxInactive must be a non-negative integer");
  }

  const roots = new Map();
  const pending = new Map();
  const lastUsed = new Map();
  let clock = 0;
  let destroyed = false;

  const touch = (sceneId) => lastUsed.set(sceneId, ++clock);

  function evict(sceneId) {
    // Deleting a pending token cannot abort GLTFLoader's fetch, but it makes a
    // late result stale. The completion path disposes that root immediately
    // instead of publishing an orphan into the scene.
    pending.delete(sceneId);
    lastUsed.delete(sceneId);
    const root = roots.get(sceneId);
    roots.delete(sceneId);
    if (root) dispose(root);
  }

  async function ensure(sceneId) {
    if (destroyed) return null;
    const resident = roots.get(sceneId);
    if (resident) {
      touch(sceneId);
      return resident;
    }
    if (pending.has(sceneId)) return pending.get(sceneId).promise;

    const token = {};
    const promise = Promise.resolve()
      .then(() => loadRoom(sceneId))
      .then((root) => {
        const current = pending.get(sceneId);
        if (destroyed || current?.token !== token) {
          if (root) dispose(root);
          return null;
        }
        pending.delete(sceneId);
        if (root) {
          roots.set(sceneId, root);
          touch(sceneId);
        }
        return root;
      })
      .catch((error) => {
        if (pending.get(sceneId)?.token === token) pending.delete(sceneId);
        throw error;
      });
    pending.set(sceneId, { token, promise });
    return promise;
  }

  function activate(sceneId) {
    if (destroyed) return;
    if (roots.has(sceneId)) touch(sceneId);
    for (const [id, root] of roots) root.visible = id === sceneId;

    const inactive = [...roots.keys()]
      .filter((id) => id !== sceneId)
      .sort((a, b) => (lastUsed.get(b) ?? 0) - (lastUsed.get(a) ?? 0));
    for (const id of inactive.slice(maxInactive)) evict(id);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    pending.clear();
    for (const root of roots.values()) dispose(root);
    roots.clear();
    lastUsed.clear();
  }

  return {
    ensure,
    activate,
    evict,
    destroy,
    get: (sceneId) => roots.get(sceneId) ?? null,
    entries: () => [...roots.entries()],
    pendingCount: () => pending.size,
    residentIds: () => [...roots.keys()],
  };
}
