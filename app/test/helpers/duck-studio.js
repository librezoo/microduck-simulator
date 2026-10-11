import { readFileSync } from "node:fs";
import { parseStudioManifest } from "../../src/customizer/studio-manifest.js";
import { createStudioParts } from "../../src/customizer/studio-parts.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

// The generated manifest, exactly what the browser fetches.
export const duckManifestRaw = () => read("../../public/robot/librezoo/studio.json");
export const duckKinematics = () => read("../../public/robot/librezoo/kinematics.json");
export const duckLegacy = () => read("../fixtures/duck-studio-legacy.json");
export const duckStudio = () => createStudioParts(parseStudioManifest(duckManifestRaw()));
