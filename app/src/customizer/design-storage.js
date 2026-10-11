// The design the Studio saves and the simulator reads (?design=custom).
// They share an origin on the studio host, which is what lets "Run design"
// hand the palette over through localStorage.
export const STUDIO_DESIGN_KEY = "librezoo.color-studio.v2";

// Duck's design keeps the key it has always had, so designs saved before the
// Studio knew other creatures still load and the simulator reads the same key.
// Every other creature saves under its own.
export const studioDesignKey = (creatureId = "duck") => (
  creatureId === "duck" ? STUDIO_DESIGN_KEY : `${STUDIO_DESIGN_KEY}.${creatureId}`
);

const validHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

// localStorage can be absent, full or blocked (private windows, embedded
// frames); a design that cannot be saved must never break the Studio.
const storage = () => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function saveStudioDesign({ colors, meshColors }, creatureId = "duck") {
  const store = storage();
  if (!store) return null;
  const design = {
    version: 2,
    savedAt: new Date().toISOString(),
    colors: Object.fromEntries(Object.entries(colors).filter(([, value]) => validHex(value))),
    meshColors: Object.fromEntries(Object.entries(meshColors).filter(([, value]) => validHex(value))),
  };
  try {
    store.setItem(studioDesignKey(creatureId), JSON.stringify(design));
  } catch {
    return null;
  }
  return design;
}

export function readStudioDesign(creatureId = "duck") {
  const store = storage();
  if (!store) return null;
  try {
    const design = JSON.parse(store.getItem(studioDesignKey(creatureId)));
    if (design?.version !== 2 || !design.meshColors || typeof design.meshColors !== "object") return null;
    const meshColors = Object.fromEntries(Object.entries(design.meshColors).filter(([, value]) => validHex(value)));
    if (!Object.keys(meshColors).length) return null;
    return { ...design, meshColors };
  } catch {
    return null;
  }
}
