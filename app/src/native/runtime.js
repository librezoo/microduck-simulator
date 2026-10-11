import { resolvePerformanceProfile } from "./performance-profile.js";

const params = new URLSearchParams(location.search);
const injected = window.__MICRODUCK_NATIVE__ ?? {};
const native = injected.enabled === true || params.get("native") === "1";
const listeners = new Set();

let input = {
  native,
  thermalState: injected.thermalState ?? "nominal",
  lowPowerMode: injected.lowPowerMode === true,
  appActive: injected.appActive !== false,
  pageVisible: document.visibilityState !== "hidden",
};
let profile = resolvePerformanceProfile(input);

function publish(next) {
  input = { ...input, ...next, native };
  const resolved = resolvePerformanceProfile(input);
  if (JSON.stringify(resolved) === JSON.stringify(profile)) return;
  profile = resolved;
  document.documentElement.dataset.performanceProfile = profile.name;
  for (const listener of listeners) listener();
}

export function getPerformanceProfile() {
  return profile;
}

export function subscribePerformanceProfile(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function postNative(message) {
  if (!native) return;
  try {
    window.webkit?.messageHandlers?.microduck?.postMessage(message);
  } catch (error) {
    console.warn("native bridge unavailable", error);
  }
}

export function initializeNativeRuntime() {
  document.documentElement.dataset.performanceProfile = profile.name;
  if (!native) return;

  document.title = "Zoo Kinder — by LibreZoo";
  window.__microduckNativeUpdate = (next = {}) => publish(next);
  postNative({
    type: "ready",
    capabilities: {
      secureContext: window.isSecureContext,
      webgpu: "gpu" in navigator,
      webgl2: Boolean(document.createElement("canvas").getContext("webgl2")),
      wasm: typeof WebAssembly === "object",
    },
  });
}

document.addEventListener("visibilitychange", () => {
  publish({ pageVisible: document.visibilityState !== "hidden" });
});
window.addEventListener("pagehide", () => publish({ pageVisible: false }));
window.addEventListener("pageshow", () => publish({ pageVisible: true }));
