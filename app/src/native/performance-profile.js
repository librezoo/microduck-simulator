const WEB = Object.freeze({
  targetFps: null,
  maxDpr: 2,
  msaaSamples: 4,
  animateNoise: true,
});

const NATIVE = Object.freeze({
  nominal: Object.freeze({ targetFps: 60, maxDpr: 1.5, msaaSamples: 2, animateNoise: true }),
  fair: Object.freeze({ targetFps: 60, maxDpr: 1.25, msaaSamples: 0, animateNoise: true }),
  constrained: Object.freeze({ targetFps: 30, maxDpr: 1, msaaSamples: 0, animateNoise: false }),
});

const THERMAL_STATES = new Set(["nominal", "fair", "serious", "critical"]);

export function resolvePerformanceProfile({
  native = false,
  thermalState = "nominal",
  lowPowerMode = false,
  appActive = true,
  pageVisible = true,
} = {}) {
  const thermal = THERMAL_STATES.has(thermalState) ? thermalState : "nominal";
  const suspended = !appActive || !pageVisible || thermal === "critical";

  if (!native) {
    return { ...WEB, name: "web", native: false, suspended };
  }

  const constrained = lowPowerMode || thermal === "serious" || thermal === "critical";
  const name = constrained ? "constrained" : thermal;
  const settings = constrained ? NATIVE.constrained : NATIVE[name];
  return { ...settings, name, native: true, suspended };
}
