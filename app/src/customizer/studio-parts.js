import { meshInstanceKey } from "../game/mesh-selector.js";

// Lookup tables derived from a parsed studio manifest (see
// studio-manifest.js). Everything the Studio, the 3MF export and the tests
// need to know about a creature's printed parts comes through here.
//
//   groups       [{ id, label, parts: [{ id, label, color, targets, groupId }] }]
//   parts        every part in group order
//   partById     id -> part
//   printMeshOrder  mesh-instance selectors in print order: the absolute
//                   numbers of the exported files follow it
//   defaultColors   id -> #RRGGBB
//   colorways    ready-made colour maps (complete: every part id)
export function createStudioParts(manifest) {
  const groups = manifest.groups.map((group) => ({
    ...group,
    parts: group.parts.map((part) => ({ ...part, groupId: group.id })),
  }));
  const parts = groups.flatMap((group) => group.parts);
  const partById = Object.fromEntries(parts.map((part) => [part.id, part]));
  const partByTarget = new Map(parts.flatMap((part) => (
    part.targets.map(({ mesh, body, occurrence }) => [meshInstanceKey(mesh, body, occurrence), part])
  )));
  const selectorsOf = (part) => part.targets.map(({ mesh, body, occurrence }) => meshInstanceKey(mesh, body, occurrence));
  const printMeshOrder = manifest.printOrder.flatMap((id) => selectorsOf(partById[id]));
  const defaultColors = Object.fromEntries(parts.map((part) => [part.id, part.color]));

  return {
    manifest,
    creature: manifest.creature,
    groups,
    parts,
    partById,
    partByTarget,
    printMeshOrder,
    defaultColors,
    colorways: manifest.colorways,

    partForMeshInstance(meshName, bodyName, occurrence) {
      return partByTarget.get(meshInstanceKey(meshName, bodyName, occurrence)) ?? null;
    },

    // mesh-instance selector -> hex, the shape the simulator's design handoff
    // (design-storage / variants.materialMapForHexOverrides) reads.
    colorOverridesForParts(colors) {
      return Object.fromEntries(parts.flatMap((part) => (
        selectorsOf(part).map((selector) => [selector, colors[part.id]])
      )));
    },

    // A colour map that is complete and valid: unknown ids dropped, missing or
    // malformed values fall back to the part default.
    normalizeColors(colors) {
      return Object.fromEntries(parts.map((part) => {
        const value = colors?.[part.id];
        return [part.id, typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : part.color];
      }));
    },
  };
}
