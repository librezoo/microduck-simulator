// The studio manifest is what a creature's model tool emits next to its
// geometry (app/public/robot/<dir>/studio.json, written by
// tools/build_robot_model.py for Duck). It says which solids are printed
// parts, how they are grouped and named in both languages, their default
// colours, the print order and the ready-made colourways. This module checks
// it and fills the optional blocks; nothing in it knows a creature.
//
// Schema "librezoo.studio/1": see docs/adding-a-creature.md.

export const STUDIO_SCHEMA = "librezoo.studio/1";

const HEX = /^#[0-9a-f]{6}$/i;

export class StudioManifestError extends Error {
  constructor(message) {
    super(`Invalid studio manifest: ${message}`);
    this.name = "StudioManifestError";
  }
}

const fail = (message) => {
  throw new StudioManifestError(message);
};

const isRecord = (value) => value != null && typeof value === "object" && !Array.isArray(value);

function text(value, where) {
  if (typeof value !== "string" || !value.trim()) fail(`${where} must be a non-empty string`);
  return value;
}

function localized(value, where) {
  if (!isRecord(value)) fail(`${where} must be { en, zh }`);
  return { en: text(value.en, `${where}.en`), zh: text(value.zh, `${where}.zh`) };
}

function hex(value, where) {
  if (typeof value !== "string" || !HEX.test(value)) fail(`${where} must be a #RRGGBB colour`);
  return value.toUpperCase();
}

function vec3(value, where) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n))) {
    fail(`${where} must be three numbers`);
  }
  return value.map(Number);
}

function material(value, where) {
  if (!isRecord(value)) fail(`${where} must be a material`);
  return {
    color: hex(value.color, `${where}.color`),
    roughness: Number.isFinite(value.roughness) ? value.roughness : 0.5,
    metalness: Number.isFinite(value.metalness) ? value.metalness : 0,
  };
}

const targetKey = (target) => `${target.body}::${target.mesh}::${target.occurrence}`;

export function parseStudioManifest(raw) {
  if (!isRecord(raw)) fail("not an object");
  if (raw.schema !== STUDIO_SCHEMA) fail(`schema must be "${STUDIO_SCHEMA}" (got ${JSON.stringify(raw.schema)})`);
  const creature = text(raw.creature, "creature");

  if (!Array.isArray(raw.groups) || !raw.groups.length) fail("groups must be a non-empty array");
  const seenIds = new Set();
  const seenTargets = new Set();
  const groups = raw.groups.map((group, gi) => {
    if (!isRecord(group)) fail(`groups[${gi}] must be an object`);
    const gid = text(group.id, `groups[${gi}].id`);
    if (!Array.isArray(group.parts) || !group.parts.length) fail(`group ${gid} has no parts`);
    const parts = group.parts.map((part, pi) => {
      const where = `groups[${gi}].parts[${pi}]`;
      if (!isRecord(part)) fail(`${where} must be an object`);
      const id = text(part.id, `${where}.id`);
      if (seenIds.has(id)) fail(`duplicate part id "${id}"`);
      seenIds.add(id);
      if (!Array.isArray(part.targets) || !part.targets.length) fail(`part ${id} needs at least one target`);
      const targets = part.targets.map((target, ti) => {
        const t = {
          body: text(target?.body, `${where}.targets[${ti}].body`),
          mesh: text(target?.mesh, `${where}.targets[${ti}].mesh`),
          occurrence: target?.occurrence ?? 1,
        };
        if (!Number.isInteger(t.occurrence) || t.occurrence < 1) fail(`part ${id}: occurrence must be an integer >= 1`);
        if (seenTargets.has(targetKey(t))) fail(`mesh instance ${targetKey(t)} belongs to two parts`);
        seenTargets.add(targetKey(t));
        return t;
      });
      return { id, label: localized(part.label, `${where}.label`), color: hex(part.color, `${where}.color`), targets };
    });
    return { id: gid, label: localized(group.label, `groups[${gi}].label`), parts };
  });

  const allIds = groups.flatMap((group) => group.parts.map((part) => part.id));
  const defaults = Object.fromEntries(groups.flatMap((group) => group.parts.map((part) => [part.id, part.color])));

  let printOrder = allIds;
  if (raw.printOrder != null) {
    if (!Array.isArray(raw.printOrder) || raw.printOrder.length !== allIds.length
      || new Set(raw.printOrder).size !== allIds.length || raw.printOrder.some((id) => !seenIds.has(id))) {
      fail("printOrder must list every part id exactly once");
    }
    printOrder = [...raw.printOrder];
  }

  const colorways = (raw.colorways ?? []).map((way, wi) => {
    const where = `colorways[${wi}]`;
    if (!isRecord(way)) fail(`${where} must be an object`);
    const colors = { ...defaults };
    for (const [id, value] of Object.entries(way.colors ?? {})) {
      if (!seenIds.has(id)) fail(`${where} colours unknown part "${id}"`);
      colors[id] = hex(value, `${where}.colors.${id}`);
    }
    const stripe = Array.isArray(way.stripe) ? way.stripe.map((value, si) => hex(value, `${where}.stripe[${si}]`)) : [];
    return { id: text(way.id, `${where}.id`), name: localized(way.name, `${where}.name`), stripe, colors };
  });
  if (new Set(colorways.map((way) => way.id)).size !== colorways.length) fail("duplicate colourway id");

  const model = isRecord(raw.model) ? raw.model : {};
  const exportBlock = isRecord(raw.export) ? raw.export : {};
  const view = isRecord(raw.view) ? raw.view : {};
  const hardware = isRecord(raw.hardware) ? raw.hardware : {};

  return {
    schema: STUDIO_SCHEMA,
    creature,
    model: {
      kinematics: text(model.kinematics ?? "kinematics.json", "model.kinematics"),
      glb: text(model.glb, "model.glb"),
    },
    export: {
      filePrefix: text(exportBlock.filePrefix ?? creature, "export.filePrefix"),
      zipPrefix: text(exportBlock.zipPrefix ?? creature, "export.zipPrefix"),
      title: text(exportBlock.title ?? `${creature} custom colorway`, "export.title"),
      description: text(exportBlock.description ?? `Full ${creature} assembly with per-part colors`, "export.description"),
    },
    view: {
      fov: Number.isFinite(view.fov) ? view.fov : 34,
      camera: vec3(view.camera ?? [0.5, 0.31, 0.52], "view.camera"),
      target: vec3(view.target ?? [0, 0.13, 0], "view.target"),
      yaw: Number.isFinite(view.yaw) ? view.yaw : 0,
    },
    pose: isRecord(raw.pose) ? Object.fromEntries(Object.entries(raw.pose).map(([joint, angle]) => {
      if (!Number.isFinite(angle)) fail(`pose.${joint} must be a number`);
      return [joint, angle];
    })) : {},
    hardware: {
      default: material(hardware.default ?? { color: "#8B8B90", roughness: 0.5, metalness: 0.3 }, "hardware.default"),
      meshes: Object.fromEntries(Object.entries(hardware.meshes ?? {}).map(([mesh, spec]) => [mesh, material(spec, `hardware.meshes.${mesh}`)])),
    },
    groups,
    printOrder,
    colorways,
  };
}
