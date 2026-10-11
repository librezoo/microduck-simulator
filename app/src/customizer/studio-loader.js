import { MESH_VERSION } from "../game/mesh-version.js";
import { signed } from "../game/signed.js";
import { parseStudioManifest } from "./studio-manifest.js";
import { createStudioParts } from "./studio-parts.js";

// Fetches and checks a creature's studio manifest (see docs/adding-a-creature.md)
// and returns the lookup tables the Studio runs on. The version query is the
// same cache-buster the model files carry.
export async function loadStudio(creature, { signal } = {}) {
  const response = await fetch(signed(`${creature.studioManifest}?v=${MESH_VERSION}`), { signal });
  if (!response.ok) throw new Error(`${creature.studioManifest}: HTTP ${response.status}`);
  const raw = await response.json();
  return createStudioParts(parseStudioManifest(raw));
}
