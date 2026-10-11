// Creature registry of the browser tools (simulator + LibreZoo Studio).
//
// LibreZoo is a collection of small robot creatures; Duck is the first entry,
// not the product. A creature appears in the Studio when it has an entry here
// and its model directory carries a generated studio.json (see
// docs/adding-a-creature.md). Nothing else in the Studio names a creature.
//
//   id             url-safe id: ?creature=<id>, /<id>/sim/, design storage key
//   name           display name, English and Chinese (the Chinese UI shows both
//                  scripts of the brand, creature names are free to be Latin)
//   modelDir       directory of the generated model, relative to the page
//   studioManifest URL of the generated studio manifest
//   credit         optional lineage line, shown quietly wherever the creature
//                  is presented (Duck improves on Pollen Robotics' Microduck)
export const CREATURES = Object.freeze([
  Object.freeze({
    id: "duck",
    name: Object.freeze({ en: "Duck", zh: "Duck" }),
    modelDir: "./robot/librezoo",
    studioManifest: "./robot/librezoo/studio.json",
    credit: Object.freeze({
      url: "https://github.com/pollen-robotics/microduck",
      text: Object.freeze({
        en: "Improves on the Apache-2.0 Microduck by Pollen Robotics.",
        zh: "在 Pollen Robotics 的 Apache-2.0 开源项目 Microduck 基础上改进。",
      }),
    }),
  }),
]);

export const DEFAULT_CREATURE_ID = "duck";

export const listCreatures = () => CREATURES;

export function getCreature(id) {
  return CREATURES.find((creature) => creature.id === id) ?? null;
}

// ?creature=<id> from a query string. A missing or empty parameter means the
// default creature; an id the registry does not know is reported back, so the
// Studio can say so and list what exists instead of silently showing Duck.
export function creatureFromSearch(search = "") {
  const requested = new URLSearchParams(search).get("creature")?.trim().toLowerCase() || null;
  const id = requested ?? DEFAULT_CREATURE_ID;
  const creature = getCreature(id);
  return { requested, id, creature, known: !!creature };
}

const joinUrl = (dir, file) => `${dir.replace(/\/+$/, "")}/${file.replace(/^\.?\/+/, "")}`;

// Where a creature's model files are, from its registry entry and the studio
// manifest that names them (manifest.model.glb / .kinematics are relative to
// the model directory).
export function creatureModelUrls(creature, manifest) {
  return {
    kinematics: joinUrl(creature.modelDir, manifest.model.kinematics),
    glb: joinUrl(creature.modelDir, manifest.model.glb),
  };
}
