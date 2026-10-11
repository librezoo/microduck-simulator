// URL routing shared by the simulator and LibreZoo Studio.
//
//   deployed                                       local dev
//   https://studio.librezoo.com/                   /?studio=1            Studio
//   https://studio.librezoo.com/duck/sim/          /                     simulator
//   https://librezoo.com/duck/sim/  (container)
//
// The same build serves every row. Asset URLs stay relative (vite base "./"),
// so the bundle works at "/", under "/duck/sim/" and on the studio host at "/".
// The Studio and the simulator it launches share an origin on the studio host,
// which is what lets the saved design (localStorage) travel between them.
//
// All helpers take the location to look at (default: the live one) so the
// rules can be tested for every host/path combination without a browser.
import { DEFAULT_CREATURE_ID } from "./creatures/index.js";

const live = () => globalThis.location;

export const isStudioHost = (loc = live()) => /^studio\./i.test(loc?.hostname ?? "");

// Any path with a "/sim" segment is a simulator path ("/sim/", "/duck/sim/").
export const isSimulatorPath = (loc = live()) => (loc?.pathname ?? "/").includes("/sim");

const isStudioPath = (loc = live()) => /\/studio(\/(index\.html)?)?$/.test(loc?.pathname ?? "/");
const endsInSim = (loc = live()) => /\/sim(\/(index\.html)?)?$/.test(loc?.pathname ?? "/");

// Studio mode when (a) ?studio=1, (b) a studio.* host and not a simulator
// path, or (c) the path ends in /studio/.
export function isStudioRoute(loc = live()) {
  if (new URLSearchParams(loc?.search ?? "").get("studio") === "1") return true;
  if (isStudioHost(loc)) return !isSimulatorPath(loc);
  return isStudioPath(loc);
}

const withQuery = (base, query) => (query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base);

// Where the Studio is, seen from the current page. An explicit creature id is
// carried as ?creature=<id>; without one the Studio opens its default.
export function studioUrl(creatureId, loc = live()) {
  const creature = creatureId ? `creature=${encodeURIComponent(creatureId)}` : "";
  if (isStudioHost(loc)) return withQuery("/", creature);
  // The deployed simulator lives at /<creature>/sim/; the Studio is the
  // sibling "studio/" at the site root, which the operator sends to the host.
  if (endsInSim(loc)) return withQuery("../../studio/", creature);
  return withQuery("?studio=1", creature);
}

// Where the simulator is. { design: true } asks it to boot straight into the
// design saved by the Studio (?boot=1&design=custom).
export function simulatorUrl({ design = false, creature = DEFAULT_CREATURE_ID } = {}, loc = live()) {
  const query = design ? "?boot=1&design=custom" : "";
  if (isStudioHost(loc)) return `/${creature}/sim/${query}`;
  if (isStudioPath(loc)) return `../${creature}/sim/${query}`;
  return `./${query}`;
}

// The LibreZoo home for the lockup: the apex of a studio.* host, otherwise
// the simulator this page was reached from.
export function homeUrl(loc = live()) {
  if (isStudioHost(loc)) return `${loc.protocol}//${loc.host.replace(/^studio\./i, "")}/`;
  return simulatorUrl({}, loc);
}
