import assert from "node:assert/strict";
import test from "node:test";
import { resolvePerformanceProfile } from "../src/native/performance-profile.js";

test("keeps the browser renderer unchanged", () => {
  assert.deepEqual(resolvePerformanceProfile(), {
    targetFps: null,
    maxDpr: 2,
    msaaSamples: 4,
    animateNoise: true,
    name: "web",
    native: false,
    suspended: false,
  });
});
test("runs the native nominal profile at a stable 60 fps", () => {
  const profile = resolvePerformanceProfile({ native: true });
  assert.equal(profile.targetFps, 60);
  assert.equal(profile.maxDpr, 1.5);
  assert.equal(profile.msaaSamples, 2);
  assert.equal(profile.suspended, false);
});

test("drops extra multisampling when thermal state becomes fair", () => {
  const profile = resolvePerformanceProfile({ native: true, thermalState: "fair" });
  assert.equal(profile.targetFps, 60);
  assert.equal(profile.maxDpr, 1.25);
  assert.equal(profile.msaaSamples, 0);
  assert.equal(profile.animateNoise, true);
});

test("reduces bandwidth and frame rate under power or thermal pressure", () => {
  for (const input of [
    { native: true, lowPowerMode: true },
    { native: true, thermalState: "serious" },
  ]) {
    const profile = resolvePerformanceProfile(input);
    assert.equal(profile.name, "constrained");
    assert.equal(profile.targetFps, 30);
    assert.equal(profile.maxDpr, 1);
    assert.equal(profile.msaaSamples, 0);
    assert.equal(profile.animateNoise, false);
  }
});

test("suspends work when hidden, inactive, or thermally critical", () => {
  assert.equal(resolvePerformanceProfile({ pageVisible: false }).suspended, true);
  assert.equal(resolvePerformanceProfile({ native: true, appActive: false }).suspended, true);
  assert.equal(resolvePerformanceProfile({ native: true, thermalState: "critical" }).suspended, true);
});
