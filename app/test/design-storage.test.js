import assert from "node:assert/strict";
import test from "node:test";
import { readStudioDesign, saveStudioDesign, STUDIO_DESIGN_KEY, studioDesignKey } from "../src/customizer/design-storage.js";
import { creatureFromSearch, creatureModelUrls, getCreature } from "../src/creatures/index.js";
import { duckStudio } from "./helpers/duck-studio.js";

function withStorage(store, run) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: store });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
}

const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), map };
};

const design = () => {
  const studio = duckStudio();
  const colors = { ...studio.defaultColors, head: "#FF7A2F" };
  return { colors, meshColors: studio.colorOverridesForParts(colors) };
};

test("Duck keeps its storage key; other creatures get their own", () => {
  assert.equal(studioDesignKey("duck"), STUDIO_DESIGN_KEY);
  assert.equal(studioDesignKey(), STUDIO_DESIGN_KEY);
  assert.equal(studioDesignKey("heron"), `${STUDIO_DESIGN_KEY}.heron`);
});

test("a design round-trips per creature", () => {
  const store = memory();
  withStorage(() => store, () => {
    const saved = saveStudioDesign(design());
    assert.equal(saved.version, 2);
    assert.ok(store.map.has(STUDIO_DESIGN_KEY));
    assert.equal(readStudioDesign().colors.head, "#FF7A2F");
    assert.equal(readStudioDesign("heron"), null, "another creature has its own design");
    saveStudioDesign(design(), "heron");
    assert.ok(store.map.has(`${STUDIO_DESIGN_KEY}.heron`));
  });
});

test("blocked or full storage never breaks the Studio", () => {
  withStorage(() => { throw new Error("SecurityError"); }, () => {
    assert.equal(saveStudioDesign(design()), null);
    assert.equal(readStudioDesign(), null);
  });
  withStorage(() => ({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } }), () => {
    assert.equal(saveStudioDesign(design()), null);
  });
  withStorage(() => ({ getItem: () => "{not json", setItem() {} }), () => {
    assert.equal(readStudioDesign(), null);
  });
});

test("only valid colours are stored", () => {
  const store = memory();
  withStorage(() => store, () => {
    const saved = saveStudioDesign({ colors: { head: "#FF7A2F", eye: "nope" }, meshColors: { a: "#000000", b: "x" } });
    assert.deepEqual(saved.colors, { head: "#FF7A2F" });
    assert.deepEqual(saved.meshColors, { a: "#000000" });
  });
});

test("model URLs come from the registry entry and the manifest", () => {
  const manifest = duckStudio().manifest;
  const urls = creatureModelUrls(getCreature("duck"), manifest);
  assert.deepEqual(urls, { kinematics: "./robot/librezoo/kinematics.json", glb: "./robot/librezoo/microduck.glb" });
  const other = creatureModelUrls({ modelDir: "./robot/heron/" }, { model: { kinematics: "k.json", glb: "./h.glb" } });
  assert.deepEqual(other, { kinematics: "./robot/heron/k.json", glb: "./robot/heron/h.glb" });
});

test("?creature= accepts the default and reports what it does not know", () => {
  assert.equal(creatureFromSearch("?studio=1").id, "duck");
  assert.equal(creatureFromSearch("?creature=DUCK").known, true);
  assert.equal(creatureFromSearch("?creature=heron").known, false);
});
