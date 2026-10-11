import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { DEFAULT_POSE, JOINT_NAMES } from "../src/game/constants.js";
import { parseStudioManifest, StudioManifestError } from "../src/customizer/studio-manifest.js";
import { createStudioParts } from "../src/customizer/studio-parts.js";
import { createThreeMfBundle } from "../src/customizer/three-mf.js";
import { duckKinematics, duckLegacy, duckManifestRaw, duckStudio } from "./helpers/duck-studio.js";

const legacy = duckLegacy();

test("the manifest reproduces what the hard-coded studio-parts.js produced", () => {
  const studio = duckStudio();
  assert.equal(studio.parts.length, 32);
  assert.deepEqual(
    studio.groups.map((group) => [group.label.en, group.parts.map((part) => [part.id, part.label.en, part.color, part.targets])]),
    legacy.groups.map((group) => [group.label, group.parts.map((part) => [part.id, part.label, part.color, part.targets])]),
  );
  assert.deepEqual(studio.printMeshOrder, legacy.printMeshOrder);
  assert.equal(new Set(studio.parts.map((part) => part.id)).size, 32);
});

test("the four colourways keep their names, chips and colours", () => {
  const studio = duckStudio();
  assert.deepEqual(studio.colorways.map((way) => way.id), legacy.colorways.map((way) => way.id));
  assert.deepEqual(studio.colorways.map((way) => way.name.en), ["Creamsicle", "After hours", "Ultraviolet", "Poolside"]);
  for (const [index, old] of legacy.colorways.entries()) {
    const way = studio.colorways[index];
    assert.deepEqual(way.stripe, old.stripe);
    // The old maps carried a stale key, "jaw", left over from the model the
    // Studio was first written for; it named no part, so the colourway never
    // reached the head base plate. It is the head base plate now.
    const expected = Object.fromEntries(Object.entries(old.colors).map(([id, color]) => [id === "jaw" ? "headBase" : id, color.toUpperCase()]));
    assert.deepEqual(way.colors, expected, `${way.id} colours`);
    // every colourway is a complete map
    assert.deepEqual(Object.keys(way.colors).sort(), studio.parts.map((part) => part.id).sort());
  }
  assert.equal(studio.colorways[1].colors.headBase, "#FFD23F");
});

test("the manifest names the files it depends on, and they exist", () => {
  const manifest = duckStudio().manifest;
  for (const file of [manifest.model.kinematics, manifest.model.glb]) {
    assert.ok(existsSync(new URL(`../public/robot/librezoo/${file}`, import.meta.url)), `${file} is next to studio.json`);
  }
  assert.equal(manifest.creature, "duck");
});

test("the display pose is the stand keyframe the simulator uses", () => {
  const { pose } = duckStudio().manifest;
  assert.deepEqual(Object.keys(pose), JOINT_NAMES);
  JOINT_NAMES.forEach((name, index) => assert.ok(Math.abs(pose[name] - DEFAULT_POSE[index]) < 1e-6, name));
});

test("every mesh in the model is a printed part or classified hardware", () => {
  const { manifest, partByTarget } = duckStudio();
  const meshes = new Set();
  for (const body of duckKinematics().bodies) for (const geom of body.geoms ?? []) if (geom.mesh) meshes.add(geom.mesh);
  const printed = new Set([...partByTarget.keys()].map((key) => key.split("::")[1]));
  for (const mesh of Object.keys(manifest.hardware.meshes)) {
    assert.ok(meshes.has(mesh), `hardware mesh ${mesh} is in the model`);
    assert.equal(printed.has(mesh), false, `${mesh} is either printed or hardware`);
  }
  const loose = [...meshes].filter((mesh) => !printed.has(mesh) && !(mesh in manifest.hardware.meshes));
  assert.deepEqual(loose, [], "every other mesh falls back to the hardware default");
});

test("labels exist in both languages", () => {
  const { groups, colorways } = duckStudio();
  const labels = [...groups.map((g) => g.label), ...groups.flatMap((g) => g.parts.map((p) => p.label)), ...colorways.map((w) => w.name)];
  for (const label of labels) {
    assert.ok(label.en.length > 0 && label.zh.length > 0, JSON.stringify(label));
  }
  // Chinese part names are Chinese, not a copy of the English
  for (const part of groups.flatMap((g) => g.parts)) assert.notEqual(part.label.zh, part.label.en, part.id);
});

// A synthetic assembly: one box per target, in manifest order.
function syntheticRoot(studio, colors) {
  const root = new THREE.Group();
  let i = 0;
  for (const group of studio.groups) {
    for (const part of group.parts) {
      for (const target of part.targets) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.01 + i * 0.0003, 0.012, 0.014),
          new THREE.MeshStandardMaterial({ color: colors[part.id] }),
        );
        mesh.position.set(i * 0.02, 0, 0);
        mesh.userData.meshName = target.mesh;
        mesh.userData.bodyName = target.body;
        mesh.userData.meshOccurrence = target.occurrence;
        mesh.userData.partLabel = part.label.en;
        root.add(mesh);
        i += 1;
      }
    }
  }
  return root;
}

test("export bundle is byte-for-byte what it was before the manifest", () => {
  const studio = duckStudio();
  const golden = legacy.exportGolden;
  const colors = { ...studio.defaultColors, ...golden.colors };
  const { export: info } = studio.manifest;
  const bundle = createThreeMfBundle({
    root: syntheticRoot(studio, colors),
    selectedPart: golden.selectedPart,
    meshOrder: studio.printMeshOrder,
    filePrefix: info.filePrefix,
    title: info.title,
    description: info.description,
  });
  assert.equal(bundle.partCount, golden.partCount);
  assert.equal(bundle.colorCount, golden.colorCount);
  assert.equal(bundle.bytes.length, golden.bytes);
  assert.equal(createHash("sha256").update(bundle.bytes).digest("hex"), golden.sha256);
  // and the defaults of the exporter are Duck's, so callers that pass nothing get the same bytes
  const bare = createThreeMfBundle({ root: syntheticRoot(studio, colors), selectedPart: golden.selectedPart, meshOrder: studio.printMeshOrder });
  assert.equal(createHash("sha256").update(bare.bytes).digest("hex"), golden.sha256);
});

test("another creature labels its own export", () => {
  const studio = duckStudio();
  const bundle = createThreeMfBundle({
    root: syntheticRoot(studio, studio.defaultColors),
    meshOrder: studio.printMeshOrder,
    filePrefix: "heron",
    title: "Heron custom colorway",
    description: "Full Heron assembly with per-part colors",
  });
  const text = Buffer.from(bundle.bytes).toString("latin1");
  assert.match(text, /heron-complete\.3mf/);
  assert.match(text, /heron-01-\d{5}\.3mf/);
  assert.doesNotMatch(text, /duck-complete/);
  assert.match(text, /Heron custom colorway/);
  assert.match(text, /Designer">LibreZoo Studio/);
});

test("colour maps are normalised against the manifest", () => {
  const studio = duckStudio();
  const normalized = studio.normalizeColors({ head: "#abcdef", eye: "red", unknown: "#000000" });
  assert.equal(normalized.head, "#ABCDEF");
  assert.equal(normalized.eye, studio.defaultColors.eye);
  assert.equal("unknown" in normalized, false);
  assert.equal(Object.keys(normalized).length, 32);
});

const minimal = () => ({
  schema: "librezoo.studio/1",
  creature: "heron",
  model: { glb: "heron.glb" },
  groups: [
    { id: "g", label: { en: "Body", zh: "身体" }, parts: [
      { id: "a", label: { en: "A", zh: "甲" }, color: "#ffffff", targets: [{ body: "b", mesh: "a.stl" }] },
      { id: "b", label: { en: "B", zh: "乙" }, color: "#000000", targets: [{ body: "b", mesh: "b.stl", occurrence: 2 }] },
    ] },
  ],
});

test("a minimal manifest is a complete creature", () => {
  const studio = createStudioParts(parseStudioManifest(minimal()));
  assert.equal(studio.parts.length, 2);
  assert.deepEqual(studio.printMeshOrder, ["b::a.stl::1", "b::b.stl::2"]);
  assert.equal(studio.manifest.model.kinematics, "kinematics.json");
  assert.equal(studio.manifest.export.filePrefix, "heron");
  assert.equal(studio.defaultColors.a, "#FFFFFF");
  assert.deepEqual(studio.colorways, []);
});

test("a broken manifest is refused with a reason", () => {
  const broken = (mutate, pattern) => {
    const raw = minimal();
    mutate(raw);
    assert.throws(() => parseStudioManifest(raw), (error) => error instanceof StudioManifestError && pattern.test(error.message));
  };
  broken((m) => { m.schema = "other/9"; }, /schema/);
  broken((m) => { m.groups[0].parts[1].id = "a"; }, /duplicate part id/);
  broken((m) => { m.groups[0].parts[0].color = "orange"; }, /#RRGGBB/);
  broken((m) => { m.groups[0].parts[0].label = { en: "A" }; }, /label\.zh/);
  broken((m) => { m.groups[0].parts[0].targets = []; }, /at least one target/);
  broken((m) => { m.groups[0].parts[1].targets = [{ body: "b", mesh: "a.stl" }]; }, /belongs to two parts/);
  broken((m) => { m.groups[0].parts[0].targets[0].occurrence = 0; }, /occurrence/);
  broken((m) => { m.printOrder = ["a"]; }, /printOrder/);
  broken((m) => { m.model = {}; }, /model\.glb/);
  broken((m) => { m.colorways = [{ id: "x", name: { en: "X", zh: "叉" }, colors: { nope: "#ffffff" } }]; }, /unknown part/);
  assert.throws(() => parseStudioManifest(null), StudioManifestError);
});

test("an explicit printOrder reorders the numbering without regrouping", () => {
  const raw = minimal();
  raw.printOrder = ["b", "a"];
  const studio = createStudioParts(parseStudioManifest(raw));
  assert.deepEqual(studio.printMeshOrder, ["b::b.stl::2", "b::a.stl::1"]);
  assert.deepEqual(studio.parts.map((part) => part.id), ["a", "b"]);
});

test("the committed manifest passes the parser unchanged in meaning", () => {
  const raw = duckManifestRaw();
  const parsed = parseStudioManifest(raw);
  assert.equal(parsed.groups.length, raw.groups.length);
  assert.deepEqual(parsed.printOrder, raw.printOrder);
});
