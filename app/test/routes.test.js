import assert from "node:assert/strict";
import test from "node:test";
import { homeUrl, isSimulatorPath, isStudioRoute, simulatorUrl, studioUrl } from "../src/routes.js";
import { creatureFromSearch, getCreature, listCreatures } from "../src/creatures/index.js";

const at = (host, pathname = "/", search = "", protocol = "https:") => ({
  hostname: host.split(":")[0],
  host,
  pathname,
  search,
  protocol,
});

test("studio mode: ?studio=1 on any host and path", () => {
  assert.equal(isStudioRoute(at("localhost:5220", "/", "?studio=1")), true);
  assert.equal(isStudioRoute(at("localhost:5220", "/", "?studio=1&creature=duck")), true);
  assert.equal(isStudioRoute(at("librezoo.com", "/duck/sim/", "?studio=1")), true);
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/duck/sim/", "?studio=1")), true);
  assert.equal(isStudioRoute(at("localhost:5220", "/", "?studio=0")), false);
});

test("studio mode: studio.* hosts show the Studio except on simulator paths", () => {
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/")), true);
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/", "?creature=duck")), true);
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/index.html")), true);
  assert.equal(isStudioRoute(at("studio.localhost:5220", "/")), true);
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/duck/sim/")), false);
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/duck/sim/", "?boot=1&design=custom")), false);
  assert.equal(isStudioRoute(at("studio.librezoo.com", "/sim/")), false);
  assert.equal(isSimulatorPath(at("studio.librezoo.com", "/duck/sim/")), true);
  assert.equal(isSimulatorPath(at("studio.librezoo.com", "/")), false);
});

test("studio mode: a path ending in /studio/", () => {
  assert.equal(isStudioRoute(at("librezoo.com", "/studio/")), true);
  assert.equal(isStudioRoute(at("librezoo.com", "/studio")), true);
  assert.equal(isStudioRoute(at("localhost:5220", "/duck/studio/")), true);
  assert.equal(isStudioRoute(at("librezoo.com", "/studio/extra/")), false);
});

test("simulator mode everywhere else", () => {
  assert.equal(isStudioRoute(at("localhost:5220", "/")), false);
  assert.equal(isStudioRoute(at("127.0.0.1:5220", "/", "?boot=1")), false);
  assert.equal(isStudioRoute(at("librezoo.com", "/duck/sim/")), false);
  assert.equal(isStudioRoute(at("duck.librezoo.com", "/sim/")), false);
  // a host that merely contains "studio" is not a studio host
  assert.equal(isStudioRoute(at("mystudio.librezoo.com", "/")), false);
  assert.equal(isStudioRoute(at("librezoo.com", "/")), false);
});

test("studioUrl from every place the page can be", () => {
  // local development
  assert.equal(studioUrl(undefined, at("localhost:5220", "/")), "?studio=1");
  assert.equal(studioUrl("duck", at("localhost:5220", "/")), "?studio=1&creature=duck");
  // the simulator deployed at /duck/sim/ (or /sim/): the relative sibling
  assert.equal(studioUrl(undefined, at("librezoo.com", "/duck/sim/")), "../../studio/");
  assert.equal(studioUrl("duck", at("librezoo.com", "/duck/sim/")), "../../studio/?creature=duck");
  assert.equal(studioUrl(undefined, at("librezoo.com", "/duck/sim/index.html")), "../../studio/");
  assert.equal(studioUrl(undefined, at("duck.librezoo.com", "/sim/")), "../../studio/");
  // on the studio host the Studio is "/"
  assert.equal(studioUrl(undefined, at("studio.librezoo.com", "/")), "/");
  assert.equal(studioUrl("duck", at("studio.librezoo.com", "/")), "/?creature=duck");
  assert.equal(studioUrl(undefined, at("studio.librezoo.com", "/duck/sim/")), "/");
  // ids are encoded
  assert.equal(studioUrl("a b", at("studio.librezoo.com", "/")), "/?creature=a%20b");
});

test("simulatorUrl from every place the page can be", () => {
  const design = { design: true };
  assert.equal(simulatorUrl({}, at("localhost:5220", "/", "?studio=1")), "./");
  assert.equal(simulatorUrl(design, at("localhost:5220", "/", "?studio=1")), "./?boot=1&design=custom");
  assert.equal(simulatorUrl(design, at("librezoo.com", "/duck/sim/")), "./?boot=1&design=custom");
  // the studio host serves the simulator at /<creature>/sim/, same origin
  assert.equal(simulatorUrl({}, at("studio.librezoo.com", "/")), "/duck/sim/");
  assert.equal(simulatorUrl(design, at("studio.librezoo.com", "/")), "/duck/sim/?boot=1&design=custom");
  assert.equal(simulatorUrl({ design: true, creature: "owl" }, at("studio.librezoo.com", "/")), "/owl/sim/?boot=1&design=custom");
  assert.equal(simulatorUrl(design, at("studio.localhost:5220", "/")), "/duck/sim/?boot=1&design=custom");
  // a Studio at /studio/ must not link to itself
  assert.equal(simulatorUrl(design, at("librezoo.com", "/studio/")), "../duck/sim/?boot=1&design=custom");
});

test("homeUrl: the apex of the studio host, the simulator elsewhere", () => {
  assert.equal(homeUrl(at("studio.librezoo.com", "/")), "https://librezoo.com/");
  assert.equal(homeUrl(at("studio.localhost:5220", "/", "", "http:")), "http://localhost:5220/");
  assert.equal(homeUrl(at("localhost:5220", "/", "?studio=1")), "./");
});

test("the registry lists Duck first and resolves ?creature=", () => {
  assert.equal(listCreatures()[0].id, "duck");
  assert.equal(getCreature("duck").studioManifest, "./robot/librezoo/studio.json");
  assert.equal(getCreature("nope"), null);

  assert.deepEqual(
    (({ id, known }) => ({ id, known }))(creatureFromSearch("")),
    { id: "duck", known: true },
  );
  assert.deepEqual(
    (({ id, known }) => ({ id, known }))(creatureFromSearch("?studio=1&creature=duck")),
    { id: "duck", known: true },
  );
  const unknown = creatureFromSearch("?creature=Heron");
  assert.equal(unknown.known, false);
  assert.equal(unknown.requested, "heron");
  assert.equal(unknown.creature, null);
  // empty value falls back to the default
  assert.equal(creatureFromSearch("?creature=").id, "duck");
});
